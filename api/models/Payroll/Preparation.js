const mongoose = require('mongoose');
const { Schema } = mongoose;
const options = { timestamps: true, strict: 'throw' };
// These payloads are constructed by the service from allowlisted fields only.
// No provider account balance belongs in any of these collections.
const monthSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'Mitarbeiter', required: true },
  month: { type: String, required: true },
  revision: { type: Number, required: true },
  state: { type: String, enum: ['DRAFT', 'REVIEWED'], default: 'DRAFT' },
  items: { type: [Schema.Types.Mixed], default: [] },
  sourceHash: { type: String, required: true },
  sources: { type: [Schema.Types.Mixed], default: [] },
  inherited: { type: [Schema.Types.Mixed], default: [] },
  history: { type: [Schema.Types.Mixed], default: [] },
}, options);
monthSchema.index({ employee: 1, month: 1 }, { unique: true });

const snapshotSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, required: true, immutable: true },
  month: { type: String, required: true, immutable: true },
  revision: { type: Number, required: true, immutable: true },
  payload: { type: Schema.Types.Mixed, required: true, immutable: true },
  contentHash: { type: String, required: true, immutable: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  reviewedAt: { type: Date, required: true, immutable: true },
}, options);
snapshotSchema.index({ employee: 1, month: 1, revision: 1 }, { unique: true });

const mappingSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, required: true, immutable: true },
  version: { type: Number, required: true, immutable: true },
  config: { type: Schema.Types.Mixed, required: true, immutable: true },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
}, options);
mappingSchema.index({ employee: 1, version: 1 }, { unique: true });
for (const schema of [snapshotSchema, mappingSchema]) {
  schema.pre('save', function () { if (!this.isNew) throw new Error('Immutable payroll record'); });
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
    schema.pre(operation, function () { throw new Error('Immutable payroll record'); });
  }
}
module.exports = {
  Guard: mongoose.model('PayrollPreparationGuard', new Schema({ _id: Schema.Types.ObjectId, revision: Number }, { strict: 'throw' })),
  Preparation: mongoose.model('PayrollPreparation', monthSchema),
  Snapshot: mongoose.model('PayrollSnapshot', snapshotSchema),
  Mapping: mongoose.model('PayrollMapping', mappingSchema),
};
