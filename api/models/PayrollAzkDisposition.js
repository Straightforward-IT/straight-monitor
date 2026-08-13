'use strict';

const mongoose = require('mongoose');

const DISPOSITION_KINDS = [
  'NONE',
  'EMPLOYEE_OVER_91',
  'MONTHLY_AGREEMENT',
  'CYCLE_AGREEMENT',
  'CYCLE_OVERFLOW',
  'TERMINATION',
];

const PayrollAzkDispositionSchema = new mongoose.Schema({
  dispositionKey: {
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
    ref: 'PayrollAzkDisposition',
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
  personalNrSnapshot: { type: String, required: true, trim: true, immutable: true },
  payrollMonth: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
    immutable: true,
  },
  kind: { type: String, required: true, enum: DISPOSITION_KINDS, immutable: true },
  requestedHours: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    immutable: true,
    validate: {
      validator(value) {
        if (value == null) return true;
        const number = Number(value.toString());
        return Number.isFinite(number) && number >= 0;
      },
      message: 'requestedHours muss eine nicht-negative Dezimalzahl sein.',
    },
  },
  reconciliationDue: { type: Boolean, default: false, immutable: true },
  terminationDate: { type: Date, default: null, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
  evidenceRefs: {
    type: [{ type: String, trim: true, immutable: true }],
    required: true,
    validate: {
      validator(value) { return Array.isArray(value) && value.length > 0; },
      message: 'AZK-Disposition benötigt mindestens einen Evidenzverweis.',
    },
    immutable: true,
  },
  evidenceHash: { type: String, required: true, trim: true, immutable: true },
  source: {
    type: String,
    required: true,
    enum: ['employee_request', 'mutual_agreement', 'cycle_review', 'termination', 'office_confirmation'],
    immutable: true,
  },
  sourceRef: { type: String, required: true, trim: true, immutable: true },
  contentHash: { type: String, required: true, trim: true, immutable: true },
  status: {
    type: String,
    required: true,
    enum: ['DRAFT', 'APPROVED', 'LOCKED', 'CANCELLED'],
    default: 'DRAFT',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date, default: null },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null },
  payrollEmployeeSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployeeSnapshot', default: null },
}, { timestamps: false, minimize: false });

PayrollAzkDispositionSchema.pre('validate', function validateDisposition(next) {
  const requestedHours = this.requestedHours == null ? null : Number(this.requestedHours.toString());
  const requestedKinds = ['MONTHLY_AGREEMENT', 'CYCLE_AGREEMENT'];
  const optionalRequestedKinds = ['EMPLOYEE_OVER_91'];
  if (requestedKinds.includes(this.kind) && !(requestedHours > 0)) {
    this.invalidate('requestedHours', `${this.kind} benötigt ausdrücklich angeforderte positive Stunden.`);
  }
  if (!requestedKinds.includes(this.kind) && !optionalRequestedKinds.includes(this.kind) && this.requestedHours != null) {
    this.invalidate('requestedHours', `${this.kind} berechnet die Auszahlungsmenge gesetzlich/tariflich und akzeptiert keine manuelle Menge.`);
  }
  if (optionalRequestedKinds.includes(this.kind) && this.requestedHours != null && !(requestedHours > 0)) {
    this.invalidate('requestedHours', `${this.kind} akzeptiert nur eine positive angeforderte Stundenmenge.`);
  }
  if (this.kind === 'CYCLE_OVERFLOW' && this.reconciliationDue !== true) {
    this.invalidate('reconciliationDue', 'CYCLE_OVERFLOW benötigt einen freigegebenen fälligen Ausgleichszyklus.');
  }
  if (this.kind !== 'CYCLE_OVERFLOW' && this.reconciliationDue) {
    this.invalidate('reconciliationDue', 'reconciliationDue ist nur für CYCLE_OVERFLOW zulässig.');
  }
  if (this.kind === 'TERMINATION' && !this.terminationDate) {
    this.invalidate('terminationDate', 'TERMINATION benötigt das belegte Vertragsende.');
  }
  if (this.kind !== 'TERMINATION' && this.terminationDate) {
    this.invalidate('terminationDate', 'terminationDate ist nur für TERMINATION zulässig.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status)) {
    if (!this.approvedBy || !this.approvedAt) {
      this.invalidate('status', 'Freigegebene AZK-Dispositionen benötigen Prüfer und Zeitpunkt.');
    }
    if (String(this.createdBy) === String(this.approvedBy)) {
      this.invalidate('approvedBy', 'AZK-Dispositionen benötigen das Vier-Augen-Prinzip.');
    }
  }
  if (this.status === 'LOCKED' && (!this.lockedBy || !this.lockedAt || !this.payrollRun || !this.payrollEmployeeSnapshot)) {
    this.invalidate('status', 'Gesperrte AZK-Dispositionen benötigen Lauf, Snapshot, Benutzer und Zeitpunkt.');
  }
  next();
});

PayrollAzkDispositionSchema.index(
  { dispositionKey: 1, version: 1 },
  { unique: true, name: 'payroll_azk_disposition_key_version_unique' },
);
PayrollAzkDispositionSchema.index(
  { mitarbeiter: 1, payrollMonth: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'payroll_azk_disposition_one_current_per_month',
  },
);
PayrollAzkDispositionSchema.index({ payrollRun: 1, mitarbeiter: 1 });

module.exports = mongoose.model('PayrollAzkDisposition', PayrollAzkDispositionSchema);
module.exports.DISPOSITION_KINDS = DISPOSITION_KINDS;
