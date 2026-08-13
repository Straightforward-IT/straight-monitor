const mongoose = require('mongoose');

const FEDERAL_STATES = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
];

// This is the customer's operational business context, not a DGB/GVP
// Branchenzuschlag agreement. The latter is represented independently by
// industrySurchargeTariffCode and must be explicitly NONE or a verified code.
const OPERATIONAL_SECTORS = [
  'GASTRONOMY',
  'HOSPITALITY',
  'EVENTS',
  'CATERING',
  'EVENT_CATERING',
  'OTHER_VERIFIED',
];

const integerOrNull = (value) => value == null || Number.isInteger(value);

const basisPointsField = {
  type: Number,
  min: 0,
  max: 10000,
  validate: integerOrNull,
  default: null,
};

const RegularComparisonComponentSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  amountCents: { type: Number, required: true, validate: Number.isInteger },
  frequency: { type: String, required: true, enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'ONE_TIME'] },
}, { _id: false });

const CustomerPayrollRuleSchema = new mongoose.Schema({
  ruleKey: {
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
    ref: 'CustomerPayrollRule',
    default: null,
    immutable: true,
  },

  kunde: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kunde',
    required: true,
    immutable: true,
  },
  kundenNrSnapshot: { type: Number, default: null, immutable: true },
  validFrom: { type: Date, required: true, immutable: true },
  validTill: { type: Date, default: null, immutable: true },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'active', 'retired', 'cancelled'],
    default: 'draft',
  },

  siteKey: { type: String, required: true, trim: true, immutable: true },
  siteDeclaration: {
    siteName: { type: String, required: true, trim: true, immutable: true },
    street: { type: String, required: true, trim: true, immutable: true },
    houseNumber: { type: String, required: true, trim: true, immutable: true },
    postalCode: { type: String, required: true, trim: true, immutable: true },
    city: { type: String, required: true, trim: true, immutable: true },
    federalState: { type: String, required: true, enum: FEDERAL_STATES, immutable: true },
    declaredByName: { type: String, required: true, trim: true, immutable: true },
    declaredByRole: { type: String, required: true, trim: true, immutable: true },
    declaredAt: { type: Date, required: true, immutable: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    signatureHash: { type: String, required: true, trim: true, immutable: true },
    evidenceHash: { type: String, required: true, trim: true, immutable: true },
  },
  holidayCalendar: {
    calendarId: { type: String, required: true, trim: true, immutable: true },
    dates: [{ type: String, match: /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/, immutable: true }],
    source: { type: String, required: true, trim: true, immutable: true },
    sourceVersion: { type: String, required: true, trim: true, immutable: true },
    evidenceHash: { type: String, required: true, trim: true, immutable: true },
  },

  industryCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    enum: OPERATIONAL_SECTORS,
    immutable: true,
  },
  industrySurchargeTariffCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    immutable: true,
  },
  industrySurchargeRuleVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TariffVersion',
    default: null,
    immutable: true,
  },

  equalPay: {
    status: {
      type: String,
      required: true,
      enum: ['not_applicable', 'pending', 'verified', 'expired'],
      default: 'pending',
      immutable: true,
    },
    comparisonHourlyRateCents: {
      type: Number,
      min: 0,
      validate: integerOrNull,
      default: null,
      immutable: true,
    },
    comparisonMonthlyAmountCents: {
      type: Number,
      min: 0,
      validate: integerOrNull,
      default: null,
      immutable: true,
    },
    comparisonHourlyRateScope: {
      type: String,
      enum: ['BASE_ONLY', 'ALL_IN_REGULAR_PACKAGE'],
      default: 'BASE_ONLY',
      immutable: true,
    },
    conversionPolicyId: { type: String, trim: true, default: null, immutable: true },
    conversionEvidenceHash: { type: String, trim: true, default: null, immutable: true },
    regularComponents: { type: [RegularComparisonComponentSchema], default: [], immutable: true },
    comparisonGroup: { type: String, trim: true, default: null, immutable: true },
    source: { type: String, trim: true, maxlength: 1000, default: null, immutable: true },
    evidenceIds: [{ type: String, trim: true, immutable: true }],
    declarationSigner: { type: String, trim: true, default: null, immutable: true },
    declarationSignedAt: { type: Date, default: null, immutable: true },
    signatureHash: { type: String, trim: true, default: null, immutable: true },
    evidenceHash: { type: String, trim: true, default: null, immutable: true },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null, immutable: true },
    notes: { type: String, trim: true, maxlength: 4000, default: null, immutable: true },
  },

  premiumOverrides: {
    decision: {
      type: String,
      required: true,
      enum: ['UNKNOWN', 'NONE', 'CUSTOMER_RULES'],
      default: 'UNKNOWN',
      immutable: true,
    },
    nightBasisPoints: { ...basisPointsField, immutable: true },
    sundayBasisPoints: { ...basisPointsField, immutable: true },
    holidayBasisPoints: { ...basisPointsField, immutable: true },
    nightWindowStart: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: null,
      immutable: true,
    },
    nightWindowEnd: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: null,
      immutable: true,
    },
    overlapPolicy: {
      type: String,
      enum: ['highest_only', 'stack'],
      default: 'highest_only',
      immutable: true,
    },
    source: { type: String, trim: true, maxlength: 1000, default: null, immutable: true },
  },
  holidayFederalState: {
    type: String,
    enum: FEDERAL_STATES,
    default: null,
    immutable: true,
  },

  source: {
    type: String,
    required: true,
    enum: ['monitor', 'customer_confirmation', 'collective_agreement', 'import', 'migration'],
    default: 'monitor',
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  declarationEvidence: {
    declarationId: { type: String, trim: true, default: null, immutable: true },
    schemaVersion: { type: String, trim: true, default: null, immutable: true },
    signedPayloadHash: { type: String, trim: true, default: null, immutable: true },
    signedDocumentHash: { type: String, trim: true, default: null, immutable: true },
    evidenceManifestHash: { type: String, trim: true, default: null, immutable: true },
    sourceContractHash: { type: String, trim: true, default: null, immutable: true },
    signatureVerificationMode: {
      type: String,
      enum: ['HASH_EQUALITY_ONLY', 'CRYPTOGRAPHICALLY_VERIFIED'],
      default: null,
      immutable: true,
    },
    verifiedAt: { type: Date, default: null, immutable: true },
  },
  changeReason: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  contentHash: { type: String, trim: true, default: null, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

CustomerPayrollRuleSchema.pre('validate', function validateRule(next) {
  if (this.validTill && this.validFrom && this.validTill < this.validFrom) {
    this.invalidate('validTill', 'validTill darf nicht vor validFrom liegen.');
  }
  if (this.status === 'active' && this.equalPay?.status === 'verified') {
    if (!Number.isInteger(this.equalPay.comparisonHourlyRateCents)) {
      this.invalidate('equalPay.comparisonHourlyRateCents', 'Verifiziertes Equal Pay benötigt einen Vergleichsstundenlohn in Cent.');
    }
    if (!this.equalPay.source || !this.equalPay.verifiedAt || !this.equalPay.verifiedBy
        || !this.equalPay.declarationSigner || !this.equalPay.declarationSignedAt
        || !this.equalPay.signatureHash || !this.equalPay.evidenceHash
        || !this.equalPay.evidenceIds?.length) {
      this.invalidate('equalPay.status', 'Verifiziertes Equal Pay benötigt vollständige Erklärung, Evidenz, Signatur und Prüfung.');
    }
    if (this.equalPay.comparisonHourlyRateScope === 'ALL_IN_REGULAR_PACKAGE'
        && (!this.equalPay.conversionPolicyId || !this.equalPay.conversionEvidenceHash)) {
      this.invalidate('equalPay.comparisonHourlyRateScope', 'Ein All-in-Vergleichsstundenlohn benötigt Konversionsrichtlinie und Evidenz-Hash.');
    }
  }
  if (this.status === 'active' && (!this.approvedBy || !this.approvedAt)) {
    this.invalidate('status', 'Aktive Kundenregeln müssen freigegeben sein.');
  }
  if (this.status === 'active') {
    if (!this.siteDeclaration?.reviewedBy || !this.siteDeclaration?.reviewedAt) {
      this.invalidate('siteDeclaration', 'Aktive Kundenregeln benötigen eine geprüfte Einsatzort-Erklärung.');
    }
    if (!this.industrySurchargeTariffCode) {
      this.invalidate('industrySurchargeTariffCode', 'Aktive Kundenregeln benötigen einen Branchenzuschlagstarif oder den expliziten Wert NONE.');
    }
    if (!this.contentHash) {
      this.invalidate('contentHash', 'Aktive Kundenregeln benötigen einen Content-Hash.');
    }
    if (this.premiumOverrides?.decision === 'UNKNOWN') {
      this.invalidate('premiumOverrides.decision', 'Kundenprämien müssen ausdrücklich als NONE oder CUSTOMER_RULES erklärt sein.');
    }
    const premiumValues = [
      this.premiumOverrides?.nightBasisPoints,
      this.premiumOverrides?.sundayBasisPoints,
      this.premiumOverrides?.holidayBasisPoints,
    ];
    if (this.premiumOverrides?.decision === 'NONE' && premiumValues.some((value) => value !== 0)) {
      this.invalidate('premiumOverrides', 'Die explizite NONE-Erklärung benötigt 0 Basispunkte für Nacht, Sonntag und Feiertag.');
    }
    if (this.premiumOverrides?.decision === 'CUSTOMER_RULES'
        && (premiumValues.some((value) => !Number.isInteger(value)) || !this.premiumOverrides?.source)) {
      this.invalidate('premiumOverrides', 'Kundenprämien benötigen vollständige Basispunkte und eine Quelle.');
    }
  }
  next();
});

CustomerPayrollRuleSchema.index(
  { ruleKey: 1, version: 1 },
  { unique: true, name: 'customer_payroll_rule_key_version_unique' },
);
CustomerPayrollRuleSchema.index(
  { ruleKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'customer_payroll_rule_one_current',
  },
);
CustomerPayrollRuleSchema.index({ kunde: 1, validFrom: 1, validTill: 1 });
CustomerPayrollRuleSchema.index({ kunde: 1, siteKey: 1, validFrom: 1, validTill: 1 });
CustomerPayrollRuleSchema.index({ kunde: 1, status: 1, isCurrent: 1 });
CustomerPayrollRuleSchema.index({ industrySurchargeTariffCode: 1, status: 1 });
CustomerPayrollRuleSchema.index(
  { source: 1, sourceRef: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceRef: { $type: 'string' } },
    name: 'customer_payroll_rule_source_ref_unique',
  },
);

module.exports = mongoose.model('CustomerPayrollRule', CustomerPayrollRuleSchema);
module.exports.OPERATIONAL_SECTORS = OPERATIONAL_SECTORS;
module.exports.FEDERAL_STATES = FEDERAL_STATES;
