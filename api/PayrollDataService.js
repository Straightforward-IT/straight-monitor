'use strict';

const mongoose = require('mongoose');
const Mitarbeiter = require('./models/Mitarbeiter');
const Kunde = require('./models/Kunde');
const Auftrag = require('./models/Auftrag');
const PayrollEmployment = require('./models/PayrollEmployment');
const CustomerPayrollRule = require('./models/CustomerPayrollRule');
const AssignmentLedger = require('./models/AssignmentLedger');
const AbsenceLedger = require('./models/AbsenceLedger');
const AZKLedger = require('./models/AZKLedger');
const PayrollAzkDisposition = require('./models/PayrollAzkDisposition');
const PayrollAdjustmentLedger = require('./models/PayrollAdjustmentLedger');
const TariffVersion = require('./models/TariffVersion');
const PayrollAuditLog = require('./models/PayrollAuditLog');
const PayrollError = require('./utils/PayrollError');
const { sha256 } = require('./payroll-core/hash');
const { CALCULATION_VERSION, validateGvpTariffApproval } = require('./payroll-core');
const {
  markRunRevisionRequired,
  invalidateEmployeeRuns,
} = require('./PayrollRunInvalidationService');

const idOf = (value) => value?._id || value || null;
const idString = (value) => idOf(value)?.toString?.() || '';
const actorId = (actor) => actor?._id || actor?.id || actor || null;

function assertId(value, label = 'ID') {
  if (!mongoose.isValidObjectId(value)) throw new PayrollError('PAYROLL_ID_INVALID', `${label} ist ungültig.`, 400);
}

function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    throw new PayrollError('PAYROLL_MONTH_INVALID', 'Monat muss YYYY-MM sein.', 400);
  }
  const [year, value] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(year, value - 1, 1)), endExclusive: new Date(Date.UTC(year, value, 1)) };
}

function pick(input, fields) {
  return Object.fromEntries(fields.filter((key) => input?.[key] !== undefined).map((key) => [key, input[key]]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function withoutReview(value, fields) {
  const output = clone(value);
  for (const field of fields) delete output[field];
  return output;
}

async function employeeRequired(employeeId) {
  assertId(employeeId, 'Mitarbeiter-ID');
  const employee = await Mitarbeiter.findById(employeeId).select('_id personalnr vorname nachname paychex_id integrations.paychex').lean();
  if (!employee) throw new PayrollError('PAYROLL_EMPLOYEE_NOT_FOUND', 'Mitarbeiter nicht gefunden.', 404);
  if (!employee.personalnr) throw new PayrollError('PERSONAL_NUMBER_REQUIRED', 'Mitarbeiter benötigt eine Personalnummer.', 409);
  return employee;
}

async function auditRecord({ actor, employee = null, action, outcome = 'SUCCEEDED', previousStatus = null, newStatus = null, hash = null, reason, resource, resourceId }) {
  await PayrollAuditLog.create({
    actor: { user: actorId(actor), actorType: 'USER', displayId: actor?.email || actor?.name || null },
    mitarbeiter: idOf(employee),
    action,
    outcome,
    previousStatus,
    newStatus,
    inputHash: hash,
    reasonCode: String(resource || 'PAYROLL_DATA').replaceAll('-', '_').toUpperCase(),
    summary: reason || `${resource} ${action}`,
    safeMetadata: { resource, resourceId },
  });
}

function assertFourEyes(record, actor, creatorField) {
  const creator = record[creatorField];
  if (creator && idString(creator) === idString(actorId(actor))) {
    throw new PayrollError('FOUR_EYES_REQUIRED', 'Erfasser und Freigeber müssen unterschiedliche Benutzer sein.', 409);
  }
}

const fields = {
  employment: [
    'mitarbeiter', 'validFrom', 'validTill', 'employmentType', 'contractNumber', 'weeklyHours',
    'monthlyTargetHours', 'workingDaysPerWeek', 'tariff', 'overtimeModel', 'experiencePolicy',
    'periodTargetOverrides', 'source', 'sourceRef', 'contractEvidence', 'changeReason',
  ],
  customerRule: [
    'kunde', 'validFrom', 'validTill', 'siteKey', 'siteDeclaration', 'holidayCalendar',
    'industryCode', 'industrySurchargeTariffCode', 'industrySurchargeRuleVersion', 'equalPay',
    'premiumOverrides', 'holidayFederalState', 'source', 'sourceRef', 'declarationEvidence', 'changeReason',
  ],
  assignment: [
    'mitarbeiter', 'kunde', 'auftrag', 'einsatz', 'customerPayrollRule', 'siteKey', 'activityCode', 'activityLabel', 'activityProfile',
    'employeeTariffDecision', 'professionCode', 'qualificationCode', 'workLocation', 'assignmentFrom',
    'assignmentTill', 'plannedStart', 'plannedEnd', 'plannedBreakHours', 'guaranteedHours',
    'payrollEligible', 'continuityKey', 'continuityEvidence', 'countsTowardIndustryTenure',
    'countsTowardEqualPay', 'interruption', 'statutoryPriorRelationshipChecks', 'source', 'sourceRef',
    'declarationEvidence', 'sourceUpdatedAt', 'changeReason',
  ],
  absence: [
    'mitarbeiter', 'employment', 'assignmentLedger', 'kunde', 'absenceType', 'reasonCode', 'dateFrom',
    'dateTill', 'timeZone', 'unit', 'quantity', 'payrollHours', 'dayAllocations', 'azkCreditTreatment',
    'payTreatment', 'paychexAbsenceType',
    'paychexStatus', 'paychexPayloadDetails', 'treatmentEvidence', 'entitlementYear', 'holidayFederalState',
    'referencePeriodFrom', 'referencePeriodTill', 'source', 'sourceRef', 'evidenceRefs', 'changeReason',
  ],
  azk: [
    'idempotencyKey', 'mitarbeiter', 'employment', 'effectiveDate', 'payrollMonth', 'movementType',
    'hoursDelta', 'balanceAfterHours', 'payoutRateCents', 'payoutAmountCents', 'tariffVersion',
    'policyContext', 'sourceWorkingTime', 'sourceAbsence', 'reversalOf', 'source', 'sourceRef', 'reason',
  ],
  azkDisposition: [
    'mitarbeiter', 'employment', 'payrollMonth', 'kind', 'requestedHours',
    'reconciliationDue', 'terminationDate', 'reason', 'evidenceRefs', 'evidenceHash',
    'source', 'sourceRef',
  ],
  adjustment: [
    'mitarbeiter', 'employment', 'assignmentLedger', 'payrollMonth', 'adjustmentType', 'mappingKey',
    'quantity', 'unit', 'rateCents', 'factor', 'percentBasisPoints', 'amountCents', 'evidenceRefs',
    'evidenceHash', 'clause', 'ruleVersion', 'reason', 'source', 'sourceRef',
  ],
  tariff: [
    'code', 'system', 'version', 'previousVersion', 'validFrom', 'validTill', 'standardMonthlyHours',
    'alternativeMonthlyHours', 'entgeltgruppen', 'experienceBonusRules', 'industrySurchargeStages',
    'premiumRules', 'premiumOverlapPolicy', 'overtimeThresholdBasisPoints', 'azkRules',
    'vacationEntitlements', 'absenceAverageReferenceMonths', 'additionalRules', 'calculationVersion', 'source',
  ],
};

async function createEmployment(input, actor, internal = {}) {
  const employee = await employeeRequired(input.mitarbeiter);
  assertId(input.tariff?.ruleVersion, 'Tarifversion-ID');
  const tariff = await TariffVersion.findById(input.tariff.ruleVersion).lean();
  if (!tariff) throw new PayrollError('TARIFF_VERSION_REQUIRED', 'Tarifversion nicht gefunden.', 404);
  const group = String(input.tariff?.group || '').toUpperCase();
  const rate = tariff.entgeltgruppen?.find((entry) => entry.code === group)?.hourlyRateCents;
  if (!Number.isInteger(rate)) throw new PayrollError('ENTGELTGRUPPE_RATE_REQUIRED', 'Entgeltgruppe ist in der Tarifversion nicht enthalten.', 409);
  const data = pick(input, fields.employment);
  data.personalNrSnapshot = employee.personalnr;
  data.paychexEmployeeUid = employee.paychex_id || employee.integrations?.paychex?.employeeUid || null;
  data.baseHourlyRateCents = rate;
  data.status = 'draft';
  data.createdBy = actorId(actor);
  data.experiencePolicy = withoutReview(data.experiencePolicy, ['approvedBy', 'approvedAt']);
  Object.assign(data, internal);
  const record = await PayrollEmployment.create(data);
  await auditRecord({ actor, employee, action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE', hash: sha256(record.toObject()), reason: data.changeReason, resource: 'employment', resourceId: record._id });
  return record;
}

async function createCustomerRule(input, actor, internal = {}) {
  assertId(input.kunde, 'Kunden-ID');
  const customer = await Kunde.findById(input.kunde).select('_id kundenNr').lean();
  if (!customer) throw new PayrollError('PAYROLL_CUSTOMER_NOT_FOUND', 'Kunde nicht gefunden.', 404);
  const data = pick(input, fields.customerRule);
  data.kundenNrSnapshot = customer.kundenNr;
  data.status = 'draft';
  data.createdBy = actorId(actor);
  data.siteDeclaration = withoutReview(data.siteDeclaration, ['reviewedBy', 'reviewedAt']);
  data.equalPay = withoutReview(data.equalPay, ['verifiedBy', 'verifiedAt']);
  data.contentHash = sha256(data);
  Object.assign(data, internal);
  const record = await CustomerPayrollRule.create(data);
  await auditRecord({ actor, action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE', hash: record.contentHash, reason: data.changeReason, resource: 'customer-rule', resourceId: record._id });
  return record;
}

async function createAssignment(input, actor, internal = {}) {
  const [employee, customer, order] = await Promise.all([
    employeeRequired(input.mitarbeiter),
    Kunde.findById(input.kunde).select('_id kundenNr').lean(),
    Auftrag.findById(input.auftrag).select('_id auftragNr kundenNr').lean(),
  ]);
  if (!customer || !order) throw new PayrollError('ASSIGNMENT_SOURCE_REQUIRED', 'Kunde oder Auftrag wurde nicht gefunden.', 404);
  if (Number(order.kundenNr) !== Number(customer.kundenNr)) {
    throw new PayrollError('ASSIGNMENT_CUSTOMER_MISMATCH', 'Auftrag und Kunde gehören nicht zusammen.', 409);
  }
  assertId(input.customerPayrollRule, 'Standortregel-ID');
  const payrollRule = await CustomerPayrollRule.findOne({
    _id: input.customerPayrollRule,
    kunde: customer._id,
    isCurrent: true,
  }).select('_id siteKey').lean();
  if (!payrollRule || payrollRule.siteKey !== input.siteKey) {
    throw new PayrollError(
      'ASSIGNMENT_SITE_RULE_MISMATCH',
      'Einsatz, Kunde, Standortschlüssel und Payroll-Regel gehören nicht eindeutig zusammen.',
      409,
    );
  }
  const data = pick(input, fields.assignment);
  data.personalNrSnapshot = employee.personalnr;
  data.kundenNrSnapshot = customer.kundenNr;
  data.auftragNrSnapshot = order.auftragNr;
  data.status = 'DRAFT';
  data.recordedBy = actorId(actor);
  data.employeeTariffDecision = withoutReview(data.employeeTariffDecision, ['reviewedBy', 'reviewedAt']);
  data.continuityEvidence = withoutReview(data.continuityEvidence, ['reviewedBy', 'reviewedAt']);
  Object.assign(data, internal);
  const record = await AssignmentLedger.create(data);
  await auditRecord({ actor, employee, action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE', hash: sha256(record.toObject()), reason: data.changeReason, resource: 'assignment', resourceId: record._id });
  return record;
}

async function createAbsence(input, actor, internal = {}) {
  const employee = await employeeRequired(input.mitarbeiter);
  assertId(input.employment, 'Beschäftigungs-ID');
  const employment = await PayrollEmployment.findOne({ _id: input.employment, mitarbeiter: employee._id }).lean();
  if (!employment) throw new PayrollError('ABSENCE_EMPLOYMENT_MISMATCH', 'Abwesenheit und Beschäftigung gehören nicht zusammen.', 409);
  const data = pick(input, fields.absence);
  data.personalNrSnapshot = employee.personalnr;
  data.status = 'DRAFT';
  data.recordedBy = actorId(actor);
  data.treatmentEvidence = withoutReview(data.treatmentEvidence, ['reviewedBy', 'reviewedAt']);
  data.contentHash = sha256(data);
  Object.assign(data, internal);
  const record = await AbsenceLedger.create(data);
  await auditRecord({ actor, employee, action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE', hash: record.contentHash, reason: data.changeReason, resource: 'absence', resourceId: record._id });
  return record;
}

async function createAzk(input, actor) {
  const employee = await employeeRequired(input.mitarbeiter);
  assertId(input.employment, 'Beschäftigungs-ID');
  const employment = await PayrollEmployment.findOne({
    _id: input.employment,
    mitarbeiter: employee._id,
    isCurrent: true,
  }).lean();
  if (!employment) throw new PayrollError('AZK_EMPLOYMENT_MISMATCH', 'AZK-Buchung und aktuelle Beschäftigung gehören nicht zusammen.', 409);
  if (['PAYOUT', 'OVERFLOW_PAYOUT'].includes(input.movementType)
      || input.payoutRateCents != null || input.payoutAmountCents != null) {
    throw new PayrollError(
      'AZK_PAYOUT_CORE_CALCULATION_REQUIRED',
      'Aktuelle AZK-Auszahlungen dürfen nicht manuell gebucht werden; nur die freigegebene Disposition wird erfasst, Menge, Rate und Betrag berechnet der Payroll Core.',
      409,
    );
  }
  const data = pick(input, fields.azk);
  data.personalNrSnapshot = employee.personalnr;
  data.status = 'PENDING';
  data.recordedBy = actorId(actor);
  data.policyContext = withoutReview(data.policyContext, ['reviewedBy', 'reviewedAt']);
  data.contentHash = sha256(data);
  const record = await AZKLedger.create(data);
  await auditRecord({ actor, employee, action: 'MANUAL_OVERRIDE', hash: record.contentHash, reason: data.reason, resource: 'azk', resourceId: record._id });
  return record;
}

async function createAzkDisposition(input, actor, internal = {}) {
  const employee = await employeeRequired(input.mitarbeiter);
  assertId(input.employment, 'Beschäftigungs-ID');
  const employment = await PayrollEmployment.findOne({
    _id: input.employment,
    mitarbeiter: employee._id,
    isCurrent: true,
  }).lean();
  if (!employment) {
    throw new PayrollError(
      'AZK_DISPOSITION_EMPLOYMENT_MISMATCH',
      'AZK-Disposition und aktuelle Beschäftigung gehören nicht zusammen.',
      409,
    );
  }
  const existing = await PayrollAzkDisposition.findOne({
    mitarbeiter: employee._id,
    payrollMonth: input.payrollMonth,
    isCurrent: true,
  }).select('_id status').lean();
  if (existing) {
    throw new PayrollError(
      'AZK_DISPOSITION_ALREADY_EXISTS',
      'Für Mitarbeiter und Abrechnungsmonat existiert bereits eine aktuelle AZK-Disposition; Korrekturen müssen als Revision erfolgen.',
      409,
      { existingDispositionId: existing._id, status: existing.status },
    );
  }
  const data = pick(input, fields.azkDisposition);
  data.personalNrSnapshot = employee.personalnr;
  data.status = 'DRAFT';
  data.createdBy = actorId(actor);
  Object.assign(data, internal);
  data.contentHash = sha256({
    ...data,
    createdBy: idString(data.createdBy),
    supersedes: idString(data.supersedes),
  });
  const record = await PayrollAzkDisposition.create(data);
  await auditRecord({
    actor,
    employee,
    action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE',
    hash: record.contentHash,
    reason: data.reason,
    resource: 'azk-disposition',
    resourceId: record._id,
  });
  return record;
}

async function createAdjustment(input, actor, internal = {}) {
  const employee = await employeeRequired(input.mitarbeiter);
  assertId(input.employment, 'Beschäftigungs-ID');
  const employment = await PayrollEmployment.findOne({
    _id: input.employment,
    mitarbeiter: employee._id,
    isCurrent: true,
  }).lean();
  if (!employment) {
    throw new PayrollError(
      'ADJUSTMENT_EMPLOYMENT_MISMATCH',
      'Entgeltanpassung und aktuelle Beschäftigung gehören nicht zusammen.',
      409,
    );
  }
  if (input.assignmentLedger) {
    assertId(input.assignmentLedger, 'Einsatz-ID');
    const assignment = await AssignmentLedger.findOne({
      _id: input.assignmentLedger,
      mitarbeiter: employee._id,
      isCurrent: true,
    }).lean();
    if (!assignment) {
      throw new PayrollError(
        'ADJUSTMENT_ASSIGNMENT_MISMATCH',
        'Entgeltanpassung und aktueller Einsatz gehören nicht zusammen.',
        409,
      );
    }
  }

  const data = pick(input, fields.adjustment);
  data.componentType = String(data.adjustmentType || '').toUpperCase();
  data.status = 'DRAFT';
  data.createdBy = actorId(actor);
  Object.assign(data, internal);
  data.contentHash = sha256({
    ...data,
    createdBy: idString(data.createdBy),
    supersedes: idString(data.supersedes),
  });
  const record = await PayrollAdjustmentLedger.create(data);
  await auditRecord({
    actor,
    employee,
    action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE',
    hash: record.contentHash,
    reason: data.reason,
    resource: 'adjustment',
    resourceId: record._id,
  });
  return record;
}

async function createTariff(input, actor) {
  const data = pick(input, fields.tariff);
  data.status = 'DRAFT';
  data.createdBy = actorId(actor);
  data.contentHash = sha256(data);
  const record = await TariffVersion.create(data);
  await auditRecord({ actor, action: 'MANUAL_OVERRIDE', hash: record.contentHash, resource: 'tariff', resourceId: record._id });
  return record;
}

const creators = {
  employments: createEmployment,
  'customer-rules': createCustomerRule,
  assignments: createAssignment,
  absences: createAbsence,
  azk: createAzk,
  'azk-dispositions': createAzkDisposition,
  adjustments: createAdjustment,
  tariffs: createTariff,
};

async function createResource(resource, input, actor) {
  const create = creators[resource];
  if (!create) throw new PayrollError('PAYROLL_RESOURCE_INVALID', 'Unbekannte Payroll-Datenquelle.', 404);
  return create(input, actor);
}

async function createDeclarationDraft(resource, input, actor, metadata = {}) {
  const definition = {
    'customer-rules': { model: CustomerPayrollRule, create: createCustomerRule, key: 'ruleKey' },
    assignments: { model: AssignmentLedger, create: createAssignment, key: 'assignmentKey' },
  }[resource];
  if (!definition) {
    throw new PayrollError('DECLARATION_RESOURCE_INVALID', 'Dieser Erklärungstyp kann nicht in das Payroll-Ledger importiert werden.', 404);
  }

  const revision = Number(metadata.revision);
  let stableKey = String(metadata.stableKey || '').trim();
  const declarationId = String(metadata.declarationId || '').trim();
  if (!Number.isInteger(revision) || revision < 1 || (revision === 1 && !stableKey) || !declarationId
      || input.source !== 'import' || !String(input.sourceRef || '').trim()
      || input.declarationEvidence?.signatureVerificationMode !== 'HASH_EQUALITY_ONLY') {
    throw new PayrollError('DECLARATION_IMPORT_METADATA_INVALID', 'Der geprüfte Erklärungsimport enthält unvollständige Metadaten.', 422);
  }

  const duplicate = await definition.model.findOne({ source: 'import', sourceRef: input.sourceRef }).select('_id').lean();
  if (duplicate) throw new PayrollError('DECLARATION_ALREADY_IMPORTED', 'Diese Erklärungsrevision wurde bereits importiert.', 409);

  let previous = null;
  if (revision > 1) {
    const supersedesDeclarationId = String(metadata.supersedesDeclarationId || '').trim();
    if (!supersedesDeclarationId) {
      throw new PayrollError('DECLARATION_SUPERSEDES_REQUIRED', 'Eine Revision ab Version 2 muss ihre vorherige Erklärung referenzieren.', 422);
    }
    previous = await definition.model.findOne({
      isCurrent: true,
      version: revision - 1,
      'declarationEvidence.declarationId': supersedesDeclarationId,
    });
    if (!previous || (stableKey && String(previous[definition.key]) !== stableKey)) {
      throw new PayrollError('DECLARATION_PREVIOUS_REVISION_NOT_FOUND', 'Die aktuelle vorherige Erklärungsrevision konnte nicht eindeutig aufgelöst werden.', 409);
    }
    stableKey = String(previous[definition.key]);
  } else {
    const existing = await definition.model.findOne({ [definition.key]: stableKey }).select('_id').lean();
    if (existing) throw new PayrollError('DECLARATION_REVISION_CONFLICT', 'Für diesen stabilen Erklärungsschlüssel existiert bereits ein Ledger-Eintrag.', 409);
  }

  if (previous) {
    previous.isCurrent = false;
    await previous.save();
  }
  try {
    return await definition.create(input, actor, {
      [definition.key]: stableKey,
      version: revision,
      isCurrent: true,
      supersedes: previous?._id || null,
    });
  } catch (error) {
    if (previous) {
      previous.isCurrent = true;
      await previous.save();
    }
    throw error;
  }
}

async function submitAbsence(recordId, actor) {
  assertId(recordId, 'Abwesenheits-ID');
  const record = await AbsenceLedger.findOne({ _id: recordId, isCurrent: true, status: 'DRAFT' });
  if (!record) throw new PayrollError('ABSENCE_DRAFT_NOT_FOUND', 'Aktueller Abwesenheitsentwurf nicht gefunden.', 404);
  record.status = 'SUBMITTED';
  record.submittedBy = actorId(actor);
  record.submittedAt = new Date();
  record.statusHistory.push({ from: 'DRAFT', to: 'SUBMITTED', at: new Date(), by: actorId(actor), reason: 'Zur Payroll-Prüfung eingereicht' });
  await record.save();
  await auditRecord({ actor, employee: record.mitarbeiter, action: 'SUBMIT_INPUT', previousStatus: 'DRAFT', newStatus: 'SUBMITTED', hash: record.contentHash, resource: 'absence', resourceId: record._id });
  return record;
}

async function approveEmployment(record, actor) {
  assertFourEyes(record, actor, 'createdBy');
  const tariff = await TariffVersion.findById(record.tariff.ruleVersion).lean();
  if (tariff?.status !== 'APPROVED') throw new PayrollError('TARIFF_VERSION_NOT_APPROVED', 'Tarifversion muss zuerst freigegeben werden.', 409);
  const group = String(record.tariff?.group || '').toUpperCase();
  const approvedRate = tariff.entgeltgruppen?.find((entry) => String(entry.code).toUpperCase() === group)?.hourlyRateCents;
  if (!Number.isInteger(approvedRate)) {
    throw new PayrollError('ENTGELTGRUPPE_RATE_REQUIRED', 'Entgeltgruppe ist in der freigegebenen Tarifversion nicht enthalten.', 409);
  }
  if (record.baseHourlyRateCents !== approvedRate) {
    throw new PayrollError(
      'EMPLOYMENT_TARIFF_RATE_MISMATCH',
      'Der gespeicherte Basisstundenlohn entspricht nicht der freigegebenen Tarifgruppe.',
      409,
      { group, expectedRateCents: approvedRate, actualRateCents: record.baseHourlyRateCents },
    );
  }
  const conflict = await PayrollEmployment.findOne({
    _id: { $ne: record._id }, mitarbeiter: record.mitarbeiter, isCurrent: true, status: 'active',
    validFrom: { $lte: record.validTill || new Date('9999-12-31') },
    $or: [{ validTill: null }, { validTill: { $gte: record.validFrom } }],
  }).lean();
  if (conflict) throw new PayrollError('EMPLOYMENT_EFFECTIVE_OVERLAP', 'Eine andere aktive Beschäftigung überschneidet sich.', 409);
  record.experiencePolicy.approvedBy = actorId(actor);
  record.experiencePolicy.approvedAt = new Date();
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.status = 'active';
}

async function approveCustomerRule(record, actor) {
  assertFourEyes(record, actor, 'createdBy');
  if (record.source === 'import'
      && record.declarationEvidence?.signatureVerificationMode !== 'CRYPTOGRAPHICALLY_VERIFIED') {
    throw new PayrollError(
      'DECLARATION_SIGNATURE_AUTHENTICITY_REQUIRED',
      'Importierte Standortregeln dürfen erst nach kryptografischer Provider-/Zertifikatsprüfung der Signatur aktiviert werden.',
      409,
    );
  }
  const conflict = await CustomerPayrollRule.findOne({
    _id: { $ne: record._id }, kunde: record.kunde, siteKey: record.siteKey, isCurrent: true, status: 'active',
    validFrom: { $lte: record.validTill || new Date('9999-12-31') },
    $or: [{ validTill: null }, { validTill: { $gte: record.validFrom } }],
  }).lean();
  if (conflict) throw new PayrollError('CUSTOMER_RULE_EFFECTIVE_OVERLAP', 'Eine aktive Standortregel überschneidet sich.', 409);
  record.siteDeclaration.reviewedBy = actorId(actor);
  record.siteDeclaration.reviewedAt = new Date();
  if (record.equalPay.status === 'verified') {
    record.equalPay.verifiedBy = actorId(actor);
    record.equalPay.verifiedAt = new Date();
  }
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.status = 'active';
}

async function approveAssignment(record, actor) {
  assertFourEyes(record, actor, 'recordedBy');
  if (record.source === 'import'
      && record.declarationEvidence?.signatureVerificationMode !== 'CRYPTOGRAPHICALLY_VERIFIED') {
    throw new PayrollError(
      'DECLARATION_SIGNATURE_AUTHENTICITY_REQUIRED',
      'Importierte Einsatzdeklarationen dürfen erst nach kryptografischer Provider-/Zertifikatsprüfung der Signatur bestätigt werden.',
      409,
    );
  }
  if (record.customerPayrollRule) {
    const rule = await CustomerPayrollRule.findOne({
      _id: record.customerPayrollRule,
      kunde: record.kunde,
      siteKey: record.siteKey,
      isCurrent: true,
      status: 'active',
    }).lean();
    if (!rule) throw new PayrollError('CUSTOMER_PAYROLL_RULE_NOT_APPROVED', 'Die verknüpfte Standortregel ist nicht aktiv.', 409);
  }
  record.employeeTariffDecision.reviewedBy = actorId(actor);
  record.employeeTariffDecision.reviewedAt = new Date();
  record.continuityEvidence.reviewedBy = actorId(actor);
  record.continuityEvidence.reviewedAt = new Date();
  record.confirmedBy = actorId(actor);
  record.confirmedAt = new Date();
  record.status = 'CONFIRMED';
}

async function approveAbsence(record, actor) {
  if (record.status !== 'SUBMITTED') throw new PayrollError('ABSENCE_NOT_SUBMITTED', 'Abwesenheit muss zuerst eingereicht werden.', 409);
  assertFourEyes(record, actor, 'submittedBy');
  record.treatmentEvidence.reviewedBy = actorId(actor);
  record.treatmentEvidence.reviewedAt = new Date();
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.statusHistory.push({ from: 'SUBMITTED', to: 'APPROVED', at: new Date(), by: actorId(actor), reason: 'Abwesenheit und Entgeltbehandlung freigegeben' });
  record.status = 'APPROVED';
}

async function approveAzk(record, actor) {
  assertFourEyes(record, actor, 'recordedBy');
  record.policyContext.reviewedBy = actorId(actor);
  record.policyContext.reviewedAt = new Date();
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.status = 'APPROVED';
}

async function approveAzkDisposition(record, actor) {
  assertFourEyes(record, actor, 'createdBy');
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.status = 'APPROVED';
}

async function approveAdjustment(record, actor) {
  assertFourEyes(record, actor, 'createdBy');
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.status = 'APPROVED';
}

async function approveTariff(record, actor, approval = {}) {
  assertFourEyes(record, actor, 'createdBy');
  if (!String(approval.reason || '').trim() || !Array.isArray(approval.evidenceRefs)
      || !approval.evidenceRefs.length || !String(approval.evidenceHash || '').trim()) {
    throw new PayrollError('TARIFF_APPROVAL_EVIDENCE_REQUIRED', 'Tariffreigabe benötigt fachlichen Grund, Evidenzverweise und Evidenz-Hash.', 400);
  }
  const executableValidation = validateGvpTariffApproval(record, {
    calculationVersion: CALCULATION_VERSION,
  });
  if (executableValidation.status !== 'OK') {
    throw new PayrollError(
      executableValidation.code,
      executableValidation.message,
      409,
      executableValidation.partial,
    );
  }
  record.approvalReview = {
    reason: String(approval.reason).trim(),
    evidenceRefs: approval.evidenceRefs.map(String),
    evidenceHash: String(approval.evidenceHash).trim(),
  };
  record.approvedBy = actorId(actor);
  record.approvedAt = new Date();
  record.contentHash = executableValidation.data.executableHash;
  record.status = 'APPROVED';
}

const approvers = {
  employments: { model: PayrollEmployment, draft: 'draft', fn: approveEmployment },
  'customer-rules': { model: CustomerPayrollRule, draft: 'draft', fn: approveCustomerRule },
  assignments: { model: AssignmentLedger, draft: 'DRAFT', fn: approveAssignment },
  absences: { model: AbsenceLedger, draft: null, fn: approveAbsence },
  azk: { model: AZKLedger, draft: 'PENDING', fn: approveAzk },
  'azk-dispositions': { model: PayrollAzkDisposition, draft: 'DRAFT', fn: approveAzkDisposition },
  adjustments: { model: PayrollAdjustmentLedger, draft: 'DRAFT', fn: approveAdjustment },
  tariffs: { model: TariffVersion, draft: 'DRAFT', fn: approveTariff },
};

async function approveResource(resource, recordId, actor, approval = {}) {
  const definition = approvers[resource];
  if (!definition) throw new PayrollError('PAYROLL_RESOURCE_INVALID', 'Unbekannte Payroll-Datenquelle.', 404);
  assertId(recordId);
  const query = { _id: recordId };
  if (definition.draft) query.status = definition.draft;
  if (['employments', 'customer-rules', 'assignments', 'absences', 'adjustments', 'azk-dispositions'].includes(resource)) query.isCurrent = true;
  const record = await definition.model.findOne(query);
  if (!record) throw new PayrollError('PAYROLL_DRAFT_NOT_FOUND', 'Aktueller freigabefähiger Datensatz nicht gefunden.', 404);
  const previous = record.status;
  await definition.fn(record, actor, approval);
  await record.save();
  await auditRecord({ actor, employee: record.mitarbeiter || null, action: 'APPROVE_INPUT', previousStatus: previous, newStatus: record.status, hash: record.contentHash || sha256(record.toObject()), resource, resourceId: record._id });
  return record;
}

async function reviseResource(resource, recordId, input, actor) {
  const definition = {
    employments: { model: PayrollEmployment, create: createEmployment, key: 'employmentKey' },
    'customer-rules': { model: CustomerPayrollRule, create: createCustomerRule, key: 'ruleKey' },
    assignments: { model: AssignmentLedger, create: createAssignment, key: 'assignmentKey' },
    absences: { model: AbsenceLedger, create: createAbsence, key: 'absenceKey' },
    adjustments: { model: PayrollAdjustmentLedger, create: createAdjustment, key: 'adjustmentKey' },
    'azk-dispositions': { model: PayrollAzkDisposition, create: createAzkDisposition, key: 'dispositionKey' },
  }[resource];
  if (!definition) throw new PayrollError('PAYROLL_REVISION_UNSUPPORTED', 'Diese Datenquelle wird durch neue Buchungen statt Revisionen korrigiert.', 409);
  assertId(recordId);
  const current = await definition.model.findOne({ _id: recordId, isCurrent: true });
  if (!current) throw new PayrollError('PAYROLL_CURRENT_RECORD_NOT_FOUND', 'Aktueller Datensatz nicht gefunden.', 404);
  if (!String(input.changeReason || '').trim() || !Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
    throw new PayrollError('REVISION_EVIDENCE_REQUIRED', 'Revisionen benötigen einen Grund und mindestens einen Evidenzverweis.', 400);
  }
  if (['adjustments', 'azk-dispositions'].includes(resource) && !String(input.evidenceHash || '').trim()) {
    throw new PayrollError(
      'REVISION_EVIDENCE_HASH_REQUIRED',
      'Die Revision benötigt einen neuen Evidenz-Hash.',
      400,
    );
  }
  const revisionReason = `${resource}-Revision ${current._id}`;
  if (current.payrollRun) await markRunRevisionRequired(current.payrollRun, actor, revisionReason);
  if (resource === 'customer-rules') {
    const affectedAssignments = await AssignmentLedger.find({
      customerPayrollRule: current._id,
    }).select('mitarbeiter assignmentFrom assignmentTill').lean();
    for (const assignment of affectedAssignments) {
      await invalidateEmployeeRuns({
        employeeId: assignment.mitarbeiter,
        validFrom: assignment.assignmentFrom,
        validTill: assignment.assignmentTill,
        actor,
        reason: revisionReason,
      });
    }
  } else if (current.mitarbeiter) {
    const validFrom = current.validFrom || current.assignmentFrom || current.dateFrom
      || (current.payrollMonth ? monthRange(current.payrollMonth).start : null);
    const validTill = current.validTill || current.assignmentTill || current.dateTill
      || (current.payrollMonth ? new Date(monthRange(current.payrollMonth).endExclusive.getTime() - 1) : null);
    await invalidateEmployeeRuns({
      employeeId: current.mitarbeiter,
      validFrom,
      validTill,
      actor,
      reason: revisionReason,
    });
  }
  const base = current.toObject({ depopulate: true });
  for (const key of ['_id', '__v', 'createdAt', 'updatedAt', 'approvedBy', 'approvedAt', 'confirmedBy', 'confirmedAt', 'submittedBy', 'submittedAt', 'lockedBy', 'lockedAt', 'payrollRun', 'payrollEmployeeSnapshot', 'payrollLockedAt', 'providerSync', 'contentHash']) delete base[key];
  const fieldKey = resource === 'customer-rules'
    ? 'customerRule'
    : resource === 'azk-dispositions' ? 'azkDisposition' : resource.slice(0, -1);
  const merged = { ...base, ...pick(input, fields[fieldKey]) };
  merged.changeReason = input.changeReason;
  if (resource === 'absences') merged.evidenceRefs = [...new Set([...(merged.evidenceRefs || []), ...input.evidenceRefs])];
  if (resource === 'adjustments') {
    merged.evidenceRefs = [...new Set([...(base.evidenceRefs || []), ...input.evidenceRefs.map(String)])];
    merged.evidenceHash = String(input.evidenceHash).trim();
    merged.reason = String(input.reason || `${base.reason}\nRevision: ${input.changeReason}`).trim();
  }
  if (resource === 'azk-dispositions') {
    merged.evidenceRefs = [...new Set([...(base.evidenceRefs || []), ...input.evidenceRefs.map(String)])];
    merged.evidenceHash = String(input.evidenceHash).trim();
    merged.reason = String(input.reason || `${base.reason}\nRevision: ${input.changeReason}`).trim();
  }
  current.isCurrent = false;
  await current.save();
  try {
    return await definition.create(merged, actor, {
      [definition.key]: current[definition.key],
      version: current.version + 1,
      isCurrent: true,
      supersedes: current._id,
    });
  } catch (error) {
    current.isCurrent = true;
    await current.save();
    throw error;
  }
}

async function listResource(resource, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
  if (resource === 'tariffs') {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.system) filter.system = query.system;
    return TariffVersion.find(filter).sort({ validFrom: -1, version: -1 }).limit(limit).lean();
  }
  if (resource === 'customer-rules') {
    const filter = {};
    if (query.kunde) { assertId(query.kunde, 'Kunden-ID'); filter.kunde = query.kunde; }
    if (query.current !== 'false') filter.isCurrent = true;
    if (query.status) filter.status = query.status;
    return CustomerPayrollRule.find(filter).populate('kunde', 'kundenNr kundName').sort({ validFrom: -1 }).limit(limit).lean();
  }
  const models = {
    employments: PayrollEmployment,
    assignments: AssignmentLedger,
    absences: AbsenceLedger,
    azk: AZKLedger,
    adjustments: PayrollAdjustmentLedger,
    'azk-dispositions': PayrollAzkDisposition,
  };
  const model = models[resource];
  if (!model) throw new PayrollError('PAYROLL_RESOURCE_INVALID', 'Unbekannte Payroll-Datenquelle.', 404);
  const filter = {};
  if (query.mitarbeiter) { assertId(query.mitarbeiter, 'Mitarbeiter-ID'); filter.mitarbeiter = query.mitarbeiter; }
  if (!['azk'].includes(resource) && query.current !== 'false') filter.isCurrent = true;
  if (query.status) filter.status = query.status;
  if (query.month) {
    const range = monthRange(query.month);
    if (resource === 'employments') Object.assign(filter, { validFrom: { $lt: range.endExclusive }, $or: [{ validTill: null }, { validTill: { $gte: range.start } }] });
    if (resource === 'assignments') Object.assign(filter, { assignmentFrom: { $lt: range.endExclusive }, $or: [{ assignmentTill: null }, { assignmentTill: { $gte: range.start } }] });
    if (resource === 'absences') Object.assign(filter, { dateFrom: { $lt: range.endExclusive }, dateTill: { $gte: range.start } });
    if (resource === 'azk') filter.payrollMonth = query.month;
    if (resource === 'adjustments') filter.payrollMonth = query.month;
    if (resource === 'azk-dispositions') filter.payrollMonth = query.month;
  }
  return model.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

async function listEmployees({ month, search = '', limit = 250 } = {}) {
  const range = monthRange(month);
  const filter = { isActive: { $ne: false } };
  if (String(search).trim()) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ vorname: regex }, { nachname: regex }, { personalnr: regex }];
  }
  const employees = await Mitarbeiter.find(filter).select('_id personalnr vorname nachname paychex_id integrations.paychex').sort({ nachname: 1, vorname: 1 }).limit(Math.min(Number(limit) || 250, 500)).lean();
  const employments = await PayrollEmployment.find({
    mitarbeiter: { $in: employees.map((entry) => entry._id) }, isCurrent: true,
    validFrom: { $lt: range.endExclusive }, $or: [{ validTill: null }, { validTill: { $gte: range.start } }],
  }).select('mitarbeiter status tariff.group tariff.ruleVersion monthlyTargetHours').lean();
  const byEmployee = new Map(employments.map((entry) => [idString(entry.mitarbeiter), entry]));
  return employees.map((employee) => ({
    ...employee,
    payrollEmployment: byEmployee.get(idString(employee)) || null,
    paychexLinked: Boolean(employee.paychex_id || employee.integrations?.paychex?.employeeUid),
  }));
}

module.exports = {
  createResource,
  createDeclarationDraft,
  listResource,
  approveResource,
  reviseResource,
  submitAbsence,
  listEmployees,
  _private: {
    pick,
    withoutReview,
    monthRange,
    approveTariff,
    approveEmployment,
    approveCustomerRule,
    approveAssignment,
  },
};
