const express = require('express');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const PdfVorgang = require('../models/PdfVorgang');
const PdfTemplate = require('../models/PdfTemplate');
const { buildFilledPdf } = require('../utils/pdfRender');
const R2Service = require('../R2Service');

const router = express.Router();

// ─── Public endpoints (no auth – token-based) ──────────────────────────────

// GET /api/pdf-vorgaenge/formular/:token
// Return the list of mitarbeiter bookmarks and current mitarbeiterValues so the
// employee-facing form can be rendered.
router.get('/formular/:token', asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findOne({ token: req.params.token });
  if (!vorgang) return res.status(404).json({ message: 'Formular nicht gefunden' });

  // Use the snapshot bookmarks captured at Vorgang creation.
  // Fall back to live template only if the Vorgang pre-dates versioning.
  let mitarbeiterBookmarks;
  if (vorgang.snapshotBookmarks && vorgang.snapshotBookmarks.length > 0) {
    mitarbeiterBookmarks = vorgang.snapshotBookmarks.filter(b => b.fillRole === 'mitarbeiter');
  } else {
    const template = await PdfTemplate.findById(vorgang.templateId);
    if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
    mitarbeiterBookmarks = template.bookmarks.filter(b => b.fillRole === 'mitarbeiter');
  }

  // Still need templateName from live template
  const template = await PdfTemplate.findById(vorgang.templateId, 'name');

  res.json({
    vorgangName: vorgang.name,
    templateName: template?.name ?? '',
    bookmarks: mitarbeiterBookmarks,
    values: vorgang.mitarbeiterValues || {},
    status: vorgang.status,
    pdfUrl: vorgang.pdfUrl,
  });
}));

// POST /api/pdf-vorgaenge/formular/:token/submit
// Employee submits their values → status becomes 'bereit'.
router.post('/formular/:token/submit', asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findOne({ token: req.params.token });
  if (!vorgang) return res.status(404).json({ message: 'Formular nicht gefunden' });

  const { values } = req.body;
  if (!values || typeof values !== 'object') {
    return res.status(400).json({ message: 'values fehlt' });
  }

  // Only allow values for mitarbeiter-role bookmarks (use snapshot if available)
  const bookmarksForValidation = (vorgang.snapshotBookmarks && vorgang.snapshotBookmarks.length > 0)
    ? vorgang.snapshotBookmarks
    : (await PdfTemplate.findById(vorgang.templateId, 'bookmarks'))?.bookmarks ?? [];

  const allowed = new Set(bookmarksForValidation
    .filter(b => b.fillRole === 'mitarbeiter')
    .map(b => b.id));

  const safeValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (allowed.has(k)) safeValues[k] = v;
  }

  vorgang.mitarbeiterValues = safeValues;
  vorgang.status = 'bereit';

  // Generate the PDF straight away and upload to Cloudflare R2
  try {
    const template = await PdfTemplate.findById(vorgang.templateId);
    if (template && template.pdfs.length > 0) {
      const renderTemplate = {
        pdfs:       template.pdfs,
        bookmarks:  (vorgang.snapshotBookmarks && vorgang.snapshotBookmarks.length > 0) ? vorgang.snapshotBookmarks : template.bookmarks,
        placements: (vorgang.snapshotPlacements && vorgang.snapshotPlacements.length > 0) ? vorgang.snapshotPlacements : template.placements,
      };

      const mergedValues = { ...(vorgang.operatorValues || {}), ...safeValues };
      const pdfBytes = await buildFilledPdf(renderTemplate, mergedValues);
      
      const safeName = vorgang.name.replace(/[^a-z0-9_\-]/gi, '_');
      const fileKey = `vorgaenge/${vorgang._id}/${safeName}.pdf`;
      
      await R2Service.uploadFile(fileKey, pdfBytes, 'application/pdf');
      
      vorgang.pdfKey = fileKey;
      vorgang.pdfUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`;
    }
  } catch (err) {
    logger.error(`Fehler bei der PDF-Generierung für Vorgang ${vorgang._id}:`, err);
  }

  await vorgang.save();

  logger.info(`Mitarbeiter-Formular ausgefüllt für Vorgang: ${vorgang.name}`);
  res.json({ message: 'Danke, deine Angaben wurden übermittelt.', pdfUrl: vorgang.pdfUrl });
}));

// ─── Authenticated endpoints ───────────────────────────────────────────────

// GET /api/pdf-vorgaenge
// List vorgänge. Optional query: ?templateId=...
router.get('/', auth, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.templateId) filter.templateId = req.query.templateId;
  const list = await PdfVorgang.find(filter).sort({ createdAt: -1 }).lean();
  res.json(list);
}));

// POST /api/pdf-vorgaenge
// Create a new Vorgang from a template
router.post('/', auth, asyncHandler(async (req, res) => {
  const { templateId, name, mitarbeiterEmail, mitarbeiterName } = req.body;
  if (!templateId) return res.status(400).json({ message: 'templateId fehlt' });
  if (!name)       return res.status(400).json({ message: 'name fehlt' });

  const template = await PdfTemplate.findById(templateId);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  // Pre-fill operator defaults from bookmark defaultValues
  const operatorValues = {};
  for (const bm of template.bookmarks.filter(b => b.fillRole === 'bediener')) {
    operatorValues[bm.id] = bm.defaultValue || '';
  }

  // Snapshot the template's current state so this Vorgang is independent of future edits
  const snapshotBookmarks  = template.bookmarks.map(b => b.toObject ? b.toObject() : { ...b });
  const snapshotPlacements = template.placements.map(p => p.toObject ? p.toObject() : { ...p });

  const vorgang = new PdfVorgang({
    templateId,
    name,
    mitarbeiterEmail: mitarbeiterEmail || '',
    mitarbeiterName:  mitarbeiterName || '',
    operatorValues,
    mitarbeiterValues: {},
    status: 'offen',
    templateVersion:    template.version || 1,
    snapshotBookmarks,
    snapshotPlacements,
    createdBy: req.user.id,
  });

  await vorgang.save();
  logger.info(`Vorgang erstellt: ${name} (Vorlage: ${template.name})`);
  res.status(201).json(vorgang);
}));

// GET /api/pdf-vorgaenge/:id
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findById(req.params.id).lean();
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  res.json(vorgang);
}));

// PUT /api/pdf-vorgaenge/:id
// Update operator values, name, mitarbeiterEmail, etc.
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const { name, mitarbeiterEmail, mitarbeiterName, operatorValues, status } = req.body;
  const vorgang = await PdfVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  let needsPdfRegen = false;

  if (name !== undefined)             vorgang.name             = name;
  if (mitarbeiterEmail !== undefined) vorgang.mitarbeiterEmail = mitarbeiterEmail;
  if (mitarbeiterName !== undefined)  vorgang.mitarbeiterName  = mitarbeiterName;
  
  if (operatorValues !== undefined) {
    vorgang.operatorValues = operatorValues;
    needsPdfRegen = true;
  }
  
  if (status !== undefined) {
    vorgang.status = status;
    if (status === 'bereit') needsPdfRegen = true;
  }

  // If data changed and it is "bereit", regenerate and upload to R2
  if (needsPdfRegen && vorgang.status === 'bereit') {
    try {
      const template = await PdfTemplate.findById(vorgang.templateId);
      if (template && template.pdfs.length > 0) {
        const renderTemplate = {
          pdfs:       template.pdfs,
          bookmarks:  (vorgang.snapshotBookmarks && vorgang.snapshotBookmarks.length > 0) ? vorgang.snapshotBookmarks : template.bookmarks,
          placements: (vorgang.snapshotPlacements && vorgang.snapshotPlacements.length > 0) ? vorgang.snapshotPlacements : template.placements,
        };
        const mergedValues = { ...(vorgang.operatorValues || {}), ...(vorgang.mitarbeiterValues || {}) };
        const pdfBytes = await buildFilledPdf(renderTemplate, mergedValues);
        
        const safeName = vorgang.name.replace(/[^a-z0-9_\-]/gi, '_');
        const fileKey = `vorgaenge/${vorgang._id}/${safeName}.pdf`;
        
        await R2Service.uploadFile(fileKey, pdfBytes, 'application/pdf');
        vorgang.pdfKey = fileKey;
        vorgang.pdfUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`;
      }
    } catch (err) {
      logger.error(`Fehler bei der PDF-Neugenerierung für Vorgang ${vorgang._id}:`, err);
    }
  }

  await vorgang.save();
  res.json(vorgang);
}));

// DELETE /api/pdf-vorgaenge/:id
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findByIdAndDelete(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  if (vorgang.pdfKey) {
    try {
      await R2Service.deleteFile(vorgang.pdfKey);
    } catch (err) {
      logger.warn(`Could not delete file ${vorgang.pdfKey} from R2 when deleting Vorgang:`, err.message);
    }
  }

  logger.info(`Vorgang gelöscht: ${vorgang.name}`);
  res.json({ message: 'Gelöscht' });
}));

// POST /api/pdf-vorgaenge/:id/send-email
// Placeholder: logs the intent. Real email sending will be added later.
router.post('/:id/send-email', auth, asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  if (!vorgang.mitarbeiterEmail) {
    return res.status(400).json({ message: 'Keine Mitarbeiter-E-Mail angegeben' });
  }

  const formUrl = `${process.env.FRONTEND_URL || 'https://straightmonitor.com'}/formular/${vorgang.token}`;
  logger.info(`[PDF-Vorgang] E-Mail senden an ${vorgang.mitarbeiterEmail}: ${formUrl}`);

  // TODO: integrate EmailService to actually send the email
  res.json({ message: 'E-Mail-Versand vorgemerkt (noch nicht implementiert)', formUrl });
}));

// GET /api/pdf-vorgaenge/:id/download
// Return the filled PDF from R2 (or generate on the fly and upload if missing)
router.get('/:id/download', auth, asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findById(req.params.id);
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });
  const safeName = vorgang.name.replace(/[^a-z0-9_\-]/gi, '_');

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
  });

  // If we already have the finalized PDF in R2, stream it directly
  if (vorgang.pdfKey) {
    try {
      const buffer = await R2Service.downloadFile(vorgang.pdfKey);
      return res.send(buffer);
    } catch (err) {
      logger.error(`Error downloading Vorgang PDF from R2 (key: ${vorgang.pdfKey}):`, err);
      // Fallback: continue to re-generate it on the fly
    }
  }

  const template = await PdfTemplate.findById(vorgang.templateId);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  if (template.pdfs.length === 0) return res.status(400).json({ message: 'Vorlage hat keine PDFs' });

  // Use the snapshot bookmarks + placements so the PDF reflects the state at Vorgang creation.
  // The live template PDFs are still used.
  const renderTemplate = {
    pdfs:       template.pdfs,
    bookmarks:  (vorgang.snapshotBookmarks  && vorgang.snapshotBookmarks.length  > 0)
                  ? vorgang.snapshotBookmarks  : template.bookmarks,
    placements: (vorgang.snapshotPlacements && vorgang.snapshotPlacements.length > 0)
                  ? vorgang.snapshotPlacements : template.placements,
  };

  // Merge operator and mitarbeiter values (mitarbeiter wins on conflict)
  const values = { ...(vorgang.operatorValues || {}), ...(vorgang.mitarbeiterValues || {}) };

  const pdfBytes = await buildFilledPdf(renderTemplate, values);

  // Since it was missing, let's cache it to R2 now for future fast downloads
  if (vorgang.status === 'bereit') {
    const fileKey = `vorgaenge/${vorgang._id}/${safeName}.pdf`;
    try {
      await R2Service.uploadFile(fileKey, pdfBytes, 'application/pdf');
      vorgang.pdfKey = fileKey;
      vorgang.pdfUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`;
      await vorgang.save();
    } catch (uploadErr) {
      logger.warn('Failed to upload dynamically generated Vorgang PDF to R2:', uploadErr);
    }
  }

  res.send(pdfBytes);
}));

// GET /api/pdf-vorgaenge/:id/formlink
// Return the public form URL for conveniently sharing the Mitarbeiter link
router.get('/:id/formlink', auth, asyncHandler(async (req, res) => {
  const vorgang = await PdfVorgang.findById(req.params.id, 'token mitarbeiterEmail status');
  if (!vorgang) return res.status(404).json({ message: 'Vorgang nicht gefunden' });

  const formUrl = `${process.env.FRONTEND_URL || 'https://straightmonitor.com'}/formular/${vorgang.token}`;
  res.json({ formUrl, token: vorgang.token });
}));

module.exports = router;
