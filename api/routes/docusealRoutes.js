const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const logger = require('../utils/logger');
const DocuSealService = require('../DocuSealService');
const DocuSealVorgang = require('../models/DocuSealVorgang');
const R2Service = require('../R2Service');
const User = require('../models/User');
const Auftrag = require('../models/Auftrag');
const Kunde = require('../models/Kunde');
const StundenlisteService = require('../StundenlisteService');

const router = express.Router();

const WEBHOOK_SECRET = process.env.DOCUSEAL_WEBHOOK_SECRET;

// SSE: track connected admin clients
const sseClients = new Set();

function broadcastDocuSealEvent(type, payload) {
  const msg = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (_) { sseClients.delete(res); }
  }
}

/**
 * Ensure the requesting user has the ADMIN role.
 * Returns the user document, or sends a 403 and returns null.
 */
async function requireAdmin(req, res) {
  const adminUser = await User.findById(req.user.id).select('role roles');
  const isAdmin = !!adminUser && (adminUser.roles?.includes('ADMIN') || adminUser.role === 'ADMIN');
  if (!isAdmin) {
    res.status(403).json({ message: 'Zugriff verweigert – nur für Admins' });
    return null;
  }
  return adminUser;
}


/**
 * Verify a DocuSeal webhook request.
 *
 * DocuSeal does not HMAC-sign webhooks by default, so we authenticate via a
 * shared secret. Configure DocuSeal to send it either as a custom header
 * (`X-Docuseal-Secret`) or as a query param (`?secret=...`) on the webhook URL.
 */
function verifyDocuSealWebhook(req, res, next) {
  if (!WEBHOOK_SECRET) {
    logger.error('DocuSeal webhook rejected: DOCUSEAL_WEBHOOK_SECRET is not configured.');
    return res.status(500).send('Webhook secret not configured');
  }

  const provided = req.header('X-Docuseal-Secret') || req.query.secret || '';
  const a = Buffer.from(String(provided), 'utf8');
  const b = Buffer.from(WEBHOOK_SECRET, 'utf8');
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    logger.warn('DocuSeal webhook rejected: invalid secret.');
    return res.status(401).send('Invalid secret');
  }
  next();
}

/**
 * Map a DocuSeal submitter result onto our stored submitter shape.
 */
function mapSubmitter(apiSubmitter, requested) {
  return {
    role:     apiSubmitter.role || requested.role || '',
    name:     apiSubmitter.name || requested.name || '',
    email:    apiSubmitter.email || requested.email || '',
    slug:     apiSubmitter.slug || '',
    embedSrc: apiSubmitter.embed_src || '',
    embedded: !!requested.embedded,
    status:   apiSubmitter.status || 'awaiting',
    completedAt: apiSubmitter.completed_at ? new Date(apiSubmitter.completed_at) : null,
  };
}

// GET /api/docuseal/events — SSE stream for real-time submission updates (token in query)
router.get('/events', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'Kein Token übergeben' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Ungültiger Token' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// GET /api/docuseal/templates — list dashboard templates for the create-request UI
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const { limit, q } = req.query;
  const params = {};
  if (limit) params.limit = Number(limit);
  if (q) params.q = q;

  const result = await DocuSealService.listTemplates(params);
  res.json(result.data || result);
}));

// GET /api/docuseal/submissions — list local signing requests
router.get('/', auth, asyncHandler(async (req, res) => {
  const vorgaenge = await DocuSealVorgang.find().sort({ createdAt: -1 }).limit(200);
  res.json(vorgaenge);
}));

// POST /api/docuseal/submissions — create a signature request
// Body: { name, templateId, templateName?, order?, linkedEntity?, submitters: [{ role, name, email, embedded }] }
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, templateId, templateName, order, linkedEntity, submitters } = req.body;

  if (!name) return res.status(400).json({ message: 'name ist erforderlich' });
  if (!templateId) return res.status(400).json({ message: 'templateId ist erforderlich' });
  if (!Array.isArray(submitters) || submitters.length === 0) {
    return res.status(400).json({ message: 'Mindestens ein Unterzeichner ist erforderlich' });
  }

  // Embedded signers (our employees) sign inside the app → suppress DocuSeal emails.
  const apiSubmitters = submitters.map((s) => ({
    role:  s.role,
    name:  s.name,
    email: s.email,
    send_email: s.embedded ? false : true,
  }));

  const result = await DocuSealService.createSubmission({
    templateId: Number(templateId),
    submitters: apiSubmitters,
    order: order === 'random' ? 'random' : 'preserved',
  });

  const submissionId = Array.isArray(result) && result.length ? result[0].submission_id : undefined;

  // Match API results back to requested submitters (by email, then role).
  const storedSubmitters = (Array.isArray(result) ? result : []).map((apiSub) => {
    const requested = submitters.find(
      (s) => (s.email && s.email === apiSub.email) || s.role === apiSub.role
    ) || {};
    return mapSubmitter(apiSub, requested);
  });

  const vorgang = new DocuSealVorgang({
    name,
    docusealTemplateId: Number(templateId),
    docusealTemplateName: templateName || '',
    submissionId,
    linkedEntity: linkedEntity && linkedEntity.type
      ? { type: linkedEntity.type, refId: linkedEntity.refId || null }
      : { type: null, refId: null },
    submitters: storedSubmitters,
    status: 'pending',
    createdBy: req.user && req.user.id,
  });
  await vorgang.save();

  res.status(201).json(vorgang);
}));

// GET /api/docuseal/stundenliste/:auftragNr/signers — resolve default signers (ADMIN)
// Returns the customer (Entleiher) + location-based Verleiher so the UI can
// pre-fill the signature dialog. Microsoft contacts are loaded separately by
// the frontend via /api/graph/contacts (filtered by Kunde-Kürzel).
router.get('/stundenliste/:auftragNr/signers', auth, asyncHandler(async (req, res) => {
  if (!await requireAdmin(req, res)) return;

  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) {
    return res.status(400).json({ message: 'Ungültige Auftragsnummer' });
  }

  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: `Auftrag ${auftragNr} nicht gefunden` });

  const kunde = auftrag.kundenNr
    ? await Kunde.findOne({ kundenNr: auftrag.kundenNr }).lean()
    : null;

  const verleiher = StundenlisteService.getVerleiherSigner(auftrag);

  res.json({
    auftragNr,
    eventTitel: auftrag.eventTitel || '',
    kunde: kunde
      ? { _id: kunde._id, kundenNr: kunde.kundenNr, kundName: kunde.kundName, kuerzel: kunde.kuerzel || '' }
      : null,
    verleiher,
  });
}));

// POST /api/docuseal/stundenliste/:auftragNr — generate the Stundenliste PDF and
// send it for signature (Verleiher embedded, Entleiher via email). (ADMIN)
// Body: { entleiher: { name, email }, verleiher?: { name, email } }
router.post('/stundenliste/:auftragNr', auth, asyncHandler(async (req, res) => {
  if (!await requireAdmin(req, res)) return;

  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) {
    return res.status(400).json({ message: 'Ungültige Auftragsnummer' });
  }

  const { entleiher, verleiher } = req.body || {};
  if (!entleiher || !entleiher.email) {
    return res.status(400).json({ message: 'Entleiher (E-Mail) ist erforderlich' });
  }

  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: `Auftrag ${auftragNr} nicht gefunden` });

  const kunde = auftrag.kundenNr
    ? await Kunde.findOne({ kundenNr: auftrag.kundenNr }).lean()
    : null;

  // Resolve the Verleiher signer (location-based) unless overridden by the request.
  const verleiherDefault = StundenlisteService.getVerleiherSigner(auftrag);
  const verleiherSigner = {
    name:  (verleiher && verleiher.name) || verleiherDefault.name,
    email: (verleiher && verleiher.email) || verleiherDefault.email,
  };
  if (!verleiherSigner.email) {
    return res.status(400).json({ message: 'Verleiher-E-Mail konnte nicht ermittelt werden (geschSt/Niederlassung prüfen)' });
  }

  // Build the PDF with embedded DocuSeal signature text tags.
  const { buffer } = await StundenlisteService.buildStundenliste(auftragNr, { signatureTags: true });

  const docName = `Stundenliste ${auftragNr}`;
  const requestedSubmitters = [
    { role: 'Verleiher', name: verleiherSigner.name, email: verleiherSigner.email, embedded: true },
    { role: 'Entleiher', name: entleiher.name || (kunde && kunde.kundName) || '', email: entleiher.email, embedded: false },
  ];

  // We are creating the submission, but we do NOT send any emails via DocuSeal, 
  // because we handle that via our GRAPH Mail integration
  const apiSubmitters = requestedSubmitters.map((s) => ({
    role: s.role,
    name: s.name,
    email: s.email,
    send_email: false,
  }));

  const result = await DocuSealService.createSubmissionFromPdf({
    name: docName,
    fileBuffer: buffer,
    submitters: apiSubmitters,
    order: 'preserved',
  });

  logger.info(`[Stundenliste ${auftragNr}] Raw DocuSeal result type=${Array.isArray(result) ? 'array' : typeof result}:`, JSON.stringify(result, null, 2));

  // createSubmissionFromPdf may return either a flat array of submitters (like createSubmission)
  // or an object like { id, submitters: [...] } — normalise to a flat array.
  const resultSubmitters = Array.isArray(result)
    ? result
    : (result?.submitters || (result?.id ? [result] : []));

  const submissionId = resultSubmitters.length ? resultSubmitters[0].submission_id ?? result?.id : undefined;

  const storedSubmitters = resultSubmitters.map((apiSub) => {
    const requested = requestedSubmitters.find(
      (s) => (s.email && s.email === apiSub.email) || s.role === apiSub.role
    ) || {};
    return mapSubmitter(apiSub, requested);
  });

  const vorgang = new DocuSealVorgang({
    name: docName,
    docusealTemplateName: 'Stundenliste (PDF)',
    submissionId,
    auftragNr,
    kundenNr: auftrag.kundenNr || null,
    linkedEntity: kunde ? { type: 'Kunde', refId: kunde._id } : { type: 'Auftrag', refId: null },
    submitters: storedSubmitters,
    status: 'pending',
    createdBy: req.user && req.user.id,
  });
  await vorgang.save();

  // Custom Graph Email Dispatching
  // Find external submitters (like Entleiher) that are not embedded in the UI
  const { sendMail } = require('../EmailService');
  logger.info(`[Stundenliste ${auftragNr}] storedSubmitters after DocuSeal response:`, JSON.stringify(storedSubmitters, null, 2));
  for (const apiSub of storedSubmitters) {
    logger.info(`[Stundenliste ${auftragNr}] Checking submitter for email: role=${apiSub.role}, email=${apiSub.email}, embedded=${apiSub.embedded}, slug=${apiSub.slug || '(empty)'}`);
    if (!apiSub.embedded && apiSub.slug) {
      const signingLink = apiSub.embedSrc || `https://docuseal.eu/s/${apiSub.slug}`;
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="font-weight: bold; color: #000;">Ihre Stundenliste ist bereit zur Unterschrift</h2>
          <p>Bitte klicken Sie auf den untenstehenden Link, um die Stundenliste für Auftrag ${auftragNr} zu überprüfen und zu unterschreiben.</p>
          <a href="${signingLink}" style="display:inline-block; padding:10px 15px; color:#fff; background-color:#E36125; text-decoration:none; border-radius:4px; margin-top:20px;">
            Dokument unterschreiben
          </a>
        </div>
      `;
      // Use the actual entleiher email (not the DocuSeal-stored one which may be a test address)
      const recipientEmail = requestedSubmitters.find((s) => s.role === apiSub.role)?.email || apiSub.email;
      logger.info(`[Stundenliste ${auftragNr}] Attempting to send e-mail to ${recipientEmail} with signing link ${signingLink}`);
      try {
        await sendMail(recipientEmail, `Ihre Stundenliste für Auftrag ${auftragNr}`, emailContent, "it");
        logger.info(`[Stundenliste ${auftragNr}] E-mail successfully dispatched to ${recipientEmail}`);
      } catch (err) {
        logger.error(`Could not send custom e-mail to ${recipientEmail}:`, err);
      }
    } else {
      logger.warn(`[Stundenliste ${auftragNr}] Skipping email for submitter role=${apiSub.role}: embedded=${apiSub.embedded}, slug present=${!!apiSub.slug}`);
    }
  }

  // Surface the embedded Verleiher signing URL so the UI can show the form.
  const verleiherSubmitter = storedSubmitters.find((s) => s.role === 'Verleiher');

  res.status(201).json({
    vorgang,
    embed: verleiherSubmitter
      ? { role: 'Verleiher', slug: verleiherSubmitter.slug, src: verleiherSubmitter.embedSrc }
      : null,
  });
}));

// GET /api/docuseal/:id/signed-url — return a presigned R2 URL to open the PDF inline
router.get('/:id/signed-url', auth, asyncHandler(async (req, res) => {
  const vorgang = await DocuSealVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  if (!vorgang.signedPdfKey) {
    return res.status(409).json({ message: 'Noch kein unterschriebenes Dokument vorhanden' });
  }
  const safeName = vorgang.name.replace(/[^a-z0-9_\- ]/gi, '_') + '.pdf';
  const url = await R2Service.getSignedDownloadUrl(vorgang.signedPdfKey, 3600, { inline: true, filename: safeName });
  res.json({ url });
}));

// GET /api/docuseal/submissions/:id — local record, optionally refreshed from DocuSeal
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await DocuSealVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  if (req.query.refresh === 'true' && vorgang.submissionId) {
    try {
      const submission = await DocuSealService.getSubmission(vorgang.submissionId);
      if (submission && Array.isArray(submission.submitters)) {
        vorgang.submitters = vorgang.submitters.map((local) => {
          const live = submission.submitters.find((s) => s.slug === local.slug || s.email === local.email);
          if (live) {
            local.status = live.status || local.status;
            local.completedAt = live.completed_at ? new Date(live.completed_at) : local.completedAt;
          }
          return local;
        });
        if (submission.status === 'completed') vorgang.status = 'completed';
        await vorgang.save();
      }
    } catch (err) {
      logger.warn(`DocuSeal refresh failed for submission ${vorgang.submissionId}:`, err.message);
    }
  }

  res.json(vorgang);
}));

// GET /api/docuseal/submissions/:id/signed — stream the signed PDF from R2
router.get('/:id/signed', auth, asyncHandler(async (req, res) => {
  const vorgang = await DocuSealVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  if (!vorgang.signedPdfKey) {
    return res.status(409).json({ message: 'Noch kein unterschriebenes Dokument vorhanden' });
  }

  const safeName = vorgang.name.replace(/[^a-z0-9_\-]/gi, '_');
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
  });

  try {
    const buffer = await R2Service.downloadFile(vorgang.signedPdfKey);
    return res.send(buffer);
  } catch (err) {
    logger.error(`Error downloading signed PDF from R2 (key: ${vorgang.signedPdfKey}):`, err);
    return res.status(500).json({ message: 'Fehler beim Laden des Dokuments' });
  }
}));

// DELETE /api/docuseal/submissions/:id — archive in DocuSeal + mark archived locally
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await DocuSealVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  if (vorgang.submissionId) {
    try {
      await DocuSealService.archiveSubmission(vorgang.submissionId);
    } catch (err) {
      logger.warn(`DocuSeal archive failed for submission ${vorgang.submissionId}:`, err.message);
    }
  }

  vorgang.status = 'archived';
  await vorgang.save();
  res.json({ message: 'Vorgang archiviert', vorgang });
}));

// POST /api/docuseal/webhook — receive submission / form events
router.post('/webhook', verifyDocuSealWebhook, asyncHandler(async (req, res) => {
  // Acknowledge immediately; process afterwards.
  res.sendStatus(200);

  const { event_type: eventType, data } = req.body || {};
  if (!eventType || !data) return;

  const submissionId = data.submission_id || data.id;
  if (!submissionId) return;

  const vorgang = await DocuSealVorgang.findOne({ submissionId });
  if (!vorgang) {
    logger.warn(`DocuSeal webhook: no local Vorgang for submission ${submissionId} (${eventType}).`);
    return;
  }

  // Update individual submitter status on form-level events.
  if (data.email || data.slug) {
    vorgang.submitters = vorgang.submitters.map((s) => {
      if ((data.slug && s.slug === data.slug) || (data.email && s.email === data.email)) {
        s.status = data.status || s.status;
        if (eventType === 'form.completed') {
          s.status = 'completed';
          s.completedAt = new Date();
        }
      }
      return s;
    });
  }

  if (eventType === 'submission.completed') {
    vorgang.status = 'completed';
    vorgang.completedAt = new Date();
    if (data.audit_log_url) vorgang.auditLogUrl = data.audit_log_url;
    try {
      const r2Prefix = vorgang.kundenNr
        ? `docuseal/kunden/${vorgang.kundenNr}/${vorgang._id}`
        : `docuseal/${vorgang._id}`;
      const stored = await DocuSealService.storeSignedPdf(submissionId, r2Prefix);
      if (stored) vorgang.signedPdfKey = stored.key;
    } catch (err) {
      logger.error(`DocuSeal: failed to store signed PDF for submission ${submissionId}:`, err.message);
    }
  } else if (eventType === 'submission.expired') {
    vorgang.status = 'expired';
  } else if (eventType === 'submission.archived') {
    vorgang.status = 'archived';
  }

  await vorgang.save();
  logger.info(`DocuSeal webhook processed: ${eventType} for submission ${submissionId}.`);

  // Push update to all connected admin SSE clients
  broadcastDocuSealEvent('vorgang.updated', vorgang.toObject());
}));

module.exports = router;
