const mongoose = require('mongoose');
const { Schema } = mongoose;
const options = { timestamps: true, strict: 'throw', minimize: false };
const child = fields => new Schema(fields, { _id: false, strict: 'throw' });
const issue = child({ code: String, message: String, source: String });
const source = child({ role: String, filename: String, sheet: String, row: Number, recordId: { type: String, default: null } });
const interval = child({ start: Date, end: Date, paid: { type: Boolean, default: null } });
const booking = new Schema({
  snapshotId: { type: Schema.Types.ObjectId, required: true, index: true }, ordinal: { type: Number, required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null }, personalNr: String,
  auftragNr: Number, einsortNr: String, shiftId: String, assignmentNumber: String, guaranteedMinutes: Number,
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Einsatz', default: null },
  date: String, start: { type: Date, default: null }, end: { type: Date, default: null }, timeZone: String,
  reportedHours: { type: String, default: null }, reportedBreak: { type: String, default: null },
  reportedPaidBreak: { type: String, default: null }, breakMinutes: { type: Number, default: null },
  paidBreakMinutes: { type: Number, default: null }, productiveMinutes: { type: Number, default: null },
  breaks: [interval], sources: [source], issues: [issue],
}, options);
booking.index({ snapshotId: 1, ordinal: 1 }, { unique: true });
booking.index({ employeeId: 1, date: 1 });
const rule = new Schema({
  snapshotId: { type: Schema.Types.ObjectId, required: true, index: true }, ordinal: Number,
  auftragNr: Number, personalNr: { type: String, default: null }, assignmentNumber: String, einsortNr: String,
  serviceNumber: String, side: String, wageType: String,
  fromDate: { type: String, default: null }, untilDate: { type: String, default: null },
  windowStart: { type: Number, default: null }, windowEnd: { type: Number, default: null },
  weekdays: [Number], holiday: { type: Boolean, default: null },
  rate: { type: String, default: null }, percent: { type: String, default: null }, priceNumber: String,
  priority: String, followingWageType: String, automatic: { type: Boolean, default: null },
  hourLimit: String, afterHourLimit: String, hourLimitType: String, intervalCode: String,
  ignoreBreak: String, paidBreak: String, deductPaidBreak: String, calculationSelection: String, wageKind: String,
  source: source, issues: [issue],
}, options);
const reference = child({
  kind: { type: String, enum: ['LOHNPOSITIONEN', 'LOHNARTENSUMMEN', 'FAKTURPOSITIONEN', 'RECHNUNGEN'] },
  side: String, personalNr: { type: String, default: null }, auftragNr: { type: Number, default: null },
  date: { type: String, default: null }, month: { type: String, default: null },
  wageType: { type: String, default: null }, unit: { type: String, default: null },
  quantity: { type: String, default: null }, rate: { type: String, default: null },
  amount: { type: String, default: null }, percent: { type: String, default: null }, invoiceNumber: { type: String, default: null }, source: source,
});
const row = child({ role: String, source: source, date1904: Boolean, originalHeaders: [String], cells: [Schema.Types.Mixed], raw: { type: Schema.Types.Mixed, required: true } });
const snapshot = new Schema({
  kind: { type: String, enum: ['INPUT', 'REFERENCE'], required: true }, scope: { type: String, required: true },
  auftragNr: { type: Number, default: null }, contentHash: { type: String, required: true },
  rows: [row], references: [reference], issues: [issue], pauseUnit: { type: String, enum: ['HOURS', 'MINUTES', null], default: null },
  ruleTimeUnit: { type: String, enum: ['CLOCK', 'DECIMAL_HOURS'], default: 'CLOCK' },
}, options);
snapshot.index({ kind: 1, scope: 1, contentHash: 1 }, { unique: true });
const imports = new Schema({
  kind: { type: String, enum: ['INPUT', 'REFERENCE'], required: true }, scope: String,
  snapshotId: { type: Schema.Types.ObjectId, default: null },
  baseRevision: Number, status: { type: String, enum: ['PREVIEW', 'INVALID', 'ACTIVE'], required: true },
  issues: [issue], rows: [row], counts: child({ bookings: Number, rules: Number, references: Number }),
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  activatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, activatedAt: Date,
}, options);
const state = new Schema({
  _id: String, revision: { type: Number, default: 0 }, snapshotId: { type: Schema.Types.ObjectId, default: null },
  importId: { type: Schema.Types.ObjectId, default: null },
}, options);
const segment = child({ start: Date, end: Date, date: String, minutes: Number, kind: String });
const position = child({
  personalNr: String, employeeId: { type: Schema.Types.ObjectId, default: null }, auftragNr: Number,
  date: String, month: String, wageType: String, unit: String, minutes: Number,
  quantityNumerator: String, quantityDenominator: String, rate: String, percent: { type: String, default: null },
  amount: { type: String, default: null }, exactNumerator: String, exactDenominator: String,
  bookingIds: [String], ruleIds: [String], segments: [segment], rateSource: String,
});
const policies = child({
  rounding: { type: String, enum: ['HALF_UP_PER_POSITION', null], default: null },
  dayBasis: { type: String, enum: ['SEGMENT_DATE', 'SHIFT_DATE', null], default: null },
  supplementBasis: { type: String, enum: ['RULE_PRICE', 'BASE_RATE', null], default: null },
  overlap: { type: String, enum: ['STACK', 'HIGHEST_ONLY', null], default: null },
  precedence: { type: String, enum: ['EMPLOYEE_OVER_ORDER', null], default: null },
  holidayDates: { type: [String], default: null },
});
const run = new Schema({
  inputSnapshotIds: [{ type: Schema.Types.ObjectId, required: true }],
  side: { type: String, enum: ['L', 'F'], required: true }, selection: child({ month: String, employeeId: String, auftragNr: Number }),
  contentHash: { type: String, required: true, unique: true }, calculationVersion: String,
  status: { type: String, enum: ['PREVIEW', 'INCOMPLETE'], required: true }, policies: policies,
  // Only raw/pinned external context may be Mixed; operational results are typed.
  inputs: { type: Schema.Types.Mixed, required: true },
  lohnpositionen: [position], fakturpositionen: [position], issues: [issue],
  monthlySummaries: [child({ personalNr: String, month: String, wageType: String, unit: String, minutes: Number, amount: { type: String, default: null } })],
  invoiceDrafts: [child({ auftragNr: Number, month: String, netAmount: { type: String, default: null } })],
  totals: child({ amount: { type: String, default: null }, productiveMinutes: Number }),
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, options);
const difference = child({ key: String, code: String, actual: { type: String, default: null }, expected: { type: String, default: null }, delta: { type: String, default: null } });
const comparison = new Schema({
  runId: { type: Schema.Types.ObjectId, required: true }, referenceSnapshotId: { type: Schema.Types.ObjectId, required: true },
  contentHash: { type: String, required: true, unique: true }, referenceKind: String, granularity: String,
  status: { type: String, enum: ['MATCH', 'DIFFERENT', 'INCOMPLETE'] }, differences: [difference],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, options);
function immutable(schema) {
  schema.pre('save', function () { if (!this.isNew) throw new Error('Abrechnungsdaten sind unveränderlich.'); });
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
    schema.pre(operation, function () { throw new Error('Abrechnungsdaten sind unveränderlich.'); });
  }
}
for (const schema of [booking, rule, snapshot, run, comparison]) immutable(schema);
module.exports = {
  Booking: mongoose.model('Zeitbuchung', booking), Rule: mongoose.model('AbrechnungsregelVersion', rule),
  Snapshot: mongoose.model('AbrechnungDatenstand', snapshot), Import: mongoose.model('ZvooveDetailImport', imports),
  State: mongoose.model('AbrechnungImportState', state), Run: mongoose.model('Ausweisung', run),
  Comparison: mongoose.model('AbrechnungVergleich', comparison),
};
