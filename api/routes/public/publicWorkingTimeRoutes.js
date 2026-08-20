'use strict';

const express = require('express');
const publicAuth = require('../../middleware/publicAuth');
const asyncHandler = require('../../middleware/AsyncHandler');
const sensitiveRoute = require('../../middleware/sensitiveRoute');
const WorkingTimeService = require('../../services/payroll/WorkingTimeService');

const router = express.Router();

// Unlike legacy public endpoints, payroll time routes never accept credentials
// in the query string (where browsers and proxies commonly retain them).
router.use(sensitiveRoute, publicAuth.headerOnly);

async function employeeFromRequest(req) {
  // OIDC-Identität hat Vorrang; im Legacy-Token-Flow kommt die E-Mail (kein Secret)
  // aus Query/Body — konsistent mit den übrigen Public-Endpunkten.
  return WorkingTimeService.resolvePublicEmployee({
    flipId: req.oidcFlipId || req.body?.flipId || null,
    email: req.oidcEmail || req.query.email || req.body?.email || null,
  });
}

router.get('/assignments', asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const assignments = await WorkingTimeService.listEmployeeAssignments(employee._id);
  res.json({ employee: { _id: employee._id, personalnr: employee.personalnr, vorname: employee.vorname, nachname: employee.nachname }, assignments });
}));

router.get('/entries', asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const entries = await WorkingTimeService.listEmployeeEntries(employee._id, req.query);
  res.json({ entries });
}));

router.post('/start', asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const entry = await WorkingTimeService.startTimer({
    employee,
    assignmentId: req.body.assignmentLedgerId,
    clientTimeZone: req.body.clientTimeZone,
    deviceId: req.body.deviceId,
  });
  res.status(201).json({ entry });
}));

router.post('/record', asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const entry = await WorkingTimeService.recordCompletedEntry({
    employee,
    assignmentId: req.body.assignmentLedgerId,
    actualStart: req.body.actualStart,
    actualEnd: req.body.actualEnd,
    breaks: req.body.breaks,
    clientTimeZone: req.body.clientTimeZone,
    deviceId: req.body.deviceId,
  });
  res.status(201).json({ entry });
}));

router.post('/:entryId/submit', asyncHandler(async (req, res) => {
  const employee = await employeeFromRequest(req);
  const entry = await WorkingTimeService.submitTimer({
    employee,
    entryId: req.params.entryId,
    actualStart: req.body.actualStart,
    actualEnd: req.body.actualEnd,
    breaks: req.body.breaks,
    clientTimeZone: req.body.clientTimeZone,
    deviceId: req.body.deviceId,
  });
  res.json({ entry });
}));

module.exports = router;
