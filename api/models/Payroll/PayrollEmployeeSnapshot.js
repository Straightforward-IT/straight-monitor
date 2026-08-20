const mongoose = require('mongoose');

const SNAPSHOT_STATUSES = [
  'CALCULATED',
  'VALIDATION_FAILED',
  'VALIDATED',
  'READY_FOR_EXPORT',
  'SYNC_PENDING',
  'SYNCED_TO_PAYCHEX',
  'PAYROLL_COMPLETED',
  'SUPERSEDED',
  'ERROR',
];

const COMPONENT_TYPES = [
  'BASE_WAGE',
  'EXPERIENCE_BONUS',
  'INDUSTRY_SURCHARGE',
  'EQUAL_PAY_ADJUSTMENT',
  'NIGHT_PREMIUM',
  'SUNDAY_PREMIUM',
  'HOLIDAY_PREMIUM',
  'OVERTIME_PREMIUM',
  'AZK_ACCRUAL',
  'AZK_WITHDRAWAL',
  'AZK_PAYOUT',
  'VACATION_PAY',
  'SICK_PAY',
  'SHORT_TIME',
  'CORRECTION',
  'TEMP_HIGHER_GRADE_DIFFERENTIAL',
  'TRAVEL_TIME',
  'SPECIAL_PAYMENT',
  'OTHER',
];

function decimalIsFinite(value) {
  if (value == null) return true;
  return Number.isFinite(Number(value.toString()));
}

const integerOrNull = (value) => value == null || Number.isInteger(value);

const EmployeeIdentitySchema = new mongoose.Schema({
  // Missing identifiers must remain representable so a blocking validation
  // snapshot can be persisted and fixed traceably instead of aborting the run.
  personalNr: { type: String, trim: true, default: null },
  paychexEmployeeUid: { type: String, trim: true, default: null },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  employmentType: { type: String, enum: ['regular', 'minijob', 'short_term', 'student'], default: null },
}, { _id: false });

const InputSnapshotSchema = new mongoose.Schema({
  capturedAt: { type: Date, required: true },
  sourceHash: { type: String, required: true, trim: true },
  employment: { type: mongoose.Schema.Types.Mixed, default: null },
  providerProfile: { type: mongoose.Schema.Types.Mixed, default: null },
  assignments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  workingTimes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  absences: { type: [mongoose.Schema.Types.Mixed], default: [] },
  azk: { type: [mongoose.Schema.Types.Mixed], default: [] },
  azkDisposition: { type: mongoose.Schema.Types.Mixed, default: null },
  adjustments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  customerRules: { type: [mongoose.Schema.Types.Mixed], default: [] },
  referenceMonths: { type: [mongoose.Schema.Types.Mixed], default: [] },
  referenceMonthIssues: { type: [mongoose.Schema.Types.Mixed], default: [] },
  tariffVersions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  pendingInputs: {
    workingTimes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    absences: { type: [mongoose.Schema.Types.Mixed], default: [] },
    adjustments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    azkDispositions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  allocationIssues: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { _id: false, minimize: false });

const PayrollComponentSchema = new mongoose.Schema({
  componentKey: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: COMPONENT_TYPES },
  mappingKey: { type: String, required: true, trim: true },
  wageTypeCode: { type: String, trim: true, default: null },
  quantity: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: { validator: decimalIsFinite, message: 'quantity muss eine endliche Dezimalzahl sein.' },
  },
  unit: {
    type: String,
    required: true,
    enum: ['HOURS', 'DAYS', 'UNITS', 'AMOUNT', 'PERCENT'],
  },
  rateCents: { type: Number, validate: integerOrNull, default: null },
  factor: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: { validator: decimalIsFinite, message: 'factor muss eine endliche Dezimalzahl sein.' },
  },
  percentBasisPoints: { type: Number, validate: integerOrNull, default: null },
  amountCents: { type: Number, required: true, validate: Number.isInteger },
  currency: { type: String, required: true, enum: ['EUR'], default: 'EUR' },
  taxable: { type: Boolean, default: null },
  socialSecurityRelevant: { type: Boolean, default: null },
  explanation: { type: mongoose.Schema.Types.Mixed, required: true },
  sourceRefs: [{ type: String, trim: true }],
  payloadHash: { type: String, required: true, trim: true },
}, { _id: true, minimize: false });

const TotalsSchema = new mongoose.Schema({
  baseWageCents: { type: Number, required: true, validate: Number.isInteger, default: 0 },
  premiumsCents: { type: Number, required: true, validate: Number.isInteger, default: 0 },
  equalPayAdjustmentCents: { type: Number, required: true, validate: Number.isInteger, default: 0 },
  azkPayoutCents: { type: Number, required: true, validate: Number.isInteger, default: 0 },
  absencePayCents: { type: Number, required: true, validate: Number.isInteger, default: 0 },
  correctionsCents: { type: Number, required: true, validate: Number.isInteger, default: 0 },
  expectedGrossCents: { type: Number, required: true, validate: Number.isInteger },
  currency: { type: String, required: true, enum: ['EUR'], default: 'EUR' },
}, { _id: false });

const IssueSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  severity: { type: String, required: true, enum: ['INFO', 'WARNING', 'ERROR'] },
  blocking: { type: Boolean, required: true, default: false },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  fieldPath: { type: String, trim: true, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false, minimize: false });

const ValidationSchema = new mongoose.Schema({
  status: { type: String, required: true, enum: ['NOT_RUN', 'FAILED', 'PASSED'], default: 'NOT_RUN' },
  validatedAt: { type: Date, default: null },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  validationVersion: { type: String, trim: true, default: null },
  hash: { type: String, trim: true, default: null },
}, { _id: false });

const ProviderExportSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['paychex'] },
  componentKey: { type: String, required: true, trim: true },
  companySalaryComponentUid: { type: String, required: true, trim: true },
  remoteComponentId: { type: String, trim: true, default: null },
  payloadHash: { type: String, required: true, trim: true },
  idempotencyKey: { type: String, required: true, trim: true },
  status: { type: String, required: true, enum: ['PENDING', 'SYNCED', 'FAILED', 'SUPERSEDED'] },
  attempts: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  lastAttemptAt: { type: Date, default: null },
  syncedAt: { type: Date, default: null },
  errorCode: { type: String, trim: true, default: null },
  errorMessage: { type: String, trim: true, maxlength: 2000, default: null },
}, { _id: true });

const PayrollEmployeeSnapshotSchema = new mongoose.Schema({
  payrollRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollRun',
    required: true,
    immutable: true,
  },
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  revision: { type: Number, required: true, min: 1, validate: Number.isInteger, default: 1, immutable: true },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployeeSnapshot',
    default: null,
    immutable: true,
  },
  status: { type: String, required: true, enum: SNAPSHOT_STATUSES, default: 'CALCULATED' },

  employeeIdentity: { type: EmployeeIdentitySchema, required: true, immutable: true },
  inputSnapshot: { type: InputSnapshotSchema, required: true, immutable: true },
  components: {
    type: [PayrollComponentSchema],
    required: true,
    immutable: true,
    validate: {
      validator(values) {
        return new Set(values.map((value) => value.componentKey)).size === values.length;
      },
      message: 'componentKey muss innerhalb eines Snapshots eindeutig sein.',
    },
  },
  totals: { type: TotalsSchema, required: true, immutable: true },
  calculationVersion: { type: String, required: true, trim: true, immutable: true },
  tariffVersions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TariffVersion', required: true, immutable: true }],
  calculatedAt: { type: Date, required: true, default: Date.now, immutable: true },
  calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  contentHash: { type: String, required: true, trim: true, immutable: true },

  issues: { type: [IssueSchema], default: [] },
  validation: { type: ValidationSchema, default: () => ({}) },
  providerExports: { type: [ProviderExportSchema], default: [] },
  providerCompletedAt: { type: Date, default: null },
  providerCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, minimize: false });

PayrollEmployeeSnapshotSchema.pre('validate', function validateSnapshot(next) {
  const blockingIssues = (this.issues || []).some((issue) => issue.blocking);
  if (this.validation?.status === 'PASSED') {
    if (!this.validation.validatedAt || !this.validation.validatedBy || !this.validation.hash) {
      this.invalidate('validation', 'Erfolgreiche Validierung benötigt Benutzer, Zeitpunkt und Hash.');
    }
    if (blockingIssues) {
      this.invalidate('issues', 'Ein Snapshot mit blockierenden Fehlern kann nicht erfolgreich validiert sein.');
    }
  }
  if (this.validation?.status === 'FAILED' && !blockingIssues) {
    this.invalidate('issues', 'Fehlgeschlagene Validierung benötigt mindestens einen blockierenden Fehler.');
  }
  if (['READY_FOR_EXPORT', 'SYNC_PENDING', 'SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(this.status)
      && this.validation?.status !== 'PASSED') {
    this.invalidate('status', 'Export und Provider-Sync setzen eine erfolgreiche Validierung voraus.');
  }
  const activeProviderExports = this.providerExports.filter((entry) => entry.status !== 'SUPERSEDED');
  if (this.status === 'SYNCED_TO_PAYCHEX'
      && (activeProviderExports.length === 0 || activeProviderExports.some((entry) => entry.status !== 'SYNCED'))) {
    this.invalidate('providerExports', 'SYNCED_TO_PAYCHEX setzt vollständig synchronisierte Provider-Komponenten voraus.');
  }
  if (this.status === 'PAYROLL_COMPLETED' && (!this.providerCompletedAt || !this.providerCompletedBy)) {
    this.invalidate('status', 'PAYROLL_COMPLETED benötigt Zeitpunkt und Benutzer.');
  }
  if (this.status === 'SUPERSEDED' && this.isCurrent) {
    this.invalidate('isCurrent', 'Ein ersetzter Snapshot darf nicht current sein.');
  }
  next();
});

PayrollEmployeeSnapshotSchema.index(
  { payrollRun: 1, mitarbeiter: 1, revision: 1 },
  { unique: true, name: 'payroll_employee_snapshot_revision_unique' },
);
PayrollEmployeeSnapshotSchema.index(
  { payrollRun: 1, mitarbeiter: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'payroll_employee_snapshot_one_current',
  },
);
PayrollEmployeeSnapshotSchema.index({ payrollRun: 1, status: 1 });
PayrollEmployeeSnapshotSchema.index({ mitarbeiter: 1, month: -1, isCurrent: 1 });
PayrollEmployeeSnapshotSchema.index({ 'providerExports.idempotencyKey': 1 }, { sparse: true });

module.exports = mongoose.model('PayrollEmployeeSnapshot', PayrollEmployeeSnapshotSchema);
module.exports.SNAPSHOT_STATUSES = SNAPSHOT_STATUSES;
module.exports.COMPONENT_TYPES = COMPONENT_TYPES;
