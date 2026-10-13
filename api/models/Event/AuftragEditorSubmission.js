const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientSubmissionId: { type: String, required: true, maxlength: 200 },
  requestHash: { type: String, required: true },
  mode: { type: String, enum: ['create', 'edit'], required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Auftragsgruppe', default: null },
  groupRevision: { type: Number },
  status: { type: String, enum: ['pending', 'processing', 'incomplete', 'completed'], default: 'pending' },
  total: { type: Number, required: true },
  completed: { type: Number, default: 0 },
  attachmentsPending: { type: Number, default: 0 },
  ready: { type: Boolean, default: true },
  leaseToken: { type: String, default: null },
  leaseUntil: { type: Date, default: null },
}, { timestamps: true });
schema.index({ createdBy: 1, clientSubmissionId: 1 }, { unique: true });
module.exports = mongoose.model('AuftragEditorSubmission', schema);
