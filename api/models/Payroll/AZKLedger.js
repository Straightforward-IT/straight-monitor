const mongoose = require('mongoose');

function decimalToNumber(value) {
  return value == null ? null : Number(value.toString());
}

const integerOrNull = (value) => value == null || Number.isInteger(value);

const AZKLedgerSchema = new mongoose.Schema({
  entryKey: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  idempotencyKey: { type: String, trim: true, default: null, immutable: true },
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  },
  employment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployment',
    required: true,
    immutable: true,
  },
  personalNrSnapshot: { type: String, required: true, trim: true, immutable: true },
  effectiveDate: { type: Date, required: true, immutable: true },
  payrollMonth: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  movementType: {
    type: String,
    required: true,
    enum: [
      'OPENING_BALANCE',
      'NO_CHANGE',
      'ACCRUAL',
      'WITHDRAWAL',
      'PAYOUT',
      'OVERFLOW_PAYOUT',
      'EXPIRY',
      'CORRECTION',
      'REVERSAL',
    ],
    immutable: true,
  },
  hoursDelta: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    immutable: true,
    validate: {
      validator(value) {
        const number = decimalToNumber(value);
        return Number.isFinite(number);
      },
      message: 'hoursDelta muss eine endliche Dezimalzahl sein.',
    },
  },
  balanceAfterHours: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    immutable: true,
    validate: {
      validator(value) {
        const number = decimalToNumber(value);
        return value == null || Number.isFinite(number);
      },
      message: 'balanceAfterHours muss eine endliche Dezimalzahl sein.',
    },
  },
  payoutRateCents: {
    type: Number,
    min: 0,
    validate: integerOrNull,
    default: null,
    immutable: true,
  },
  payoutAmountCents: {
    type: Number,
    min: 0,
    validate: integerOrNull,
    default: null,
    immutable: true,
  },
  tariffVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TariffVersion',
    default: null,
    immutable: true,
  },
  policyContext: {
    openingBalanceAsserted: { type: Boolean, required: true, default: false, immutable: true },
    openingBalanceEvidenceRefs: [{ type: String, trim: true, immutable: true }],
    openingBalanceEvidenceHash: { type: String, trim: true, default: null, immutable: true },
    balancingCycleKey: { type: String, required: true, trim: true, immutable: true },
    balancingCycleFrom: { type: Date, required: true, immutable: true },
    balancingCycleTill: { type: Date, required: true, immutable: true },
    capType: { type: String, required: true, enum: ['REGULAR', 'SEASONAL', 'PART_TIME_PRORATED', 'UNKNOWN'], default: 'UNKNOWN', immutable: true },
    partTimeNumerator: { type: Number, min: 1, validate: integerOrNull, default: null, immutable: true },
    partTimeDenominator: { type: Number, min: 1, validate: integerOrNull, default: null, immutable: true },
    applicableCapHours: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      immutable: true,
      validate: {
        validator(value) { return value == null || Number.isFinite(Number(value.toString())); },
        message: 'applicableCapHours muss eine endliche Dezimalzahl sein.',
      },
    },
    seasonalApprovalRef: { type: String, trim: true, default: null, immutable: true },
    insolvencyProtectionStatus: {
      type: String,
      required: true,
      enum: ['NOT_REQUIRED', 'REQUIRED_PENDING', 'PROTECTED', 'UNKNOWN'],
      default: 'UNKNOWN',
      immutable: true,
    },
    insolvencyProtectionEvidenceRefs: [{ type: String, trim: true, immutable: true }],
    insolvencyProtectionEvidenceHash: { type: String, trim: true, default: null, immutable: true },
    policyVersion: { type: String, required: true, trim: true, immutable: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },

  sourceWorkingTime: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArbeitszeitBuch',
    default: null,
    immutable: true,
  },
  sourceAbsence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AbsenceLedger',
    default: null,
    immutable: true,
  },
  payrollRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollRun',
    default: null,
  },
  payrollEmployeeSnapshot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployeeSnapshot',
    default: null,
  },
  reversalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AZKLedger',
    default: null,
    immutable: true,
  },
  reversedByEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'AZKLedger', default: null },

  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'APPROVED', 'LOCKED', 'REVERSED'],
    default: 'PENDING',
  },
  source: {
    type: String,
    required: true,
    enum: ['payroll-core', 'office', 'import', 'migration', 'reversal'],
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  recordedAt: { type: Date, required: true, default: Date.now, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date, default: null },
  contentHash: { type: String, trim: true, default: null, immutable: true },
}, { timestamps: true });

AZKLedgerSchema.pre('validate', function validateMovement(next) {
  const delta = decimalToNumber(this.hoursDelta);
  const positiveTypes = ['ACCRUAL'];
  const negativeTypes = ['WITHDRAWAL', 'PAYOUT', 'OVERFLOW_PAYOUT', 'EXPIRY'];

  if (positiveTypes.includes(this.movementType) && !(delta > 0)) {
    this.invalidate('hoursDelta', `${this.movementType} benötigt einen positiven Stundenwert.`);
  }
  if (negativeTypes.includes(this.movementType) && !(delta < 0)) {
    this.invalidate('hoursDelta', `${this.movementType} benötigt einen negativen Stundenwert.`);
  }
  if (['CORRECTION', 'REVERSAL'].includes(this.movementType) && delta === 0) {
    this.invalidate('hoursDelta', `${this.movementType} darf nicht 0 Stunden betragen.`);
  }
  if (this.movementType === 'NO_CHANGE' && delta !== 0) {
    this.invalidate('hoursDelta', 'NO_CHANGE benötigt exakt 0 Stunden.');
  }
  if (this.movementType === 'REVERSAL' && !this.reversalOf) {
    this.invalidate('reversalOf', 'Eine Stornobuchung benötigt den ursprünglichen Ledger-Eintrag.');
  }
  if (['PAYOUT', 'OVERFLOW_PAYOUT'].includes(this.movementType)
      && (!Number.isInteger(this.payoutRateCents) || !Number.isInteger(this.payoutAmountCents))) {
    this.invalidate('payoutAmountCents', 'Auszahlungen benötigen Stundenlohn und Betrag in Cent.');
  }
  if (['PAYOUT', 'OVERFLOW_PAYOUT'].includes(this.movementType)
      && !['payroll-core', 'migration'].includes(this.source)) {
    this.invalidate('source', 'Aktuelle AZK-Auszahlungen dürfen ausschließlich aus dem Payroll Core stammen; migration ist nur für historische Bestände zulässig.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status)
      && (this.balanceAfterHours == null || !this.approvedBy || !this.approvedAt)) {
    this.invalidate('status', 'Freigegebene AZK-Buchungen benötigen Saldo, Prüfer und Zeitpunkt.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status)) {
    const policy = this.policyContext || {};
    if (!policy.openingBalanceAsserted || !policy.openingBalanceEvidenceHash
        || policy.capType === 'UNKNOWN' || policy.applicableCapHours == null
        || policy.insolvencyProtectionStatus === 'UNKNOWN'
        || !policy.reviewedBy || !policy.reviewedAt) {
      this.invalidate('policyContext', 'Freigegebene AZK-Buchungen benötigen geprüfte Eröffnungs-, Zyklus-, Cap- und Schutzfakten.');
    }
    if (policy.capType === 'SEASONAL' && !policy.seasonalApprovalRef) {
      this.invalidate('policyContext.seasonalApprovalRef', 'Saisonale AZK-Grenzen benötigen eine Freigabereferenz.');
    }
    if (!Number.isInteger(policy.partTimeNumerator) || !Number.isInteger(policy.partTimeDenominator)
        || policy.partTimeNumerator <= 0 || policy.partTimeDenominator <= 0
        || policy.partTimeNumerator > policy.partTimeDenominator) {
      this.invalidate('policyContext.partTimeNumerator', 'AZK-Cap benötigt ein geprüftes Teilzeitverhältnis zwischen 0 und 1.');
    }
    const expectedFullTimeCap = policy.capType === 'SEASONAL' ? 230 : 200;
    const expectedApplicableCap = Math.round(
      (expectedFullTimeCap * 6000 * policy.partTimeNumerator) / policy.partTimeDenominator,
    ) / 6000;
    if (Math.abs(Number(policy.applicableCapHours?.toString()) - expectedApplicableCap) > (0.5 / 6000)) {
      this.invalidate('policyContext.applicableCapHours', 'Der freigegebene AZK-Cap entspricht nicht dem Cap-Typ und Teilzeitverhältnis.');
    }
    if (['REQUIRED_PENDING', 'PROTECTED'].includes(policy.insolvencyProtectionStatus)
        && (!policy.insolvencyProtectionEvidenceRefs?.length || !policy.insolvencyProtectionEvidenceHash)) {
      this.invalidate('policyContext.insolvencyProtectionEvidenceHash', 'Schutzpflichtige AZK-Salden benötigen Schutzevidenz.');
    }
  }
  if (this.policyContext?.balancingCycleTill < this.policyContext?.balancingCycleFrom) {
    this.invalidate('policyContext.balancingCycleTill', 'Der AZK-Ausgleichszyklus ist ungültig.');
  }
  if (this.status === 'LOCKED' && (!this.lockedBy || !this.lockedAt)) {
    this.invalidate('status', 'Gesperrte AZK-Buchungen benötigen lockedBy und lockedAt.');
  }
  next();
});

AZKLedgerSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    name: 'azk_ledger_idempotency_unique',
  },
);
AZKLedgerSchema.index({ mitarbeiter: 1, effectiveDate: 1, createdAt: 1 });
AZKLedgerSchema.index({ mitarbeiter: 1, payrollMonth: 1, status: 1 });
AZKLedgerSchema.index({ payrollRun: 1, mitarbeiter: 1 });
AZKLedgerSchema.index({ reversalOf: 1 }, { sparse: true });

module.exports = mongoose.model('AZKLedger', AZKLedgerSchema);
