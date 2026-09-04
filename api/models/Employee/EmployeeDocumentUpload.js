const mongoose = require('mongoose');

const EmployeeDocumentUploadSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeDocumentRequest', required: true, index: true },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', required: true, index: true },
  originalFileName: { type: String, required: true, trim: true },
  contentType: { type: String, required: true, trim: true },
  byteLength: { type: Number, required: true, min: 1 },
  contentHash: { type: String, required: true, trim: true, lowercase: true },
  r2Key: { type: String, required: true, trim: true, unique: true, immutable: true },
  uploadedAt: { type: Date, default: Date.now, immutable: true },
}, { timestamps: true });

EmployeeDocumentUploadSchema.index({ mitarbeiter: 1, request: 1, uploadedAt: -1 });

module.exports = mongoose.model('EmployeeDocumentUpload', EmployeeDocumentUploadSchema);