const crypto = require('crypto');
const path = require('path');
const express = require('express');
const multer = require('multer');
const asyncHandler = require('../../middleware/AsyncHandler');
const publicAuth = require('../../middleware/publicAuth');
const sensitiveRoute = require('../../middleware/sensitiveRoute');
const WorkingTimeService = require('../../services/payroll/WorkingTimeService');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const EmployeeDocumentRequest = require('../../models/Employee/EmployeeDocumentRequest');
const EmployeeDocumentUpload = require('../../models/Employee/EmployeeDocumentUpload');
const { EMPLOYEE_DOCUMENT_TYPES } = require('../../config/employeeDocumentTypes');
const { buildEmployeeR2Path } = require('../../utils/employeeR2Path');
const r2Service = require('../../services/integrations/R2Service');

const PUBLIC_DEV_EMAILS = new Set(['cedricbglx@gmail.com', 'dh@straightforward.email']);
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    callback(allowedTypes.has(file.mimetype) ? null : new Error('Nur PDF-, JPEG- und PNG-Dateien sind erlaubt.'), allowedTypes.has(file.mimetype));
  },
});

router.use(sensitiveRoute, publicAuth.headerOnly);

function requireOidc(req, res, next) {
  const isProduction = String(process.env.NODE_ENV).toLowerCase() === 'production'
    || String(process.env.APP_ENV).toLowerCase() === 'production';
  const legacyEmail = String(req.query.email || '').trim().toLowerCase();
  const legacyDevelopmentAccess = !isProduction && !req.oidcUser && PUBLIC_DEV_EMAILS.has(legacyEmail);
  if (req.oidcUser?.source !== 'oidc' && !legacyDevelopmentAccess) {
    return res.status(403).json({ msg: 'Für Dokumente ist eine OIDC-Anmeldung erforderlich.' });
  }
  return next();
}

async function employeeFromRequest(req) {
  return WorkingTimeService.resolvePublicEmployee({ flipId: req.oidcFlipId, email: req.oidcEmail || req.query.email });
}

function serializeRequest(request) {
  const uploadDoc = request.currentUpload;
  return {
    id: String(request._id),
    type: request.type,
    label: EMPLOYEE_DOCUMENT_TYPES[request.type].label,
    status: request.status,
    dueAt: request.dueAt,
    validUntil: request.validUntil,
    reviewNote: request.reviewNote,
    upload: uploadDoc ? { id: String(uploadDoc._id), fileName: uploadDoc.originalFileName, uploadedAt: uploadDoc.uploadedAt } : null,
  };
}

router.get('/', requireOidc, asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const requests = await EmployeeDocumentRequest.find({
    mitarbeiter: employee._id,
    status: { $ne: 'CANCELLED' },
  })
    .populate('currentUpload', 'originalFileName uploadedAt')
    .sort({ dueAt: 1, createdAt: -1 });
  res.json({ requests: requests.map(serializeRequest) });
}));

router.post('/:requestId/upload', requireOidc, upload.single('document'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: 'Keine Datei hochgeladen.' });
  const employee = await employeeFromRequest(req);
  const request = await EmployeeDocumentRequest.findOne({
    _id: req.params.requestId,
    mitarbeiter: employee._id,
    status: { $in: ['REQUESTED', 'REJECTED', 'EXPIRED'] },
  });
  if (!request) return res.status(404).json({ msg: 'Offene Dokumentanforderung nicht gefunden.' });

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(extension)) {
    return res.status(400).json({ msg: 'Ungültige Dateiendung.' });
  }
  if (!employee.r2Prefix) {
    const prefixResult = await Mitarbeiter.collection.updateOne(
      {
        _id: employee._id,
        $or: [{ r2Prefix: { $exists: false } }, { r2Prefix: null }, { r2Prefix: '' }],
      },
      { $set: { r2Prefix: `employees/${employee._id}` } },
    );
    if (!prefixResult.acknowledged) {
      throw new Error('Employee R2 prefix could not be initialized.');
    }
  }
  const safeName = `${crypto.randomUUID()}${extension}`;
  const r2Key = buildEmployeeR2Path(employee.r2Prefix || `employees/${employee._id}`, 'documents/uploads', String(request._id));
  const fileKey = `${r2Key}/${safeName}`;
  const contentHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  await r2Service.uploadFile(fileKey, req.file.buffer, req.file.mimetype);

  const documentUpload = await EmployeeDocumentUpload.create({
    request: request._id,
    mitarbeiter: employee._id,
    originalFileName: path.basename(req.file.originalname).slice(0, 255),
    contentType: req.file.mimetype,
    byteLength: req.file.size,
    contentHash,
    r2Key: fileKey,
  });
  request.currentUpload = documentUpload._id;
  request.status = 'UPLOADED';
  request.reviewNote = '';
  request.reviewedBy = null;
  request.reviewedAt = null;
  await request.save();
  res.status(201).json({ request: serializeRequest({ ...request.toObject(), currentUpload: documentUpload }) });
}));

router.get('/:requestId/download', requireOidc, asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const request = await EmployeeDocumentRequest.findOne({ _id: req.params.requestId, mitarbeiter: employee._id })
    .populate('currentUpload');
  if (!request?.currentUpload || !['UPLOADED', 'APPROVED'].includes(request.status)) {
    return res.status(404).json({ msg: 'Dokument nicht verfügbar.' });
  }
  const url = await r2Service.getSignedDownloadUrl(request.currentUpload.r2Key, 900, { filename: request.currentUpload.originalFileName });
  res.json({ url });
}));

module.exports = router;