const mongoose = require('mongoose');

const DECIMAL_NON_NEGATIVE = {
  validator(value) {
    if (value == null) return true;
    const number = Number(value.toString());
    return Number.isFinite(number) && number >= 0;
  },
  message: '{PATH} muss eine nicht-negative Dezimalzahl sein.',
};

const PayrollEmploymentSchema = new mongoose.Schema({
  employmentKey: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  version: { type: Number, required: true, min: 1, default: 1, immutable: true },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployment',
    default: null,
    immutable: true,
  },

  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  },
  personalNrSnapshot: { type: String, trim: true, default: null, immutable: true },
  paychexEmployeeUid: { type: String, trim: true, default: null, immutable: true },
  validFrom: { type: Date, required: true, immutable: true },
  validTill: { type: Date, default: null, immutable: true },

  employmentType: {
    type: String,
    required: true,
    enum: ['regular', 'minijob', 'short_term', 'student'],
    immutable: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'active', 'ended', 'cancelled'],
    default: 'draft',
  },
  contractNumber: { type: String, trim: true, default: null, immutable: true },
  weeklyHours: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: DECIMAL_NON_NEGATIVE,
    immutable: true,
  },
  monthlyTargetHours: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: DECIMAL_NON_NEGATIVE,
    immutable: true,
  },
  workingDaysPerWeek: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator(value) {
        const number = Number(value.toString());
        return Number.isFinite(number) && number > 0 && number <= 7;
      },
      message: 'workingDaysPerWeek muss zwischen 0 und 7 liegen.',
    },
    immutable: true,
  },

  tariff: {
    system: {
      type: String,
      required: true,
      enum: ['GVP', 'BAP', 'IGZ', 'OTHER'],
      default: 'GVP',
      immutable: true,
    },
    group: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    ruleVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TariffVersion',
      required: true,
      immutable: true,
    },
    transitionRule: {
      type: String,
      enum: ['unknown', 'standard', 'legacy_igz', 'legacy_bap', 'custom'],
      default: 'unknown',
      immutable: true,
    },
  },
  baseHourlyRateCents: {
    type: Number,
    required: true,
    min: 0,
    validate: Number.isInteger,
    immutable: true,
  },
  overtimeModel: {
    type: String,
    required: true,
    enum: ['fixed_115_percent', 'legacy_igz_workdays', 'custom'],
    default: 'fixed_115_percent',
    immutable: true,
  },
  experiencePolicy: {
    policy: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    evidenceHash: { type: String, trim: true, default: null, immutable: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  periodTargetOverrides: [{
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, immutable: true },
    payableTargetHours: { type: mongoose.Schema.Types.Decimal128, required: true, validate: DECIMAL_NON_NEGATIVE, immutable: true },
    reason: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    evidenceHash: { type: String, required: true, trim: true, immutable: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    approvedAt: { type: Date, required: true, immutable: true },
  }],

  source: {
    type: String,
    required: true,
    enum: ['monitor', 'import', 'migration'],
    default: 'monitor',
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  contractEvidence: {
    contractDocumentId: { type: String, trim: true, default: null, immutable: true },
    collectiveAgreementIncorporated: { type: Boolean, default: null, immutable: true },
    collectiveAgreementCode: { type: String, trim: true, uppercase: true, default: null, immutable: true },
    declarationSignedAt: { type: Date, default: null, immutable: true },
    declarationSigner: { type: String, trim: true, default: null, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    signatureHash: { type: String, trim: true, default: null, immutable: true },
    evidenceHash: { type: String, trim: true, default: null, immutable: true },
  },
  changeReason: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

PayrollEmploymentSchema.pre('validate', function validateEffectiveRange(next) {
  if (this.validTill && this.validFrom && this.validTill < this.validFrom) {
    this.invalidate('validTill', 'validTill darf nicht vor validFrom liegen.');
  }
  if (this.status === 'ended' && !this.validTill) {
    this.invalidate('validTill', 'Beendete Beschäftigungen benötigen validTill.');
  }
  if (this.status === 'active' && (!this.approvedBy || !this.approvedAt)) {
    this.invalidate('status', 'Aktive Beschäftigungen müssen freigegeben sein.');
  }
  if (this.status === 'active') {
    if (this.tariff?.transitionRule === 'unknown') {
      this.invalidate('tariff.transitionRule', 'Aktive Beschäftigungen benötigen eine geprüfte Übergangsregel.');
    }
    if (this.contractEvidence?.collectiveAgreementIncorporated !== true
        || !this.contractEvidence?.contractDocumentId
        || !this.contractEvidence?.signatureHash
        || !this.contractEvidence?.evidenceHash) {
      this.invalidate('contractEvidence', 'Aktive Beschäftigungen benötigen einen nachweisbar einbezogenen Tarifvertrag mit Dokument-, Signatur- und Evidenz-Hash.');
    }
    if (!this.experiencePolicy?.policy?.policyId || !this.experiencePolicy?.policy?.mode
        || !this.experiencePolicy?.evidenceHash || !this.experiencePolicy?.approvedBy
        || !this.experiencePolicy?.approvedAt) {
      this.invalidate('experiencePolicy', 'Aktive Beschäftigungen benötigen eine freigegebene, evidenzbasierte Auslegung des Erfahrungszuschlags.');
    }
  }
  next();
});

PayrollEmploymentSchema.index(
  { employmentKey: 1, version: 1 },
  { unique: true, name: 'payroll_employment_key_version_unique' },
);
PayrollEmploymentSchema.index(
  { employmentKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'payroll_employment_one_current',
  },
);
PayrollEmploymentSchema.index({ mitarbeiter: 1, validFrom: 1, validTill: 1 });
PayrollEmploymentSchema.index({ mitarbeiter: 1, status: 1, isCurrent: 1 });
PayrollEmploymentSchema.index(
  { source: 1, sourceRef: 1 },
  { sparse: true, name: 'payroll_employment_source_ref' },
);

module.exports = mongoose.model('PayrollEmployment', PayrollEmploymentSchema);
