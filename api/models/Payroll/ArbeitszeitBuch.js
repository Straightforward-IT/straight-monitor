const mongoose = require('mongoose');

const WORKING_TIME_STATUSES = ['OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED', 'VOIDED'];

function decimalIsNonNegative(value) {
  if (value == null) return true;
  const number = Number(value.toString());
  return Number.isFinite(number) && number >= 0;
}

// Pausen werden als reine Minutenzahl erfasst — keine Von-/Bis-Zeitpunkte.
const BreakSchema = new mongoose.Schema({
  minutes: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: decimalIsNonNegative,
      message: 'Pausenminuten müssen nicht-negativ sein.',
    },
    immutable: true,
  },
  source: {
    type: String,
    enum: ['timer', 'employee', 'teamlead', 'office', 'import'],
    required: true,
    immutable: true,
  },
}, { _id: true });

const StatusHistorySchema = new mongoose.Schema({
  from: { type: String, enum: WORKING_TIME_STATUSES, default: null },
  to: { type: String, enum: WORKING_TIME_STATUSES, required: true },
  at: { type: Date, required: true, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, trim: true, maxlength: 2000, default: null },
}, { _id: false });

const WorkingTimeLedgerSchema = new mongoose.Schema({
  entryKey: {
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
    ref: 'ArbeitszeitBuch',
    default: null,
    immutable: true,
  },

  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  },
  assignmentLedger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EinsatzBuch',
    required: true,
    immutable: true,
  },
  auftrag: { type: mongoose.Schema.Types.ObjectId, ref: 'Auftrag', required: true, immutable: true },
  einsatz: { type: mongoose.Schema.Types.ObjectId, ref: 'Einsatz', default: null, immutable: true },
  kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', required: true, immutable: true },
  personalNrSnapshot: { type: String, required: true, trim: true, immutable: true },
  workDate: { type: Date, required: true, immutable: true },
  timeZone: { type: String, required: true, trim: true, default: 'Europe/Berlin', immutable: true },

  planned: {
    start: { type: Date, default: null, immutable: true },
    end: { type: Date, default: null, immutable: true },
    breakMinutes: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      validate: { validator: decimalIsNonNegative, message: 'planned.breakMinutes muss nicht-negativ sein.' },
      immutable: true,
    },
    hours: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      validate: { validator: decimalIsNonNegative, message: 'planned.hours muss nicht-negativ sein.' },
      immutable: true,
    },
  },
  actual: {
    start: { type: Date, default: null, immutable: true },
    end: { type: Date, default: null, immutable: true },
    breaks: { type: [BreakSchema], default: [], immutable: true },
    breakMinutes: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      validate: { validator: decimalIsNonNegative, message: 'actual.breakMinutes muss nicht-negativ sein.' },
      immutable: true,
    },
    workedHours: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      validate: { validator: decimalIsNonNegative, message: 'actual.workedHours muss nicht-negativ sein.' },
      immutable: true,
    },
  },
  capture: {
    rawStart: { type: Date, default: null, immutable: true },
    rawEnd: { type: Date, default: null, immutable: true },
    startReceivedAt: { type: Date, default: null, immutable: true },
    endReceivedAt: { type: Date, default: null, immutable: true },
    clientTimeZone: { type: String, trim: true, default: null, immutable: true },
    siteKey: { type: String, trim: true, default: null, immutable: true },
    deviceIdHash: { type: String, trim: true, default: null, immutable: true },
  },
  roundingRule: { type: String, trim: true, default: 'none', immutable: true },

  status: {
    type: String,
    required: true,
    enum: WORKING_TIME_STATUSES,
    default: 'OPEN',
  },
  statusHistory: { type: [StatusHistorySchema], default: [] },
  source: {
    type: String,
    required: true,
    enum: ['public-monitor', 'teamlead', 'office', 'import', 'migration'],
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  sourceRecordedAt: { type: Date, default: null, immutable: true },
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

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  recordedAt: { type: Date, required: true, default: Date.now, immutable: true },
  contentHash: { type: String, trim: true, default: null, immutable: true },
}, { timestamps: true });

WorkingTimeLedgerSchema.pre('validate', function validateWorkingTime(next) {
  const actual = this.actual || {};
  const planned = this.planned || {};

  if (actual.start && actual.end && actual.end <= actual.start) {
    this.invalidate('actual.end', 'Das Arbeitsende muss nach dem Arbeitsbeginn liegen.');
  }
  if (planned.start && planned.end && planned.end <= planned.start) {
    this.invalidate('planned.end', 'Das geplante Ende muss nach dem geplanten Beginn liegen.');
  }

  if (['SUBMITTED', 'APPROVED', 'LOCKED'].includes(this.status)) {
    if (!actual.start || !actual.end || actual.workedHours == null || actual.breakMinutes == null) {
      this.invalidate('status', 'Eingereichte Zeiten benötigen Beginn, Ende, Pause und berechnete Arbeitsstunden.');
    }
    if (!this.submittedAt) this.invalidate('submittedAt', 'Eingereichte Zeiten benötigen submittedAt.');
  }
  if (['APPROVED', 'LOCKED'].includes(this.status) && (!this.approvedBy || !this.approvedAt)) {
    this.invalidate('status', 'Freigegebene Zeiten benötigen approvedBy und approvedAt.');
  }
  if (this.status === 'REJECTED' && (!this.rejectedBy || !this.rejectedAt || !this.rejectionReason)) {
    this.invalidate('status', 'Abgelehnte Zeiten benötigen Prüfer, Zeitpunkt und Grund.');
  }
  if (this.status === 'LOCKED' && (!this.lockedBy || !this.lockedAt || !this.payrollRun)) {
    this.invalidate('status', 'Gesperrte Zeiten benötigen Sperrvermerk und PayrollRun.');
  }
  next();
});

WorkingTimeLedgerSchema.index(
  { entryKey: 1, version: 1 },
  { unique: true, name: 'working_time_ledger_key_version_unique' },
);
WorkingTimeLedgerSchema.index(
  { entryKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'working_time_ledger_one_current',
  },
);
WorkingTimeLedgerSchema.index({ mitarbeiter: 1, workDate: 1, status: 1 });
WorkingTimeLedgerSchema.index({ assignmentLedger: 1, workDate: 1 });
WorkingTimeLedgerSchema.index({ payrollRun: 1, mitarbeiter: 1 });
WorkingTimeLedgerSchema.index({ source: 1, sourceRef: 1, version: 1 });
WorkingTimeLedgerSchema.index(
  { mitarbeiter: 1, status: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'OPEN', isCurrent: true },
    name: 'working_time_one_open_timer_per_employee',
  },
);

module.exports = mongoose.model('ArbeitszeitBuch', WorkingTimeLedgerSchema);
