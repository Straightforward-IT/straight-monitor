const mongoose = require('mongoose');

const PROFILE_STATUSES = ['DRAFT', 'APPROVED', 'RETIRED'];

const EmployeePayloadSchema = new mongoose.Schema({
  formOfAddress: { type: String, trim: true, default: null, immutable: true },
  firstName: { type: String, required: true, trim: true, immutable: true },
  surname: { type: String, required: true, trim: true, immutable: true },
  title: { type: String, trim: true, default: null, immutable: true },
  surnamePrefix: { type: String, trim: true, default: null, immutable: true },
  surnameSuffix: { type: String, trim: true, default: null, immutable: true },
  birthSurname: { type: String, trim: true, default: null, immutable: true },
  birthSurnamePrefix: { type: String, trim: true, default: null, immutable: true },
  birthSurnameSuffix: { type: String, trim: true, default: null, immutable: true },
  // Paychex requires the key but permits null. The explicit null is retained in
  // the canonical payload instead of inventing a date.
  birthDate: { type: Date, default: null, immutable: true },
  birthCountry: { type: String, required: true, trim: true, immutable: true },
  birthCity: { type: String, trim: true, default: null, immutable: true },
  gender: { type: String, required: true, trim: true, immutable: true },
  nationality: { type: String, required: true, trim: true, immutable: true },
  graduation: { type: String, required: true, trim: true, immutable: true },
  professionalQualification: { type: String, required: true, trim: true, immutable: true },
}, { _id: false, minimize: false });

const ContractPayloadSchema = new mongoose.Schema({
  jobDescription: { type: String, trim: true, default: null, immutable: true },
  personalNumber: { type: String, required: true, trim: true, immutable: true },
  startDate: { type: Date, required: true, immutable: true },
  endDate: { type: Date, default: null, immutable: true },
  reasonForLeaving: { type: String, trim: true, default: null, immutable: true },
  terminationDate: { type: Date, default: null, immutable: true },
  employingCompany: { type: String, required: true, trim: true, immutable: true },
  employedEastOrWest: { type: String, required: true, trim: true, immutable: true },
  performedOccupation: { type: String, trim: true, default: null, immutable: true },
  employmentType: { type: String, required: true, trim: true, immutable: true },
  limitedEmployment: { type: String, required: true, trim: true, immutable: true },
  paymentReductionType: { type: String, required: true, trim: true, immutable: true },
}, { _id: false, minimize: false });

const PayrollProviderProfileSchema = new mongoose.Schema({
  profileKey: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  version: { type: Number, required: true, min: 1, validate: Number.isInteger, default: 1, immutable: true },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollProviderProfile', default: null, immutable: true },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', required: true, immutable: true },
  employment: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployment', required: true, immutable: true },
  personalNrSnapshot: { type: String, required: true, trim: true, immutable: true },
  paychexEmployeeUid: { type: String, required: true, trim: true, immutable: true },
  validFrom: { type: Date, required: true, immutable: true },
  validTill: { type: Date, default: null, immutable: true },
  provider: { type: String, required: true, enum: ['paychex'], default: 'paychex', immutable: true },
  apiVersion: { type: String, required: true, enum: ['v1.3'], default: 'v1.3', immutable: true },
  employeePayload: { type: EmployeePayloadSchema, required: true, immutable: true },
  contractPayload: { type: ContractPayloadSchema, required: true, immutable: true },
  providerOwnedStatutoryData: {
    status: {
      type: String,
      required: true,
      enum: ['UNKNOWN', 'INCOMPLETE', 'COMPLETE_IN_PAYCHEX'],
      default: 'UNKNOWN',
      immutable: true,
    },
    includesTaxData: { type: Boolean, required: true, default: false, immutable: true },
    includesSocialInsuranceData: { type: Boolean, required: true, default: false, immutable: true },
    includesBankData: { type: Boolean, required: true, default: false, immutable: true },
    includesHealthInsuranceData: { type: Boolean, required: true, default: false, immutable: true },
    verifiedInPaychexAt: { type: Date, default: null, immutable: true },
    paychexEvidenceReference: { type: String, trim: true, default: null, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    evidenceHash: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      default: null,
      immutable: true,
    },
  },
  providerReferenceDataHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  contentHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  changeReason: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
  evidenceRefs: [{ type: String, trim: true, immutable: true }],
  evidenceHash: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-f0-9]{64}$/,
    immutable: true,
  },
  status: { type: String, required: true, enum: PROFILE_STATUSES, default: 'DRAFT' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false });

PayrollProviderProfileSchema.pre('validate', function validateProviderProfile(next) {
  if (this.validTill && this.validTill < this.validFrom) {
    this.invalidate('validTill', 'validTill darf nicht vor validFrom liegen.');
  }
  if (this.contractPayload?.endDate && this.contractPayload.endDate < this.contractPayload.startDate) {
    this.invalidate('contractPayload.endDate', 'Das Vertragsende darf nicht vor dem Vertragsbeginn liegen.');
  }
  if (this.contractPayload?.terminationDate && !this.contractPayload?.reasonForLeaving) {
    this.invalidate('contractPayload.reasonForLeaving', 'Ein Kündigungsdatum benötigt einen Austrittsgrund.');
  }
  if (this.status === 'APPROVED') {
    const statutory = this.providerOwnedStatutoryData || {};
    if (!this.approvedBy || !this.approvedAt || String(this.createdBy || '') === String(this.approvedBy || '')) {
      this.invalidate('approvedBy', 'Provider-Profil-Erfassung und -Freigabe müssen im Vier-Augen-Prinzip erfolgen.');
    }
    if (!this.evidenceRefs?.length || statutory.status !== 'COMPLETE_IN_PAYCHEX'
        || !statutory.includesTaxData || !statutory.includesSocialInsuranceData
        || !statutory.includesBankData || !statutory.includesHealthInsuranceData
        || !statutory.verifiedInPaychexAt || !statutory.paychexEvidenceReference
        || !statutory.evidenceRefs?.length || !statutory.evidenceHash) {
      this.invalidate('providerOwnedStatutoryData', 'Freigabe benötigt den nachgewiesenen vollständigen Steuer-, SV-, Krankenversicherungs- und Bankdatenbestand in Paychex.');
    }
  }
  if (this.status === 'RETIRED' && this.isCurrent) {
    this.invalidate('isCurrent', 'Ein stillgelegtes Provider-Profil darf nicht current sein.');
  }
  next();
});

PayrollProviderProfileSchema.index(
  { profileKey: 1, version: 1 },
  { unique: true, name: 'payroll_provider_profile_key_version_unique' },
);
PayrollProviderProfileSchema.index(
  { employment: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'payroll_provider_profile_one_current_per_employment',
  },
);
PayrollProviderProfileSchema.index({ mitarbeiter: 1, validFrom: 1, validTill: 1, status: 1 });
PayrollProviderProfileSchema.index({ paychexEmployeeUid: 1, isCurrent: 1 });

module.exports = mongoose.model('PayrollProviderProfile', PayrollProviderProfileSchema);
module.exports.PROFILE_STATUSES = PROFILE_STATUSES;
