const mongoose = require('mongoose');
const { EMPLOYEE_DOCUMENT_TYPES } = require('../../config/employeeDocumentTypes');

const EmployeeDocumentRequestSchema = new mongoose.Schema({
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', required: true, index: true },
  type: { type: String, enum: Object.keys(EMPLOYEE_DOCUMENT_TYPES), required: true, index: true },
  status: {
    type: String,
    enum: ['REQUESTED', 'UPLOADED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
    default: 'REQUESTED',
    index: true,
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueAt: { type: Date, default: null },
  validUntil: { type: Date, default: null },
  reviewNote: { type: String, default: '', trim: true, maxlength: 2000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  flipTaskId: { type: String, default: '', trim: true },
  source: { type: String, enum: ['MANUAL', 'DEFAULT_RULE'], default: 'MANUAL', immutable: true, index: true },
  ruleKey: { type: String, default: '', trim: true, immutable: true, index: true },
  currentUpload: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeDocumentUpload', default: null },
}, { timestamps: true });

EmployeeDocumentRequestSchema.index({ mitarbeiter: 1, status: 1, dueAt: 1 });

module.exports = mongoose.model('EmployeeDocumentRequest', EmployeeDocumentRequestSchema);