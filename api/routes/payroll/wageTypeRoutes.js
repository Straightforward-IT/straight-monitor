const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAdmin');
const logger = require('../../utils/logger');
const service = require('../../services/payroll/WageTypeService');

function createWageTypeRouter(options = {}) {
  const router = express.Router();
  const api = options.service || service;
  const authenticate = options.auth || auth;
  const authorizeImport = options.requireAdmin || requireAdmin;
  const logImport = options.logImport || (async () => {});
  const upload = multer({ storage: multer.memoryStorage() });

  router.get('/lohnarten', authenticate, async (req, res) => {
    try { res.json({ success: true, data: await api.list() }); }
    catch (error) { logger.error('GET Lohnarten Error:', error); res.status(500).json({ success: false, message: 'Fehler beim Abrufen der Lohnarten.' }); }
  });
  router.get('/lohnarten/nummer/:number', authenticate, async (req, res) => {
    if (!/^\d{1,12}$/.test(req.params.number)) return res.status(400).json({ success: false, message: 'Ungültige Lohnartnummer.' });
    try {
      const data = await api.detailByNumber(req.params.number);
      if (!data) return res.status(404).json({ success: false, message: 'Lohnart nicht gefunden.' });
      res.json({ success: true, data });
    } catch (error) { logger.error('GET Lohnartdetails nach Nummer Error:', error); res.status(500).json({ success: false, message: 'Lohnartdetails konnten nicht geladen werden.' }); }
  });
  router.get('/lohnarten/:id', authenticate, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Ungültige Lohnart-ID.' });
    try {
      const data = await api.detail(req.params.id);
      if (!data) return res.status(404).json({ success: false, message: 'Lohnart nicht gefunden.' });
      res.json({ success: true, data });
    } catch (error) { logger.error('GET Lohnartdetails Error:', error); res.status(500).json({ success: false, message: 'Lohnartdetails konnten nicht geladen werden.' }); }
  });
  router.post('/lohnart', authenticate, authorizeImport, (req, res, next) => {
    req.setTimeout(600000); res.setTimeout(600000); next();
  }, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    try {
      const details = await api.importWorkbook(req.file.buffer, { filename: req.file.originalname });
      await logImport('lohnart', req.file.originalname, 'success', details.total, details, req.user?.id);
      res.json({ success: true, message: `${details.total} Lohnarten verarbeitet: ${details.inserted} neu, ${details.updated} aktualisiert, ${details.unchanged} unverändert.`, details });
    } catch (error) {
      const status = error.statusCode || error.status || 500;
      if (status >= 500) logger.error('Import Lohnart Error:', error);
      await logImport('lohnart', req.file.originalname, 'failed', 0, { message: error.message, issues: error.issues || [] }, req.user?.id);
      res.status(status).json({ success: false, message: status < 500 ? error.message : 'Fehler beim Importieren der Lohnarten.', issues: error.issues || [] });
    }
  });
  return router;
}

module.exports = { createWageTypeRouter };
