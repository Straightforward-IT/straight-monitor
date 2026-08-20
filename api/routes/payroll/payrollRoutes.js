'use strict';

const express = require('express');
const auth = require('../../middleware/auth');
const requirePayrollRole = require('../../middleware/requirePayrollRole');
const sensitiveRoute = require('../../middleware/sensitiveRoute');
const asyncHandler = require('../../middleware/AsyncHandler');
const PayrollService = require('../../services/payroll/PayrollService');
const PaychexService = require('../../services/integrations/PaychexService');
const PayrollDocumentService = require('../../services/payroll/PayrollDocumentService');
const WorkingTimeService = require('../../services/payroll/WorkingTimeService');
const PayrollDataService = require('../../services/payroll/PayrollDataService');
const PayrollDeclarationImportService = require('../../services/payroll/PayrollDeclarationImportService');
const PayrollProviderProfileService = require('../../services/payroll/PayrollProviderProfileService');

const router = express.Router();

// Payroll routes contain employee compensation data. Mark them sensitive before
// authentication so even errors from auth/role middleware cannot log bodies.
router.use(sensitiveRoute, auth, requirePayrollRole);

router.post('/declarations/validate', asyncHandler(async (req, res) => {
  const validation = PayrollDeclarationImportService.validateDeclaration(req.body);
  res.json({ validation });
}));

router.post('/declarations/import', asyncHandler(async (req, res) => {
  const result = await PayrollDeclarationImportService.importDeclaration(req.body, req.payrollUser);
  res.status(201).json(result);
}));

router.get('/runs', asyncHandler(async (req, res) => {
  const runs = await PayrollService.listRuns(req.query);
  res.json({ runs });
}));

router.post('/runs', asyncHandler(async (req, res) => {
  const run = await PayrollService.createRun(req.body, req.payrollUser);
  res.status(201).json({ run });
}));

router.get('/runs/:id', asyncHandler(async (req, res) => {
  const run = await PayrollService.getRun(req.params.id);
  res.json({ run });
}));

router.get('/runs/:id/employees', asyncHandler(async (req, res) => {
  const employees = await PayrollService.listEmployees(req.params.id);
  res.json({ employees });
}));

router.get('/runs/:id/employees/:mitarbeiterId', asyncHandler(async (req, res) => {
  const employee = await PayrollService.getEmployeeSnapshot(req.params.id, req.params.mitarbeiterId);
  res.json({ employee });
}));

router.post('/runs/:id/calculate', asyncHandler(async (req, res) => {
  const run = await PayrollService.calculateRun(req.params.id, req.payrollUser);
  res.json({ run });
}));

router.post('/runs/:id/validate', asyncHandler(async (req, res) => {
  const run = await PayrollService.validateRun(req.params.id, req.payrollUser);
  res.json({ run });
}));

router.post('/runs/:id/sync-paychex', asyncHandler(async (req, res) => {
  const run = await PayrollService.syncPaychex(req.params.id, req.payrollUser);
  res.json({ run });
}));

router.get('/runs/:id/provider-operations', asyncHandler(async (req, res) => {
  const operations = await PayrollService.listProviderOperations(req.params.id);
  res.json({ operations });
}));

router.post('/provider-operations/:operationId/reconcile', asyncHandler(async (req, res) => {
  const operation = await PayrollService.reconcileProviderOperation(
    req.params.operationId,
    req.payrollUser,
    req.body,
  );
  res.json({ operation });
}));

router.post('/runs/:id/mark-payroll-complete', asyncHandler(async (req, res) => {
  const run = await PayrollService.markPayrollComplete(req.params.id, req.payrollUser, req.body);
  res.json({ run });
}));

router.post('/runs/:id/sync-documents', asyncHandler(async (req, res) => {
  const result = await PayrollDocumentService.syncRunDocuments(req.params.id, req.payrollUser);
  res.json(result);
}));

router.get('/runs/:id/documents', asyncHandler(async (req, res) => {
  const documents = await PayrollDocumentService.listRunDocuments(req.params.id);
  res.json({ documents });
}));

router.get('/documents/:documentId/download', asyncHandler(async (req, res) => {
  const download = await PayrollDocumentService.createPrivateDownload(req.params.documentId);
  res.json(download);
}));

router.post('/runs/:id/close', asyncHandler(async (req, res) => {
  const run = await PayrollService.closeRun(req.params.id, req.payrollUser);
  res.json({ run });
}));

router.post('/runs/:id/employees/:mitarbeiterId/recalculate', asyncHandler(async (req, res) => {
  const employee = await PayrollService.recalculateEmployee(
    req.params.id,
    req.params.mitarbeiterId,
    req.payrollUser,
  );
  res.json({ employee });
}));

router.get('/runs/:id/audit', asyncHandler(async (req, res) => {
  const events = await PayrollService.listAudit(req.params.id);
  res.json({ events });
}));

router.get('/data/employees', asyncHandler(async (req, res) => {
  const employees = await PayrollDataService.listEmployees(req.query);
  res.json({ employees });
}));

router.get('/data/employees/:mitarbeiterId/readiness', asyncHandler(async (req, res) => {
  const readiness = await PayrollService.getEmployeeReadiness(req.params.mitarbeiterId, req.query.month);
  res.json({ readiness });
}));

router.get('/data/provider-profiles', asyncHandler(async (req, res) => {
  const records = await PayrollProviderProfileService.list(req.query);
  res.json({ records });
}));

router.post('/data/provider-profiles', asyncHandler(async (req, res) => {
  const record = await PayrollProviderProfileService.createDraft(req.body, req.payrollUser);
  res.status(201).json({ record });
}));

router.post('/data/provider-profiles/:recordId/approve', asyncHandler(async (req, res) => {
  const record = await PayrollProviderProfileService.approve(req.params.recordId, req.payrollUser);
  res.json({ record });
}));

router.post('/data/provider-profiles/:recordId/revise', asyncHandler(async (req, res) => {
  const record = await PayrollProviderProfileService.revise(req.params.recordId, req.body, req.payrollUser);
  res.status(201).json({ record });
}));

router.get('/data/:resource', asyncHandler(async (req, res) => {
  const records = await PayrollDataService.listResource(req.params.resource, req.query);
  res.json({ records });
}));

router.post('/data/:resource', asyncHandler(async (req, res) => {
  const record = await PayrollDataService.createResource(req.params.resource, req.body, req.payrollUser);
  res.status(201).json({ record });
}));

router.post('/data/absences/:recordId/submit', asyncHandler(async (req, res) => {
  const record = await PayrollDataService.submitAbsence(req.params.recordId, req.payrollUser);
  res.json({ record });
}));

router.post('/data/:resource/:recordId/approve', asyncHandler(async (req, res) => {
  const record = await PayrollDataService.approveResource(req.params.resource, req.params.recordId, req.payrollUser, req.body);
  res.json({ record });
}));

router.post('/data/:resource/:recordId/revise', asyncHandler(async (req, res) => {
  const record = await PayrollDataService.reviseResource(req.params.resource, req.params.recordId, req.body, req.payrollUser);
  res.status(201).json({ record });
}));

router.get('/paychex/configuration-status', (req, res) => {
  const documentSync = PayrollDocumentService.configurationStatus();
  res.json({
    ...PaychexService.configurationStatus(),
    documentSyncEnabled: documentSync.enabled,
    documentSync,
  });
});

router.get('/paychex/salary-components', asyncHandler(async (req, res) => {
  const components = await PaychexService.listCompanySalaryComponents({
    companyKey: req.query.companyKey || 'straightforward',
    limit: req.query.limit,
    offset: req.query.offset,
    ordering: req.query.ordering,
  });
  res.json({ components });
}));

router.get('/paychex/status/:mitarbeiterId', asyncHandler(async (req, res) => {
  const status = await PayrollService.getPaychexStatus(req.params.mitarbeiterId, req.query.companyKey || 'straightforward');
  res.json({ status });
}));

router.post('/paychex/sync-employee/:mitarbeiterId', asyncHandler(async (req, res) => {
  const result = await PayrollService.syncEmployee(
    req.params.mitarbeiterId,
    { month: req.body.month, companyKey: req.body.companyKey || 'straightforward' },
    req.payrollUser,
  );
  res.json({ result });
}));

router.get('/settings/mappings', asyncHandler(async (req, res) => {
  const mappings = await PayrollService.getMappings(req.query.companyKey || 'straightforward');
  res.json({ mappings });
}));

router.get('/working-times', asyncHandler(async (req, res) => {
  const entries = await WorkingTimeService.listForPayroll(req.query);
  res.json({ entries });
}));

router.post('/working-times/:entryId/approve', asyncHandler(async (req, res) => {
  const entry = await WorkingTimeService.approve(req.params.entryId, req.payrollUser);
  res.json({ entry });
}));

router.post('/working-times/:entryId/reject', asyncHandler(async (req, res) => {
  const entry = await WorkingTimeService.reject(req.params.entryId, req.payrollUser, req.body.reason);
  res.json({ entry });
}));

router.post('/working-times/:entryId/correct', asyncHandler(async (req, res) => {
  const entry = await WorkingTimeService.correct(req.params.entryId, req.payrollUser, req.body);
  res.status(201).json({ entry });
}));

router.put('/settings/mappings', asyncHandler(async (req, res) => {
  const mapping = await PayrollService.saveMapping(req.body, req.payrollUser);
  res.status(201).json({ mapping });
}));

router.post('/settings/mappings/:mappingId/approve', asyncHandler(async (req, res) => {
  const mapping = await PayrollService.approveMapping(req.params.mappingId, req.body, req.payrollUser);
  res.json({ mapping });
}));

module.exports = router;
