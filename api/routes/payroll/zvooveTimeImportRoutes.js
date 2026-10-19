const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const { isAdmin } = require('../../middleware/requireAdmin');
const service = require('../../services/payroll/ZvooveTimeImportService');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(auth, wrap(async (req, res, next) => {
  const user = await User.findById(req.user?.id || req.user?._id).select('role roles isConfirmed').lean();
  if (!user?.isConfirmed) return res.status(401).json({ message: 'Bestätigter interner Benutzer erforderlich.' });
  if (!isAdmin(user)) return res.status(403).json({ message: 'Jahresimporte sind ausschließlich für Admins verfügbar.' });
  res.set('Cache-Control', 'no-store'); req.timeImportUser = user; next();
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 2, fileSize: 40 * 1024 * 1024, fields: 1 }, fileFilter: (_req, file, callback) => callback(/\.xlsx?$/i.test(file.originalname) ? null : Object.assign(new Error('Excel-Datei erforderlich.'), { statusCode: 400 }), true) }).fields([{ name: 'STUNDENVORTRAG', maxCount: 1 }, { name: 'STUNDUHR', maxCount: 1 }]);
router.get('/', wrap(async (req, res) => res.json(await service.list(req.timeImportUser))));
router.post('/preview', upload, wrap(async (req, res) => {
  if (Object.keys(req.body).some(key => key !== 'year')) return res.status(400).json({ message: 'Nur year ist als Formularfeld zulässig.' });
  res.json(await service.preview(Object.values(req.files || {}).flat(), Number(req.body.year), req.timeImportUser));
}));
router.get('/:id', wrap(async (req, res) => res.json(await service.get(req.params.id, req.timeImportUser))));
router.get('/:id/rows', wrap(async (req, res) => res.json(await service.sourceRows(req.params.id, req.query.role, Number(req.query.page || 0), req.timeImportUser))));
router.post('/:id/activate', wrap(async (req, res) => res.json(await service.activate(req.params.id, req.body?.expectedRevision, req.timeImportUser))));
router.use((error, _req, res, _next) => { const status = error instanceof multer.MulterError ? 400 : error.statusCode || (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name) ? 400 : 500); res.status(status).json({ code: status < 500 ? error.code || 'TIME_IMPORT_INVALID' : 'TIME_IMPORT_ERROR', message: status < 500 ? error.message : 'Jahresimport konnte nicht verarbeitet werden.' }); });
module.exports = router;
