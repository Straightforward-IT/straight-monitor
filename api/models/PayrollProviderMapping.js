const mongoose = require('mongoose');

const PAYLOAD_MODES = [
  'AMOUNT_ONLY',
  'QUANTITY_FACTOR_PERCENT',
];

const ComponentMappingSchema = new mongoose.Schema({
  componentKey: { type: String, required: true, trim: true, uppercase: true, immutable: true },
  companySalaryComponentUid: { type: String, required: true, trim: true, immutable: true },
  payloadMode: { type: String, required: true, enum: PAYLOAD_MODES, immutable: true },
  wageTypeCode: { type: String, trim: true, default: null, immutable: true },
  quantityUnit: {
    type: String,
    enum: ['HOURS', 'DAYS', 'UNITS', 'AMOUNT', 'PERCENT'],
    default: null,
    immutable: true,
  },
  quantitySource: { type: String, enum: ['COMPONENT_QUANTITY', 'FIXED_ONE'], default: 'COMPONENT_QUANTITY', immutable: true },
  factorSource: { type: String, enum: ['COMPONENT_FACTOR', 'COMPONENT_RATE_EURO', 'FIXED_ONE'], default: 'COMPONENT_FACTOR', immutable: true },
  percentSource: { type: String, enum: ['COMPONENT_PERCENT', 'FIXED_100'], default: 'COMPONENT_PERCENT', immutable: true },
  allowNegativeAmount: { type: Boolean, required: true, default: false, immutable: true },
  // Paychex Public API v1.3 accepts at most two decimal places for all three
  // quantity/factor/percent fields. Keeping the limit in the approved mapping
  // makes provider rounding visible and versioned.
  roundQuantityScale: { type: Number, min: 0, max: 2, validate: Number.isInteger, default: 2, immutable: true },
  roundFactorScale: { type: Number, min: 0, max: 2, validate: Number.isInteger, default: 2, immutable: true },
  roundPercentScale: { type: Number, min: 0, max: 2, validate: Number.isInteger, default: 2, immutable: true },
  description: { type: String, trim: true, maxlength: 1000, default: null, immutable: true },
  providerMetadataHash: { type: String, required: true, trim: true, immutable: true },
}, { _id: true });

ComponentMappingSchema.pre('validate', function validatePayloadMode(next) {
  if (this.payloadMode === 'QUANTITY_FACTOR_PERCENT' && !this.quantityUnit) {
    this.invalidate('quantityUnit', 'QUANTITY_FACTOR_PERCENT benötigt quantityUnit.');
  }
  next();
});

const PayrollProviderMappingSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['paychex'], immutable: true },
  companyKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9][a-z0-9_-]{1,63}$/,
    immutable: true,
  },
  companyUid: { type: String, required: true, trim: true, immutable: true },
  version: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  status: {
    type: String,
    required: true,
    enum: ['DRAFT', 'ACTIVE', 'RETIRED'],
    default: 'DRAFT',
  },
  isActive: { type: Boolean, required: true, default: false },
  supersedes: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollProviderMapping',
    default: null,
    immutable: true,
  },
  validFrom: { type: Date, required: true, immutable: true },
  validTill: { type: Date, default: null },
  components: {
    type: [ComponentMappingSchema],
    required: true,
    immutable: true,
    validate: {
      validator(values) {
        return Array.isArray(values) && values.length > 0
          && new Set(values.map((value) => value.componentKey)).size === values.length;
      },
      message: 'Eine Provider-Zuordnung benötigt eindeutige componentKey-Einträge.',
    },
  },
  referenceDataSyncedAt: { type: Date, required: true, immutable: true },
  referenceDataHash: { type: String, required: true, trim: true, immutable: true },
  source: {
    type: String,
    required: true,
    enum: ['paychex_reference_sync', 'manual', 'migration'],
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  contentHash: { type: String, required: true, trim: true, immutable: true },
  changeReason: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  approvalReview: {
    reason: { type: String, trim: true, maxlength: 2000, default: null },
    paychexApprovalReference: { type: String, trim: true, default: null },
    evidenceRefs: [{ type: String, trim: true }],
    evidenceHash: { type: String, trim: true, default: null },
  },
  retiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  retiredAt: { type: Date, default: null },
}, { timestamps: true });

PayrollProviderMappingSchema.pre('validate', function validateMapping(next) {
  if (this.validTill && this.validTill < this.validFrom) {
    this.invalidate('validTill', 'validTill darf nicht vor validFrom liegen.');
  }
  if (this.status === 'ACTIVE') {
    if (!this.isActive || !this.approvedBy || !this.approvedAt
        || !this.approvalReview?.reason || !this.approvalReview?.paychexApprovalReference
        || !this.approvalReview?.evidenceRefs?.length || !this.approvalReview?.evidenceHash) {
      this.invalidate('status', 'Aktive Provider-Zuordnungen benötigen isActive, Prüfer und Zeitpunkt.');
    }
    if (this.validTill && this.validTill < new Date()) {
      this.invalidate('validTill', 'Eine aktive Provider-Zuordnung darf nicht abgelaufen sein.');
    }
  } else if (this.isActive) {
    this.invalidate('isActive', 'Nur Provider-Zuordnungen mit Status ACTIVE dürfen aktiv sein.');
  }
  if (this.status === 'RETIRED' && (!this.retiredBy || !this.retiredAt || !this.validTill)) {
    this.invalidate('status', 'Stillgelegte Provider-Zuordnungen benötigen Benutzer, Zeitpunkt und validTill.');
  }
  next();
});

PayrollProviderMappingSchema.index(
  { provider: 1, companyKey: 1, version: 1 },
  { unique: true, name: 'payroll_provider_mapping_version_unique' },
);
PayrollProviderMappingSchema.index(
  { provider: 1, companyKey: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'payroll_provider_mapping_one_active',
  },
);
PayrollProviderMappingSchema.index({ provider: 1, companyKey: 1, status: 1, validFrom: -1 });
PayrollProviderMappingSchema.index({ 'components.componentKey': 1, provider: 1, companyKey: 1 });

PayrollProviderMappingSchema.statics.findActive = function findActive(provider, companyKey, at = new Date()) {
  return this.findOne({
    provider,
    companyKey: String(companyKey).trim().toLowerCase(),
    status: 'ACTIVE',
    isActive: true,
    validFrom: { $lte: at },
    $or: [{ validTill: null }, { validTill: { $gte: at } }],
  });
};

module.exports = mongoose.model('PayrollProviderMapping', PayrollProviderMappingSchema);
module.exports.PAYLOAD_MODES = PAYLOAD_MODES;
