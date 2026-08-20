'use strict';

const mongoose = require('mongoose');

const PROVIDER_OPERATION_STATES = [
  'PENDING',
  'IN_FLIGHT',
  'SYNCED',
  'FAILED',
  'UNCERTAIN',
];

const PROVIDER_OPERATION_ACTIONS = ['CREATE', 'UPDATE'];

const integerOrNull = (value) => value == null || Number.isInteger(value);

// Deliberately excludes quantity, factor, percent and amount. The provider
// payload itself may contain compensation data and is represented only by its
// SHA-256 hash in this durable checkpoint.
const SafePayloadMetadataSchema = new mongoose.Schema({
  companySalaryComponentUid: { type: String, required: true, trim: true, immutable: true },
  payloadMode: {
    type: String,
    required: true,
    enum: ['AMOUNT_ONLY', 'QUANTITY_FACTOR_PERCENT'],
    immutable: true,
  },
  validFromMonth: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  validTillMonth: {
    type: String,
    default: null,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  componentType: { type: String, required: true, trim: true, uppercase: true, immutable: true },
  mappingKey: { type: String, required: true, trim: true, immutable: true },
}, { _id: false, strict: 'throw' });

const SafeErrorSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  classification: {
    type: String,
    required: true,
    enum: ['REMOTE_WRITE_FAILED', 'REMOTE_WRITE_UNCERTAIN'],
  },
  httpStatus: { type: Number, min: 100, max: 599, validate: integerOrNull, default: null },
  requestId: { type: String, trim: true, maxlength: 256, default: null },
  retryable: { type: Boolean, required: true, default: false },
  at: { type: Date, required: true },
}, { _id: false, strict: 'throw' });

const ReconciliationSchema = new mongoose.Schema({
  outcome: { type: String, enum: ['REMOTE_FOUND', 'REMOTE_NOT_FOUND'], required: true },
  reasonCode: {
    type: String,
    required: true,
    enum: [
      'PAYCHEX_API_LIST_VERIFIED',
      'PAYCHEX_UI_VERIFIED',
      'PAYCHEX_SUPPORT_CONFIRMED',
      'CONTROLLED_EVIDENCE_VERIFIED',
    ],
  },
  // Reference and hash point to controlled evidence; no provider response,
  // employee master data, bank/tax/SV field or free-form note is kept here.
  evidenceRef: {
    type: String,
    required: true,
    trim: true,
    maxlength: 256,
    match: /^[A-Za-z0-9][A-Za-z0-9:._/-]*$/,
  },
  evidenceHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
  },
  reconciledAt: { type: Date, required: true },
  reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: false, strict: 'throw' });

const PayrollProviderOperationSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['paychex'], default: 'paychex', immutable: true },
  idempotencyKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  payrollRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollRun',
    required: true,
    immutable: true,
  },
  payrollEmployeeSnapshot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployeeSnapshot',
    required: true,
    immutable: true,
  },
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  },
  payrollComponentId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  componentKey: { type: String, required: true, trim: true, immutable: true },
  providerAction: {
    type: String,
    required: true,
    enum: PROVIDER_OPERATION_ACTIONS,
    immutable: true,
  },
  payloadHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  safePayloadMetadata: {
    type: SafePayloadMetadataSchema,
    required: true,
    immutable: true,
  },

  state: {
    type: String,
    required: true,
    enum: PROVIDER_OPERATION_STATES,
    default: 'PENDING',
  },
  remoteComponentId: { type: String, trim: true, default: null },
  attempts: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  lastAttemptBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastAttemptAt: { type: Date, default: null },
  inFlightAt: { type: Date, default: null },
  syncedAt: { type: Date, default: null },
  failedAt: { type: Date, default: null },
  uncertainAt: { type: Date, default: null },
  lastError: { type: SafeErrorSchema, default: null },
  reconciliations: { type: [ReconciliationSchema], default: [] },
}, {
  timestamps: true,
  minimize: false,
  optimisticConcurrency: true,
  strict: 'throw',
});

PayrollProviderOperationSchema.pre('validate', function validateProviderOperation(next) {
  if (this.state === 'PENDING'
      && this.attempts !== 0
      && this.reconciliations?.at(-1)?.outcome !== 'REMOTE_NOT_FOUND') {
    this.invalidate('state', 'PENDING nach einem Versuch benötigt eine dokumentierte Reconciliation.');
  }
  if (this.state === 'IN_FLIGHT'
      && (!this.lastAttemptAt || !this.inFlightAt || !this.lastAttemptBy || this.attempts < 1)) {
    this.invalidate('state', 'IN_FLIGHT benötigt Versuch, Zeitpunkt und Benutzer.');
  }
  if (this.state === 'SYNCED' && (!this.remoteComponentId || !this.syncedAt)) {
    this.invalidate('state', 'SYNCED benötigt Provider-ID und Synchronisationszeitpunkt.');
  }
  if (this.state === 'FAILED' && (!this.failedAt || !this.lastError)) {
    this.invalidate('state', 'FAILED benötigt Zeitpunkt und sichere Fehlerklassifikation.');
  }
  if (this.state === 'UNCERTAIN' && (!this.uncertainAt || !this.lastError)) {
    this.invalidate('state', 'UNCERTAIN benötigt Zeitpunkt und sichere Fehlerklassifikation.');
  }
  const latestReconciliation = this.reconciliations?.at(-1);
  if (this.state === 'PENDING' && latestReconciliation?.outcome !== 'REMOTE_NOT_FOUND') {
    if (this.attempts > 0) this.invalidate('reconciliations', 'Ein kontrollierter neuer Versuch benötigt REMOTE_NOT_FOUND-Evidenz.');
  }
  if (this.state === 'SYNCED' && latestReconciliation?.outcome === 'REMOTE_FOUND'
      && !this.remoteComponentId) {
    this.invalidate('reconciliations', 'REMOTE_FOUND benötigt die bestätigte Provider-ID.');
  }
  next();
});

PayrollProviderOperationSchema.index(
  { provider: 1, idempotencyKey: 1 },
  { unique: true, name: 'payroll_provider_operation_idempotency_unique' },
);
PayrollProviderOperationSchema.index({ payrollRun: 1, state: 1, updatedAt: 1 });
PayrollProviderOperationSchema.index({ payrollEmployeeSnapshot: 1, payrollComponentId: 1, createdAt: -1 });
PayrollProviderOperationSchema.index({ mitarbeiter: 1, createdAt: -1 });

module.exports = mongoose.model('PayrollProviderOperation', PayrollProviderOperationSchema);
module.exports.PROVIDER_OPERATION_STATES = PROVIDER_OPERATION_STATES;
module.exports.PROVIDER_OPERATION_ACTIONS = PROVIDER_OPERATION_ACTIONS;
