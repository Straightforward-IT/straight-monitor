const mongoose = require('mongoose');

const normalizedType = (value) => String(value || '').trim().normalize('NFKC').toLowerCase();

const PayslipValidationSchema = new mongoose.Schema({
  categoryField: { type: String, required: true, enum: ['category'], immutable: true },
  approvedDocumentType: { type: String, required: true, trim: true, immutable: true },
  documentTypeConfigHash: { type: String, required: true, trim: true, immutable: true },
  typeMatched: { type: Boolean, required: true, immutable: true },
  periodMatched: { type: Boolean, required: true, immutable: true },
  employeeMatched: { type: Boolean, required: true, immutable: true },
  validatedAt: { type: Date, required: true, immutable: true },
}, { _id: false });

const PayrollDocumentSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['paychex'], immutable: true },
  companyKey: { type: String, required: true, trim: true, lowercase: true, immutable: true },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true, immutable: true },
  payrollEmployeeSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployeeSnapshot', default: null, immutable: true },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null, immutable: true },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, immutable: true },
  employeeUid: { type: String, trim: true, default: null, immutable: true },
  remoteDocumentId: { type: String, required: true, trim: true, immutable: true },
  revision: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollDocument', default: null, immutable: true },
  documentType: { type: String, trim: true, default: null, immutable: true },
  documentPurpose: { type: String, enum: ['PAYSLIP', 'OTHER', 'UNKNOWN'], default: 'UNKNOWN', immutable: true },
  providerDocumentDate: { type: String, trim: true, default: null, immutable: true },
  payslipValidation: { type: PayslipValidationSchema, default: null, immutable: true },
  fileName: { type: String, required: true, trim: true, immutable: true },
  contentType: { type: String, required: true, trim: true, immutable: true },
  byteLength: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
  contentHash: { type: String, required: true, trim: true, immutable: true },
  providerMetadataHash: { type: String, required: true, trim: true, immutable: true },
  r2Key: { type: String, required: true, trim: true, immutable: true },
  importedAt: { type: Date, required: true, default: Date.now, immutable: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  status: { type: String, required: true, enum: ['IMPORTED', 'SUPERSEDED', 'UNLINKED'], immutable: false },
}, { timestamps: true });

PayrollDocumentSchema.pre('validate', function validateDocument(next) {
  if (this.status === 'IMPORTED' && (!this.mitarbeiter || !this.payrollEmployeeSnapshot || !this.employeeUid)) {
    this.invalidate('status', 'Importierte Payroll-Dokumente müssen einem Mitarbeiter-Snapshot zugeordnet sein.');
  }
  if (this.status === 'IMPORTED'
      && (this.documentPurpose !== 'PAYSLIP'
        || !this.documentType
        || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(this.providerDocumentDate || '')
        || !this.payslipValidation?.typeMatched
        || !this.payslipValidation?.periodMatched
        || !this.payslipValidation?.employeeMatched
        || !this.payslipValidation?.documentTypeConfigHash
        || normalizedType(this.payslipValidation?.approvedDocumentType) !== normalizedType(this.documentType))) {
    this.invalidate('payslipValidation', 'Importierte Payroll-Dokumente müssen als typ-, perioden- und mitarbeitergeprüfte Payslips belegt sein.');
  }
  if (this.status === 'SUPERSEDED' && this.isCurrent) {
    this.invalidate('isCurrent', 'Ein ersetztes Dokument darf nicht aktuell sein.');
  }
  next();
});

PayrollDocumentSchema.index(
  { provider: 1, companyKey: 1, remoteDocumentId: 1, revision: 1 },
  { unique: true, name: 'payroll_document_remote_revision_unique' },
);
PayrollDocumentSchema.index(
  { provider: 1, companyKey: 1, remoteDocumentId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true }, name: 'payroll_document_one_current' },
);
PayrollDocumentSchema.index({ payrollRun: 1, mitarbeiter: 1, status: 1 });
PayrollDocumentSchema.index({
  payrollRun: 1,
  month: 1,
  documentPurpose: 1,
  'payslipValidation.documentTypeConfigHash': 1,
  mitarbeiter: 1,
  status: 1,
});
PayrollDocumentSchema.index({ contentHash: 1 });

module.exports = mongoose.model('PayrollDocument', PayrollDocumentSchema);
