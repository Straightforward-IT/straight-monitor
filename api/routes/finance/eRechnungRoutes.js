const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/AsyncHandler');
const logger = require('../../utils/logger');
const { generateZugferd, ZugferdValidationError } = require('../../services/finance/ZugferdService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, file.mimetype === 'application/pdf'),
});

// POST /api/e-rechnungen/zugferd
// multipart/form-data: invoice (JSON string), pdf (visual invoice PDF)
router.post('/zugferd', auth, upload.single('pdf'), asyncHandler(async (req, res) => {
  let invoice;
  try {
    invoice = JSON.parse(req.body.invoice || '');
  } catch {
    return res.status(400).json({ message: 'Das Feld invoice muss gültiges JSON enthalten.' });
  }

  try {
    const document = await generateZugferd(invoice, req.file);
    const invoiceNumber = String(invoice['ubl:Invoice']?.['cbc:ID'] || 'rechnung').replace(/[^a-z0-9_-]/gi, '_');

    res
      .status(200)
      .type('application/pdf')
      .attachment(`ZUGFeRD-${invoiceNumber}.pdf`)
      .send(document);
  } catch (error) {
    if (error instanceof ZugferdValidationError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    logger.error('[ZUGFeRD] Generation failed:', error);
    return res.status(422).json({ message: 'Die ZUGFeRD-Rechnung konnte nicht generiert werden.', detail: error.message });
  }
}));

module.exports = router;