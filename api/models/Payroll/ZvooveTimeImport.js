const mongoose = require('mongoose');
const { PROFILES } = require('../../domain/payroll/zvooveTimeImport');
const { Schema } = mongoose;
const options = { timestamps: true, strict: 'throw' };
const source = new Schema({ filename: String, sheet: String, row: Number }, { _id: false });
const fields = columns => new Schema(Object.fromEntries(columns.map(column => [column, { type: String, default: null }])), { _id: false, strict: 'throw' });
const row = new Schema({
  role: { type: String, enum: Object.keys(PROFILES), required: true }, year: Number,
  sourceKey: { type: String, required: true, index: true }, contentHash: { type: String, required: true, unique: true },
  date: String, personalNr: String, shiftId: String, shiftDatabase: String,
  vortrag: { type: fields(PROFILES.STUNDENVORTRAG), default: null },
  stunduhr: { type: fields(PROFILES.STUNDUHR), default: null },
  raw: { type: Schema.Types.Mixed, required: true }, source,
  originalHeaders: [String], cells: [Schema.Types.Mixed], date1904: Boolean,
}, options);
row.pre('save', function () { if (!this.isNew) throw new Error('Importierte Originalzeile ist unveränderlich.'); });
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany']) row.pre(op, function () { throw new Error('Importierte Originalzeile ist unveränderlich.'); });
const current = require('../Stundenzeit').schema.path('current').schema;
const mapping = new Schema({
  rowId: Schema.Types.ObjectId, assignmentId: Schema.Types.ObjectId, employeeId: Schema.Types.ObjectId,
  personalNr: Number, auftragNr: Number, schicht: { type: Schema.Types.ObjectId, default: null },
  transferred: Boolean, sourceKey: String, sourceHash: String, current, released: { type: current, default: null },
}, { _id: false });
const counts = new Schema({ vortraege: Number, stunduhr: Number, workRows: Number, pauseRows: Number, bookings: Number, unlocatedBreaks: Number, unresolved: Number, orphanRows: Number, editableProjections: Number }, { _id: false });
const imports = new Schema({
  year: { type: Number, required: true }, status: { type: String, enum: ['BUILDING', 'PREVIEW', 'ACTIVE', 'INVALID'], required: true },
  snapshotId: { type: Schema.Types.ObjectId, default: null }, baseRevision: Number,
  files: [{ _id: false, role: String, filename: String, sheet: String, rows: Number, headers: [String] }],
  counts, productiveHours: String, pauseHours: String,
  issues: [{ _id: false, code: String, message: String }],
  createdBy: { type: Schema.Types.ObjectId, required: true }, activatedBy: Schema.Types.ObjectId, activatedAt: Date,
  projectionResult: new Schema({ created: Number, updated: Number, unchanged: Number, protected: Number }, { _id: false }),
}, options);
const projection = new Schema({ importId: { type: Schema.Types.ObjectId, required: true, index: true }, mapping: { type: mapping, required: true } }, options);
module.exports = { Row: mongoose.model('ZvooveTimeSourceRow', row), Import: mongoose.model('ZvooveTimeYearImport', imports), Projection: mongoose.model('ZvooveTimeProjection', projection) };
