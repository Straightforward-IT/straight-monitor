const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const service = require('../../services/TimeCaptureService');
const documents = require('../../services/operations/OrderDocumentService');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(auth, wrap(async (req, res, next) => {
  const id = req.user?.id || req.user?._id;
  const user = mongoose.isValidObjectId(id) ? await User.findById(id).select('name role roles isConfirmed locationV2 locationAccess').lean() : null;
  if (!user || !user.isConfirmed) return res.status(401).json({ message: 'Ein bestätigter interner Benutzer ist erforderlich.' });
  req.timeUser = user;
  next();
}));
router.get('/orders/:auftragNr', wrap(async (req, res) => res.json(await service.review(req.timeUser, req.params.auftragNr, req.query.employeeId))));
router.get('/orders/:auftragNr/documents', wrap(async (req, res) => res.json({ documents: await documents.list(req.timeUser, req.params.auftragNr) })));
router.get('/orders/:auftragNr/documents/:kind/:documentId/preview', wrap(async (req, res) => {
  const result = await documents.preview(req.timeUser, req.params.auftragNr, req.params.kind, req.params.documentId, req.query.attachmentId, req.query.download === 'true');
  res.set('Cache-Control', 'no-store');
  if (result.buffer) return res.type('application/pdf').send(result.buffer);
  res.json(result);
}));
router.post('/orders/:auftragNr', wrap(async (req, res) => {
  await service.saveReview(req.timeUser, req.params.auftragNr, req.body);
  res.json({ saved: true });
}));
router.get('/employees/:employeeId/orders', wrap(async (req, res) => res.json({ orders: await service.employeeOrders(req.timeUser, req.params.employeeId, req.query.month) })));
router.get('/employees/:employeeId/month', wrap(async (req, res) => res.json(await service.monthView(req.timeUser, req.params.employeeId, req.query.month))));
// Keep sensitive hour payloads and authentication headers out of the legacy
// global error logger, including unexpected database errors.
router.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  res.status(status).json({ code: error.code && status < 500 ? error.code : 'TIME_CAPTURE_ERROR', message: status < 500 ? error.message : 'Stunden konnten nicht verarbeitet werden.' });
});
module.exports = router;
