const mongoose = require('mongoose');

const PAYROLL_RUN_STATUSES = [
  'DRAFT',
  'CALCULATING',
  'CALCULATED',
  'VALIDATING',
  'VALIDATED',
  'READY_FOR_EXPORT',
  'SYNCING_TO_PAYCHEX',
  'SYNCED_TO_PAYCHEX',
  'PAYROLL_COMPLETED',
  'DOCUMENTS_IMPORTED',
  'CLOSED',
  'FAILED',
  'REVISION_REQUIRED',
];

const RECONCILIATION_STATUSES = ['NOT_RUN', 'PASSED', 'FAILED'];
const FINALIZED_PAYROLL_RUN_STATUSES = ['PAYROLL_COMPLETED', 'DOCUMENTS_IMPORTED', 'CLOSED'];

const CounterSchema = new mongoose.Schema({
  calculated: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  validated: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  readyForExport: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  synced: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  completed: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  documentsImported: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  warnings: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  errors: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
}, { _id: false });

const StatusHistorySchema = new mongoose.Schema({
  from: { type: String, enum: PAYROLL_RUN_STATUSES, default: null },
  to: { type: String, enum: PAYROLL_RUN_STATUSES, required: true },
  at: { type: Date, required: true, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, trim: true, maxlength: 2000, default: null },
}, { _id: false });

const CohortSchema = new mongoose.Schema({
  employeeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  }],
  frozenAt: { type: Date, required: true, immutable: true },
  sourceHash: { type: String, required: true, trim: true, immutable: true },
  selectionPolicy: {
    type: String,
    required: true,
    enum: ['MONTH_EFFECTIVE_EMPLOYEE_V1'],
    immutable: true,
  },
}, { _id: false });

const CoverageSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['NOT_CHECKED', 'INCOMPLETE', 'COMPLETE'],
    default: 'NOT_CHECKED',
  },
  checkedAt: { type: Date, default: null },
  expectedCount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  snapshotCount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  missingEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter' }],
  unexpectedEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter' }],
}, { _id: false });

const ReconciliationSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: RECONCILIATION_STATUSES,
    default: 'NOT_RUN',
  },
  expectedGrossCents: { type: Number, validate: Number.isSafeInteger, default: null },
  providerGrossCents: { type: Number, validate: Number.isSafeInteger, default: null },
  differenceCents: { type: Number, validate: Number.isSafeInteger, default: null },
  providerFinalizationReference: { type: String, trim: true, maxlength: 500, default: null },
  evidenceRefs: [{ type: String, trim: true, maxlength: 1000 }],
  evidenceHash: {
    type: String,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    default: null,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reason: { type: String, trim: true, maxlength: 2000, default: null },
}, { _id: false });

const AmendmentDetectionSchema = new mongoose.Schema({
  eventKey: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  detectedAt: { type: Date, required: true, default: Date.now, immutable: true },
  detectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
}, { _id: false });

const AmendmentRequirementSchema = new mongoose.Schema({
  correctionRequired: { type: Boolean, required: true, default: false },
  detectionCount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  lastDetectedAt: { type: Date, default: null },
  lastDetectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  detections: { type: [AmendmentDetectionSchema], default: [] },
}, { _id: false });

const PayrollRunSchema = new mongoose.Schema({
  runKey: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  companyKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9][a-z0-9_-]{1,63}$/,
    immutable: true,
  },
  runNumber: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  runType: {
    type: String,
    required: true,
    enum: ['REGULAR', 'CORRECTION', 'SHADOW'],
    default: 'REGULAR',
    immutable: true,
  },
  parentRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null, immutable: true },

  scope: {
    locationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location', immutable: true }],
    teamKeys: [{ type: String, trim: true, lowercase: true, immutable: true }],
    employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', immutable: true }],
  },
  cohort: { type: CohortSchema, required: true, immutable: true },
  tariffVersions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TariffVersion', immutable: true }],
  calculationVersion: { type: String, required: true, trim: true, immutable: true },
  inputCutoffAt: { type: Date, required: true, immutable: true },
  inputHash: { type: String, trim: true, default: null, immutable: true },

  status: {
    type: String,
    required: true,
    enum: PAYROLL_RUN_STATUSES,
    default: 'DRAFT',
  },
  statusHistory: { type: [StatusHistorySchema], default: [] },
  employeeCount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  counters: { type: CounterSchema, default: () => ({}) },
  coverage: { type: CoverageSchema, default: () => ({}) },

  provider: {
    name: { type: String, enum: ['paychex'], default: 'paychex' },
    companyUid: { type: String, trim: true, default: null },
    mappingVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollProviderMapping', default: null },
    syncBatchId: { type: String, trim: true, default: null },
    lastSyncedAt: { type: Date, default: null },
    lastSyncedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  reconciliation: { type: ReconciliationSchema, default: () => ({}) },
  // A finalized payroll result is immutable. Later source changes are recorded
  // here and must be handled by a child CORRECTION run; they never reopen this
  // run or replace its final status.
  amendmentRequirement: { type: AmendmentRequirementSchema, default: () => ({}) },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  calculationStartedAt: { type: Date, default: null },
  calculatedAt: { type: Date, default: null },
  validationStartedAt: { type: Date, default: null },
  validatedAt: { type: Date, default: null },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  readyForExportAt: { type: Date, default: null },
  readyForExportBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  payrollCompletedAt: { type: Date, default: null },
  payrollCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  failure: {
    code: { type: String, trim: true, default: null },
    message: { type: String, trim: true, maxlength: 2000, default: null },
    at: { type: Date, default: null },
  },
}, { timestamps: true });

PayrollRunSchema.pre('validate', function validateRun(next) {
  if (this.runType === 'CORRECTION' && !this.parentRun) {
    this.invalidate('parentRun', 'Korrekturabrechnungen benötigen einen parentRun.');
  }
  if (this.status === 'VALIDATED' && (!this.validatedAt || !this.validatedBy)) {
    this.invalidate('status', 'Validierte PayrollRuns benötigen validatedAt und validatedBy.');
  }
  if (this.status === 'READY_FOR_EXPORT' && (!this.readyForExportAt || !this.readyForExportBy)) {
    this.invalidate('status', 'Exportbereite PayrollRuns benötigen Freigabezeitpunkt und Benutzer.');
  }
  if (this.status === 'PAYROLL_COMPLETED' && (!this.payrollCompletedAt || !this.payrollCompletedBy)) {
    this.invalidate('status', 'Abgeschlossene Provider-Payroll benötigt Zeitpunkt und Benutzer.');
  }
  const reconciliation = this.reconciliation || {};
  if (['PASSED', 'FAILED'].includes(reconciliation.status)) {
    const hasCompleteReconciliation = Number.isSafeInteger(reconciliation.expectedGrossCents)
      && Number.isSafeInteger(reconciliation.providerGrossCents)
      && Number.isSafeInteger(reconciliation.differenceCents)
      && reconciliation.providerFinalizationReference
      && (reconciliation.evidenceRefs || []).length > 0
      && reconciliation.evidenceHash
      && reconciliation.reviewedBy
      && reconciliation.reviewedAt
      && reconciliation.reason;
    if (!hasCompleteReconciliation) {
      this.invalidate('reconciliation', 'Ein ausgeführter Bruttoabgleich benötigt Beträge, Provider-Referenz, Evidenz, Prüfer, Zeitpunkt und Grund.');
    }
  }
  if (reconciliation.status === 'PASSED'
      && (reconciliation.differenceCents !== 0
        || reconciliation.expectedGrossCents !== reconciliation.providerGrossCents)) {
    this.invalidate('reconciliation', 'Ein bestandener Bruttoabgleich benötigt eine Differenz von exakt null Cent.');
  }
  if (this.status === 'PAYROLL_COMPLETED') {
    if (reconciliation.status !== 'PASSED') {
      this.invalidate('reconciliation', 'PAYROLL_COMPLETED benötigt einen bestandenen Bruttoabgleich.');
    }
    if (!this.provider?.lastSyncedBy) {
      this.invalidate('provider.lastSyncedBy', 'PAYROLL_COMPLETED benötigt den verantwortlichen Provider-Synchronisierer.');
    }
    if (String(this.provider?.lastSyncedBy || '') === String(reconciliation.reviewedBy || '')) {
      this.invalidate('reconciliation.reviewedBy', 'Provider-Synchronisation und Bruttoabgleich müssen im Vier-Augen-Prinzip erfolgen.');
    }
  }
  if (this.status === 'CLOSED' && (!this.closedAt || !this.closedBy)) {
    this.invalidate('status', 'Geschlossene PayrollRuns benötigen closedAt und closedBy.');
  }
  if (this.amendmentRequirement?.correctionRequired
      && (!this.amendmentRequirement.lastDetectedAt
        || this.amendmentRequirement.detectionCount < 1
        || (this.amendmentRequirement.detections || []).length < 1)) {
    this.invalidate(
      'amendmentRequirement',
      'Eine Korrekturanforderung benötigt mindestens eine nachvollziehbare Erkennung.',
    );
  }
  if (this.status === 'FAILED' && (!this.failure?.code || !this.failure?.message || !this.failure?.at)) {
    this.invalidate('failure', 'Fehlgeschlagene PayrollRuns benötigen Fehlercode, Meldung und Zeitpunkt.');
  }
  const cohortIds = (this.cohort?.employeeIds || []).map(String);
  if (new Set(cohortIds).size !== cohortIds.length) {
    this.invalidate('cohort.employeeIds', 'Der eingefrorene Payroll-Cohort darf keine doppelten Mitarbeiter enthalten.');
  }
  if (this.employeeCount !== cohortIds.length) {
    this.invalidate('employeeCount', 'employeeCount muss exakt dem eingefrorenen Payroll-Cohort entsprechen.');
  }
  if (this.coverage?.status === 'COMPLETE'
      && ((this.coverage.missingEmployeeIds || []).length > 0
        || (this.coverage.unexpectedEmployeeIds || []).length > 0
        || this.coverage.expectedCount !== this.employeeCount
        || this.coverage.snapshotCount !== this.employeeCount)) {
    this.invalidate('coverage', 'Vollständige Abdeckung benötigt exakt einen aktuellen Snapshot je Cohort-Mitarbeiter.');
  }
  if (['READY_FOR_EXPORT', 'SYNCING_TO_PAYCHEX', 'SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED', 'DOCUMENTS_IMPORTED', 'CLOSED'].includes(this.status)
      && this.coverage?.status !== 'COMPLETE') {
    this.invalidate('coverage', 'Export und Provider-Synchronisation benötigen eine vollständige Cohort-Abdeckung.');
  }
  const counters = this.counters || {};
  const boundedCounters = ['calculated', 'validated', 'readyForExport', 'synced', 'completed', 'documentsImported'];
  for (const field of boundedCounters) {
    if ((counters[field] || 0) > this.employeeCount) {
      this.invalidate(`counters.${field}`, `${field} darf employeeCount nicht überschreiten.`);
    }
  }
  next();
});

PayrollRunSchema.index(
  { companyKey: 1, month: 1, runNumber: 1 },
  { unique: true, name: 'payroll_run_company_month_number_unique' },
);
PayrollRunSchema.index(
  { companyKey: 1, month: 1, runType: 1 },
  {
    unique: true,
    name: 'payroll_run_single_regular_lineage_unique',
    partialFilterExpression: { runType: 'REGULAR' },
  },
);
PayrollRunSchema.index({ month: -1, status: 1, companyKey: 1 });
PayrollRunSchema.index({ 'scope.locationIds': 1, month: -1 });
PayrollRunSchema.index({ 'scope.employeeIds': 1, month: -1 });
PayrollRunSchema.index({ 'cohort.employeeIds': 1, month: -1 });
PayrollRunSchema.index({ parentRun: 1 }, { sparse: true });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
module.exports.PAYROLL_RUN_STATUSES = PAYROLL_RUN_STATUSES;
module.exports.RECONCILIATION_STATUSES = RECONCILIATION_STATUSES;
module.exports.FINALIZED_PAYROLL_RUN_STATUSES = FINALIZED_PAYROLL_RUN_STATUSES;
