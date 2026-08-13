const mongoose = require('mongoose');

const REFERENCE_MONTH_STATUSES = ['DRAFT', 'APPROVED', 'LOCKED', 'SUPERSEDED'];
const EXCLUSION_TYPES = [
  'SHORT_TIME',
  'EXHAUSTED_SICK_PAY',
  'EXCUSED_ABSENCE',
  'SUSPENDED_EMPLOYMENT',
  'OTHER_REVIEWED',
];

const nonNegativeInteger = {
  validator(value) { return Number.isSafeInteger(value) && value >= 0; },
  message: '{PATH} muss eine nicht-negative sichere Ganzzahl sein.',
};

const ExclusionSchema = new mongoose.Schema({
  exclusionType: { type: String, required: true, enum: EXCLUSION_TYPES, immutable: true },
  dateFrom: { type: Date, required: true, immutable: true },
  dateTill: { type: Date, required: true, immutable: true },
  earningsExcludedCents: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  minutesExcluded: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  referenceDaysExcluded: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  evidenceRefs: [{ type: String, trim: true, immutable: true }],
  reason: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
}, { _id: true });

const CandidateComponentSchema = new mongoose.Schema({
  componentKey: { type: String, required: true, trim: true, immutable: true },
  type: { type: String, required: true, trim: true, immutable: true },
  amountCents: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  payloadHash: { type: String, required: true, trim: true, immutable: true },
}, { _id: false });

const SourceCandidateSchema = new mongoose.Schema({
  policyId: { type: String, required: true, enum: ['GVP_REFERENCE_CANDIDATE_V1'], immutable: true },
  baseEarningsCents: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  supplementEarningsCents: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  actualMinutes: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  referenceDays: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  mehrarbeitPremiumCentsExcluded: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  components: { type: [CandidateComponentSchema], default: [], immutable: true },
  workingTimeSourceRefs: [{ type: String, required: true, trim: true, immutable: true }],
  candidateHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
}, { _id: false });

const UsageLockSchema = new mongoose.Schema({
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
  payrollEmployeeSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployeeSnapshot', required: true },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lockedAt: { type: Date, required: true },
}, { _id: false });

const PayrollReferenceMonthSchema = new mongoose.Schema({
  referenceKey: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  version: { type: Number, required: true, min: 1, validate: Number.isInteger, default: 1, immutable: true },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollReferenceMonth', default: null, immutable: true },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', required: true, immutable: true },
  employment: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployment', required: true, immutable: true },
  period: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  sourceSnapshot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployeeSnapshot',
    required: true,
    immutable: true,
  },
  sourceSnapshotContentHash: { type: String, required: true, trim: true, immutable: true },
  sourceCandidate: { type: SourceCandidateSchema, required: true, immutable: true },
  eligibleBaseEarningsCents: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  eligibleSupplementEarningsCents: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  eligibleActualMinutes: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  eligibleReferenceDays: { type: Number, required: true, validate: nonNegativeInteger, immutable: true },
  mehrarbeitPremiumExcluded: { type: Boolean, required: true, immutable: true },
  exclusions: { type: [ExclusionSchema], default: [], immutable: true },
  normalizationPolicyId: { type: String, required: true, trim: true, immutable: true },
  normalizationClause: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
  evidenceRefs: [{ type: String, trim: true, immutable: true }],
  evidenceHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  contentHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  status: { type: String, required: true, enum: REFERENCE_MONTH_STATUSES, default: 'DRAFT' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  approvalReason: { type: String, trim: true, maxlength: 2000, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date, default: null },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null },
  payrollEmployeeSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployeeSnapshot', default: null },
  usageLocks: { type: [UsageLockSchema], default: [] },
}, { timestamps: true });

PayrollReferenceMonthSchema.pre('validate', function validateReferenceMonth(next) {
  for (const exclusion of this.exclusions || []) {
    if (exclusion.dateTill < exclusion.dateFrom) {
      this.invalidate('exclusions', 'Das Ende eines Referenzzeitraum-Ausschlusses darf nicht vor seinem Beginn liegen.');
    }
    if (!exclusion.evidenceRefs?.length) {
      this.invalidate('exclusions', 'Jeder Referenzzeitraum-Ausschluss benötigt mindestens einen Evidenzverweis.');
    }
  }
  if (this.sourceCandidate) {
    const candidateEarnings = this.sourceCandidate.baseEarningsCents + this.sourceCandidate.supplementEarningsCents;
    const normalizedEarnings = this.eligibleBaseEarningsCents + this.eligibleSupplementEarningsCents;
    const exclusionEarnings = (this.exclusions || []).reduce((sum, entry) => sum + entry.earningsExcludedCents, 0);
    const exclusionMinutes = (this.exclusions || []).reduce((sum, entry) => sum + entry.minutesExcluded, 0);
    const exclusionDays = (this.exclusions || []).reduce((sum, entry) => sum + entry.referenceDaysExcluded, 0);
    if (normalizedEarnings > candidateEarnings
        || this.eligibleActualMinutes > this.sourceCandidate.actualMinutes
        || this.eligibleReferenceDays > this.sourceCandidate.referenceDays) {
      this.invalidate('sourceCandidate', 'Final normalisierte Zähler und Nenner dürfen die quellabgeleiteten Kandidaten nicht erhöhen.');
    }
    if (candidateEarnings - normalizedEarnings !== exclusionEarnings
        || this.sourceCandidate.actualMinutes - this.eligibleActualMinutes !== exclusionMinutes
        || this.sourceCandidate.referenceDays - this.eligibleReferenceDays !== exclusionDays) {
      this.invalidate('exclusions', 'Normalisierungsdifferenzen müssen vollständig durch die geprüften Ausschlüsse erklärt sein.');
    }
  }
  if (['APPROVED', 'LOCKED'].includes(this.status)) {
    if (!this.mehrarbeitPremiumExcluded || !this.evidenceRefs?.length || !this.approvedBy || !this.approvedAt || !this.approvalReason) {
      this.invalidate('status', 'Freigegebene Referenzmonate benötigen Mehrarbeitsausschluss, Evidenz und Freigabe.');
    }
    if (String(this.createdBy || '') === String(this.approvedBy || '')) {
      this.invalidate('approvedBy', 'Referenzmonat-Erfassung und -Freigabe müssen im Vier-Augen-Prinzip erfolgen.');
    }
  }
  if (this.status === 'LOCKED'
      && (!this.lockedBy || !this.lockedAt || !this.payrollRun || !this.payrollEmployeeSnapshot
        || !this.usageLocks?.length)) {
    this.invalidate('status', 'Gesperrte Referenzmonate benötigen Lauf-, Snapshot-, Benutzer- und Zeitbezug.');
  }
  if (this.status === 'SUPERSEDED' && this.isCurrent) {
    this.invalidate('isCurrent', 'Ein ersetzter Referenzmonat darf nicht current sein.');
  }
  next();
});

PayrollReferenceMonthSchema.index(
  { referenceKey: 1, version: 1 },
  { unique: true, name: 'payroll_reference_month_key_version_unique' },
);
PayrollReferenceMonthSchema.index(
  { mitarbeiter: 1, period: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'payroll_reference_month_one_current_per_employee_period',
  },
);
PayrollReferenceMonthSchema.index({ sourceSnapshot: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });
PayrollReferenceMonthSchema.index({ mitarbeiter: 1, period: -1, status: 1 });
PayrollReferenceMonthSchema.index({ 'usageLocks.payrollRun': 1, 'usageLocks.payrollEmployeeSnapshot': 1 });

module.exports = mongoose.model('PayrollReferenceMonth', PayrollReferenceMonthSchema);
module.exports.REFERENCE_MONTH_STATUSES = REFERENCE_MONTH_STATUSES;
module.exports.EXCLUSION_TYPES = EXCLUSION_TYPES;
