const express = require('express');
const multer = require('multer');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const { isAdmin } = require('../../middleware/requireAdmin');
const service = require('../../services/tariffs/TariffService');
const { TABLES } = require('../../services/tariffs/tariffDomain');

const router = express.Router();
router.use(auth);
router.use(async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id || req.user?._id).select('role roles isConfirmed').lean();
    if (!user || user.isConfirmed === false) return res.status(401).json({ message: 'Anmeldung erforderlich.' });
    if (!isAdmin(user)) return res.status(403).json({ message: 'Tarifdaten sind derzeit nur für Admins verfügbar.' });
    req.tariffUser = user;
    next();
  } catch (error) { next(error); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 14, fields: 0 },
  fileFilter: (_req, file, callback) => {
    // Browser multipart filenames arrive as UTF-8 bytes, while Busboy defaults
    // to Latin-1. Decode only a lossless UTF-8 roundtrip; genuine Latin-1 and
    // already-decoded Unicode names remain intact.
    if ([...file.originalname].every(character => character.codePointAt(0) <= 255)) {
      const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
      if (!decoded.includes('\uFFFD') && Buffer.from(decoded, 'utf8').toString('latin1') === file.originalname) file.originalname = decoded;
    }
    if (!/\.xlsx?$/i.test(file.originalname)) { const error = new Error('Es werden ausschließlich Excel-Dateien (.xls, .xlsx) unterstützt.'); error.status = 400; return callback(error); }
    callback(null, true);
  },
});
const handle = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (error) { next(error); } };
router.get('/catalog', handle(() => service.catalog()));
router.get('/employees', handle(req => service.employees(req.query)));
router.get('/employee-history', handle(req => service.history(req.query.key)));
router.get('/employees/:employeeId/base-rate', handle(req => service.baseRate(req.params.employeeId, req.query.date)));
router.get('/employees/:employeeId/wage-info', handle(req => service.wageInfo(req.params.employeeId, req.query.date)));
router.get('/imports', handle(() => service.imports()));
router.post('/imports/preview', upload.fields(TABLES.map(table => ({ name: table.key, maxCount: 1 }))), handle(req => service.preview(Object.values(req.files || {}).flat(), req.tariffUser._id)));
router.get('/imports/:id', handle(req => service.getImport(req.params.id)));
router.post('/imports/:id/activate', handle(req => service.activate(req.params.id, req.body?.expectedActiveImportId, req.tariffUser._id)));
router.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? 400 : error.status || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
  res.status(status).json({ message: status === 500 ? 'Die Tarifdaten konnten nicht verarbeitet werden.' : error.message });
});
module.exports = router;
