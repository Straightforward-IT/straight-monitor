const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const service = require('../../services/payroll/AbrechnungService');
const { INPUT_ROLES, REFERENCE_ROLES } = require('../../domain/payroll/detailImport');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const resolveUser = wrap(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const id = req.user?.id || req.user?._id;
  const user = mongoose.isValidObjectId(id) ? await User.findById(id).select('name role roles isConfirmed locationV2 locationAccess').lean() : null;
  if (!user?.isConfirmed) return res.status(401).json({ message: 'Bestätigter interner Benutzer erforderlich.' });
  req.abrechnungUser = user; next();
});
function router() { const value = express.Router(); value.use(auth, resolveUser); return value; }
const imports = router(), bookings = router(), runs = router();
imports.use((req, res, next) => service.isAdmin(req.abrechnungUser) ? next() : res.status(403).json({ message: 'Detailimports sind Admin-Aufgabe.' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 4, fields: 5, fieldSize: 1024 }, fileFilter: (_req, file, callback) => {
  if (!/\.xlsx?$/i.test(file.originalname)) return callback(Object.assign(new Error('Excel-Dateien (.xls oder .xlsx) erforderlich.'), { statusCode: 400 }));
  callback(null, true);
} }).fields([...INPUT_ROLES, ...REFERENCE_ROLES].map(name => ({ name, maxCount: 1 })));
imports.get('/', wrap(async (req, res) => res.json(await service.listImports(req.abrechnungUser))));
imports.post('/preview', upload, wrap(async (req, res) => res.json(await service.preview(Object.values(req.files || {}).flat(), req.body, req.abrechnungUser))));
imports.get('/:id', wrap(async (req, res) => res.json(await service.getImport(req.params.id, req.abrechnungUser))));
imports.post('/:id/activate', wrap(async (req, res) => {
  if (Object.keys(req.body || {}).some(key => key !== 'expectedRevision')) return res.status(400).json({ message: 'Nur expectedRevision ist zulässig.' });
  res.json(await service.activate(req.params.id, req.body?.expectedRevision, req.abrechnungUser));
}));
bookings.get('/', wrap(async (req, res) => res.json(await service.bookings(req.abrechnungUser, req.query))));
runs.post('/', wrap(async (req, res) => res.json(await service.calculate(req.abrechnungUser, req.body))));
runs.get('/:id', wrap(async (req, res) => res.json(await service.getRun(req.abrechnungUser, req.params.id))));
runs.post('/:id/compare', wrap(async (req, res) => res.json(await service.compare(req.abrechnungUser, req.params.id, req.body))));
for (const value of [imports, bookings, runs]) value.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? 400 : error.statusCode || (['CastError', 'ValidationError', 'StrictModeError'].includes(error.name) ? 400 : 500);
  // Never send/log raw time, financial inputs, or credentials on unexpected errors.
  res.status(status).json({ code: status < 500 ? error.code || 'ABRECHNUNG_INVALID' : 'ABRECHNUNG_ERROR', message: status < 500 ? error.message : 'Abrechnungsdaten konnten nicht verarbeitet werden.' });
});
module.exports = { imports, bookings, runs };
