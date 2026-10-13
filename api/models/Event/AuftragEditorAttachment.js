const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'AuftragEditorSubmission', required: true },
  clientUploadId: { type: String, required: true, maxlength: 200 },
  relationTarget: { type: String, enum: ['group', 'order'], required: true },
  day: { type: String, required: true },
  filename: { type: String, required: true },
  size: { type: Number, required: true, min: 0, max: 30 * 1024 * 1024 },
  ready: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ submission: 1, clientUploadId: 1, relationTarget: 1, day: 1 }, { unique: true });
module.exports = mongoose.model('AuftragEditorAttachment', schema);
