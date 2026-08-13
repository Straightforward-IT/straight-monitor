const mongoose = require('mongoose');

const DECIMAL_NON_NEGATIVE = {
  validator(value) {
    if (value == null) return true;
    const number = Number(value.toString());
    return Number.isFinite(number) && number >= 0;
  },
  message: '{PATH} muss eine nicht-negative Dezimalzahl sein.',
};

const integerOrNull = (value) => value == null || Number.isInteger(value);

const AssignmentLedgerSchema = new mongoose.Schema({
  assignmentKey: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  version: { type: Number, required: true, min: 1, default: 1, immutable: true },
  isCurrent: { type: Boolean, required: true, default: true },
  supersedes: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssignmentLedger',
    default: null,
    immutable: true,
  },

  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    immutable: true,
  },
  kunde: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kunde',
    required: true,
    immutable: true,
  },
  auftrag: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auftrag',
    required: true,
    immutable: true,
  },
  einsatz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Einsatz',
    default: null,
    immutable: true,
  },
  customerPayrollRule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerPayrollRule',
    required: true,
    immutable: true,
  },
  siteKey: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    immutable: true,
  },

  personalNrSnapshot: { type: String, required: true, trim: true, immutable: true },
  kundenNrSnapshot: { type: Number, required: true, immutable: true },
  auftragNrSnapshot: { type: Number, required: true, immutable: true },
  activityCode: { type: String, trim: true, default: null, immutable: true },
  activityLabel: { type: String, trim: true, default: null, immutable: true },
  activityProfile: {
    actualDuties: [{ type: String, trim: true, immutable: true }],
    responsibilityLevel: { type: String, trim: true, default: null, immutable: true },
    requiredQualifications: [{ type: String, trim: true, immutable: true }],
  },
  employeeTariffDecision: {
    declaredActivity: { type: String, required: true, trim: true, immutable: true },
    entgeltgruppe: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    decisionReason: { type: String, required: true, trim: true, maxlength: 4000, immutable: true },
    sourceClause: { type: String, trim: true, default: null, immutable: true },
    tariffVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'TariffVersion', default: null, immutable: true },
    tariffVersionRef: { type: String, trim: true, default: null, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    declaredBy: { type: String, required: true, trim: true, immutable: true },
    declaredAt: { type: Date, required: true, immutable: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    signatureHash: { type: String, required: true, trim: true, immutable: true },
    evidenceHash: { type: String, required: true, trim: true, immutable: true },
  },
  professionCode: { type: String, trim: true, default: null, immutable: true },
  qualificationCode: { type: String, trim: true, default: null, immutable: true },
  workLocation: {
    name: { type: String, trim: true, default: null, immutable: true },
    postalCode: { type: String, trim: true, default: null, immutable: true },
    city: { type: String, trim: true, default: null, immutable: true },
    federalState: {
      type: String,
      enum: ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'],
      default: null,
      immutable: true,
    },
    timeZone: { type: String, trim: true, default: 'Europe/Berlin', immutable: true },
  },

  assignmentFrom: { type: Date, required: true, immutable: true },
  assignmentTill: { type: Date, default: null, immutable: true },
  plannedStart: { type: Date, default: null, immutable: true },
  plannedEnd: { type: Date, default: null, immutable: true },
  plannedBreakHours: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: DECIMAL_NON_NEGATIVE,
    immutable: true,
  },
  guaranteedHours: {
    type: mongoose.Schema.Types.Decimal128,
    default: null,
    validate: DECIMAL_NON_NEGATIVE,
    immutable: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'VOIDED'],
    default: 'DRAFT',
  },
  payrollEligible: { type: Boolean, required: true, default: true, immutable: true },

  continuityKey: { type: String, required: true, trim: true, immutable: true },
  continuityEvidence: {
    sameCustomerDefinition: { type: String, trim: true, maxlength: 1000, default: null, immutable: true },
    historyCompleteness: {
      type: String,
      required: true,
      enum: ['UNKNOWN', 'EMPLOYEE_DECLARED_COMPLETE', 'PROVIDER_VERIFIED_COMPLETE'],
      default: 'UNKNOWN',
      immutable: true,
    },
    priorAssignments: [{
      priorAssignmentId: { type: String, required: true, trim: true, immutable: true },
      staffingProviderName: { type: String, required: true, trim: true, immutable: true },
      staffingProviderIdentifier: { type: String, trim: true, default: null, immutable: true },
      customerName: { type: String, required: true, trim: true, immutable: true },
      customerIdentifier: { type: String, required: true, trim: true, immutable: true },
      from: { type: Date, required: true, immutable: true },
      till: { type: Date, required: true, immutable: true },
      interruptionAfterDays: { type: Number, min: 0, validate: integerOrNull, default: null, immutable: true },
      evidenceRefs: [{ type: String, trim: true, immutable: true }],
      evidenceHash: { type: String, required: true, trim: true, immutable: true },
    }],
    exactInterruptionPeriods: [{
      interruptionId: { type: String, required: true, trim: true, immutable: true },
      afterAssignmentId: { type: String, required: true, trim: true, immutable: true },
      beforeAssignmentId: { type: String, required: true, trim: true, immutable: true },
      from: { type: Date, required: true, immutable: true },
      till: { type: Date, required: true, immutable: true },
      calendarDays: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      reason: {
        type: String,
        required: true,
        enum: ['CUSTOMER_BREAK', 'EMPLOYMENT_BREAK', 'SICKNESS', 'VACATION', 'OTHER'],
        immutable: true,
      },
      resetsEqualPayTenure: { type: Boolean, required: true, immutable: true },
      resetsIndustryTenure: { type: Boolean, required: true, immutable: true },
      evidenceRefs: [{ type: String, trim: true, immutable: true }],
    }],
    declarationSource: { type: String, required: true, trim: true, immutable: true },
    declaredBy: { type: String, required: true, trim: true, immutable: true },
    declaredAt: { type: Date, required: true, immutable: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    signatureHash: { type: String, required: true, trim: true, immutable: true },
    evidenceHash: { type: String, required: true, trim: true, immutable: true },
    continuityAssessment: {
      policyVersion: { type: String, trim: true, default: null, immutable: true },
      asOfDate: { type: Date, default: null, immutable: true },
      countsTowardEqualPay: { type: Boolean, default: null, immutable: true },
      countsTowardIndustryTenure: { type: Boolean, default: null, immutable: true },
      equalPayContinuityStart: { type: Date, default: null, immutable: true },
      equalPayThresholdDate: { type: Date, default: null, immutable: true },
      assessmentEvidenceRefs: [{ type: String, trim: true, immutable: true }],
      assessmentHash: { type: String, trim: true, default: null, immutable: true },
    },
  },
  countsTowardIndustryTenure: { type: Boolean, required: true, default: true, immutable: true },
  countsTowardEqualPay: { type: Boolean, required: true, default: true, immutable: true },
  interruption: {
    type: {
      type: String,
      enum: ['none', 'customer_break', 'employment_break', 'sickness', 'vacation', 'other'],
      default: 'none',
      immutable: true,
    },
    from: { type: Date, default: null, immutable: true },
    till: { type: Date, default: null, immutable: true },
    resetsIndustryTenure: { type: Boolean, default: false, immutable: true },
    resetsEqualPayTenure: { type: Boolean, default: false, immutable: true },
    reason: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  },

  statutoryPriorRelationshipChecks: {
    formerCustomerEmployeeWithinSixMonths: {
      type: String,
      enum: ['NO', 'YES', 'UNKNOWN'],
      default: 'UNKNOWN',
      immutable: true,
    },
    otherProviderWithinThreeMonthsAndOneDay: {
      type: String,
      enum: ['NO', 'YES', 'UNKNOWN'],
      default: 'UNKNOWN',
      immutable: true,
    },
    checkedAt: { type: Date, default: null, immutable: true },
    checkedByEvidenceParty: { type: String, trim: true, default: null, immutable: true },
    evidenceRefs: [{ type: String, trim: true, immutable: true }],
    evidenceHash: { type: String, trim: true, default: null, immutable: true },
    notes: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  },

  source: {
    type: String,
    required: true,
    enum: ['monitor', 'zvoove', 'import', 'migration'],
    default: 'monitor',
    immutable: true,
  },
  sourceRef: { type: String, trim: true, default: null, immutable: true },
  declarationEvidence: {
    declarationId: { type: String, trim: true, default: null, immutable: true },
    schemaVersion: { type: String, trim: true, default: null, immutable: true },
    signedPayloadHash: { type: String, trim: true, default: null, immutable: true },
    signedDocumentHash: { type: String, trim: true, default: null, immutable: true },
    evidenceManifestHash: { type: String, trim: true, default: null, immutable: true },
    sourceContractHash: { type: String, trim: true, default: null, immutable: true },
    signatureVerificationMode: {
      type: String,
      enum: ['HASH_EQUALITY_ONLY', 'CRYPTOGRAPHICALLY_VERIFIED'],
      default: null,
      immutable: true,
    },
    verifiedAt: { type: Date, default: null, immutable: true },
  },
  sourceUpdatedAt: { type: Date, default: null, immutable: true },
  changeReason: { type: String, trim: true, maxlength: 2000, default: null, immutable: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  recordedAt: { type: Date, required: true, default: Date.now, immutable: true },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  confirmedAt: { type: Date, default: null },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null },
  payrollLockedAt: { type: Date, default: null },
}, { timestamps: true });

AssignmentLedgerSchema.pre('validate', function validateAssignment(next) {
  if (this.assignmentTill && this.assignmentTill < this.assignmentFrom) {
    this.invalidate('assignmentTill', 'assignmentTill darf nicht vor assignmentFrom liegen.');
  }
  if (this.plannedStart && this.plannedEnd && this.plannedEnd <= this.plannedStart) {
    this.invalidate('plannedEnd', 'plannedEnd muss nach plannedStart liegen.');
  }
  if (this.interruption?.from && this.interruption?.till && this.interruption.till < this.interruption.from) {
    this.invalidate('interruption.till', 'Das Ende der Unterbrechung darf nicht vor ihrem Beginn liegen.');
  }
  if (['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(this.status) && (!this.confirmedBy || !this.confirmedAt)) {
    this.invalidate('status', 'Bestätigte Einsätze benötigen confirmedBy und confirmedAt.');
  }
  if (['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(this.status)) {
    if (!this.customerPayrollRule || !this.siteKey) {
      this.invalidate('customerPayrollRule', 'Bestätigte Einsätze benötigen eine eindeutige, standortbezogene Payroll-Regel.');
    }
    if (this.continuityEvidence?.historyCompleteness === 'UNKNOWN'
        || !this.continuityEvidence?.reviewedBy || !this.continuityEvidence?.reviewedAt) {
      this.invalidate('continuityEvidence', 'Bestätigte Einsätze benötigen eine geprüfte, vollständige Kontinuitätserklärung.');
    }
    const assessment = this.continuityEvidence?.continuityAssessment;
    if (!this.continuityEvidence?.sameCustomerDefinition || !assessment?.policyVersion
        || !assessment?.asOfDate || typeof assessment?.countsTowardEqualPay !== 'boolean'
        || typeof assessment?.countsTowardIndustryTenure !== 'boolean'
        || !assessment?.assessmentEvidenceRefs?.length || !assessment?.assessmentHash) {
      this.invalidate('continuityEvidence.continuityAssessment', 'Bestätigte Einsätze benötigen eine vollständig neu berechnete Kontinuitätsbewertung.');
    }
    if (!this.employeeTariffDecision?.reviewedBy || !this.employeeTariffDecision?.reviewedAt) {
      this.invalidate('employeeTariffDecision', 'Bestätigte Einsätze benötigen eine geprüfte Tätigkeits-/Entgeltgruppenentscheidung.');
    }
    if (!this.statutoryPriorRelationshipChecks?.checkedAt
        || !this.statutoryPriorRelationshipChecks?.checkedByEvidenceParty
        || !this.statutoryPriorRelationshipChecks?.evidenceRefs?.length
        || !this.statutoryPriorRelationshipChecks?.evidenceHash
        || ['UNKNOWN', undefined, null].includes(this.statutoryPriorRelationshipChecks?.formerCustomerEmployeeWithinSixMonths)
        || ['UNKNOWN', undefined, null].includes(this.statutoryPriorRelationshipChecks?.otherProviderWithinThreeMonthsAndOneDay)) {
      this.invalidate('statutoryPriorRelationshipChecks', 'Bestätigte Einsätze benötigen vollständige gesetzliche Vorbeschäftigungsprüfungen.');
    }
  }
  if (this.payrollLockedAt && !this.payrollRun) {
    this.invalidate('payrollRun', 'Eine Payroll-Sperre benötigt einen PayrollRun.');
  }
  next();
});

AssignmentLedgerSchema.index(
  { assignmentKey: 1, version: 1 },
  { unique: true, name: 'assignment_ledger_key_version_unique' },
);
AssignmentLedgerSchema.index(
  { assignmentKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'assignment_ledger_one_current',
  },
);
AssignmentLedgerSchema.index({ mitarbeiter: 1, assignmentFrom: 1, assignmentTill: 1 });
AssignmentLedgerSchema.index({ kunde: 1, continuityKey: 1, assignmentFrom: 1 });
AssignmentLedgerSchema.index({ kunde: 1, siteKey: 1, assignmentFrom: 1 });
AssignmentLedgerSchema.index({ auftrag: 1, status: 1 });
AssignmentLedgerSchema.index({ payrollRun: 1, mitarbeiter: 1 });
AssignmentLedgerSchema.index({ source: 1, sourceRef: 1, version: 1 });
AssignmentLedgerSchema.index(
  { source: 1, sourceRef: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceRef: { $type: 'string' } },
    name: 'assignment_ledger_source_ref_unique',
  },
);

module.exports = mongoose.model('AssignmentLedger', AssignmentLedgerSchema);
