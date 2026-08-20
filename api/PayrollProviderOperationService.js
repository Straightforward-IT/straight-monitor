'use strict';

const PayrollProviderOperation = require('./models/Payroll/PayrollProviderOperation');
const PayrollError = require('./utils/PayrollError');
const mongoose = require('mongoose');

function isUncertainCreateFailure(error) {
  const status = Number(error?.status ?? error?.response?.status) || null;
  return status === null || status === 408 || status >= 500;
}

function safeOperationError(error, uncertain, now = new Date()) {
  return {
    code: String(error?.code || (uncertain ? 'PAYCHEX_WRITE_UNCERTAIN' : 'PAYCHEX_WRITE_FAILED'))
      .trim()
      .toUpperCase()
      .slice(0, 200),
    classification: uncertain ? 'REMOTE_WRITE_UNCERTAIN' : 'REMOTE_WRITE_FAILED',
    httpStatus: Number(error?.status ?? error?.response?.status) || null,
    requestId: error?.requestId ? String(error.requestId).slice(0, 256) : null,
    retryable: Boolean(error?.retryable),
    at: now,
  };
}

function remoteComponentId(remote, fallback = null) {
  return remote?.uid || remote?.id || remote?.data?.uid || remote?.data?.id || fallback || null;
}

function reconciliationRequired(operation) {
  return new PayrollError(
    'PAYCHEX_PROVIDER_RECONCILIATION_REQUIRED',
    'Das Ergebnis eines Paychex-Schreibvorgangs ist unklar. Vor einem neuen Versuch muss die Provider-Komponente abgeglichen und der Vorgang dokumentiert reconciled werden.',
    409,
    {
      providerOperationId: operation?._id?.toString?.() || null,
      state: operation?.state || 'UNCERTAIN',
      componentKey: operation?.componentKey || null,
    },
  );
}

/**
 * Persist-first execution wrapper. saveCheckpoint must durably store the
 * checkpoint; tests inject it to simulate process/database failures.
 */
async function executeCheckpointedMutation({
  operation,
  actor,
  execute,
  saveCheckpoint = async () => operation.save(),
  fallbackRemoteId = null,
  now = () => new Date(),
}) {
  if (!operation) throw new TypeError('operation is required.');
  if (typeof execute !== 'function') throw new TypeError('execute is required.');
  if (operation.state === 'UNCERTAIN') throw reconciliationRequired(operation);
  if (operation.state === 'SYNCED') {
    return { operation, remoteComponentId: operation.remoteComponentId, recovered: true };
  }
  if (operation.state === 'IN_FLIGHT') {
    // A previous process can have died after dispatching the request. Treating
    // this as uncertain is deliberately conservative and prevents a duplicate
    // POST. Reconciliation can confirm either provider outcome.
    const timestamp = now();
    operation.state = 'UNCERTAIN';
    operation.uncertainAt = timestamp;
    operation.lastError = safeOperationError(
      { code: 'PAYCHEX_IN_FLIGHT_OUTCOME_UNKNOWN', retryable: false },
      true,
      timestamp,
    );
    await saveCheckpoint(operation);
    throw reconciliationRequired(operation);
  }

  const startedAt = now();
  operation.state = 'IN_FLIGHT';
  operation.attempts = Number(operation.attempts || 0) + 1;
  operation.lastAttemptAt = startedAt;
  operation.inFlightAt = startedAt;
  operation.lastAttemptBy = actor?._id || actor?.id || actor;
  operation.failedAt = null;
  operation.uncertainAt = null;
  operation.lastError = null;
  await saveCheckpoint(operation);

  try {
    const remote = await execute();
    const resolvedRemoteId = remoteComponentId(remote, fallbackRemoteId);
    if (!resolvedRemoteId) {
      const missingIdError = Object.assign(
        new Error('Paychex returned no durable salary-component identifier.'),
        { code: 'PAYCHEX_COMPONENT_ID_MISSING', retryable: false },
      );
      const uncertain = operation.providerAction === 'CREATE';
      const timestamp = now();
      operation.state = uncertain ? 'UNCERTAIN' : 'FAILED';
      operation.uncertainAt = uncertain ? timestamp : null;
      operation.failedAt = uncertain ? null : timestamp;
      operation.lastError = safeOperationError(missingIdError, uncertain, timestamp);
      await saveCheckpoint(operation);
      if (uncertain) throw reconciliationRequired(operation);
      throw missingIdError;
    }

    const completedAt = now();
    operation.state = 'SYNCED';
    operation.remoteComponentId = String(resolvedRemoteId);
    operation.syncedAt = completedAt;
    operation.failedAt = null;
    operation.uncertainAt = null;
    operation.lastError = null;
    await saveCheckpoint(operation);
    return { operation, remote, remoteComponentId: String(resolvedRemoteId), recovered: false };
  } catch (error) {
    if (error?.code === 'PAYCHEX_PROVIDER_RECONCILIATION_REQUIRED') throw error;
    const uncertain = operation.providerAction === 'CREATE' && isUncertainCreateFailure(error);
    const failedAt = now();
    operation.state = uncertain ? 'UNCERTAIN' : 'FAILED';
    operation.uncertainAt = uncertain ? failedAt : null;
    operation.failedAt = uncertain ? null : failedAt;
    operation.lastError = safeOperationError(error, uncertain, failedAt);
    await saveCheckpoint(operation);
    if (uncertain) throw reconciliationRequired(operation);
    throw error;
  }
}

async function findOrCreateOperation(identity, Model = PayrollProviderOperation) {
  const document = {
    provider: 'paychex',
    idempotencyKey: identity.idempotencyKey,
    payrollRun: identity.payrollRun,
    payrollEmployeeSnapshot: identity.payrollEmployeeSnapshot,
    mitarbeiter: identity.mitarbeiter,
    payrollComponentId: identity.payrollComponentId,
    componentKey: identity.componentKey,
    providerAction: identity.providerAction,
    payloadHash: identity.payloadHash,
    safePayloadMetadata: identity.safePayloadMetadata,
    state: 'PENDING',
    attempts: 0,
    createdBy: identity.createdBy,
  };

  try {
    return await Model.findOneAndUpdate(
      { provider: 'paychex', idempotencyKey: identity.idempotencyKey },
      { $setOnInsert: document },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Model.findOne({ provider: 'paychex', idempotencyKey: identity.idempotencyKey });
  }
}

async function reconcileOperation(operationId, input, actor, Model = PayrollProviderOperation) {
  if (!mongoose.isValidObjectId(operationId)) {
    throw new PayrollError('PAYROLL_PROVIDER_OPERATION_ID_INVALID', 'Provider-Vorgangs-ID ist ungültig.', 400);
  }
  const operation = await Model.findById(operationId);
  if (!operation) {
    throw new PayrollError('PAYROLL_PROVIDER_OPERATION_NOT_FOUND', 'Provider-Vorgang wurde nicht gefunden.', 404);
  }
  if (operation.state !== 'UNCERTAIN') {
    throw new PayrollError(
      'PAYROLL_PROVIDER_OPERATION_STATE_INVALID',
      `Nur UNCERTAIN-Vorgänge können reconciled werden; aktueller Status: ${operation.state}.`,
      409,
    );
  }
  const outcome = String(input?.outcome || '').trim().toUpperCase();
  if (!['REMOTE_FOUND', 'REMOTE_NOT_FOUND'].includes(outcome)) {
    throw new PayrollError('PAYROLL_PROVIDER_RECONCILIATION_INVALID', 'outcome muss REMOTE_FOUND oder REMOTE_NOT_FOUND sein.', 400);
  }
  const reasonCode = String(input?.reasonCode || '').trim().toUpperCase();
  const evidenceRef = String(input?.evidenceRef || '').trim();
  const evidenceHash = String(input?.evidenceHash || '').trim().toLowerCase();
  const allowedReasonCodes = [
    'PAYCHEX_API_LIST_VERIFIED',
    'PAYCHEX_UI_VERIFIED',
    'PAYCHEX_SUPPORT_CONFIRMED',
    'CONTROLLED_EVIDENCE_VERIFIED',
  ];
  if (!allowedReasonCodes.includes(reasonCode)
      || !/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/.test(evidenceRef)
      || !/^[a-f0-9]{64}$/.test(evidenceHash)
      || !actor) {
    throw new PayrollError(
      'PAYROLL_PROVIDER_RECONCILIATION_EVIDENCE_REQUIRED',
      'Reconciliation benötigt Benutzer, kontrollierten Grundcode, Evidenzreferenz und SHA-256-Evidenzhash.',
      400,
    );
  }

  const remoteId = input?.remoteComponentId == null ? '' : String(input.remoteComponentId).trim();
  if (outcome === 'REMOTE_FOUND' && !remoteId) {
    throw new PayrollError(
      'PAYROLL_PROVIDER_REMOTE_ID_REQUIRED',
      'REMOTE_FOUND benötigt die bestätigte Paychex Salary-Component-ID.',
      400,
    );
  }
  const timestamp = new Date();
  operation.reconciliations.push({
    outcome,
    reasonCode,
    evidenceRef,
    evidenceHash,
    reconciledAt: timestamp,
    reconciledBy: actor?._id || actor?.id || actor,
  });
  if (outcome === 'REMOTE_FOUND') {
    operation.state = 'SYNCED';
    operation.remoteComponentId = remoteId;
    operation.syncedAt = timestamp;
  } else {
    operation.state = 'PENDING';
    operation.remoteComponentId = null;
    operation.inFlightAt = null;
    operation.uncertainAt = null;
  }
  await operation.save();
  return operation;
}

async function listRunOperations(runId, Model = PayrollProviderOperation) {
  if (!mongoose.isValidObjectId(runId)) {
    throw new PayrollError('PAYROLL_RUN_ID_INVALID', 'Payroll-Lauf-ID ist ungültig.', 400);
  }
  return Model.find({ payrollRun: runId })
    .sort({ createdAt: 1, _id: 1 })
    .select('-lastError.requestId')
    .lean();
}

module.exports = {
  executeCheckpointedMutation,
  findOrCreateOperation,
  isUncertainCreateFailure,
  listRunOperations,
  reconcileOperation,
  reconciliationRequired,
  remoteComponentId,
  safeOperationError,
};
