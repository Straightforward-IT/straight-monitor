const mongoose = require('mongoose');
const { Schema } = mongoose;
const options = { timestamps: true, strict: 'throw' };
const sourceSchema = new Schema({ filename: String, sheet: String, row: Number }, { _id: false });
const referenceSchema = new Schema({ key: { type: String, required: true }, versionId: { type: Schema.Types.ObjectId, ref: 'ZvooveHoursWeek', required: true }, source: sourceSchema }, { _id: false });
const weekSchema = new Schema({
  contentHash: { type: String, required: true, unique: true }, key: { type: String, required: true }, month: { type: String, required: true },
  personalNr: { type: String, required: true }, week: Number, kw: Number,
  employeeId: { type: Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null }, matchStatus: String,
  raw: { type: Schema.Types.Mixed, required: true }, days: { type: [Schema.Types.Mixed], default: [] },
}, options);
weekSchema.index({ employeeId: 1, month: 1 });
const snapshotSchema = new Schema({ month: { type: String, required: true }, contentHash: { type: String, required: true }, rows: { type: [referenceSchema], default: [] } }, options);
snapshotSchema.index({ month: 1, contentHash: 1 }, { unique: true });
const importSchema = new Schema({
  filename: String, month: String, status: { type: String, enum: ['PREVIEW', 'INVALID', 'ACTIVE'], required: true },
  baseRevision: { type: Number, default: 0 }, valid: Boolean, counts: Schema.Types.Mixed, changes: Schema.Types.Mixed, issues: { type: [Schema.Types.Mixed], default: [] },
  // Every import retains its original provenance, even when versions are reused.
  rows: { type: [Schema.Types.Mixed], default: [] }, snapshotId: { type: Schema.Types.ObjectId, ref: 'ZvooveHoursSnapshot', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, activatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, activatedAt: Date,
  revision: Number,
}, options);
const stateSchema = new Schema({ _id: String, revision: { type: Number, default: 0 }, snapshotId: { type: Schema.Types.ObjectId, ref: 'ZvooveHoursSnapshot', default: null }, importId: { type: Schema.Types.ObjectId, ref: 'ZvooveHoursImport', default: null } }, options);
for (const schema of [weekSchema, snapshotSchema]) {
  schema.pre('save', function () { if (!this.isNew) throw new Error('Immutable Zvoove hours record'); });
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) schema.pre(operation, function () { throw new Error('Immutable Zvoove hours record'); });
}
module.exports = {
  Week: mongoose.model('ZvooveHoursWeek', weekSchema), Snapshot: mongoose.model('ZvooveHoursSnapshot', snapshotSchema),
  Import: mongoose.model('ZvooveHoursImport', importSchema), State: mongoose.model('ZvooveHoursState', stateSchema),
};
