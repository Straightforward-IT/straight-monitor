const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'AuftragEditorSubmission', required: true },
  ordinal: { type: Number, required: true },
  day: { type: String, required: true },
  auftragNr: { type: Number },
  status: { type: String, enum: ['pending', 'failed', 'completed'], default: 'pending' },
  active: { type: Boolean, default: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  error: { type: mongoose.Schema.Types.Mixed, default: null },
  scheduleRelevant: { type: Boolean, default: false },
  windowStart: { type: Date },
  windowEnd: { type: Date },
}, { timestamps: true, minimize: false });
schema.index({ submission: 1, day: 1 }, { unique: true });
schema.index({ submission: 1, status: 1, ordinal: 1 });
schema.index({ auftragNr: 1, status: 1 });
schema.index({ auftragNr: 1, active: 1 }, {
  unique: true, partialFilterExpression: { auftragNr: { $type: 'number' }, active: true },
});
schema.index({ submission: 1, scheduleRelevant: 1, windowStart: 1, windowEnd: 1 });
module.exports = mongoose.model('AuftragEditorDay', schema);
