const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const logger = require('../utils/logger');
const DocuSealService = require('../DocuSealService');
const DocuSealVorgang = require('../models/DocuSealVorgang');
const R2Service = require('../R2Service');

const router = express.Router();

const WEBHOOK_SECRET = process.env.DOCUSEAL_WEBHOOK_SECRET;

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
      const stored = await DocuSealService.storeSignedPdf(submissionId, `docuseal/${vorgang._id}`);
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
}));

module.exports = router;
