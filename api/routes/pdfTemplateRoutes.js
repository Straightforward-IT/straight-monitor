const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const PdfTemplate = require('../models/PdfTemplate');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Nur PDF-Dateien erlaubt'));
    }
    cb(null, true);
  }
});

// ─── GET /api/pdf-templates ────────────────────────────────────────────────
// List all templates (metadata only, no raw PDF bytes)
router.get('/', auth, asyncHandler(async (req, res) => {
  const templates = await PdfTemplate.find({}, '-pdfData').sort({ createdAt: -1 });
  res.json(templates);
}));

// ─── POST /api/pdf-templates ───────────────────────────────────────────────
// Upload a new PDF template
router.post('/', auth, upload.single('pdf'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Keine Datei hochgeladen' });

  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Name ist erforderlich' });

  // Determine page count via pdf-lib
  let pageCount = 1;
  try {
    const pdfDoc = await PDFDocument.load(req.file.buffer);
    pageCount = pdfDoc.getPageCount();
  } catch (e) {
    logger.warn('pdf-lib konnte Seitenanzahl nicht lesen:', e.message);
  }

  const template = new PdfTemplate({
    name,
    description: description || '',
    filename: req.file.originalname,
    pdfData: req.file.buffer,
    pageCount,
    fields: [],
    createdBy: req.user.id
  });

  await template.save();
  logger.info(`PDF-Template erstellt: ${name} (${pageCount} Seiten)`);

  // Return without pdfData
  const { pdfData: _, ...meta } = template.toObject();
  res.status(201).json(meta);
}));

// ─── GET /api/pdf-templates/:id ───────────────────────────────────────────
// Get template metadata + fields (no raw PDF)
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id, '-pdfData');
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  res.json(template);
}));

// ─── GET /api/pdf-templates/:id/pdf ───────────────────────────────────────
// Serve the raw PDF bytes for preview
router.get('/:id/pdf', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id, 'pdfData filename');
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${template.filename}"`
  });
  res.send(template.pdfData);
}));

// ─── PUT /api/pdf-templates/:id ───────────────────────────────────────────
// Update name / description / fields layout
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const { name, description, fields } = req.body;
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  if (name !== undefined) template.name = name;
  if (description !== undefined) template.description = description;
  if (fields !== undefined) template.fields = fields;

  await template.save();
  logger.info(`PDF-Template aktualisiert: ${template.name}`);

  const { pdfData: _, ...meta } = template.toObject();
  res.json(meta);
}));

// ─── DELETE /api/pdf-templates/:id ────────────────────────────────────────
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findByIdAndDelete(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
  logger.info(`PDF-Template gelöscht: ${template.name}`);
  res.json({ message: 'Gelöscht' });
}));

// ─── POST /api/pdf-templates/:id/fill ─────────────────────────────────────
// Fill PDF with form values and return as download
router.post('/:id/fill', auth, asyncHandler(async (req, res) => {
  const template = await PdfTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });

  const values = req.body.values || {}; // { fieldId: value, ... }

  const pdfDoc = await PDFDocument.load(template.pdfData);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of template.fields) {
    const page = pages[field.page];
    if (!page) continue;

    const { width: pageW, height: pageH } = page.getSize();

    // Convert % positions to absolute points
    const absX = (field.x / 100) * pageW;
    const absY = pageH - (field.y / 100) * pageH; // PDF coordinate origin is bottom-left
    const absW = (field.width / 100) * pageW;
    const absH = (field.height / 100) * pageH;

    const value = values[field.id] !== undefined
      ? String(values[field.id])
      : (field.defaultValue || '');

    if (field.type === 'checkbox') {
      const checked = value === 'true' || value === '1' || value === 'ja';
      if (checked) {
        // Draw a cross (X) inside the checkbox bounds
        page.drawLine({ start: { x: absX, y: absY - absH }, end: { x: absX + absW, y: absY }, thickness: 1.5, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: absX + absW, y: absY - absH }, end: { x: absX, y: absY }, thickness: 1.5, color: rgb(0, 0, 0) });
      }
    } else {
      // Text / Date / Signature
      const text = value;
      if (text) {
        const fs = field.fontSize || 11;
        // Field display height matches frontend: fs * 1.5
        // Bottom edge in PDF coords = absY - fs*1.5
        // Baseline sits just above bottom border (descender room ≈ 0.2*fs)
        const fieldBottom = absY - (fs * 1.5);
        page.drawText(text, {
          x: absX,
          y: fieldBottom + fs * 0.2,
          size: fs,
          font,
          color: rgb(0, 0, 0),
          maxWidth: absW,
        });
      }
    }
  }

  const filledBytes = await pdfDoc.save();
  const safeName = template.name.replace(/[^a-z0-9_\-]/gi, '_');

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeName}_ausgefuellt.pdf"`
  });
  res.send(Buffer.from(filledBytes));
}));

module.exports = router;
