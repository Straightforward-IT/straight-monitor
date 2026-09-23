const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const service = require('../../services/payroll/PreparationService');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(auth, wrap(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const id = req.user?.id || req.user?._id;
  const user = mongoose.isValidObjectId(id) ? await User.findById(id).select('role roles isConfirmed locationV2 locationAccess').lean() : null;
  if (!user?.isConfirmed) return res.status(401).json({ message: 'Bestätigter interner Benutzer erforderlich.' });
  req.payrollUser = user; next();
}));
const root = '/employees/:employeeId';
router.get(`${root}/months/:month`, wrap(async (req, res) => res.json(await service.read(req.payrollUser, req.params.employeeId, req.params.month))));
router.put(`${root}/months/:month`, wrap(async (req, res) => res.json(await service.mutate(req.payrollUser, req.params.employeeId, req.params.month, req.body, 'save'))));
for (const action of ['finalize', 'reopen']) router.post(`${root}/months/:month/${action}`, wrap(async (req, res) => res.json(await service.mutate(req.payrollUser, req.params.employeeId, req.params.month, req.body, action))));
router.get(`${root}/snapshots/:id`, wrap(async (req, res) => res.json(await service.snapshot(req.payrollUser, req.params.employeeId, req.params.id))));
router.get(`${root}/snapshots/:id/preview`, wrap(async (req, res) => res.json(await service.preview(req.payrollUser, req.params.employeeId, req.params.id))));
router.get(`${root}/lodas-mapping`, wrap(async (req, res) => res.json(await service.getMapping(req.payrollUser, req.params.employeeId))));
router.put(`${root}/lodas-mapping`, wrap(async (req, res) => res.json(await service.saveMapping(req.payrollUser, req.params.employeeId, req.body))));
router.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  res.status(status).json({ code: status < 500 ? error.code : 'PAYROLL_ERROR', message: status < 500 ? error.message : 'Vorbereitung konnte nicht verarbeitet werden.' });
});
module.exports = router;
