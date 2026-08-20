const mongoose = require('mongoose');

const ABSENCE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED', 'VOIDED'];

function decimalIsNonNegative(value) {
  if (value == null) return true;
  const number = Number(value.toString());
  return Number.isFinite(number) && number >= 0;
}

function decimalToScaledInteger(value, scale) {
  if (value == null) return null;
  const scaled = Number(value.toString()) * scale;
  return Number.isSafeInteger(scaled) ? scaled : null;
}

function dateOnly(value) {
  return value instanceof Date && Number.isFinite(value.getTime())
    ? value.toISOString().slice(0, 10)
    : null;
}

function nextDate(value) {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

const StatusHistorySchema = new mongoose.Schema({
  from: { type: String, enum: ABSENCE_STATUSES, default: null },
  to: { type: String, enum: ABSENCE_STATUSES, required: true },
  at: { type: Date, required: true, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, trim: true, maxlength: 2000, default: null },
}, { _id: false });

const DayAllocationSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/,
    immutable: true,
  },
  creditedMinutes: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  quantityHundredths: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  amountCents: { type: Number, min: 0, validate: Number.isInteger, default: null, immutable: true },
}, { _id: false });

const AbsenceLedgerSchema = new mongoose.Schema({
  absenceKey: {
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
    ref: 'AbwesenheitsBuch',
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
    ref: 'EinsatzBuch',
    default: null,
    immutable: true,
  },
  kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', default: null, immutable: true },
  personalNrSnapshot: { type: String, required: true, trim: true, immutable: true },

  absenceType: {
    type: String,
    required: true,
    enum: [
      'VACATION',
      'SICKNESS',
      'PUBLIC_HOLIDAY',
      'AZK_WITHDRAWAL',
      'UNPAID_LEAVE',
      'SHORT_TIME',
      'SPECIAL_LEAVE',
      'OTHER',
    ],
    immutable: true,
  },
  reasonCode: { type: String, trim: true, uppercase: true, default: null, immutable: true },
  dateFrom: { type: Date, required: true, immutable: true },
  dateTill: { type: Date, required: true, immutable: true },
  timeZone: { type: String, required: true, trim: true, default: 'Europe/Berlin', immutable: true },
  unit: { type: String, required: true, enum: ['HOURS', 'DAYS'], immutable: true },
  quantity: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: { validator: decimalIsNonNegative, message: 'quantity muss nicht-negativ sein.' },
    immutable: true,
  },
  payrollHours: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: { validator: decimalIsNonNegative, message: 'payrollHours muss nicht-negativ sein.' },
    immutable: true,
  },
  dayAllocations: { type: [DayAllocationSchema], default: [], immutable: true },
  azkCreditTreatment: {
    type: String,
    required: true,
    enum: ['CREDIT', 'NO_CREDIT', 'UNKNOWN'],
    default: 'UNKNOWN',
    immutable: true,
  },
  payTreatment: {
    type: String,
    required: true,
    enum: ['PAID_REFERENCE_AVERAGE', 'PAID_BASE', 'UNPAID', 'UNKNOWN'],
    default: 'UNKNOWN',
    immutable: true,
  },
  paychexAbsenceType: { type: String, trim: true, default: null, immutable: true },
  paychexStatus: { type: String, trim: true, default: null, immutable: true },
  // Provider-subtype fields (for example half-day flags or sickness/refund
  // facts) are reviewed as payroll evidence. Common identity/date fields are
  // always constructed by the service and may not be overridden here.
  paychexPayloadDetails: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  treatmentEvidence: {
    decisionSource: { type: String, trim: true, default: null, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    evidenceHash: { type: String, trim: true, default: null, immutable: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  entitlementYear: { type: Number, min: 2000, max: 2200, default: null, immutable: true },
  holidayFederalState: {
    type: String,
    enum: ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'],
    default: null,
    immutable: true,
  },
  referencePeriodFrom: { type: Date, default: null, immutable: true },
  referencePeriodTill: { type: Date, default: null, immutable: true },

  status: {
    type: String,
    required: true,
    enum: ABSENCE_STATUSES,
    default: 'DRAFT',
  },
  statusHistory: { type: [StatusHistorySchema], default: [] },
  source: {
    type: String,
    required: true,
    enum: ['monitor', 'employee', 'teamlead', 'office', 'import', 'migration'],
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  evidenceRefs: [{ type: String, trim: true, immutable: true }],
  changeReason: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 2000, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date, default: null },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null },
  providerSync: {
    provider: { type: String, enum: ['paychex'], default: 'paychex' },
    remoteAbsenceId: { type: String, trim: true, default: null },
    remoteAbsenceReason: { type: String, trim: true, default: null },
    payloadHash: { type: String, trim: true, default: null },
    status: { type: String, enum: ['NOT_SYNCED', 'SYNCED', 'FAILED'], default: 'NOT_SYNCED' },
    attempts: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    syncedAt: { type: Date, default: null },
    errorCode: { type: String, trim: true, default: null },
    errorMessage: { type: String, trim: true, maxlength: 1000, default: null },
  },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  recordedAt: { type: Date, required: true, default: Date.now, immutable: true },
  contentHash: { type: String, trim: true, default: null, immutable: true },
}, { timestamps: true });

AbsenceLedgerSchema.pre('validate', function validateAbsence(next) {
  if (this.dateTill < this.dateFrom) {
    this.invalidate('dateTill', 'dateTill darf nicht vor dateFrom liegen.');
  }
  if (this.referencePeriodFrom && this.referencePeriodTill && this.referencePeriodTill < this.referencePeriodFrom) {
    this.invalidate('referencePeriodTill', 'Der Referenzzeitraum ist ungültig.');
  }
  if (this.absenceType === 'PUBLIC_HOLIDAY' && !this.holidayFederalState) {
    this.invalidate('holidayFederalState', 'Feiertage benötigen ein Bundesland.');
  }
  if (['SUBMITTED', 'APPROVED', 'LOCKED'].includes(this.status) && !this.submittedAt) {
    this.invalidate('submittedAt', 'Eingereichte Abwesenheiten benötigen submittedAt.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status) && (!this.approvedBy || !this.approvedAt)) {
    this.invalidate('status', 'Freigegebene Abwesenheiten benötigen approvedBy und approvedAt.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status)) {
    if (this.payTreatment === 'UNKNOWN') {
      this.invalidate('payTreatment', 'Freigegebene Abwesenheiten benötigen eine explizite Entgeltbehandlung.');
    }
    if (this.azkCreditTreatment === 'UNKNOWN') {
      this.invalidate('azkCreditTreatment', 'Freigegebene Abwesenheiten benötigen eine explizite AZK-Anrechnungsentscheidung.');
    }
    const fromDate = dateOnly(this.dateFrom);
    const tillDate = dateOnly(this.dateTill);
    const fromMonth = fromDate?.slice(0, 7);
    const tillMonth = tillDate?.slice(0, 7);
    if (fromMonth && tillMonth && fromMonth !== tillMonth && !(this.dayAllocations || []).length) {
      this.invalidate('dayAllocations', 'Monatsübergreifende Abwesenheiten benötigen eine geprüfte Tagesaufteilung.');
    }
    if ((this.dayAllocations || []).length) {
      const allocations = [...this.dayAllocations].sort((left, right) => left.date.localeCompare(right.date));
      const expectedDates = [];
      for (let current = fromDate; current && current <= tillDate; current = nextDate(current)) {
        expectedDates.push(current);
      }
      if (allocations.length !== expectedDates.length
          || allocations.some((entry, index) => entry.date !== expectedDates[index])) {
        this.invalidate('dayAllocations', 'Die Tagesaufteilung muss jeden Kalendertag des Zeitraums genau einmal enthalten; arbeitsfreie Tage erhalten Nullwerte.');
      }
      const expectedMinutes = decimalToScaledInteger(this.payrollHours, 60);
      const expectedQuantityHundredths = decimalToScaledInteger(this.quantity, 100);
      const allocatedMinutes = allocations.reduce((sum, entry) => sum + entry.creditedMinutes, 0);
      const allocatedQuantityHundredths = allocations.reduce((sum, entry) => sum + entry.quantityHundredths, 0);
      if (expectedMinutes == null || allocatedMinutes !== expectedMinutes) {
        this.invalidate('dayAllocations', 'Die Tagesminuten müssen den freigegebenen payrollHours minutengenau entsprechen.');
      }
      if (expectedQuantityHundredths == null || allocatedQuantityHundredths !== expectedQuantityHundredths) {
        this.invalidate('dayAllocations', 'Die Tagesmengen müssen der freigegebenen Abwesenheitsmenge auf Hundertstel genau entsprechen.');
      }
    }
    if (!this.paychexAbsenceType || !this.paychexStatus || !this.treatmentEvidence?.decisionSource
        || !this.treatmentEvidence?.evidenceHash || !this.treatmentEvidence?.reviewedBy
        || !this.treatmentEvidence?.reviewedAt) {
      this.invalidate('treatmentEvidence', 'Freigegebene Abwesenheiten benötigen Provider-Mapping und geprüfte Behandlungsevidenz.');
    }
  }
  const providerDetails = this.paychexPayloadDetails || {};
  const forbiddenProviderFields = ['absence_reason', 'status', 'start_date', 'end_date'];
  for (const field of forbiddenProviderFields) {
    if (Object.prototype.hasOwnProperty.call(providerDetails, field)) {
      this.invalidate(`paychexPayloadDetails.${field}`, `${field} wird aus kanonischen Feldern erzeugt und darf nicht überschrieben werden.`);
    }
  }
  if (this.absenceType === 'VACATION' && ['APPROVED', 'LOCKED'].includes(this.status)
      && (typeof providerDetails.start_date_is_half_day !== 'boolean'
        || typeof providerDetails.end_date_is_half_day !== 'boolean')) {
    this.invalidate('paychexPayloadDetails', 'Paychex-Urlaub benötigt explizite Halbtag-Kennzeichen.');
  }
  if (this.status === 'REJECTED' && (!this.rejectedBy || !this.rejectedAt || !this.rejectionReason)) {
    this.invalidate('status', 'Abgelehnte Abwesenheiten benötigen Prüfer, Zeitpunkt und Grund.');
  }
  if (this.status === 'LOCKED' && (!this.lockedBy || !this.lockedAt)) {
    this.invalidate('status', 'Gesperrte Abwesenheiten benötigen lockedBy und lockedAt.');
  }
  next();
});

AbsenceLedgerSchema.index(
  { absenceKey: 1, version: 1 },
  { unique: true, name: 'absence_ledger_key_version_unique' },
);
AbsenceLedgerSchema.index(
  { absenceKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'absence_ledger_one_current',
  },
);
AbsenceLedgerSchema.index({ mitarbeiter: 1, dateFrom: 1, dateTill: 1, status: 1 });
AbsenceLedgerSchema.index({ employment: 1, dateFrom: 1 });
AbsenceLedgerSchema.index({ payrollRun: 1, mitarbeiter: 1 });
AbsenceLedgerSchema.index({ 'providerSync.remoteAbsenceId': 1 }, { sparse: true });
AbsenceLedgerSchema.index({ source: 1, sourceRef: 1, version: 1 });

module.exports = mongoose.model('AbwesenheitsBuch', AbsenceLedgerSchema);
