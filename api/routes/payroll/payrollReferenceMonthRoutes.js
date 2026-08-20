'use strict';

const express = require('express');
const auth = require('../../middleware/auth');
const requirePayrollRole = require('../../middleware/requirePayrollRole');
const sensitiveRoute = require('../../middleware/sensitiveRoute');
const asyncHandler = require('../../middleware/AsyncHandler');
const PayrollReferenceMonthService = require('../../services/payroll/PayrollReferenceMonthService');

const router = express.Router();

router.use(sensitiveRoute, auth, requirePayrollRole);

router.get('/preview', asyncHandler(async (req, res) => {
  const preview = await PayrollReferenceMonthService.preview(req.query);
  res.json({ preview });
}));

router.get('/', asyncHandler(async (req, res) => {
  const records = await PayrollReferenceMonthService.list(req.query);
  res.json({ records });
}));

router.post('/', asyncHandler(async (req, res) => {
  const record = await PayrollReferenceMonthService.createDraft(req.body, req.payrollUser);
  res.status(201).json({ record });
}));

router.post('/:referenceId/approve', asyncHandler(async (req, res) => {
  const record = await PayrollReferenceMonthService.approve(
    req.params.referenceId,
    req.body,
    req.payrollUser,
  );
  res.json({ record });
}));

module.exports = router;
