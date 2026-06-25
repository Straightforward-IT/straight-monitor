const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const logger = require('../utils/logger');
const DocuSealService = require('../DocuSealService');
const SignaturVorgang = require('../models/SignaturVorgang');
const SignaturTyp = require('../models/SignaturTyp');
const Mitarbeiter = require('../models/Mitarbeiter');
const Kunde = require('../models/Kunde');
const R2Service = require('../R2Service');
const User = require('../models/User');
const Auftrag = require('../models/Auftrag');
const StundenlisteService = require('../StundenlisteService');
const { sendMail } = require('../EmailService');
const { buildSignaturR2Prefix } = require('../utils/signaturR2Path');

const router = express.Router();

const WEBHOOK_SECRET = process.env.DOCUSEAL_WEBHOOK_SECRET;

// SSE clients for real-time updates to connected UI sessions
const sseClients = new Set();

function broadcastSignaturEvent(type, payload) {
  const msg = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (_) { sseClients.delete(res); }
  }
}

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
 * Verify a DocuSeal webhook via shared secret.
 * DocuSeal sends the secret in X-Docuseal-Secret header or ?secret= query param.
 */
function verifyDocuSealWebhook(req, res, next) {
  if (!WEBHOOK_SECRET) {
    logger.error('SignaturRoutes: DOCUSEAL_WEBHOOK_SECRET is not configured.');
    return res.status(500).send('Webhook secret not configured');
  }
  const provided = req.header('X-Docuseal-Secret') || req.query.secret || '';
  const a = Buffer.from(String(provided), 'utf8');
  const b = Buffer.from(WEBHOOK_SECRET, 'utf8');
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    logger.warn('SignaturRoutes: webhook rejected — invalid secret.');
    return res.status(401).send('Invalid secret');
  }
  next();
}

/**
 * Map a DocuSeal API submitter onto our stored SubmitterSchema shape.
 */
function mapSubmitter(apiSubmitter, requested = {}) {
  return {
    role:        apiSubmitter.role      || requested.role      || '',
    name:        apiSubmitter.name      || requested.name      || '',
    email:       apiSubmitter.email     || requested.email     || '',
    slug:        apiSubmitter.slug      || '',
    embedSrc:    apiSubmitter.embed_src || '',
    embedded:    !!requested.embedded,
    status:      apiSubmitter.status    || 'awaiting',
    completedAt: apiSubmitter.completed_at ? new Date(apiSubmitter.completed_at) : null,
  };
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

// GET /api/signaturen/events — real-time updates (token passed as query param)
router.get('/events', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'Kein Token übergeben' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ message: 'Ungültiger Token' });
  }

  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ─── DOCUSEAL FORM BUILDER TOKEN ────────────────────────────────────────────────

// GET /api/signaturen/builder-token?templateId=xxx&name=yyy
// Returns a JWT (HS256, signed with the DocuSeal API key) authorising the embedded
// DocuSeal form builder (<DocusealBuilder>) for the current user.
// The JWT MUST be generated on the backend so the API key never reaches the client.
router.get('/builder-token', auth, asyncHandler(async (req, res) => {
  const apiKey = process.env.DOCUSEAL_API_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ message: 'DocuSeal ist nicht konfiguriert (DOCUSEAL_API_TOKEN fehlt).' });
  }

  // user_email must be the owner of the API signing key (admin account in DocuSeal).
  const ownerEmail = process.env.DOCUSEAL_USER_EMAIL || process.env.DOCUSEAL_ADMIN_EMAIL;
  if (!ownerEmail) {
    return res.status(500).json({ message: 'DOCUSEAL_USER_EMAIL ist nicht gesetzt.' });
  }

  const user = await User.findById(req.user.id).select('email name');

  const payload = {
    user_email: ownerEmail,
    // integration_email lets DocuSeal scope the template to the acting user.
    integration_email: (user && user.email) || ownerEmail,
  };

  const templateId = req.query.templateId ? Number(req.query.templateId) : null;
  if (templateId) {
    payload.template_id = templateId;
  } else {
    // New template — name is required so DocuSeal knows what to create.
    payload.name = req.query.name || 'Neue Vorlage';
  }

  const token = jwt.sign(payload, apiKey);
  res.json({ token });
}));

// ─── STUNDENLISTE (PDF-generation flow) ──────────────────────────────────────

// POST /api/signaturen/stundenliste/:auftragNr
// Generates the Stundenliste PDF server-side, creates a DocuSeal submission from
// the PDF, and saves the result as a SignaturVorgang (the new hub model).
// Body (from SignaturNeuModal customEndpoint): { standort?, submitters:[{role,name,email,embedded}] }
// Response: { vorgang, embed: { role, slug, src } }
router.post('/stundenliste/:auftragNr', auth, asyncHandler(async (req, res) => {
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) {
    return res.status(400).json({ message: 'Ungültige Auftragsnummer' });
  }

  const { standort, submitters } = req.body || {};

  // Resolve submitters: the modal sends a generic submitters array.
  if (!Array.isArray(submitters) || !submitters.length) {
    return res.status(400).json({ message: 'submitters ist erforderlich' });
  }

  const entleiherReq = submitters.find((s) => s.role === 'Entleiher') || submitters.find((s) => !s.embedded);
  const verleiherReq = submitters.find((s) => s.role === 'Verleiher') || submitters.find((s) => s.embedded);

  if (!entleiherReq || !entleiherReq.email) {
    return res.status(400).json({ message: 'Entleiher (E-Mail) ist erforderlich' });
  }

  // Load Auftrag + Kunde
  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: `Auftrag ${auftragNr} nicht gefunden` });

  const kunde = auftrag.kundenNr
    ? await Kunde.findOne({ kundenNr: auftrag.kundenNr }).select('_id kundenNr kundName kuerzel').lean()
    : null;

  // Resolve the Stundenliste type
  const signaturTyp = await SignaturTyp.findOne({ key: 'stundenliste', isActive: true });
  if (!signaturTyp) {
    return res.status(400).json({ message: 'Signaturtyp "stundenliste" nicht gefunden – bitte Seed-Skript ausführen.' });
  }

  // Verleiher: use request override or derive from Auftrag location
  const verleiherDefault = StundenlisteService.getVerleiherSigner(auftrag);
  const verleiherSigner = {
    name:  (verleiherReq && verleiherReq.name)  || verleiherDefault.name,
    email: (verleiherReq && verleiherReq.email) || verleiherDefault.email,
  };
  if (!verleiherSigner.email) {
    return res.status(400).json({
      message: 'Verleiher-E-Mail konnte nicht ermittelt werden (geschSt/Niederlassung prüfen)',
    });
  }

  // Build the PDF with embedded DocuSeal text-tag fields
  const { buffer } = await StundenlisteService.buildStundenliste(auftragNr, { signatureTags: true });

  const docName = `Stundenliste ${auftragNr}`;

  const requestedSubmitters = [
    { role: 'Verleiher', name: verleiherSigner.name, email: verleiherSigner.email, embedded: true },
    { role: 'Entleiher', name: entleiherReq.name || (kunde && kunde.kundName) || '', email: entleiherReq.email, embedded: false },
  ];

  // Create DocuSeal submission from the generated PDF
  const result = await DocuSealService.createSubmissionFromPdf({
    name: docName,
    fileBuffer: buffer,
    submitters: requestedSubmitters.map((s) => ({
      role:       s.role,
      name:       s.name,
      email:      s.email,
      send_email: false, // handled via Graph Mail below
    })),
    order: 'preserved',
  });

  logger.info(`[SignaturenRoute Stundenliste ${auftragNr}] DocuSeal result:`, JSON.stringify(result));

  const resultArr = Array.isArray(result)
    ? result
    : (result?.submitters || (result?.id ? [result] : []));

  const submissionId = resultArr.length ? (resultArr[0].submission_id ?? result?.id) : undefined;

  const storedSubmitters = resultArr.map((apiSub) => {
    const req = requestedSubmitters.find(
      (s) => (s.email && s.email === apiSub.email) || s.role === apiSub.role
    ) || {};
    return mapSubmitter(apiSub, req);
  });

  // Build R2 prefix using the new path scheme
  const r2Prefix = buildSignaturR2Prefix({
    entityType: kunde ? 'Kunde' : null,
    entityIdentifier: kunde ? kunde.kuerzel : null,
    typKey: 'stundenliste',
  });

  // Save as a SignaturVorgang
  const vorgang = new SignaturVorgang({
    name:     docName,
    typ:      signaturTyp._id,
    typKey:   'stundenliste',
    standort: standort || null,
    status:   'open',
    auftragNr,

    kunde:         kunde ? kunde._id   : null,
    kundenNr:      kunde ? kunde.kundenNr : null,
    kundenKuerzel: kunde ? kunde.kuerzel  : null,

    docusealTemplateName: 'Stundenliste (PDF)',
    submissionId,
    submitters: storedSubmitters,
    r2Prefix,

    createdBy: req.user.id,
  });
  await vorgang.save();
  await vorgang.populate('typ', 'key label linkedTo');

  // Send Graph email to the non-embedded Entleiher
  for (const apiSub of storedSubmitters) {
    if (!apiSub.embedded && apiSub.slug) {
      const signingLink = apiSub.embedSrc || `https://docuseal.eu/s/${apiSub.slug}`;
      const recipientEmail = requestedSubmitters.find((s) => s.role === apiSub.role)?.email || apiSub.email;
      const emailContent = `
        <div style="font-family:Arial,sans-serif;color:#333;">
          <h2 style="color:#000;">Ihre Stundenliste ist bereit zur Unterschrift</h2>
          <p>Bitte klicken Sie auf den untenstehenden Link, um die Stundenliste für Auftrag ${auftragNr} zu überprüfen und zu unterschreiben.</p>
          <a href="${signingLink}" style="display:inline-block;padding:10px 15px;color:#fff;background-color:#E36125;text-decoration:none;border-radius:4px;margin-top:20px;">
            Dokument unterschreiben
          </a>
        </div>
      `;
      try {
        await sendMail(recipientEmail, `Ihre Stundenliste für Auftrag ${auftragNr}`, emailContent, 'it');
        logger.info(`[SignaturenRoute Stundenliste ${auftragNr}] E-Mail gesendet an ${recipientEmail}`);
      } catch (err) {
        logger.error(`[SignaturenRoute Stundenliste ${auftragNr}] E-Mail fehlgeschlagen:`, err);
      }
    }
  }

  broadcastSignaturEvent('vorgang.created', vorgang.toObject());

  const verleiherSub = storedSubmitters.find((s) => s.role === 'Verleiher');
  res.status(201).json({
    vorgang,
    embed: verleiherSub
      ? { role: 'Verleiher', slug: verleiherSub.slug, src: verleiherSub.embedSrc }
      : null,
  });
}));

// ─── LIST ─────────────────────────────────────────────────────────────────────

// GET /api/signaturen — list with optional filters
// Query params: status, standort, typ (ObjectId), mitarbeiter (ObjectId), kunde (ObjectId), limit
router.get('/', auth, asyncHandler(async (req, res) => {
  const { status, standort, typ, mitarbeiter, kunde, auftragNr, limit } = req.query;
  const filter = {};
  if (status)      filter.status      = status;
  if (standort)    filter.standort    = standort;
  if (typ)         filter.typ         = typ;
  if (mitarbeiter) filter.mitarbeiter = mitarbeiter;
  if (kunde)       filter.kunde       = kunde;
  if (auftragNr)   filter.auftragNr   = Number(auftragNr);

  const vorgaenge = await SignaturVorgang.find(filter)
    .populate('typ', 'key label linkedTo')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 500));

  res.json(vorgaenge);
}));

// ─── CREATE ───────────────────────────────────────────────────────────────────

// POST /api/signaturen — create a new SignaturVorgang
// Body: {
//   name          string (required)
//   typId         ObjectId (required)
//   standort?     string — team key ('hamburg', 'berlin', 'koeln', ...)
//   mitarbeiterId? ObjectId
//   kundeId?       ObjectId — Kunde must have a kuerzel set
//   graphContact?  { id, displayName, email }
//   templateId?    number — if provided, immediately creates a DocuSeal submission (status → 'open')
//   templateName?  string
//   order?         'preserved' | 'random' (default: 'preserved')
//   submitters?    [{ role, name, email, embedded }]
// }
router.post('/', auth, asyncHandler(async (req, res) => {
  const {
    name, typId, standort,
    mitarbeiterId, kundeId, graphContact,
    templateId, templateName, order,
    submitters,
  } = req.body;

  if (!name)  return res.status(400).json({ message: 'name ist erforderlich' });
  if (!typId) return res.status(400).json({ message: 'typId ist erforderlich' });

  const signaturTyp = await SignaturTyp.findById(typId);
  if (!signaturTyp || !signaturTyp.isActive) {
    return res.status(400).json({ message: 'Ungültiger oder inaktiver Signaturtyp' });
  }

  // Resolve entity links
  let mitarbeiterDoc = null;
  let kundeDoc       = null;

  if (mitarbeiterId) {
    mitarbeiterDoc = await Mitarbeiter.findById(mitarbeiterId).select('vorname nachname').lean();
    if (!mitarbeiterDoc) {
      return res.status(400).json({ message: 'Mitarbeiter nicht gefunden' });
    }
  }

  if (kundeId) {
    kundeDoc = await Kunde.findById(kundeId).select('kundenNr kundName kuerzel').lean();
    if (!kundeDoc) {
      return res.status(400).json({ message: 'Kunde nicht gefunden' });
    }
    if (!kundeDoc.kuerzel) {
      return res.status(400).json({
        message: 'Dieser Kunde hat kein Kürzel. Bitte zuerst ein Kürzel im Kundenstamm vergeben.',
      });
    }
  }

  // Denormalized name slug for R2 path (set once at creation, stable)
  const mitarbeiterName = mitarbeiterDoc
    ? `${mitarbeiterDoc.vorname}-${mitarbeiterDoc.nachname}`
    : null;

  // Build R2 prefix using the entity type and identifier
  const entityType = kundeDoc ? 'Kunde' : (mitarbeiterDoc ? 'Mitarbeiter' : null);
  const entityIdentifier = kundeDoc ? kundeDoc.kuerzel : mitarbeiterName;

  const r2Prefix = buildSignaturR2Prefix({
    entityType,
    entityIdentifier,
    typKey: signaturTyp.key,
  });

  // Create DocuSeal submission if templateId is provided
  let storedSubmitters = [];
  let submissionId     = null;
  let initialStatus    = 'draft';

  if (templateId && Array.isArray(submitters) && submitters.length > 0) {
    const apiSubmitters = submitters.map((s) => ({
      role:       s.role,
      name:       s.name,
      email:      s.email,
      send_email: s.embedded ? false : true,
    }));

    const result = await DocuSealService.createSubmission({
      templateId: Number(templateId),
      submitters: apiSubmitters,
      order:      order === 'random' ? 'random' : 'preserved',
    });

    const resultArr  = Array.isArray(result) ? result : (result?.submitters || []);
    submissionId     = resultArr.length ? resultArr[0].submission_id : undefined;
    storedSubmitters = resultArr.map((apiSub) => {
      const requested = submitters.find(
        (s) => (s.email && s.email === apiSub.email) || s.role === apiSub.role
      ) || {};
      return mapSubmitter(apiSub, requested);
    });
    initialStatus = 'open';

  } else if (Array.isArray(submitters) && submitters.length > 0) {
    // Draft — store submitters without creating a DocuSeal submission yet
    storedSubmitters = submitters.map((s) => ({
      role:        s.role     || '',
      name:        s.name     || '',
      email:       s.email    || '',
      slug:        '',
      embedSrc:    '',
      embedded:    !!s.embedded,
      status:      'awaiting',
      completedAt: null,
    }));
  }

  const vorgang = new SignaturVorgang({
    name,
    typ:     signaturTyp._id,
    typKey:  signaturTyp.key,
    standort: standort || null,
    status:  initialStatus,

    mitarbeiter:     mitarbeiterDoc ? mitarbeiterDoc._id : null,
    mitarbeiterName: mitarbeiterName,
    kunde:           kundeDoc ? kundeDoc._id   : null,
    kundenNr:        kundeDoc ? kundeDoc.kundenNr : null,
    kundenKuerzel:   kundeDoc ? kundeDoc.kuerzel  : null,

    graphContact: (graphContact && graphContact.email) ? {
      id:          graphContact.id          || null,
      displayName: graphContact.displayName || null,
      email:       graphContact.email,
    } : undefined,

    docusealTemplateId:   templateId   ? Number(templateId) : null,
    docusealTemplateName: templateName || '',
    submissionId,
    submitters: storedSubmitters,
    r2Prefix,

    createdBy: req.user.id,
  });

  await vorgang.save();
  await vorgang.populate('typ', 'key label linkedTo');
  res.status(201).json(vorgang);
}));

// ─── SINGLE GET ───────────────────────────────────────────────────────────────

// GET /api/signaturen/:id — fetch one, optionally refreshed from DocuSeal (?refresh=true)
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await SignaturVorgang.findById(req.params.id)
    .populate('typ', 'key label linkedTo');
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  if (req.query.refresh === 'true' && vorgang.submissionId) {
    try {
      const submission = await DocuSealService.getSubmission(vorgang.submissionId);
      if (submission && Array.isArray(submission.submitters)) {
        vorgang.submitters = vorgang.submitters.map((local) => {
          const live = submission.submitters.find(
            (s) => s.slug === local.slug || s.email === local.email
          );
          if (live) {
            local.status      = live.status       || local.status;
            local.completedAt = live.completed_at ? new Date(live.completed_at) : local.completedAt;
          }
          return local;
        });
        if (submission.status === 'completed') {
          vorgang.status = 'completed';
        }
        await vorgang.save();
      }
    } catch (err) {
      logger.warn(`SignaturVorgang refresh failed for submission ${vorgang.submissionId}:`, err.message);
    }
  }

  res.json(vorgang);
}));

// ─── DOWNLOAD URLs ────────────────────────────────────────────────────────────

// GET /api/signaturen/:id/signed-url — presigned R2 URL for the signed PDF (inline)
router.get('/:id/signed-url', auth, asyncHandler(async (req, res) => {
  const vorgang = await SignaturVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  if (!vorgang.r2KeySigned) {
    return res.status(409).json({ message: 'Noch kein unterschriebenes Dokument vorhanden' });
  }
  const safeName = vorgang.name.replace(/[^a-z0-9_\- ]/gi, '_') + '.pdf';
  const url = await R2Service.getSignedDownloadUrl(vorgang.r2KeySigned, 3600, {
    inline:   true,
    filename: safeName,
  });
  res.json({ url });
}));

// GET /api/signaturen/:id/audit-url — presigned R2 URL for the DocuSeal audit trail PDF
router.get('/:id/audit-url', auth, asyncHandler(async (req, res) => {
  const vorgang = await SignaturVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  if (!vorgang.r2KeyAudit) {
    return res.status(409).json({ message: 'Noch kein Audit-Dokument vorhanden' });
  }
  const safeName = vorgang.name.replace(/[^a-z0-9_\- ]/gi, '_') + '-audit.pdf';
  const url = await R2Service.getSignedDownloadUrl(vorgang.r2KeyAudit, 3600, {
    inline:   true,
    filename: safeName,
  });
  res.json({ url });
}));

// ─── CANCEL ───────────────────────────────────────────────────────────────────

// DELETE /api/signaturen/:id — cancel the Vorgang and archive in DocuSeal
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await SignaturVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  if (vorgang.status === 'completed') {
    return res.status(409).json({ message: 'Abgeschlossene Vorgänge können nicht storniert werden' });
  }

  if (vorgang.submissionId) {
    try {
      await DocuSealService.archiveSubmission(vorgang.submissionId);
    } catch (err) {
      logger.warn(
        `SignaturVorgang: DocuSeal archive failed for submission ${vorgang.submissionId}:`,
        err.message
      );
    }
  }

  vorgang.status      = 'cancelled';
  vorgang.cancelledAt = new Date();
  await vorgang.save();

  res.json({ message: 'Vorgang storniert', vorgang });
}));

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────

// POST /api/signaturen/webhook — DocuSeal event webhook for SignaturVorgang records
// Configure in DocuSeal dashboard alongside (or instead of) /api/docuseal/webhook.
router.post('/webhook', verifyDocuSealWebhook, asyncHandler(async (req, res) => {
  // Acknowledge immediately so DocuSeal doesn't retry
  res.sendStatus(200);

  const { event_type: eventType, data } = req.body || {};
  if (!eventType || !data) return;

  const submissionId = data.submission_id || data.id;
  if (!submissionId) return;

  const vorgang = await SignaturVorgang.findOne({ submissionId });
  if (!vorgang) {
    // Not a SignaturVorgang — may belong to the legacy DocuSealVorgang collection
    logger.debug(
      `SignaturRoutes webhook: no SignaturVorgang for submission ${submissionId} (${eventType}) — skipping.`
    );
    return;
  }

  // Update individual submitter status on per-form events
  if (data.email || data.slug) {
    vorgang.submitters = vorgang.submitters.map((s) => {
      const isMatch = (data.slug && s.slug === data.slug) || (data.email && s.email === data.email);
      if (isMatch) {
        s.status = data.status || s.status;
        if (eventType === 'form.completed') {
          s.status      = 'completed';
          s.completedAt = new Date();
        }
      }
      return s;
    });
  }

  if (eventType === 'submission.completed') {
    vorgang.status      = 'completed';
    vorgang.completedAt = new Date();

    // Use the stored prefix (or rebuild as fallback)
    const r2Prefix = vorgang.r2Prefix || buildSignaturR2Prefix({
      entityType:       vorgang.kundenKuerzel ? 'Kunde' : (vorgang.mitarbeiterName ? 'Mitarbeiter' : null),
      entityIdentifier: vorgang.kundenKuerzel || vorgang.mitarbeiterName,
      typKey:           vorgang.typKey,
    });

    // Store signed PDF in R2
    try {
      const stored = await DocuSealService.storeSignedPdf(submissionId, r2Prefix);
      if (stored) vorgang.r2KeySigned = stored.key;
    } catch (err) {
      logger.error(
        `SignaturVorgang: failed to store signed PDF for submission ${submissionId}:`,
        err.message
      );
    }

    // Store audit trail PDF in R2
    try {
      const stored = await DocuSealService.storeAuditPdf(
        submissionId,
        r2Prefix,
        data.audit_log_url || null
      );
      if (stored) vorgang.r2KeyAudit = stored.key;
    } catch (err) {
      logger.error(
        `SignaturVorgang: failed to store audit PDF for submission ${submissionId}:`,
        err.message
      );
    }

  } else if (eventType === 'submission.expired' || eventType === 'submission.archived') {
    vorgang.status      = 'cancelled';
    vorgang.cancelledAt = new Date();
  }

  await vorgang.save();
  logger.info(`SignaturRoutes webhook: processed ${eventType} for submission ${submissionId}.`);
  broadcastSignaturEvent('vorgang.updated', vorgang.toObject());
}));

module.exports = router;
