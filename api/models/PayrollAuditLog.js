const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  'CREATE_RUN',
  'CALCULATE',
  'RECALCULATE',
  'VALIDATE',
  'READY_FOR_EXPORT',
  'MANUAL_OVERRIDE',
  'SYNC_PAYCHEX',
  'SYNC_EMPLOYEE',
  'SYNC_ABSENCE',
  'UPDATE_REMOTE_COMPONENT',
  'DELETE_REMOTE_COMPONENT',
  'MARK_PAYROLL_COMPLETE',
  'IMPORT_DOCUMENTS',
  'CLOSE_RUN',
  'LOCK_INPUT',
  'UNLOCK_INPUT',
  'SUBMIT_INPUT',
  'APPROVE_INPUT',
  'REJECT_INPUT',
  'CREATE_REVISION',
  'REQUIRE_CORRECTION',
  'PROVIDER_REFERENCE_SYNC',
  'RECONCILE_PROVIDER_OPERATION',
  'CREATE_REFERENCE_MONTH',
  'APPROVE_REFERENCE_MONTH',
  'ERROR',
];

const integerOrNull = (value) => value == null || Number.isInteger(value);

const ProviderReferenceSchema = new mongoose.Schema({
  provider: { type: String, enum: ['paychex'], default: null, immutable: true },
  companyUid: { type: String, trim: true, default: null, immutable: true },
  employeeUid: { type: String, trim: true, default: null, immutable: true },
  resourceType: { type: String, trim: true, default: null, immutable: true },
  referenceId: { type: String, trim: true, default: null, immutable: true },
  correlationId: { type: String, trim: true, default: null, immutable: true },
  httpStatus: { type: Number, min: 100, max: 599, validate: integerOrNull, default: null, immutable: true },
  errorCode: { type: String, trim: true, default: null, immutable: true },
}, { _id: false });

const PayrollAuditLogSchema = new mongoose.Schema({
  eventKey: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
  actor: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
    actorType: { type: String, required: true, enum: ['USER', 'SYSTEM', 'PROVIDER'], immutable: true },
    displayId: { type: String, trim: true, default: null, immutable: true },
  },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null, immutable: true },
  payrollEmployeeSnapshot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployeeSnapshot',
    default: null,
    immutable: true,
  },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null, immutable: true },
  action: { type: String, required: true, enum: AUDIT_ACTIONS, immutable: true },
  outcome: { type: String, required: true, enum: ['STARTED', 'SUCCEEDED', 'FAILED', 'REJECTED'], immutable: true },
  previousStatus: { type: String, trim: true, default: null, immutable: true },
  newStatus: { type: String, trim: true, default: null, immutable: true },
  payloadHash: { type: String, trim: true, default: null, immutable: true },
  inputHash: { type: String, trim: true, default: null, immutable: true },
  providerRef: { type: ProviderReferenceSchema, default: null, immutable: true },
  errorCode: { type: String, trim: true, default: null, immutable: true },
  errorMessage: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  reasonCode: { type: String, trim: true, uppercase: true, default: null, immutable: true },
  summary: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  // Only non-sensitive identifiers, counts and hashes are allowed here. Never
  // persist request/response bodies, tax/SV/bank data or document contents.
  safeMetadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
}, { timestamps: true, minimize: false });

PayrollAuditLogSchema.pre('validate', function validateAuditEvent(next) {
  if (this.actor?.actorType === 'USER' && !this.actor?.user) {
    this.invalidate('actor.user', 'USER-Auditereignisse benötigen einen User.');
  }
  if (this.outcome === 'FAILED' && (!this.errorCode || !this.errorMessage)) {
    this.invalidate('outcome', 'Fehlgeschlagene Auditereignisse benötigen Fehlercode und Meldung.');
  }
  if (['SYNC_PAYCHEX', 'SYNC_EMPLOYEE', 'SYNC_ABSENCE', 'UPDATE_REMOTE_COMPONENT', 'DELETE_REMOTE_COMPONENT', 'RECONCILE_PROVIDER_OPERATION'].includes(this.action)
      && (!this.payloadHash || !this.providerRef?.provider)) {
    this.invalidate('providerRef', 'Provider-Schreibaktionen benötigen Payload-Hash und Provider-Referenz.');
  }
  next();
});

for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  PayrollAuditLogSchema.pre(operation, function rejectAuditMutation(next) {
    next(new Error('PayrollAuditLog ist append-only und darf nicht verändert oder gelöscht werden.'));
  });
}

PayrollAuditLogSchema.pre('save', function rejectSavedAuditMutation(next) {
  if (!this.isNew) return next(new Error('PayrollAuditLog ist append-only und darf nicht verändert werden.'));
  return next();
});

PayrollAuditLogSchema.index({ payrollRun: 1, occurredAt: 1 });
PayrollAuditLogSchema.index({ payrollEmployeeSnapshot: 1, occurredAt: 1 });
PayrollAuditLogSchema.index({ mitarbeiter: 1, occurredAt: -1 });
PayrollAuditLogSchema.index({ action: 1, outcome: 1, occurredAt: -1 });
PayrollAuditLogSchema.index({ 'providerRef.correlationId': 1 }, { sparse: true });
PayrollAuditLogSchema.index({ payloadHash: 1 }, { sparse: true });

module.exports = mongoose.model('PayrollAuditLog', PayrollAuditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
