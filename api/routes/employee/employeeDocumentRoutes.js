const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/AsyncHandler');
const sensitiveRoute = require('../../middleware/sensitiveRoute');
const requirePayrollRole = require('../../middleware/requirePayrollRole');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const EmployeeDocumentRequest = require('../../models/Employee/EmployeeDocumentRequest');
const { EMPLOYEE_DOCUMENT_TYPES, isEmployeeDocumentType } = require('../../config/employeeDocumentTypes');
const { assignFlipTask, completeFlipTask } = require('../../services/integrations/FlipService');
const { reconcileDefaultRequirements } = require('../../services/employee/EmployeeDocumentService');

const router = express.Router();
router.use(sensitiveRoute, auth, requirePayrollRole);

function serializeRequest(request) {
  return {
    id: String(request._id), type: request.type, label: EMPLOYEE_DOCUMENT_TYPES[request.type].label,
    status: request.status, dueAt: request.dueAt, validUntil: request.validUntil,
    reviewNote: request.reviewNote, createdAt: request.createdAt, updatedAt: request.updatedAt,
    flipTaskId: request.flipTaskId,
  };
}

router.post('/requests', asyncHandler(async (req, res) => {
  const { mitarbeiterId, type, dueAt = null, validUntil = null } = req.body;
  if (!mongoose.Types.ObjectId.isValid(mitarbeiterId) || !isEmployeeDocumentType(type)) {
    return res.status(400).json({ msg: 'Mitarbeiter und gültiger Dokumenttyp sind erforderlich.' });
  }
  const employee = await Mitarbeiter.findById(mitarbeiterId).select('_id vorname nachname flip_id').lean();
  if (!employee) return res.status(404).json({ msg: 'Mitarbeiter nicht gefunden.' });

  const request = await EmployeeDocumentRequest.create({ mitarbeiter: employee._id, type, dueAt, validUntil, requestedBy: req.user.id });
  if (employee.flip_id) {
    try {
      const task = await assignFlipTask({ body: {
        external_id: `employee-document-request:${request._id}`,
        title: `${EMPLOYEE_DOCUMENT_TYPES[type].label} hochladen`,
        recipients: [{ id: employee.flip_id, type: 'USER' }],
        due_at: dueAt ? { date: new Date(dueAt).toISOString().slice(0, 10), type: 'DATE' } : null,
        description: 'Bitte lade dein Dokument im Straight Monitor hoch.',
      }});
      request.flipTaskId = task.id || '';
      await request.save();
    } catch (error) {
      await request.deleteOne();
      throw error;
    }
  }
  res.status(201).json({ request: serializeRequest(request) });
}));

router.get('/requests', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.mitarbeiterId) filter.mitarbeiter = req.query.mitarbeiterId;
  if (req.query.status) filter.status = req.query.status;
  const requests = await EmployeeDocumentRequest.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json({ requests: requests.map(serializeRequest) });
}));

router.post('/rules/reconcile', asyncHandler(async (req, res) => {
  const { mitarbeiterId, apply = false } = req.body;
  if (!mongoose.Types.ObjectId.isValid(mitarbeiterId)) return res.status(400).json({ msg: 'Ein gültiger Mitarbeiter ist erforderlich.' });
  const employee = await Mitarbeiter.findById(mitarbeiterId)
    .select('_id isActive isBewerberstatus isStudent isSchueler studieninformationen schulinformationen steuerId sozialversicherungsnummer versicherungsnachweisTyp berufe')
    .lean();
  if (!employee) return res.status(404).json({ msg: 'Mitarbeiter nicht gefunden.' });
  const result = await reconcileDefaultRequirements(employee, req.user.id, { apply: apply === true });
  res.json(result);
}));

router.patch('/requests/:id/review', asyncHandler(async (req, res) => {
  const { status, reviewNote = '', validUntil = null } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ msg: 'Ungültiger Prüfstatus.' });
  const request = await EmployeeDocumentRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ msg: 'Dokumentanforderung nicht gefunden.' });
  if (!request.currentUpload) return res.status(409).json({ msg: 'Es wurde noch kein Dokument hochgeladen.' });
  request.status = status;
  request.reviewNote = reviewNote;
  request.validUntil = validUntil;
  request.reviewedBy = req.user.id;
  request.reviewedAt = new Date();
  await request.save();
  if (status === 'APPROVED' && request.flipTaskId) {
    await completeFlipTask(request.flipTaskId);
  }
  res.json({ request: serializeRequest(request) });
}));

module.exports = router;