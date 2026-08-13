const mongoose = require('mongoose');

const ADJUSTMENT_TYPES = [
  'TEMP_HIGHER_GRADE_DIFFERENTIAL',
  'TRAVEL_TIME',
  'SPECIAL_PAYMENT',
  'CORRECTION',
  'OTHER',
];

const ADJUSTMENT_STATUSES = ['DRAFT', 'APPROVED', 'LOCKED', 'VOIDED'];
const QUANTITY_UNITS = ['HOURS', 'DAYS', 'UNITS', 'AMOUNT', 'PERCENT'];

function decimalIsFinite(value) {
  if (value == null) return true;
  return Number.isFinite(Number(value.toString()));
}

const integerOrNull = (value) => value == null || Number.isInteger(value);

function objectIdsEqual(left, right) {
  if (!left || !right) return false;
  return String(left) === String(right);
}

const PayrollAdjustmentLedgerSchema = new mongoose.Schema({
  adjustmentKey: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  version: {
    type: Number,
    required: true,
    min: 1,
    validate: integerOrNull,
    default: 1,
    immutable: true,
  },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollAdjustmentLedger',
    default: null,
    immutable: true,
  },

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
  assignmentLedger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssignmentLedger',
    default: null,
    immutable: true,
  },
  payrollMonth: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },

  adjustmentType: {
    type: String,
    required: true,
    enum: ADJUSTMENT_TYPES,
    immutable: true,
  },
  componentType: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 100,
    immutable: true,
  },
  mappingKey: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 100,
    immutable: true,
  },
  quantity: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: {
      validator: decimalIsFinite,
      message: 'quantity muss eine endliche Dezimalzahl sein.',
    },
    immutable: true,
  },
  unit: {
    type: String,
    required: true,
    enum: QUANTITY_UNITS,
    immutable: true,
  },
  rateCents: {
    type: Number,
    validate: integerOrNull,
    default: null,
    immutable: true,
  },
  factor: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: {
      validator: decimalIsFinite,
      message: 'factor muss eine endliche Dezimalzahl sein.',
    },
    immutable: true,
  },
  percentBasisPoints: {
    type: Number,
    validate: integerOrNull,
    default: null,
    immutable: true,
  },
  amountCents: {
    type: Number,
    required: true,
    validate: Number.isInteger,
    immutable: true,
  },
  currency: { type: String, required: true, enum: ['EUR'], default: 'EUR', immutable: true },

  evidenceRefs: {
    type: [{ type: String, trim: true, immutable: true }],
    required: true,
    immutable: true,
    validate: {
      validator(values) {
        return Array.isArray(values) && values.some((value) => Boolean(value));
      },
      message: 'Entgeltanpassungen benötigen mindestens eine Evidenzreferenz.',
    },
  },
  evidenceHash: { type: String, required: true, trim: true, immutable: true },
  clause: { type: String, required: true, trim: true, maxlength: 1000, immutable: true },
  ruleVersion: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 4000, immutable: true },
  source: {
    type: String,
    required: true,
    enum: ['payroll-core', 'office', 'import', 'migration'],
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  contentHash: { type: String, required: true, trim: true, immutable: true },

  status: {
    type: String,
    required: true,
    enum: ADJUSTMENT_STATUSES,
    default: 'DRAFT',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date, default: null },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null },
  payrollEmployeeSnapshot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollEmployeeSnapshot',
    default: null,
  },
}, { timestamps: true });

PayrollAdjustmentLedgerSchema.pre('validate', function validateAdjustment(next) {
  if (this.adjustmentType && this.componentType && this.adjustmentType !== this.componentType) {
    this.invalidate('componentType', 'componentType muss der kanonischen adjustmentType entsprechen.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status)) {
    if (!this.approvedBy || !this.approvedAt) {
      this.invalidate('status', 'Freigegebene Entgeltanpassungen benötigen approvedBy und approvedAt.');
    }
    if (objectIdsEqual(this.createdBy, this.approvedBy)) {
      this.invalidate('approvedBy', 'Ersteller und Freigeber müssen für das Vier-Augen-Prinzip verschieden sein.');
    }
  }

  if (this.status === 'LOCKED'
      && (!this.lockedBy || !this.lockedAt || !this.payrollRun || !this.payrollEmployeeSnapshot)) {
    this.invalidate(
      'status',
      'Gesperrte Entgeltanpassungen benötigen lockedBy, lockedAt, PayrollRun und PayrollEmployeeSnapshot.',
    );
  }

  next();
});

PayrollAdjustmentLedgerSchema.index(
  { adjustmentKey: 1, version: 1 },
  { unique: true, name: 'payroll_adjustment_ledger_key_version_unique' },
);
PayrollAdjustmentLedgerSchema.index(
  { adjustmentKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'payroll_adjustment_ledger_one_current',
  },
);
PayrollAdjustmentLedgerSchema.index({ mitarbeiter: 1, payrollMonth: 1, status: 1 });
PayrollAdjustmentLedgerSchema.index({ employment: 1, payrollMonth: 1 });
PayrollAdjustmentLedgerSchema.index({ assignmentLedger: 1, payrollMonth: 1 });
PayrollAdjustmentLedgerSchema.index({ payrollRun: 1, mitarbeiter: 1 });
PayrollAdjustmentLedgerSchema.index({ source: 1, sourceRef: 1, version: 1 });

module.exports = mongoose.model('PayrollAdjustmentLedger', PayrollAdjustmentLedgerSchema);
module.exports.ADJUSTMENT_TYPES = ADJUSTMENT_TYPES;
module.exports.ADJUSTMENT_STATUSES = ADJUSTMENT_STATUSES;
module.exports.QUANTITY_UNITS = QUANTITY_UNITS;
