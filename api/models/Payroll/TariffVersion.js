const mongoose = require('mongoose');

function decimalIsNonNegative(value) {
  if (value == null) return true;
  const number = Number(value.toString());
  return Number.isFinite(number) && number >= 0;
}

const integerOrNull = (value) => value == null || Number.isInteger(value);

const EntgeltgruppeSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  label: { type: String, required: true, trim: true },
  hourlyRateCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
}, { _id: false });

const ExperienceBonusRuleSchema = new mongoose.Schema({
  groupCode: { type: String, trim: true, uppercase: true, default: '*' },
  afterCompletedMonths: { type: Number, required: true, min: 0, validate: Number.isInteger },
  mode: { type: String, required: true, enum: ['PERCENT', 'FIXED_CENTS'] },
  percentBasisPoints: { type: Number, min: 0, max: 10000, validate: integerOrNull, default: null },
  hourlyAmountCents: { type: Number, min: 0, validate: integerOrNull, default: null },
}, { _id: false });

ExperienceBonusRuleSchema.pre('validate', function validateExperienceBonus(next) {
  if (this.mode === 'PERCENT' && !Number.isInteger(this.percentBasisPoints)) {
    this.invalidate('percentBasisPoints', 'Prozentuale Erfahrungszuschläge benötigen Basispunkte.');
  }
  if (this.mode === 'FIXED_CENTS' && !Number.isInteger(this.hourlyAmountCents)) {
    this.invalidate('hourlyAmountCents', 'Feste Erfahrungszuschläge benötigen Cent pro Stunde.');
  }
  next();
});

const IndustrySurchargeStageSchema = new mongoose.Schema({
  tariffCode: { type: String, required: true, trim: true, uppercase: true },
  stageCode: { type: String, required: true, trim: true, uppercase: true },
  afterCompletedWeeks: { type: Number, required: true, min: 0, validate: Number.isInteger },
  percentBasisPoints: { type: Number, required: true, min: 0, max: 10000, validate: Number.isInteger },
  capAgainstEqualPay: { type: Boolean, required: true, default: true },
}, { _id: false });

const PremiumRuleSchema = new mongoose.Schema({
  premiumType: {
    type: String,
    required: true,
    enum: ['NIGHT', 'SUNDAY', 'PUBLIC_HOLIDAY', 'CHRISTMAS_EVE', 'NEW_YEARS_EVE', 'OVERTIME'],
  },
  percentBasisPoints: { type: Number, required: true, min: 0, max: 20000, validate: Number.isInteger },
  windowStart: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null },
  windowEnd: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null },
  startsAfterLocalTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null },
}, { _id: false });

const VacationEntitlementSchema = new mongoose.Schema({
  fromServiceYear: { type: Number, required: true, min: 1, validate: Number.isInteger },
  throughServiceYear: { type: Number, min: 1, validate: integerOrNull, default: null },
  daysPerYear: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: { validator: decimalIsNonNegative, message: 'Urlaubstage müssen nicht-negativ sein.' },
  },
}, { _id: false });

const TariffVersionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z0-9][A-Z0-9_.-]{2,79}$/,
    immutable: true,
  },
  system: {
    type: String,
    required: true,
    enum: ['GVP', 'BAP', 'IGZ', 'OTHER'],
    immutable: true,
  },
  version: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'TariffVersion', default: null, immutable: true },
  validFrom: { type: Date, required: true, immutable: true },
  validTill: { type: Date, default: null, immutable: true },
  status: {
    type: String,
    required: true,
    enum: ['DRAFT', 'APPROVED', 'RETIRED'],
    default: 'DRAFT',
  },
  currency: { type: String, required: true, enum: ['EUR'], default: 'EUR', immutable: true },

  standardMonthlyHours: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: { validator: decimalIsNonNegative, message: 'standardMonthlyHours muss nicht-negativ sein.' },
  },
  alternativeMonthlyHours: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: { validator: decimalIsNonNegative, message: 'alternativeMonthlyHours muss nicht-negativ sein.' },
  },
  entgeltgruppen: {
    type: [EntgeltgruppeSchema],
    required: true,
    validate: {
      validator(values) {
        return Array.isArray(values) && values.length > 0
          && new Set(values.map((value) => value.code)).size === values.length;
      },
      message: 'Entgeltgruppen müssen vorhanden und innerhalb einer Tarifversion eindeutig sein.',
    },
  },
  experienceBonusRules: { type: [ExperienceBonusRuleSchema], default: [] },
  industrySurchargeStages: {
    type: [IndustrySurchargeStageSchema],
    default: [],
    validate: {
      validator(values) {
        const keys = values.map((value) => `${value.tariffCode}:${value.stageCode}`);
        return new Set(keys).size === keys.length;
      },
      message: 'Branchenzuschlagsstufen müssen je Tarif und Stufe eindeutig sein.',
    },
  },
  premiumRules: {
    type: [PremiumRuleSchema],
    required: true,
    validate: {
      validator(values) {
        return Array.isArray(values) && new Set(values.map((value) => value.premiumType)).size === values.length;
      },
      message: 'Zuschlagsarten dürfen pro Tarifversion nur einmal vorkommen.',
    },
  },
  premiumOverlapPolicy: {
    type: String,
    required: true,
    enum: ['HIGHEST_ONLY', 'STACK'],
    default: 'HIGHEST_ONLY',
  },
  overtimeThresholdBasisPoints: {
    type: Number,
    required: true,
    min: 10000,
    max: 30000,
    validate: Number.isInteger,
  },

  azkRules: {
    regularMaxPlusHours: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: { validator: decimalIsNonNegative, message: 'AZK-Grenzen müssen nicht-negativ sein.' },
    },
    seasonalMaxPlusHours: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: { validator: decimalIsNonNegative, message: 'AZK-Grenzen müssen nicht-negativ sein.' },
    },
    insolvencyProtectionThresholdHours: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: { validator: decimalIsNonNegative, message: 'AZK-Grenzen müssen nicht-negativ sein.' },
    },
    annualCarryoverMaxHours: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: { validator: decimalIsNonNegative, message: 'AZK-Grenzen müssen nicht-negativ sein.' },
    },
    reconciliationMonths: { type: Number, required: true, min: 1, validate: Number.isInteger },
    graceMonths: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  vacationEntitlements: { type: [VacationEntitlementSchema], default: [] },
  absenceAverageReferenceMonths: { type: Number, required: true, min: 1, validate: Number.isInteger, default: 3 },
  additionalRules: { type: mongoose.Schema.Types.Mixed, default: {} },

  calculationVersion: { type: String, required: true, trim: true },
  source: {
    title: { type: String, required: true, trim: true },
    reference: { type: String, required: true, trim: true },
    publishedAt: { type: Date, default: null },
    checksum: { type: String, required: true, trim: true },
  },
  contentHash: { type: String, trim: true, default: null },
  approvalReview: {
    reason: { type: String, trim: true, maxlength: 2000, default: null },
    evidenceRefs: [{ type: String, trim: true }],
    evidenceHash: { type: String, trim: true, default: null },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false });

TariffVersionSchema.pre('validate', function validateTariff(next) {
  if (this.validTill && this.validTill < this.validFrom) {
    this.invalidate('validTill', 'validTill darf nicht vor validFrom liegen.');
  }
  if (this.status === 'APPROVED' && (!this.approvedBy || !this.approvedAt || !this.contentHash
      || !this.approvalReview?.reason || !this.approvalReview?.evidenceRefs?.length
      || !this.approvalReview?.evidenceHash)) {
    this.invalidate('status', 'Freigegebene Tarifversionen benötigen Prüfer, Zeitpunkt und Content-Hash.');
  }
  next();
});

TariffVersionSchema.index({ system: 1, validFrom: 1, validTill: 1, status: 1 });
TariffVersionSchema.index({ system: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('TariffVersion', TariffVersionSchema);
