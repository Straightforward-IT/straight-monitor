const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const { isAdmin } = require('../../middleware/requireAdmin');
const service = require('../../services/payroll/ZvooveHoursService');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(auth, wrap(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const id = req.user?.id || req.user?._id;
  const user = mongoose.isValidObjectId(id) ? await User.findById(id).select('role roles isConfirmed locationV2 locationAccess').lean() : null;
  if (!user?.isConfirmed) return res.status(401).json({ message: 'Bestätigter interner Benutzer erforderlich.' });
  req.payrollUser = user; next();
}));
router.use('/imports', (req, res, next) => {
  if (!isAdmin(req.payrollUser)) return res.status(403).json({ message: 'Stundenimports sind ausschließlich für Admins verfügbar.' });
  next();
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 }, fileFilter: (_req, file, callback) => {
  if (!/\.xlsx?$/i.test(file.originalname)) return callback(Object.assign(new Error('Eine Excel-Datei (.xls oder .xlsx) ist erforderlich.'), { statusCode: 400 }));
  if ([...file.originalname].every(character => character.codePointAt(0) <= 255)) {
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD') && Buffer.from(decoded, 'utf8').toString('latin1') === file.originalname) file.originalname = decoded;
  }
  callback(null, true);
} });
router.get('/imports', wrap(async (_req, res) => res.json(await service.imports())));
router.post('/imports/preview', upload.single('file'), wrap(async (req, res) => res.json(await service.preview(req.file, req.payrollUser._id))));
router.get('/imports/:id', wrap(async (req, res) => res.json(await service.getImport(req.params.id))));
router.post('/imports/:id/activate', wrap(async (req, res) => res.json(await service.activate(req.params.id, req.body?.expectedRevision, req.payrollUser._id))));
router.get('/employees/:employeeId/month', wrap(async (req, res) => res.json(await service.month(req.payrollUser, req.params.employeeId, req.query.month))));
router.get('/employees/:employeeId/positions', wrap(async (req, res) => {
  if (Object.keys(req.query).some(key => key !== 'month')) return res.status(400).json({ message: 'Nur month ist als Auswahl zulässig.' });
  res.json(await require('../../services/payroll/PayrollPositionsService').month(req.payrollUser, req.params.employeeId, req.query.month));
}));
router.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? 400 : error.statusCode || (error.name === 'CastError' || error.name === 'ValidationError' ? 400 : 500);
  res.status(status).json({ code: status < 500 ? error.code || 'PAYROLL_IMPORT_INVALID' : 'PAYROLL_IMPORT_ERROR', message: status < 500 ? error.message : 'Die Zvoove-Stunden konnten nicht verarbeitet werden.' });
});
module.exports = router;
