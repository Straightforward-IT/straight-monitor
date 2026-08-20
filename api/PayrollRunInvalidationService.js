'use strict';

const mongoose = require('mongoose');
const PayrollRun = require('./models/Payroll/PayrollRun');
const PayrollEmployeeSnapshot = require('./models/Payroll/PayrollEmployeeSnapshot');
const PayrollAuditLog = require('./models/Payroll/PayrollAuditLog');

const INVALIDATABLE_STATUSES = [
  'CALCULATING',
  'CALCULATED',
  'VALIDATING',
  'VALIDATED',
  'READY_FOR_EXPORT',
  'SYNCING_TO_PAYCHEX',
  'SYNCED_TO_PAYCHEX',
];
const FINALIZED_STATUSES = ['PAYROLL_COMPLETED', 'DOCUMENTS_IMPORTED', 'CLOSED'];

const actorId = (actor) => actor?._id || actor?.id || actor || null;

function monthOverlapsRange(month, validFrom = null, validTill = null) {
  const [year, value] = String(month).split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, value - 1, 1));
  const monthEnd = new Date(Date.UTC(year, value, 1));
  const from = validFrom ? new Date(validFrom) : null;
  const till = validTill ? new Date(validTill) : null;
  return (!from || from < monthEnd) && (!till || till >= monthStart);
}

async function markRunRevisionRequired(runId, actor, reason) {
  if (!runId) return false;
  const detectedAt = new Date();
  const detectedBy = actorId(actor);
  const normalizedReason = String(reason || 'Payroll-relevante Eingabedaten wurden geändert.')
    .trim()
    .slice(0, 2000);

  const observed = await PayrollRun.findById(runId).select('status').lean();
  if (!observed) return false;

  // Compare-and-set prevents an invalidation based on stale state from
  // reopening a run that became final between lookup and update.
  const previousStatus = observed.status;
  const revised = INVALIDATABLE_STATUSES.includes(previousStatus)
    ? await PayrollRun.findOneAndUpdate(
      { _id: runId, status: previousStatus },
      {
        $set: {
          status: 'REVISION_REQUIRED',
          readyForExportAt: null,
          readyForExportBy: null,
        },
        $push: {
          statusHistory: {
            from: previousStatus,
            to: 'REVISION_REQUIRED',
            at: detectedAt,
            by: detectedBy,
            reason: normalizedReason,
          },
        },
      },
      { new: true, runValidators: true },
    )
    : null;
  if (revised) return true;

  const eventKey = new mongoose.Types.ObjectId().toString();
  const finalized = await PayrollRun.findOneAndUpdate(
    {
      _id: runId,
      status: { $in: FINALIZED_STATUSES },
      'amendmentRequirement.detections.reason': { $ne: normalizedReason },
    },
    {
      $set: {
        'amendmentRequirement.correctionRequired': true,
        'amendmentRequirement.lastDetectedAt': detectedAt,
        'amendmentRequirement.lastDetectedBy': detectedBy,
      },
      $inc: { 'amendmentRequirement.detectionCount': 1 },
      $push: {
        'amendmentRequirement.detections': {
          $each: [{ eventKey, detectedAt, detectedBy, reason: normalizedReason }],
          $slice: -100,
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!finalized) {
    // A repeated call for the same source revision is idempotently successful
    // once that requirement has already been captured.
    const alreadyRecorded = await PayrollRun.exists({
      _id: runId,
      status: { $in: FINALIZED_STATUSES },
      'amendmentRequirement.correctionRequired': true,
      'amendmentRequirement.detections.reason': normalizedReason,
    });
    return Boolean(alreadyRecorded);
  }

  await PayrollAuditLog.create({
    actor: {
      user: detectedBy,
      actorType: detectedBy ? 'USER' : 'SYSTEM',
      displayId: actor?.email || actor?.name || null,
    },
    payrollRun: finalized._id,
    action: 'REQUIRE_CORRECTION',
    outcome: 'SUCCEEDED',
    previousStatus: finalized.status,
    newStatus: finalized.status,
    reasonCode: 'FINALIZED_RUN_INPUT_CHANGED',
    summary: normalizedReason,
    safeMetadata: {
      amendmentEventKey: eventKey,
      preservedFinalStatus: finalized.status,
      requiredRunType: 'CORRECTION',
    },
  });
  return true;
}

async function invalidateEmployeeRuns({ employeeId, validFrom = null, validTill = null, actor, reason }) {
  if (!employeeId) return [];
  const snapshots = await PayrollEmployeeSnapshot.find({
    mitarbeiter: employeeId,
    isCurrent: true,
  }).select('payrollRun month').lean();
  const affected = snapshots.filter((snapshot) => monthOverlapsRange(snapshot.month, validFrom, validTill));
  const invalidated = [];
  for (const snapshot of affected) {
    if (await markRunRevisionRequired(snapshot.payrollRun, actor, reason)) {
      invalidated.push(snapshot.payrollRun);
    }
  }
  return invalidated;
}

module.exports = {
  INVALIDATABLE_STATUSES,
  FINALIZED_STATUSES,
  monthOverlapsRange,
  markRunRevisionRequired,
  invalidateEmployeeRuns,
};
