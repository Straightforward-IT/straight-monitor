const express = require('express');
const publicAuth = require('../../middleware/publicAuth');
const WorkingTimeService = require('../../services/payroll/WorkingTimeService');
const service = require('../../services/TimeCaptureService');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(publicAuth.headerOnly, wrap(async (req, res, next) => {
  // A shared legacy token plus an email supplied by the client is not identity.
  if (req.oidcUser?.source !== 'oidc') return res.status(403).json({ message: 'Für die eigene Stundenerfassung bitte persönlich über OIDC anmelden.' });
  req.timeEmployee = await WorkingTimeService.resolvePublicEmployee({ email: req.oidcEmail, flipId: req.oidcFlipId });
  next();
}));
router.get('/:einsatzId', wrap(async (req, res) => res.json(await service.publicStatus(req.timeEmployee, req.params.einsatzId))));
router.post('/:einsatzId', wrap(async (req, res) => {
  await service.submitEmployee(req.timeEmployee, req.params.einsatzId, req.body);
  res.status(201).json({ locked: true, status: 'SUBMITTED' });
}));
router.use((error, _req, res, _next) => {
  const status = error.statusCode || error.status || 500;
  res.status(status).json({ code: status < 500 ? error.code : 'TIME_CAPTURE_ERROR', message: status < 500 ? error.message : 'Stunden konnten nicht verarbeitet werden.' });
});
module.exports = router;
