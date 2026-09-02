const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/AsyncHandler');
const logger = require('../../utils/logger');
const DocuSealService = require('../../services/integrations/DocuSealService');
const SignaturVorgang = require('../../models/Signature/SignaturVorgang');
const SignaturTyp = require('../../models/System/SignaturTyp');
const SignaturFolgeDefaults = require('../../models/System/SignaturFolgeDefaults');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Kunde = require('../../models/Customer/Kunde');
const Location = require('../../models/System/Location');
const R2Service = require('../../services/integrations/R2Service');
const User = require('../../models/System/User');
const Auftrag = require('../../models/Event/Auftrag');
const Reisekostenabrechnung = require('../../models/Signature/Reisekostenabrechnung');
const StundenlisteService = require('../../services/operations/StundenlisteService');
const ReisekostenService = require('../../services/operations/ReisekostenService');
const { sendMail } = require('../../services/integrations/EmailService');
const { buildSignaturR2Prefix, sanitizeSegment } = require('../../utils/signaturR2Path');
const { buildStundenlistePdfFilename } = require('../../utils/stundenlisteFilename');
const AsanaService = require('../../services/integrations/AsanaService');
const registry = require('../../config/registry');
const {
  getAppToken,
  getDriveItemById,
  downloadDriveItemBuffer,
} = require('../../services/integrations/GraphService');

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

async function requireSignaturAccess(req, res) {
  const user = await User.findById(req.user.id).select('role roles');
  const isAdmin = !!user && (user.roles?.includes('ADMIN') || user.role === 'ADMIN');
  const isVertrieb = !!user && user.roles?.includes('VERTRIEB');
  if (!isAdmin && !isVertrieb) {
    res.status(403).json({ message: 'Zugriff verweigert – nur für Admins und Vertrieb' });
    return null;
  }
  return user;
}

/**
 * Execute post-completion actions stored on a SignaturVorgang.
 * Called fire-and-forget from the submission.completed webhook handler.
 * @param {object} vorgang - saved SignaturVorgang mongoose document
 */
async function executeFolgeaktionen(vorgang) {
  const fa = vorgang.folgeaktionen;
  if (!fa) return;

  // ── Ausliefern an: send signed PDF to each recipient ───────────────────────
  const recipientsByEmail = new Map();
  for (const recipient of (fa.ausliefernAn || [])) {
    const email = String(recipient.email || '').trim().toLowerCase();
    if (email) recipientsByEmail.set(email, { displayName: recipient.displayName || '', email });
  }
  if (fa.ausliefernAnSignierer !== false) {
    for (const submitter of (vorgang.submitters || [])) {
      const email = String(submitter.email || '').trim().toLowerCase();
      if (email && !recipientsByEmail.has(email)) {
        recipientsByEmail.set(email, { displayName: submitter.name || '', email });
      }
    }
  }
  const recipients = [...recipientsByEmail.values()];
  if (recipients.length > 0 && vorgang.r2KeySigned) {
    try {
      const pdfBuffer = await R2Service.downloadFile(vorgang.r2KeySigned);
      const base64Pdf = pdfBuffer.toString('base64');
      const pdfName   = vorgang.fileName || `${vorgang.name || 'Signatur'}.pdf`;
      const attachment = {
        name: pdfName,
        contentType: 'application/pdf',
        content: base64Pdf,
      };
      const subject = `Unterzeichnetes Dokument: ${vorgang.name || 'Signatur'}`;
      const body    = `<p>Das Dokument <strong>${vorgang.name || 'Signatur'}</strong> wurde vollständig unterzeichnet und ist als Anhang beigefügt.</p>`;
      await sendMail(
        recipients.map(r => r.email),
        subject,
        body,
        'it',
        [attachment],
      );
      logger.info(`SignaturVorgang ${vorgang._id}: Signed PDF sent to ${recipients.map(r => r.email).join(', ')}`);
    } catch (err) {
      logger.error(`SignaturVorgang ${vorgang._id}: Ausliefern fehlgeschlagen:`, err.message);
    }
  }

  // ── Asana actions ──────────────────────────────────────────────────────────
  for (const action of (fa.asanaActions || [])) {
    try {
      if (action.type === 'complete') {
        await AsanaService.completeTaskById(action.taskGid);
        logger.info(`SignaturVorgang ${vorgang._id}: Asana task ${action.taskGid} completed.`);
      } else if (action.type === 'comment') {
        const text = action.comment || `Dokument "${vorgang.name}" wurde unterzeichnet.`;
        await AsanaService.createStoryOnTask(action.taskGid, {
          type: 'comment',
          html_text: `<body>${text}</body>`,
        });
        logger.info(`SignaturVorgang ${vorgang._id}: Asana task ${action.taskGid} commented.`);
      } else if (action.type === 'delete') {
        await AsanaService.deleteTask(action.taskGid);
        logger.info(`SignaturVorgang ${vorgang._id}: Asana task ${action.taskGid} deleted.`);
      }
    } catch (err) {
      logger.error(`SignaturVorgang ${vorgang._id}: Asana action ${action.type} on ${action.taskGid} fehlgeschlagen:`, err.message);
    }
  }
}

/**
 * Parse and sanitize folgeaktionen from request body.
 */
function parseFolgeaktionen(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const ausliefernAn = Array.isArray(raw.ausliefernAn)
    ? raw.ausliefernAn.filter(r => r && r.email).map(r => ({ displayName: r.displayName || '', email: r.email }))
    : [];
  const emailBenachrichtigung = raw.emailBenachrichtigung !== false;
  const ausliefernAnSignierer = raw.ausliefernAnSignierer !== false;
  const asanaActions = Array.isArray(raw.asanaActions)
    ? raw.asanaActions.filter(a => a && a.taskGid && ['complete', 'comment', 'delete'].includes(a.type))
        .map(a => ({ type: a.type, taskGid: a.taskGid, taskName: a.taskName || '', comment: a.comment || '' }))
    : [];
  return { ausliefernAn, ausliefernAnSignierer, emailBenachrichtigung, asanaActions };
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
 * Keep a linked Reisekostenabrechnung's status in sync with its signature process.
 * Completed → completed; cancelled → back to draft (re-editable). No-op otherwise.
 */
async function syncLinkedReisekosten(vorgang) {
  if (!vorgang || vorgang.typKey !== 'reisekostenabrechnung') return;
  const rkStatus = vorgang.status === 'completed'
    ? 'completed'
    : (vorgang.status === 'cancelled' ? 'draft' : null);
  if (!rkStatus) return;
  try {
    await Reisekostenabrechnung.updateOne({ signaturVorgang: vorgang._id }, { $set: { status: rkStatus } });
  } catch (err) {
    logger.warn(`Reisekosten-Status-Sync fehlgeschlagen für ${vorgang._id}: ${err.message}`);
  }
}

/**
 * Map a DocuSeal API submitter onto our stored SubmitterSchema shape.
 */
function mapSubmitter(apiSubmitter, requested = {}) {  return {
    role:        apiSubmitter.role      || requested.role      || '',
    name:        apiSubmitter.name      || requested.name      || '',
    email:       apiSubmitter.email     || requested.email     || '',
    slug:        apiSubmitter.slug      || '',
  embedSrc:    apiSubmitter.embed_src || (apiSubmitter.slug ? `https://docuseal.eu/s/${apiSubmitter.slug}` : ''),
    embedded:    !!requested.embedded,
    status:      apiSubmitter.status    || 'awaiting',
    completedAt: apiSubmitter.completed_at ? new Date(apiSubmitter.completed_at) : null,
  };
}

async function resolveSignaturLocation({ locationId, entityLocationId, auftragLocationId, standort } = {}) {
  if (locationId) {
    if (!/^[a-f\d]{24}$/i.test(String(locationId))) return null;
    return Location.findOne({ _id: locationId, isActive: true })
      .select('_id nameFull shortName nameKey shortNameKey')
      .lean();
  }

  for (const candidate of [entityLocationId, auftragLocationId]) {
    if (!candidate) continue;
    const location = await Location.findOne({ _id: candidate, isActive: true })
      .select('_id nameFull shortName nameKey shortNameKey')
      .lean();
    if (location) return location;
  }

  if (!standort) return null;
  const normalized = Location.normalize(standort);
  return Location.findOne({
    isActive: true,
    $or: [{ nameKey: normalized }, { shortNameKey: normalized }, { externalId: String(standort) }],
  }).select('_id nameFull shortName nameKey shortNameKey').lean();
}

async function resolveSpaceSignatureSource(req, locationId, itemId) {
  const user = await User.findById(req.user.id).select('role roles locationV2 locationAccess').lean();
  const isAdmin = user?.role === 'ADMIN' || user?.roles?.includes('ADMIN');
  const location = await Location.findById(locationId).lean();
  const allowed = isAdmin
    || String(user?.locationV2 || '') === String(location?._id || '')
    || (user?.locationAccess || []).some((id) => String(id) === String(location?._id || ''));
  if (!allowed || !location?.isActive || !location.spaceFolder?.folderId || !location.spaceFolder?.teamKey) return null;

  const team = registry.getTeam(location.spaceFolder.teamKey);
  const userPrincipalName = registry.getGraphMailboxUpn(team);
  if (!userPrincipalName) return null;

  const token = await getAppToken();
  let currentId = itemId;
  let item = null;
  for (let depth = 0; currentId && depth < 50; depth += 1) {
    const currentItem = await getDriveItemById(token, userPrincipalName, currentId);
    if (!item) item = currentItem;
    if (String(currentId) === String(location.spaceFolder.folderId)) {
      return { location, token, userPrincipalName, item };
    }
    currentId = currentItem.parentReference?.id;
  }
  return null;
}

async function getStundenlisteDefaultSigner(location, auftrag) {
  const resolvedLocation = await Location.findById(location._id)
    .populate('locationManager', 'name email')
    .lean();
  const manager = resolvedLocation?.locationManager;
  if (manager) {
    return {
      name: manager.name || manager.email,
      email: manager.email || null,
    };
  }
  return StundenlisteService.getVerleiherSigner(auftrag);
}

function getEntityValidationMessage(signaturTyp, kundeDoc, mitarbeiterDoc) {
  if (!signaturTyp) return 'Der Signaturtyp wurde nicht gefunden.';
  if (kundeDoc && mitarbeiterDoc) return 'Eine Signatur kann nur einem Kunden oder Mitarbeiter zugeordnet werden.';
  // Kunde is always required when the type is Kunde-only
  if (signaturTyp.linkedTo === 'Kunde' && !kundeDoc) return 'Dieser Dokumententyp benötigt einen Kunden.';
  // Mitarbeiter is optional — the person may not be in the system yet (e.g. Arbeitsvertrag for a new hire)
  return null;
}

async function ensureSignaturOrdner(entityType, entityDoc) {
  if (!entityDoc) return null;
  if (entityDoc.signaturOrdner) return entityDoc.signaturOrdner;

  const identifier = entityType === 'Kunde'
    ? entityDoc.kuerzel || entityDoc.kundName || entityDoc.kundenNr || entityDoc._id
    : [entityDoc.vorname, entityDoc.nachname].filter(Boolean).join('-') || entityDoc.personalnr || entityDoc._id;

  entityDoc.signaturOrdner = sanitizeSegment(identifier) || String(entityDoc._id);
  await entityDoc.save();
  return entityDoc.signaturOrdner;
}

async function buildR2PrefixForVorgang(vorgang, resolvedLocation = null) {
  let entityType = null;
  let entityIdentifier = null;
  let entityLocationId = null;
  if (vorgang.kunde) {
    const kunde = await Kunde.findById(vorgang.kunde)
      .select('_id kundenNr kundName kuerzel signaturOrdner locationV2');
    entityType = 'Kunde';
    entityLocationId = kunde?.locationV2 || null;
    entityIdentifier = kunde
      ? await ensureSignaturOrdner(entityType, kunde)
      : vorgang.kundenKuerzel;
  } else if (vorgang.mitarbeiter) {
    const mitarbeiter = await Mitarbeiter.findById(vorgang.mitarbeiter)
      .select('_id personalnr vorname nachname signaturOrdner locationV2');
    entityType = 'Mitarbeiter';
    entityLocationId = mitarbeiter?.locationV2 || null;
    entityIdentifier = mitarbeiter
      ? await ensureSignaturOrdner(entityType, mitarbeiter)
      : vorgang.mitarbeiterName;
  }

  let auftragLocationId = null;
  if (vorgang.auftragNr) {
    const auftrag = await Auftrag.findOne({ auftragNr: vorgang.auftragNr }).select('locationV2').lean();
    auftragLocationId = auftrag?.locationV2 || null;
  }
  const location = resolvedLocation || await resolveSignaturLocation({
    locationId: vorgang.locationV2,
    entityLocationId,
    auftragLocationId,
    standort: vorgang.standort,
  });

  return buildSignaturR2Prefix({
    locationIdentifier: location?.shortName || location?.nameFull || vorgang.standort,
    entityType,
    entityIdentifier,
    typKey: vorgang.typKey,
  });
}

function isCanonicalSignaturPrefix(prefix) {
  return /^Signatures\/[^/]+\/(?:kunden|mitarbeiter|sonstige)(?:\/|$)/.test(prefix || '');
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
    'Cache-Control': 'no-cache, no-transform',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Disable Nagle so heartbeat frames are sent immediately.
  if (req.socket) req.socket.setNoDelay(true);

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Heroku closes idle HTTP connections after ~55s, so emit SSE comment pings.
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);

  sseClients.add(res);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
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

// POST /api/signaturen/stundenliste/:auftragNr/draft — generate and persist the
// unsigned PDF, then create the local record that owns the signing workflow.
router.post('/stundenliste/:auftragNr/draft', auth, asyncHandler(async (req, res) => {
  const adminUser = await requireSignaturAccess(req, res);
  if (!adminUser) return;

  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) return res.status(400).json({ message: 'Ungültige Auftragsnummer' });

  const existingDraft = await SignaturVorgang.findOne({ typKey: 'stundenliste', auftragNr, status: 'draft' })
    .populate([{ path: 'typ', select: 'key label linkedTo' }, { path: 'locationV2', select: 'nameFull shortName color' }]);
  if (existingDraft) return res.json(existingDraft);

  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: `Auftrag ${auftragNr} nicht gefunden` });
  const kunde = auftrag.kundenNr
    ? await Kunde.findOne({ kundenNr: auftrag.kundenNr }).select('_id kundenNr kundName kuerzel locationV2 signaturOrdner signaturKontaktEmail')
    : null;
  if (!kunde) return res.status(400).json({ message: 'Für die Stundenliste wurde kein Kunde gefunden.' });

  const signaturTyp = await SignaturTyp.findOne({ key: 'stundenliste', isActive: true });
  if (!signaturTyp) return res.status(400).json({ message: 'Signaturtyp "stundenliste" nicht gefunden – bitte Seed-Skript ausführen.' });

  const location = await resolveSignaturLocation({
    locationId: req.body?.locationId,
    entityLocationId: kunde.locationV2,
    auftragLocationId: auftrag.locationV2,
  });
  if (!location) return res.status(400).json({ message: 'Bitte eine gültige Location auswählen.' });

  const verleiher = await getStundenlisteDefaultSigner(location, auftrag);
  const eventTitle = String(auftrag.eventTitel || '').trim();
  const excludePseudo = req.body?.excludePseudo === true;
  const pdfFilename = buildStundenlistePdfFilename(auftrag);
  const { buffer } = await StundenlisteService.buildStundenliste(auftragNr, { excludePseudo });
  const unsignedPdfKey = `stundenlisten/${auftragNr}.pdf`;
  await R2Service.uploadFile(unsignedPdfKey, buffer, 'application/pdf');

  const vorgang = new SignaturVorgang({
    name: String(req.body?.name || '').trim() || `Stundenliste ${eventTitle || auftragNr}`,
    fileName: pdfFilename,
    typ: signaturTyp._id,
    typKey: 'stundenliste',
    standort: location.shortNameKey || null,
    locationV2: location._id,
    status: 'draft',
    auftragNr,
    stundenlisteExcludePseudo: excludePseudo,
    kunde: kunde._id,
    kundenNr: kunde.kundenNr,
    kundenKuerzel: kunde.kuerzel,
    docusealTemplateName: 'Stundenliste (PDF)',
    r2KeyUnsigned: unsignedPdfKey,
    submitters: [
      { role: 'Verleiher', name: verleiher.name || '', email: verleiher.email || '', embedded: true },
      { role: 'Entleiher', name: kunde.kundName || '', email: kunde.signaturKontaktEmail || '', embedded: false },
    ],
    r2Prefix: buildSignaturR2Prefix({
      locationIdentifier: location.shortName || location.nameFull,
      entityType: 'Kunde',
      entityIdentifier: await ensureSignaturOrdner('Kunde', kunde),
      typKey: 'stundenliste',
    }),
    createdBy: req.user.id,
  });
  await vorgang.save();
  await vorgang.populate([{ path: 'typ', select: 'key label linkedTo' }, { path: 'locationV2', select: 'nameFull shortName color' }]);
  broadcastSignaturEvent('vorgang.created', vorgang.toObject());
  res.status(201).json(vorgang);
}));

// POST /api/signaturen/stundenliste/:auftragNr
// Generates the Stundenliste PDF server-side, creates a DocuSeal submission from
// the PDF, and saves the result as a SignaturVorgang (the new hub model).
// Body (from SignaturNeuModal customEndpoint): { locationId, submitters:[{role,name,email,embedded}] }
// Response: { vorgang, embed: { role, slug, src } }
router.post('/stundenliste/:auftragNr', auth, asyncHandler(async (req, res) => {
  const adminUser = await requireSignaturAccess(req, res);
  if (!adminUser) return;

  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) {
    return res.status(400).json({ message: 'Ungültige Auftragsnummer' });
  }

  const { name, locationId, standort, submitters, draftId, folgeaktionen: folgeaktionenRaw } = req.body || {};
  const folgeaktionen = parseFolgeaktionen(folgeaktionenRaw);

  let draftVorgang = null;
  if (draftId) {
    draftVorgang = await SignaturVorgang.findById(draftId);
    if (!draftVorgang || draftVorgang.status !== 'draft' || draftVorgang.typKey !== 'stundenliste' || draftVorgang.auftragNr !== auftragNr) {
      return res.status(409).json({ message: 'Der Stundenlisten-Entwurf ist nicht mehr verfügbar.' });
    }
  }

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
    ? await Kunde.findOne({ kundenNr: auftrag.kundenNr })
        .select('_id kundenNr kundName kuerzel locationV2 signaturOrdner')
    : null;

  // Resolve the Stundenliste type
  const signaturTyp = await SignaturTyp.findOne({ key: 'stundenliste', isActive: true });
  if (!signaturTyp) {
    return res.status(400).json({ message: 'Signaturtyp "stundenliste" nicht gefunden – bitte Seed-Skript ausführen.' });
  }
  if (!kunde) {
    return res.status(400).json({ message: 'Für die Stundenliste wurde kein Kunde gefunden.' });
  }

  const location = await resolveSignaturLocation({
    locationId,
    entityLocationId: kunde.locationV2,
    auftragLocationId: auftrag.locationV2,
    standort,
  });
  if (!location) {
    return res.status(400).json({ message: 'Bitte eine gültige Location auswählen.' });
  }

  // Verleiher: use request override or derive from Auftrag location
  const verleiherDefault = await getStundenlisteDefaultSigner(location, auftrag);
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
  // Auto-cancel any existing active Stundenliste for this Auftrag so that re-issuing
  // always replaces the outdated document rather than accumulating duplicates.
  const existingVorgang = await SignaturVorgang.findOne({
    typKey: 'stundenliste',
    auftragNr,
    status: { $nin: ['cancelled'] },
    ...(draftVorgang ? { _id: { $ne: draftVorgang._id } } : {}),
  });
  if (existingVorgang) {
    if (existingVorgang.submissionId) {
      try {
        await DocuSealService.archiveSubmission(existingVorgang.submissionId);
      } catch (e) {
        logger.warn(`[Stundenliste redo] DocuSeal archive failed for ${existingVorgang.submissionId}:`, e.message);
      }
    }
    existingVorgang.status      = 'cancelled';
    existingVorgang.cancelledAt = new Date();
    await existingVorgang.save();
    logger.info(`[Stundenliste redo] Existing vorgang ${existingVorgang._id} cancelled for Auftrag ${auftragNr}`);
  }

  const { buffer } = await StundenlisteService.buildStundenliste(auftragNr, {
    signatureTags: true,
    excludePseudo: !!draftVorgang?.stundenlisteExcludePseudo,
  });

  const requestedName = typeof name === 'string' ? name.trim() : '';
  const eventTitle = String(auftrag.eventTitel || '').trim();
  const docName = requestedName || `Stundenliste ${eventTitle || auftragNr}`;
  const pdfFilename = buildStundenlistePdfFilename(auftrag);
  const today = new Date().toISOString().split('T')[0];

  const requestedSubmitters = [
    { role: 'Verleiher', name: verleiherSigner.name, email: verleiherSigner.email, embedded: true },
    { role: 'Entleiher', name: entleiherReq.name || (kunde && kunde.kundName) || '', email: entleiherReq.email, embedded: false },
  ];

  // Create DocuSeal submission from the generated PDF
  const result = await DocuSealService.createSubmissionFromPdf({
    name: docName,
    documentName: pdfFilename,
    fileBuffer: buffer,
    submitters: requestedSubmitters.map((s) => ({
      role:       s.role,
      name:       s.name,
      email:      s.email,
      send_email: !s.embedded,
      values:     { [`${s.role} Datum`]: today },
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

  const entityFolder = await ensureSignaturOrdner('Kunde', kunde);
  const r2Prefix = buildSignaturR2Prefix({
    locationIdentifier: location.shortName || location.nameFull,
    entityType: 'Kunde',
    entityIdentifier: entityFolder,
    typKey: 'stundenliste',
  });

  // Save as a SignaturVorgang
  const vorgangData = {
    name:     docName,
    fileName: pdfFilename,
    typ:      signaturTyp._id,
    typKey:   'stundenliste',
    standort: standort || location.shortNameKey || null,
    locationV2: location._id,
    status:   'open',
    auftragNr,

    kunde:         kunde ? kunde._id   : null,
    kundenNr:      kunde ? kunde.kundenNr : null,
    kundenKuerzel: kunde ? kunde.kuerzel  : null,

    docusealTemplateName: 'Stundenliste (PDF)',
    submissionId,
    submitters: storedSubmitters,
    r2Prefix,

    folgeaktionen: folgeaktionen || undefined,

    createdBy: req.user.id,
  };
  const vorgang = draftVorgang ? Object.assign(draftVorgang, vorgangData) : new SignaturVorgang(vorgangData);
  await vorgang.save();
  await vorgang.populate([
    { path: 'typ', select: 'key label linkedTo' },
    { path: 'locationV2', select: 'nameFull shortName color' },
  ]);

  // Send Graph email to the non-embedded Entleiher.
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

// ─── REISEKOSTENABRECHNUNG (PDF-generation flow) ─────────────────────────────

// POST /api/signaturen/reisekostenabrechnung/:id
// Renders the stored Reisekostenabrechnung as a signature PDF (single Mitarbeiter
// signer), creates a DocuSeal submission, and saves a SignaturVorgang linked to the
// Mitarbeiter. Called from the modal's customEndpoint.
// Body: { locationId, standort, submitters:[{role:'Mitarbeiter',name,email,embedded}], folgeaktionen }
router.post('/reisekostenabrechnung/:id', auth, asyncHandler(async (req, res) => {
  const adminUser = await requireSignaturAccess(req, res);
  if (!adminUser) return;

  const { locationId, standort, submitters, folgeaktionen: folgeaktionenRaw } = req.body || {};
  const folgeaktionen = parseFolgeaktionen(folgeaktionenRaw) || {
    ausliefernAn: [],
    ausliefernAnSignierer: true,
    emailBenachrichtigung: true,
    asanaActions: [],
  };

  const rk = await Reisekostenabrechnung.findById(req.params.id);
  if (!rk) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });

  const signerReq = Array.isArray(submitters)
    ? (submitters.find((s) => s.role === 'Mitarbeiter') || submitters[0])
    : null;
  if (!signerReq || !signerReq.email) {
    return res.status(400).json({ message: 'Unterzeichner (E-Mail) ist erforderlich' });
  }

  const signaturTyp = await SignaturTyp.findOne({ key: 'reisekostenabrechnung', isActive: true });
  if (!signaturTyp) {
    return res.status(400).json({ message: 'Signaturtyp "reisekostenabrechnung" nicht gefunden – bitte Seed-Skript ausführen.' });
  }

  const mitarbeiter = rk.mitarbeiter
    ? await Mitarbeiter.findById(rk.mitarbeiter).select('_id vorname nachname personalnr signaturOrdner locationV2')
    : null;

  const location = await resolveSignaturLocation({
    locationId,
    entityLocationId: mitarbeiter?.locationV2 || rk.locationV2,
    standort,
  });
  if (!location) {
    return res.status(400).json({ message: 'Bitte eine gültige Location auswählen.' });
  }

  // Auto-cancel any existing non-cancelled Vorgang for this document.
  if (rk.signaturVorgang) {
    const existing = await SignaturVorgang.findById(rk.signaturVorgang);
    if (existing && existing.status !== 'cancelled') {
      if (existing.submissionId) {
        try {
          await DocuSealService.archiveSubmission(existing.submissionId);
        } catch (e) {
          logger.warn(`[Reisekosten redo] DocuSeal archive failed for ${existing.submissionId}:`, e.message);
        }
      }
      existing.status = 'cancelled';
      existing.cancelledAt = new Date();
      await existing.save();
    }
  }

  const { buffer } = await ReisekostenService.buildPdf(rk.toObject(), { signatureTags: true });

  // Belege (Screenshots/PDFs) ans Signatur-Dokument anhängen.
  let signBuffer = buffer;
  if (Array.isArray(rk.anlagen) && rk.anlagen.length) {
    const anlagenBuffers = [];
    for (const a of rk.anlagen) {
      try {
        anlagenBuffers.push({ buffer: await R2Service.downloadFile(a.key), contentType: a.contentType, filename: a.filename });
      } catch (e) {
        logger.warn(`[Reisekosten Signatur] Anlage konnte nicht geladen werden (${a.key}): ${e.message}`);
      }
    }
    signBuffer = await ReisekostenService.mergeAttachments(buffer, anlagenBuffers);
  }

  const docName = `Reisekostenabrechnung ${[rk.kopf?.vorname, rk.kopf?.name].filter(Boolean).join(' ')}`.trim() || `Reisekostenabrechnung ${rk._id}`;
  const today = new Date().toISOString().split('T')[0];
  const requestedSubmitters = [
    { role: 'Mitarbeiter', name: signerReq.name || [rk.kopf?.vorname, rk.kopf?.name].filter(Boolean).join(' '), email: signerReq.email, embedded: !!signerReq.embedded },
  ];

  const result = await DocuSealService.createSubmissionFromPdf({
    name: docName,
    fileBuffer: signBuffer,
    submitters: requestedSubmitters.map((s) => ({
      role: s.role,
      name: s.name,
      email: s.email,
      send_email: !s.embedded,
      values: { [`${s.role} Datum`]: today },
    })),
    order: 'preserved',
  });

  const resultArr = Array.isArray(result)
    ? result
    : (result?.submitters || (result?.id ? [result] : []));
  const submissionId = resultArr.length ? (resultArr[0].submission_id ?? result?.id) : undefined;
  const storedSubmitters = resultArr.map((apiSub) => {
    const reqSub = requestedSubmitters.find((s) => (s.email && s.email === apiSub.email) || s.role === apiSub.role) || {};
    return mapSubmitter(apiSub, reqSub);
  });

  const entityFolder = mitarbeiter
    ? await ensureSignaturOrdner('Mitarbeiter', mitarbeiter)
    : rk.mitarbeiterName;
  const r2Prefix = buildSignaturR2Prefix({
    locationIdentifier: location.shortName || location.nameFull,
    entityType: 'Mitarbeiter',
    entityIdentifier: entityFolder,
    typKey: 'reisekostenabrechnung',
  });

  const vorgang = new SignaturVorgang({
    name: docName,
    typ: signaturTyp._id,
    typKey: 'reisekostenabrechnung',
    standort: standort || location.shortNameKey || null,
    locationV2: location._id,
    status: 'open',
    auftragNr: rk.auftragNr,
    mitarbeiter: mitarbeiter ? mitarbeiter._id : null,
    mitarbeiterName: mitarbeiter ? [mitarbeiter.vorname, mitarbeiter.nachname].filter(Boolean).join('-') : rk.mitarbeiterName,
    docusealTemplateName: 'Reisekostenabrechnung (PDF)',
    submissionId,
    submitters: storedSubmitters,
    r2Prefix,
    folgeaktionen: folgeaktionen || undefined,
    createdBy: req.user.id,
  });
  await vorgang.save();
  await vorgang.populate([
    { path: 'typ', select: 'key label linkedTo' },
    { path: 'locationV2', select: 'nameFull shortName color' },
  ]);

  rk.status = 'signature_pending';
  rk.signaturVorgang = vorgang._id;
  await rk.save();

  // Notify the non-embedded signer by email.
  for (const apiSub of storedSubmitters) {
    if (!apiSub.embedded && apiSub.slug) {
        const signingLink = apiSub.embedSrc || `https://docuseal.eu/s/${apiSub.slug}`;
        const recipientEmail = requestedSubmitters.find((s) => s.role === apiSub.role)?.email || apiSub.email;
        const emailContent = `
          <div style="font-family:Arial,sans-serif;color:#333;">
            <h2 style="color:#000;">Ihre Reisekostenabrechnung ist bereit zur Unterschrift</h2>
            <p>Bitte klicken Sie auf den untenstehenden Link, um die Reisekostenabrechnung zu überprüfen und zu unterschreiben.</p>
            <a href="${signingLink}" style="display:inline-block;padding:10px 15px;color:#fff;background-color:#E36125;text-decoration:none;border-radius:4px;margin-top:20px;">
              Dokument unterschreiben
            </a>
          </div>
        `;
        try {
          await sendMail(recipientEmail, 'Ihre Reisekostenabrechnung zur Unterschrift', emailContent, 'it');
        } catch (err) {
          logger.error(`[SignaturenRoute Reisekosten ${rk._id}] E-Mail fehlgeschlagen:`, err);
        }
    }
  }

  broadcastSignaturEvent('vorgang.created', vorgang.toObject());

  const signerSub = storedSubmitters.find((s) => s.role === 'Mitarbeiter');
  res.status(201).json({
    vorgang,
    embed: signerSub && signerSub.embedded
      ? { role: 'Mitarbeiter', slug: signerSub.slug, src: signerSub.embedSrc }
      : null,
  });
}));

// ─── FOLGE-DEFAULTS ───────────────────────────────────────────────────────────
// GET /api/signaturen/folge-defaults?kundeId=X&typId=Y
// Returns the shared default ausliefernAn recipients for a Kunde+Typ combo.
router.get('/folge-defaults', auth, asyncHandler(async (req, res) => {
  const { kundeId, typId } = req.query;
  if (!kundeId || !typId) return res.json({ ausliefernAn: [] });

  const defaults = await SignaturFolgeDefaults.findOne({ kundeId, typId }).lean();
  res.json({ ausliefernAn: defaults?.ausliefernAn || [] });
}));

// PUT /api/signaturen/folge-defaults
// Upsert the shared default ausliefernAn recipients for a Kunde+Typ combo.
// Body: { kundeId, typId, ausliefernAn: [{ displayName, email }] }
router.put('/folge-defaults', auth, asyncHandler(async (req, res) => {
  const { kundeId, typId, ausliefernAn } = req.body || {};
  if (!kundeId || !typId) return res.status(400).json({ message: 'kundeId und typId erforderlich' });

  const sanitized = Array.isArray(ausliefernAn)
    ? ausliefernAn.filter(r => r && r.email).map(r => ({ displayName: r.displayName || '', email: r.email.toLowerCase().trim() }))
    : [];

  const doc = await SignaturFolgeDefaults.findOneAndUpdate(
    { kundeId, typId },
    { ausliefernAn: sanitized, updatedBy: req.user.id },
    { upsert: true, new: true }
  );
  res.json({ ausliefernAn: doc.ausliefernAn });
}));

// ─── LIST ─────────────────────────────────────────────────────────────────────

// GET /api/signaturen — list with optional filters
// Query params: status, locationV2, standort (legacy), typ, mitarbeiter, kunde, limit
router.get('/', auth, asyncHandler(async (req, res) => {
  const { status, locationV2, standort, typ, mitarbeiter, kunde, auftragNr, limit, refresh } = req.query;
  const filter = {};
  if (status)      filter.status      = status;
  if (locationV2)  filter.locationV2  = locationV2;
  if (standort)    filter.standort    = standort;
  if (typ)         filter.typ         = typ;
  if (mitarbeiter) filter.mitarbeiter = mitarbeiter;
  if (kunde)       filter.kunde       = kunde;
  if (auftragNr)   filter.auftragNr   = Number(auftragNr);

  const vorgaenge = await SignaturVorgang.find(filter)
    .populate([
      { path: 'typ', select: 'key label linkedTo' },
      { path: 'locationV2', select: 'nameFull shortName color' },
    ])
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 500));

  // Sync live status for open vorgaenge from DocuSeal (fire-and-wait in parallel).
  if (refresh === 'true') {
    const openOnes = vorgaenge.filter(v => v.status === 'open' && v.submissionId);
    await Promise.allSettled(openOnes.map(async (vorgang) => {
      try {
        const submission = await DocuSealService.getSubmission(vorgang.submissionId);
        if (!submission || !Array.isArray(submission.submitters)) return;
        let changed = false;
        vorgang.submitters = vorgang.submitters.map((local) => {
          const live = submission.submitters.find(
            (s) => s.slug === local.slug || s.email === local.email
          );
          if (!live) return local;
          if (live.status && live.status !== local.status) {
            local.status = live.status;
            changed = true;
          }
          if (live.completed_at && !local.completedAt) {
            local.completedAt = new Date(live.completed_at);
            changed = true;
          }
          return local;
        });
        if (submission.status === 'completed' && vorgang.status !== 'completed') {
          vorgang.status = 'completed';
          changed = true;
        }
        if (changed) await vorgang.save();
        await syncLinkedReisekosten(vorgang);
      } catch (err) {
        logger.warn(`Bulk status refresh failed for vorgang ${vorgang._id}:`, err.message);
      }
    }));
  }

  // Batch-fetch Auftrag titles for vorgaenge that have an auftragNr
  const auftragNrs = [...new Set(vorgaenge.map(v => v.auftragNr).filter(Boolean))];
  const auftragTitelMap = {};
  if (auftragNrs.length) {
    const auftraege = await Auftrag.find(
      { auftragNr: { $in: auftragNrs } },
      { auftragNr: 1, eventTitel: 1 }
    ).lean();
    auftraege.forEach(a => { auftragTitelMap[a.auftragNr] = a.eventTitel || null; });
  }

  const result = vorgaenge.map(v => {
    const obj = v.toObject();
    if (obj.auftragNr) obj.auftragTitel = auftragTitelMap[obj.auftragNr] || null;
    return obj;
  });

  res.json(result);
}));

// ─── R2 STORAGE BROWSER ─────────────────────────────────────────────────────

// GET /api/signaturen/storage — list every object in the signature archive.
router.get('/storage', auth, asyncHandler(async (_req, res) => {
  const [structuredObjects, legacyObjects, locations] = await Promise.all([
    R2Service.listObjects('Signatures/'),
    R2Service.listObjects('signaturen/'),
    Location.find({}).select('_id nameFull shortName nameKey shortNameKey').lean(),
  ]);

  const objects = [...structuredObjects, ...legacyObjects]
    .filter((object) => object.Key && !object.Key.endsWith('/'));
  const objectKeys = objects.map((object) => object.Key);
  const legacyVorgangIds = [...new Set(legacyObjects
    .map((object) => object.Key?.split('/')[1])
    .filter((id) => /^[a-f\d]{24}$/i.test(id || '')))];

  const vorgaenge = objectKeys.length || legacyVorgangIds.length
    ? await SignaturVorgang.find({
        $or: [
          { _id: { $in: legacyVorgangIds } },
          { r2KeySigned: { $in: objectKeys } },
          { r2KeyAudit: { $in: objectKeys } },
        ],
      })
        .select('_id name fileName typ typKey standort locationV2 kunde kundenKuerzel mitarbeiter mitarbeiterName auftragNr r2KeySigned r2KeyAudit')
        .populate([
          { path: 'typ', select: 'key label linkedTo' },
          { path: 'locationV2', select: 'nameFull shortName' },
          {
            path: 'kunde',
            select: 'kundenNr kundName kuerzel signaturOrdner locationV2',
            populate: { path: 'locationV2', select: 'nameFull shortName' },
          },
          {
            path: 'mitarbeiter',
            select: 'personalnr vorname nachname signaturOrdner locationV2',
            populate: { path: 'locationV2', select: 'nameFull shortName' },
          },
        ])
        .lean()
    : [];

  const auftragNrs = [...new Set(vorgaenge.map((vorgang) => vorgang.auftragNr).filter(Boolean))];
  const auftraege = auftragNrs.length
    ? await Auftrag.find({ auftragNr: { $in: auftragNrs } })
        .select('auftragNr locationV2')
        .populate('locationV2', 'nameFull shortName')
        .lean()
    : [];
  const locationByAuftragNr = new Map(auftraege.map((auftrag) => [auftrag.auftragNr, auftrag.locationV2]));
  const locationByLegacyKey = new Map();
  locations.forEach((location) => {
    locationByLegacyKey.set(location.nameKey, location);
    locationByLegacyKey.set(location.shortNameKey, location);
  });

  const vorgangById = new Map(vorgaenge.map((vorgang) => [String(vorgang._id), vorgang]));
  const vorgangByKey = new Map();
  vorgaenge.forEach((vorgang) => {
    if (vorgang.r2KeySigned) vorgangByKey.set(vorgang.r2KeySigned, vorgang);
    if (vorgang.r2KeyAudit) vorgangByKey.set(vorgang.r2KeyAudit, vorgang);
  });

  res.json(objects.map((object) => {
    const legacyId = object.Key.startsWith('signaturen/') ? object.Key.split('/')[1] : null;
    const vorgang = vorgangByKey.get(object.Key) || (legacyId ? vorgangById.get(legacyId) : null);
    const responseObject = {
      key: object.Key,
      size: object.Size || 0,
      lastModified: object.LastModified || null,
    };
    if (!vorgang) return responseObject;

    const legacyLocation = locationByLegacyKey.get(Location.normalize(vorgang.standort));
    const displayLocation = vorgang.locationV2
      || vorgang.kunde?.locationV2
      || vorgang.mitarbeiter?.locationV2
      || locationByAuftragNr.get(vorgang.auftragNr)
      || legacyLocation;
    const locationName = displayLocation?.nameFull || vorgang.standort || 'Ohne Location';
    const locationFolder = sanitizeSegment(displayLocation?.shortName || locationName) || 'ohne-location';
    const linkedTo = vorgang.typ?.linkedTo;
    const isKunde = linkedTo === 'Kunde' || (linkedTo !== 'Mitarbeiter' && !!vorgang.kunde);
    const isMitarbeiter = linkedTo === 'Mitarbeiter' || (!isKunde && !!vorgang.mitarbeiter);
    const pathSegments = [locationFolder];
    const folderLabels = [locationName];

    if (isKunde) {
      const entityName = vorgang.kunde?.kuerzel || vorgang.kunde?.kundName || vorgang.kundenKuerzel || 'Ohne Zuordnung';
      const entityFolder = vorgang.kunde?.signaturOrdner || sanitizeSegment(entityName) || 'ohne-zuordnung';
      pathSegments.push('kunden', entityFolder);
      folderLabels.push('Kunden', entityName);
      responseObject.entityType = 'kunde';
      responseObject.entityId = vorgang.kunde?._id ? String(vorgang.kunde._id) : null;
    } else if (isMitarbeiter) {
      const fullName = [vorgang.mitarbeiter?.vorname, vorgang.mitarbeiter?.nachname].filter(Boolean).join(' ')
        || vorgang.mitarbeiterName
        || 'Ohne Zuordnung';
      const entityFolder = vorgang.mitarbeiter?.signaturOrdner || sanitizeSegment(fullName) || 'ohne-zuordnung';
      pathSegments.push('mitarbeiter', entityFolder);
      folderLabels.push('Mitarbeiter', fullName);
      responseObject.entityType = 'mitarbeiter';
      responseObject.entityId = vorgang.mitarbeiter?._id ? String(vorgang.mitarbeiter._id) : null;
    } else {
      pathSegments.push('sonstige');
      folderLabels.push('Sonstige');
    }

    const typFolder = sanitizeSegment(vorgang.typ?.key || vorgang.typKey || 'dokument');
    pathSegments.push(typFolder);
    folderLabels.push(vorgang.typ?.label || vorgang.typKey || 'Dokument');

    const storedFileName = object.Key.split('/').pop() || 'dokument.pdf';
    const isAudit = object.Key === vorgang.r2KeyAudit || storedFileName.startsWith('audit-');
    return {
      ...responseObject,
      displayPath: [...pathSegments, storedFileName].join('/'),
      folderLabels,
      fileName: isAudit
        ? `${(vorgang.fileName || `${vorgang.name}.pdf`).replace(/\.pdf$/i, '')} - Audit.pdf`
        : (vorgang.fileName || `${vorgang.name}.pdf`),
    };
  }));
}));

// GET /api/signaturen/storage/url?key=...&download=true — temporary R2 file URL.
router.get('/storage/url', auth, asyncHandler(async (req, res) => {
  const key = String(req.query.key || '');
  const isSignatureKey = key.startsWith('Signatures/') || key.startsWith('signaturen/');
  if (!isSignatureKey || key.endsWith('/')) {
    return res.status(400).json({ message: 'Ungültiger Signatur-Dateipfad' });
  }

  const filename = key.split('/').pop() || 'dokument.pdf';
  const url = await R2Service.getSignedDownloadUrl(key, 3600, {
    inline: req.query.download !== 'true',
    filename,
  });
  res.json({ url });
}));

// ─── CREATE ───────────────────────────────────────────────────────────────────

router.post('/spaces/:locationId/items/:itemId/template', auth, asyncHandler(async (req, res) => {
  if (!await requireSignaturAccess(req, res)) return;
  const source = await resolveSpaceSignatureSource(req, req.params.locationId, req.params.itemId);
  if (!source) return res.status(403).json({ message: 'Kein Zugriff auf diese Datei im Standort-Space.' });
  if (!source.item?.file) return res.status(400).json({ message: 'Nur Dateien können als Vorlage verwendet werden.' });

  const fileName = String(source.item.name || '');
  const isPdf = /\.pdf$/i.test(fileName);
  const isDocx = /\.docx$/i.test(fileName);
  if (!isPdf && !isDocx) return res.status(400).json({ message: 'Vorlagen aus Spaces unterstützen nur PDF- und DOCX-Dateien.' });

  const name = String(req.body?.name || fileName.replace(/\.(pdf|docx)$/i, '')).trim();
  if (!name) return res.status(400).json({ message: 'Eine Vorlagenbezeichnung ist erforderlich.' });
  const { buffer } = await downloadDriveItemBuffer(source.token, source.userPrincipalName, req.params.itemId);
  const template = isPdf
    ? await DocuSealService.createTemplateFromPdf({ name, documentName: fileName, fileBuffer: buffer })
    : await DocuSealService.createTemplateFromDocx({ name, documentName: fileName, fileBuffer: buffer });
  res.status(201).json({ id: Number(template.id), name: template.name || name });
}));

router.post('/spaces/:locationId/items/:itemId', auth, asyncHandler(async (req, res) => {
  if (!await requireSignaturAccess(req, res)) return;
  const source = await resolveSpaceSignatureSource(req, req.params.locationId, req.params.itemId);
  if (!source) return res.status(403).json({ message: 'Kein Zugriff auf diese Datei im Standort-Space.' });
  if (!source.item?.file) return res.status(400).json({ message: 'Nur Dateien können als Signatur verwendet werden.' });

  const fileName = String(source.item.name || '');
  const isPdf = /\.pdf$/i.test(fileName);
  const isDocx = /\.docx$/i.test(fileName);
  if (!isPdf && !isDocx) return res.status(400).json({ message: 'Signaturen aus Spaces unterstützen nur PDF- und DOCX-Dateien.' });

  const { name, typId, kundeId, mitarbeiterId, submitters, folgeaktionen: folgeaktionenRaw } = req.body || {};
  if (!name || !typId) return res.status(400).json({ message: 'Bezeichnung und Dokumenttyp sind erforderlich.' });
  const signaturTyp = await SignaturTyp.findOne({ _id: typId, isActive: true });
  if (!signaturTyp) return res.status(400).json({ message: 'Ungültiger oder inaktiver Signaturtyp.' });

  const kunde = kundeId ? await Kunde.findById(kundeId).select('kundenNr kundName kuerzel locationV2 signaturOrdner') : null;
  const mitarbeiter = mitarbeiterId ? await Mitarbeiter.findById(mitarbeiterId).select('vorname nachname personalnr locationV2 signaturOrdner') : null;
  if (kundeId && !kunde) return res.status(400).json({ message: 'Kunde nicht gefunden.' });
  if (mitarbeiterId && !mitarbeiter) return res.status(400).json({ message: 'Mitarbeiter nicht gefunden.' });
  const entityValidationMessage = getEntityValidationMessage(signaturTyp, kunde, mitarbeiter);
  if (entityValidationMessage) return res.status(400).json({ message: entityValidationMessage });

  const requestedSubmitters = Array.isArray(submitters)
    ? submitters.filter((submitter) => String(submitter?.name || '').trim())
    : [];
  if (!requestedSubmitters.length || requestedSubmitters.some((submitter) => !submitter.embedded && !String(submitter.email || '').trim())) {
    return res.status(400).json({ message: 'Mindestens ein Unterzeichner mit E-Mail-Adresse ist erforderlich.' });
  }

  const { buffer } = await downloadDriveItemBuffer(source.token, source.userPrincipalName, req.params.itemId);
  const apiSubmitters = requestedSubmitters.map((submitter) => ({
    role: submitter.role || 'Unterzeichner',
    name: submitter.name,
    email: submitter.email,
    send_email: !submitter.embedded,
  }));
  const result = isPdf
    ? await DocuSealService.createSubmissionFromPdf({ name, documentName: fileName, fileBuffer: buffer, submitters: apiSubmitters })
    : await DocuSealService.createSubmissionFromDocx({ name, documentName: fileName, fileBuffer: buffer, submitters: apiSubmitters });
  const resultArr = Array.isArray(result) ? result : (result?.submitters || (result?.id ? [result] : []));
  const storedSubmitters = resultArr.map((apiSubmitter) => {
    const requested = requestedSubmitters.find((submitter) => (submitter.email && submitter.email === apiSubmitter.email) || submitter.role === apiSubmitter.role) || {};
    return mapSubmitter(apiSubmitter, requested);
  });

  const entityType = kunde ? 'Kunde' : (mitarbeiter ? 'Mitarbeiter' : null);
  const entity = kunde || mitarbeiter;
  const entityIdentifier = entity ? await ensureSignaturOrdner(entityType, entity) : null;
  const location = await resolveSignaturLocation({ locationId: req.params.locationId });
  const vorgang = new SignaturVorgang({
    name,
    fileName,
    typ: signaturTyp._id,
    typKey: signaturTyp.key,
    standort: location.shortNameKey || null,
    locationV2: location._id,
    status: 'open',
    mitarbeiter: mitarbeiter?._id || null,
    mitarbeiterName: mitarbeiter ? `${mitarbeiter.vorname || ''}-${mitarbeiter.nachname || ''}`.replace(/^-|-$/g, '') : null,
    kunde: kunde?._id || null,
    kundenNr: kunde?.kundenNr || null,
    kundenKuerzel: kunde?.kuerzel || null,
    submissionId: resultArr[0]?.submission_id ?? result?.id ?? null,
    submitters: storedSubmitters,
    r2Prefix: buildSignaturR2Prefix({ locationIdentifier: location.shortName || location.nameFull, entityType, entityIdentifier, typKey: signaturTyp.key }),
    folgeaktionen: parseFolgeaktionen(folgeaktionenRaw) || undefined,
    createdBy: req.user.id,
  });
  await vorgang.save();
  await vorgang.populate([{ path: 'typ', select: 'key label linkedTo' }, { path: 'locationV2', select: 'nameFull shortName color' }]);
  broadcastSignaturEvent('vorgang.created', vorgang.toObject());
  res.status(201).json(vorgang);
}));

// POST /api/signaturen — create a new SignaturVorgang
// Body: {
//   name          string (required)
//   typId         ObjectId (required)
//   locationId?   Location ObjectId (falls back to the linked entity's Location)
//   standort?     legacy location key
//   mitarbeiterId? ObjectId
//   kundeId?       ObjectId — Kunde must have a kuerzel set
//   graphContact?  { id, displayName, email }
//   templateId?    number — if provided, immediately creates a DocuSeal submission (status → 'open')
//   templateName?  string
//   order?         'preserved' | 'random' (default: 'preserved')
//   submitters?    [{ role, name, email, embedded }]
//   draft?         boolean — defer submission and entity requirements
// }
router.post('/', auth, asyncHandler(async (req, res) => {
  const {
    name, typId, locationId, standort,
    mitarbeiterId, kundeId, graphContact,
    templateId, templateName, order,
    submitters, folgeaktionen: folgeaktionenRaw, draft = false,
  } = req.body;

  const folgeaktionen = parseFolgeaktionen(folgeaktionenRaw);

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
    mitarbeiterDoc = await Mitarbeiter.findById(mitarbeiterId)
      .select('vorname nachname personalnr locationV2 signaturOrdner');
    if (!mitarbeiterDoc) {
      return res.status(400).json({ message: 'Mitarbeiter nicht gefunden' });
    }
  }

  if (kundeId) {
    kundeDoc = await Kunde.findById(kundeId)
      .select('kundenNr kundName kuerzel locationV2 signaturOrdner');
    if (!kundeDoc) {
      return res.status(400).json({ message: 'Kunde nicht gefunden' });
    }
  }

  if (!draft) {
    const entityValidationMessage = getEntityValidationMessage(signaturTyp, kundeDoc, mitarbeiterDoc);
    if (entityValidationMessage) return res.status(400).json({ message: entityValidationMessage });
  }

  const location = await resolveSignaturLocation({
    locationId,
    entityLocationId: kundeDoc?.locationV2 || mitarbeiterDoc?.locationV2,
    standort,
  });
  if (!location) {
    return res.status(400).json({ message: 'Bitte eine gültige Location auswählen.' });
  }

  // Denormalized name slug for R2 path (set once at creation, stable)
  const mitarbeiterName = mitarbeiterDoc
    ? `${mitarbeiterDoc.vorname}-${mitarbeiterDoc.nachname}`
    : null;

  // Build R2 prefix using the entity type and identifier
  const entityType = kundeDoc ? 'Kunde' : (mitarbeiterDoc ? 'Mitarbeiter' : null);
  const entityDoc = kundeDoc || mitarbeiterDoc;
  const entityIdentifier = entityDoc
    ? await ensureSignaturOrdner(entityType, entityDoc)
    : null;

  const r2Prefix = buildSignaturR2Prefix({
    locationIdentifier: location.shortName || location.nameFull,
    entityType,
    entityIdentifier,
    typKey: signaturTyp.key,
  });

  // Create DocuSeal submission if templateId is provided
  let storedSubmitters = [];
  let submissionId     = null;
  let initialStatus    = 'draft';

  if (!draft && templateId && Array.isArray(submitters) && submitters.length > 0) {
    const apiSubmitters = submitters.map((s) => ({
      role:       s.role,
      name:       s.name,
      email:      s.email,
      send_email: !s.embedded,
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
    standort: standort || location.shortNameKey || null,
    locationV2: location._id,
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

    folgeaktionen: folgeaktionen || undefined,

    createdBy: req.user.id,
  });

  await vorgang.save();
  await vorgang.populate([
    { path: 'typ', select: 'key label linkedTo' },
    { path: 'locationV2', select: 'nameFull shortName color' },
  ]);
  res.status(201).json(vorgang);
}));

// ─── SINGLE GET ───────────────────────────────────────────────────────────────

// GET /api/signaturen/:id — fetch one, optionally refreshed from DocuSeal (?refresh=true)
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await SignaturVorgang.findById(req.params.id)
    .populate([
      { path: 'typ', select: 'key label linkedTo' },
      { path: 'locationV2', select: 'nameFull shortName color' },
    ]);
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
        await syncLinkedReisekosten(vorgang);
      }
    } catch (err) {
      logger.warn(`SignaturVorgang refresh failed for submission ${vorgang.submissionId}:`, err.message);
    }
  }

  res.json(vorgang);
}));

// ─── DOWNLOAD URLs ────────────────────────────────────────────────────────────

// GET /api/signaturen/:id/signed-url — presigned R2 URL for the signed PDF (inline)
// Falls back to fetching from DocuSeal and caching in R2 when r2KeySigned is not yet set.
router.get('/:id/signed-url', auth, asyncHandler(async (req, res) => {
  const vorgang = await SignaturVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  // If not cached yet but the DocuSeal submission is done, download & cache now.
  if (!vorgang.r2KeySigned && vorgang.submissionId && vorgang.status === 'completed') {
    try {
      const keyPrefix = isCanonicalSignaturPrefix(vorgang.r2Prefix)
        ? vorgang.r2Prefix
        : await buildR2PrefixForVorgang(vorgang);
      const result = await DocuSealService.storeSignedPdf(vorgang.submissionId, keyPrefix);
      if (result?.key) {
        vorgang.r2Prefix = keyPrefix;
        vorgang.r2KeySigned = result.key;
        await vorgang.save();
      }
    } catch (err) {
      logger.warn(`signed-url: DocuSeal fetch failed for ${vorgang._id}:`, err.message);
    }
  }

  if (!vorgang.r2KeySigned) {
    return res.status(409).json({ message: 'Noch kein unterschriebenes Dokument vorhanden' });
  }
  const safeName = vorgang.fileName || (vorgang.name.replace(/[^a-z0-9_\- ]/gi, '_') + '.pdf');
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

// ─── UPDATE DRAFT ────────────────────────────────────────────────────────────

// PATCH /api/signaturen/:id — update a draft's fields, optionally submit it
// Body: { name?, typId?, locationId?, standort?, kundeId?, mitarbeiterId?, templateId?, templateName?,
//         submitters?, folgeaktionen?, submit? }
// Only allowed when status === 'draft'.
// If submit: true, creates the DocuSeal submission and transitions to 'open'.
router.patch('/:id', auth, asyncHandler(async (req, res) => {
  const adminUser = await requireSignaturAccess(req, res);
  if (!adminUser) return;

  const vorgang = await SignaturVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  if (vorgang.status !== 'draft') {
    return res.status(409).json({ message: 'Nur Entwürfe können bearbeitet werden' });
  }

  const {
    name, typId, locationId, standort, kundeId, mitarbeiterId,
    templateId, templateName, submitters,
    folgeaktionen: folgeaktionenRaw,
    submit,
  } = req.body;

  const folgeaktionen = parseFolgeaktionen(folgeaktionenRaw);

  if (name !== undefined) vorgang.name = name;
  if (standort !== undefined) vorgang.standort = standort || null;

  if (typId !== undefined) {
    const signaturTyp = await SignaturTyp.findOne({ _id: typId, isActive: true });
    if (!signaturTyp) return res.status(400).json({ message: 'Ungültiger oder inaktiver Signaturtyp' });
    vorgang.typ = signaturTyp._id;
    vorgang.typKey = signaturTyp.key;
  }

  let resolvedLocation = null;
  if (locationId !== undefined) {
    resolvedLocation = await resolveSignaturLocation({ locationId });
    if (!resolvedLocation) return res.status(400).json({ message: 'Bitte eine gültige Location auswählen.' });
    vorgang.locationV2 = resolvedLocation._id;
    vorgang.standort = resolvedLocation.shortNameKey || vorgang.standort;
  }

  if (kundeId !== undefined) {
    if (kundeId) {
      const kundeDoc = await Kunde.findById(kundeId).select('kundenNr kundName kuerzel');
      if (!kundeDoc) return res.status(400).json({ message: 'Kunde nicht gefunden' });
      vorgang.kunde = kundeDoc._id;
      vorgang.kundenNr = kundeDoc.kundenNr;
      vorgang.kundenKuerzel = kundeDoc.kuerzel;
      vorgang.mitarbeiter = null;
      vorgang.mitarbeiterName = null;
    } else {
      vorgang.kunde = null;
      vorgang.kundenNr = null;
      vorgang.kundenKuerzel = null;
    }
  }

  if (mitarbeiterId !== undefined) {
    if (mitarbeiterId) {
      const mitarbeiterDoc = await Mitarbeiter.findById(mitarbeiterId).select('vorname nachname');
      if (!mitarbeiterDoc) return res.status(400).json({ message: 'Mitarbeiter nicht gefunden' });
      vorgang.mitarbeiter = mitarbeiterDoc._id;
      vorgang.mitarbeiterName = `${mitarbeiterDoc.vorname}-${mitarbeiterDoc.nachname}`;
      vorgang.kunde = null;
      vorgang.kundenNr = null;
      vorgang.kundenKuerzel = null;
    } else {
      vorgang.mitarbeiter = null;
      vorgang.mitarbeiterName = null;
    }
  }

  if (templateId !== undefined) {
    vorgang.docusealTemplateId   = templateId ? Number(templateId) : null;
    vorgang.docusealTemplateName = templateName || '';
  }

  if (folgeaktionen) vorgang.folgeaktionen = folgeaktionen;

  if (Array.isArray(submitters)) {
    vorgang.submitters = submitters.map((s) => ({
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

  if (submit) {
    const [signaturTyp, kundeDoc, mitarbeiterDoc] = await Promise.all([
      SignaturTyp.findById(vorgang.typ),
      vorgang.kunde
        ? Kunde.findById(vorgang.kunde).select('_id locationV2')
        : null,
      vorgang.mitarbeiter
        ? Mitarbeiter.findById(vorgang.mitarbeiter).select('_id locationV2')
        : null,
    ]);
    const entityValidationMessage = getEntityValidationMessage(signaturTyp, kundeDoc, mitarbeiterDoc);
    if (entityValidationMessage) return res.status(400).json({ message: entityValidationMessage });

    resolvedLocation = resolvedLocation || await resolveSignaturLocation({
      locationId: vorgang.locationV2,
      entityLocationId: kundeDoc?.locationV2 || mitarbeiterDoc?.locationV2,
      standort: vorgang.standort,
    });
    if (!resolvedLocation) return res.status(400).json({ message: 'Bitte eine gültige Location auswählen.' });
    vorgang.locationV2 = resolvedLocation._id;
    vorgang.standort = resolvedLocation.shortNameKey || vorgang.standort;

    if (vorgang.docusealTemplateId && Array.isArray(vorgang.submitters) && vorgang.submitters.length > 0) {
      const apiSubmitters = vorgang.submitters.map((s) => ({
        role:       s.role,
        name:       s.name,
        email:      s.email,
        send_email: !s.embedded,
      }));

      const result = await DocuSealService.createSubmission({
        templateId: vorgang.docusealTemplateId,
        submitters: apiSubmitters,
        order: 'preserved',
      });

      const resultArr    = Array.isArray(result) ? result : (result?.submitters || []);
      vorgang.submissionId = resultArr.length ? resultArr[0].submission_id : undefined;
      const prevSubs = [...vorgang.submitters];
      vorgang.submitters = resultArr.map((apiSub) => {
        const requested = prevSubs.find(
          (s) => (s.email && s.email === apiSub.email) || s.role === apiSub.role
        ) || {};
        return mapSubmitter(apiSub, requested);
      });
      vorgang.status = 'open';
    } else {
      vorgang.status = 'open';
    }

    vorgang.r2Prefix = await buildR2PrefixForVorgang(vorgang, resolvedLocation);
  }

  await vorgang.save();
  await vorgang.populate([
    { path: 'typ', select: 'key label linkedTo' },
    { path: 'locationV2', select: 'nameFull shortName color' },
  ]);
  broadcastSignaturEvent('vorgang.updated', vorgang.toObject());
  res.json(vorgang);
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

  const unsignedPdfKey = vorgang.status === 'draft' && vorgang.typKey === 'stundenliste'
    ? vorgang.r2KeyUnsigned
    : '';

  vorgang.status      = 'cancelled';
  vorgang.cancelledAt = new Date();
  await vorgang.save();

  if (unsignedPdfKey) {
    try {
      await R2Service.deleteFile(unsignedPdfKey);
    } catch (err) {
      logger.warn(`SignaturVorgang: unsigned Stundenliste delete failed for ${vorgang._id}:`, err.message);
    }
  }

  broadcastSignaturEvent('vorgang.updated', vorgang.toObject());
  res.json({ message: 'Vorgang storniert', vorgang });
}));

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────

// POST /api/signaturen/webhook — DocuSeal event webhook for SignaturVorgang records
// Configure in DocuSeal dashboard alongside (or instead of) /api/docuseal/webhook.
router.post('/webhook', verifyDocuSealWebhook, asyncHandler(async (req, res) => {
  // Acknowledge immediately so DocuSeal doesn't retry
  res.sendStatus(200);

  const { event_type: eventType, data } = req.body || {};
  logger.info(
    `DocuSeal webhook received: event=${eventType || 'missing'}, formId=${data?.id || 'missing'}, submissionId=${data?.submission_id || data?.submission?.id || 'missing'}`
  );
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
    const r2Prefix = isCanonicalSignaturPrefix(vorgang.r2Prefix)
      ? vorgang.r2Prefix
      : await buildR2PrefixForVorgang(vorgang);
    vorgang.r2Prefix = r2Prefix;

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

  // Keep a linked Reisekostenabrechnung's status in sync with its signature process.
  await syncLinkedReisekosten(vorgang);

  logger.info(`SignaturRoutes webhook: processed ${eventType} for submission ${submissionId}.`);
  broadcastSignaturEvent('vorgang.updated', vorgang.toObject());

  // Execute folgeaktionen after the submission is fully completed and PDF is stored
  if (eventType === 'submission.completed') {
    executeFolgeaktionen(vorgang).catch((err) =>
      logger.error(`SignaturRoutes webhook: executeFolgeaktionen fehlgeschlagen für ${vorgang._id}:`, err.message)
    );
  }
}));

module.exports = router;
