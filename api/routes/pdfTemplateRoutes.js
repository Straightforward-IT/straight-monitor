const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const PdfTemplate = require('../models/PdfTemplate');
const { sortedPdfs, buildFilledPdf } = require('../utils/pdfRender');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Nur PDF-Dateien erlaubt'));
    }
    cb(null, true);
  }
});

// Helper: strip pdfData from template subdocs before sending to client
function stripPdfData(template) {
  const obj = template.toObject ? template.toObject() : template;
  return {
    ...obj,
    pdfs: (obj.pdfs || []).map(({ pdfData: _pd, ...rest }) => rest),
  };
}

// ─── GET /api/pdf-templates ────────────────────────────────────────────────
router.get('/', auth, asyncHandler(async (req, res) => {
  const templates = await PdfTemplate.find({}).sort({ createdAt: -1 });
  res.json(templates.map(stripPdfData));
}));

// ─── POST /api/pdf-templates ───────────────────────────────────────────────
// Create empty template (name/description only – add PDFs via /pdfs endpoint)
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Name ist erforderlich' });

  const template = new PdfTemplate({
    name,
    description: description || '',
    pdfs: [],
    bookmarks: [],
    placements: [],
    createdBy: req.user.id,
  });

  await template.save();
  logger.info(`PDF-Template erstellt: ${name}`);
  res.status(201).json(stripPdfData(template));
}));

// ─── GET /api/pdf-templates/:id ───────────────────────────────────────────
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  res.json(stripPdfData(template));
}));

// ─── PUT /api/pdf-templates/:id ───────────────────────────────────────────
// Update name / description / bookmarks / placements
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const { name, description, bookmarks, placements } = req.body;
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  if (name !== undefined)        template.name = name;
  if (description !== undefined) template.description = description;
  if (bookmarks !== undefined)   template.bookmarks = bookmarks;
  if (placements !== undefined)  template.placements = placements;
  // Increment version once if any structural content changed (bookmarks or placements)
  if (bookmarks !== undefined || placements !== undefined) {
    template.version = (template.version || 1) + 1;
  }

  await template.save();
  logger.info(`PDF-Template aktualisiert: ${template.name}`);
  res.json(stripPdfData(template));
}));

// ─── DELETE /api/pdf-templates/:id ────────────────────────────────────────
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findByIdAndDelete(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  logger.info(`PDF-Template gelöscht: ${template.name}`);
  res.json({ message: 'Gelöscht' });
}));

// ─── POST /api/pdf-templates/:id/pdfs ─────────────────────────────────────
// Upload a PDF file and add it to the template
router.post('/:id/pdfs', auth, upload.single('pdf'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Keine Datei hochgeladen' });

  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  let pageCount = 1;
  try {
    const pdfDoc = await PDFDocument.load(req.file.buffer);
    pageCount = pdfDoc.getPageCount();
  } catch (e) {
    logger.warn('pdf-lib konnte Seitenanzahl nicht lesen:', e.message);
  }

  const maxOrder = template.pdfs.length > 0
    ? Math.max(...template.pdfs.map(p => p.order))
    : -1;

  const pdfEntry = {
    id: crypto.randomBytes(8).toString('hex'),
    filename: req.file.originalname,
    pdfData: req.file.buffer,
    pageCount,
    order: maxOrder + 1,
  };

  template.pdfs.push(pdfEntry);
  template.version = (template.version || 1) + 1;
  await template.save();
  logger.info(`PDF hinzugefügt zu Vorlage "${template.name}": ${req.file.originalname} (${pageCount} Seiten)`);

  res.status(201).json({ id: pdfEntry.id, filename: pdfEntry.filename, pageCount, order: pdfEntry.order });
}));

// ─── DELETE /api/pdf-templates/:id/pdfs/:pdfId ────────────────────────────
router.delete('/:id/pdfs/:pdfId', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  const idx = template.pdfs.findIndex(p => p.id === req.params.pdfId);
  if (idx === -1) return res.status(404).json({ message: 'PDF nicht gefunden' });

  const removedOrder = template.pdfs[idx].order;
  template.pdfs.splice(idx, 1);
  template.version = (template.version || 1) + 1;

  // Remove placements that reference this pdf by order-index
  const orderedIds = [...template.pdfs].sort((a, b) => a.order - b.order).map(p => p.id);
  template.placements = template.placements.filter(pl => {
    const srcPdf = orderedIds[pl.pdfIndex];
    return srcPdf !== undefined;
  });

  await template.save();
  res.json({ message: 'PDF entfernt' });
}));

// ─── PUT /api/pdf-templates/:id/pdfs/reorder ──────────────────────────────
// Body: { order: [pdfId, pdfId, ...] } – defines the new ordering
router.put('/:id/pdfs/reorder', auth, asyncHandler(async (req, res) => {
  const { order } = req.body; // array of pdfIds in desired order
  if (!Array.isArray(order)) return res.status(400).json({ message: 'order muss ein Array sein' });

  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  // Update order field on each pdf
  order.forEach((id, idx) => {
    const pdf = template.pdfs.find(p => p.id === id);
    if (pdf) pdf.order = idx;
  });

  // Renumber placements: their pdfIndex refers to the index in sorted-by-order array
  // Since we just changed order fields, recompute pdfIndex for all placements
  const newOrderedIds = [...template.pdfs].sort((a, b) => a.order - b.order).map(p => p.id);
  // Build old→new index map based on pdfId
  const idToNewIdx = {};
  newOrderedIds.forEach((id, idx) => { idToNewIdx[id] = idx; });

  // Get old ordered ids (before this save, they still have old order values)
  // The placements already reference old pdfIndex values, which we should keep valid.
  // Since order is just being reassigned, pdfIndex stays the same (positionally); 
  // only user reordering changes which PDF is at which visual position.
  // We store pdfIndex as sorted order index, so update placements to new index.
  const oldOrderedIds = [...template.pdfs]
    .sort((a, b) => a.order - b.order)
    .map(p => p.id);

  template.placements = template.placements.map(pl => {
    const oldId = oldOrderedIds[pl.pdfIndex];
    if (oldId && idToNewIdx[oldId] !== undefined) {
      return { ...pl.toObject(), pdfIndex: idToNewIdx[oldId] };
    }
    return pl;
  });

  template.version = (template.version || 1) + 1;
  await template.save();
  res.json(stripPdfData(template));
}));

// ─── GET /api/pdf-templates/:id/pdfs/:pdfIndex ────────────────────────────
// Serve the raw bytes of one PDF file (0-indexed, sorted by order)
router.get('/:id/pdfs/:pdfIndex', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  const idx = parseInt(req.params.pdfIndex, 10);
  const ordered = sortedPdfs(template);
  const pdf = ordered[idx];
  if (!pdf) return res.status(404).json({ message: 'PDF nicht gefunden' });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${pdf.filename}"`,
  });
  res.send(pdf.pdfData);
}));

// ─── POST /api/pdf-templates/:id/preview ──────────────────────────────────
// Build a merged preview PDF (no values filled) and serve it
router.get('/:id/preview', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  if (template.pdfs.length === 0) return res.status(400).json({ message: 'Keine PDFs in der Vorlage' });

  const bytes = await buildFilledPdf(template, {});
  const safeName = template.name.replace(/[^a-z0-9_\-]/gi, '_');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${safeName}_vorschau.pdf"` });
  res.send(bytes);
}));

module.exports = router;
