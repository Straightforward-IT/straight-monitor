'use strict';

const mongoose = require('mongoose');
const Mitarbeiter = require('./models/Employee/Mitarbeiter');
const Kunde = require('./models/Kunde');
const Auftrag = require('./models/Auftrag');
const Einsatz = require('./models/Einsatz');
const TariffVersion = require('./models/TariffVersion');
const CustomerPayrollRule = require('./models/CustomerPayrollRule');
const PayrollDataService = require('./PayrollDataService');
const PayrollError = require('./utils/PayrollError');
const DeclarationValidation = require('./PayrollDeclarationValidationService');

const HASH_EQUALITY_MODE = 'HASH_EQUALITY_ONLY';
const SUPPORTED_CONTINUITY_POLICY = 'AUEG-EQUAL-PAY-CONTINUITY-2026-V1-APPROVED';

function requiredObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw new PayrollError('DECLARATION_INTERNAL_ID_INVALID', `${label} ist keine auflösbare interne ID.`, 422);
  }
  return String(value);
}

function same(value, expected, label) {
  if (String(value ?? '').trim() !== String(expected ?? '').trim()) {
    throw new PayrollError('DECLARATION_SNAPSHOT_MISMATCH', `${label} stimmt nicht mit den aktuellen internen Stammdaten überein.`, 409);
  }
}

function normalizedHash(value) {
  return DeclarationValidation._private.normalizeHash(value);
}

function dateOnly(value, label) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(raw)) {
    throw new PayrollError('DECLARATION_DATE_INVALID', `${label} ist kein gültiges Kalenderdatum.`, 422);
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new PayrollError('DECLARATION_DATE_INVALID', `${label} ist kein gültiges Kalenderdatum.`, 422);
  }
  return date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysInclusive(from, till) {
  return Math.round((till.getTime() - from.getTime()) / 86400000) + 1;
}

function addMonthsClamped(date, months) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const finalDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), finalDay));
  return first;
}

function assertDateRange(from, till, label) {
  if (till && till < from) throw new PayrollError('DECLARATION_DATE_RANGE_INVALID', `${label} endet vor seinem Beginn.`, 422);
}

function sourceRef(declaration) {
  return `signed-declaration:${declaration.declarationType}:${declaration.declarationId}:r${declaration.revision}:${normalizedHash(declaration.evidencePackage.signedPayloadHash).slice(-16)}`;
}

function declarationEvidence(declaration, validation) {
  return {
    declarationId: declaration.declarationId,
    schemaVersion: declaration.schemaVersion,
    signedPayloadHash: validation.signedPayloadHash,
    signedDocumentHash: validation.signedDocumentHash,
    evidenceManifestHash: validation.evidenceManifestHash,
    sourceContractHash: normalizedHash(declaration.evidencePackage.sourceContractHash),
    signatureVerificationMode: HASH_EQUALITY_MODE,
    verifiedAt: new Date(),
  };
}

async function resolveCustomerDeclaration(declaration, resolution) {
  const customerId = requiredObjectId(resolution?.customerId, 'Kunden-ID');
  same(customerId, declaration.customer.internalCustomerId, 'Kunden-ID');
  const customer = await Kunde.findById(customerId).select('_id kundenNr kundName').lean();
  if (!customer) throw new PayrollError('DECLARATION_CUSTOMER_NOT_FOUND', 'Der erklärte Kunde wurde nicht gefunden.', 404);
  same(customer.kundenNr, declaration.customer.customerNumberSnapshot, 'Kundennummer');
  same(customer.kundName, declaration.customer.legalName, 'Kundenname');

  let industrySurchargeRuleVersion = null;
  if (declaration.industrySurchargeAgreement.decision === 'APPLICABLE') {
    const tariffId = requiredObjectId(resolution?.industrySurchargeRuleVersionId, 'Branchenzuschlag-Tarifversion');
    const tariff = await TariffVersion.findById(tariffId).select('_id code status').lean();
    if (!tariff || tariff.status !== 'APPROVED') {
      throw new PayrollError('DECLARATION_INDUSTRY_TARIFF_NOT_APPROVED', 'Der erklärte Branchenzuschlag benötigt eine freigegebene Tarifversion.', 409);
    }
    same(tariff.code, declaration.industrySurchargeAgreement.ruleVersionRef, 'Branchenzuschlag-Tarifreferenz');
    industrySurchargeRuleVersion = tariff._id;
  } else if (resolution?.industrySurchargeRuleVersionId) {
    throw new PayrollError('DECLARATION_INDUSTRY_TARIFF_UNEXPECTED', 'Ohne anwendbaren Branchenzuschlag darf keine Tarifversion verknüpft werden.', 422);
  }
  return { customer, industrySurchargeRuleVersion };
}

function customerRuleInput(declaration, validation, resolved) {
  const address = declaration.site.address;
  const signer = declaration.evidencePackage.customerSignature;
  const premium = declaration.customerPremiumRules;
  const comparator = declaration.equalPayComparator;
  const industry = declaration.industrySurchargeAgreement;
  if (declaration.site.holidayJurisdiction !== declaration.holidayCalendar.federalState) {
    throw new PayrollError('DECLARATION_HOLIDAY_JURISDICTION_MISMATCH', 'Einsatzort und Feiertagskalender müssen dasselbe Bundesland verwenden.', 422);
  }
  const validFrom = dateOnly(declaration.validityPeriod.validFrom, 'Gültigkeitsbeginn');
  const validTill = declaration.validityPeriod.validTill ? dateOnly(declaration.validityPeriod.validTill, 'Gültigkeitsende') : null;
  assertDateRange(validFrom, validTill, 'Die Kunden-/Standorterklärung');

  const sourceAgreement = premium.sourceAgreement;
  return {
    kunde: resolved.customer._id,
    validFrom,
    validTill,
    siteKey: declaration.site.siteKey,
    siteDeclaration: {
      siteName: declaration.site.siteName,
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      city: address.city,
      federalState: address.federalState,
      declaredByName: signer.signerName,
      declaredByRole: signer.signerRole,
      declaredAt: new Date(signer.signedAt),
      evidenceRefs: declaration.evidencePackage.evidenceRefs,
      signatureHash: normalizedHash(signer.signatureHash),
      evidenceHash: validation.evidenceManifestHash,
    },
    holidayCalendar: {
      calendarId: declaration.holidayCalendar.calendarId,
      dates: declaration.holidayCalendar.dates,
      source: declaration.holidayCalendar.source,
      sourceVersion: declaration.holidayCalendar.sourceVersion,
      evidenceHash: normalizedHash(declaration.holidayCalendar.evidenceHash),
    },
    industryCode: declaration.site.operationalSector,
    industrySurchargeTariffCode: industry.decision === 'UNKNOWN' ? null : industry.agreementCode,
    industrySurchargeRuleVersion: resolved.industrySurchargeRuleVersion,
    equalPay: {
      status: comparator.status.toLowerCase(),
      comparisonHourlyRateCents: comparator.comparisonHourlyRateCents,
      comparisonMonthlyAmountCents: comparator.comparisonMonthlyAmountCents,
      comparisonHourlyRateScope: comparator.comparisonHourlyRateScope || 'BASE_ONLY',
      conversionPolicyId: comparator.conversionPolicyId || null,
      conversionEvidenceHash: comparator.conversionEvidenceHash ? normalizedHash(comparator.conversionEvidenceHash) : null,
      regularComponents: comparator.regularComponents,
      comparisonGroup: comparator.comparisonGroup,
      source: comparator.source,
      evidenceIds: comparator.evidenceRefs,
      declarationSigner: comparator.declarationSignature?.signerName || null,
      declarationSignedAt: comparator.declarationSignature?.signedAt ? new Date(comparator.declarationSignature.signedAt) : null,
      signatureHash: comparator.declarationSignature?.signatureHash ? normalizedHash(comparator.declarationSignature.signatureHash) : null,
      evidenceHash: comparator.evidenceHash ? normalizedHash(comparator.evidenceHash) : null,
      expiresAt: comparator.validityPeriod?.validTill ? dateOnly(comparator.validityPeriod.validTill, 'Equal-Pay-Gültigkeitsende') : null,
      notes: comparator.notApplicableReason || null,
    },
    premiumOverrides: {
      decision: premium.decision,
      nightBasisPoints: premium.nightBasisPoints,
      sundayBasisPoints: premium.sundayBasisPoints,
      holidayBasisPoints: premium.holidayBasisPoints,
      nightWindowStart: premium.nightWindow.start,
      nightWindowEnd: premium.nightWindow.end,
      overlapPolicy: premium.overlapPolicy.toLowerCase(),
      source: sourceAgreement ? `${sourceAgreement.title} (${sourceAgreement.identifier}, ${sourceAgreement.version})` : null,
    },
    holidayFederalState: declaration.site.holidayJurisdiction,
    source: 'import',
    sourceRef: sourceRef(declaration),
    declarationEvidence: declarationEvidence(declaration, validation),
    changeReason: declaration.changeReason,
  };
}

function analyzeContinuity(declaration, industryDecision) {
  if (industryDecision === 'APPLICABLE') {
    throw new PayrollError(
      'DECLARATION_INDUSTRY_CONTINUITY_POLICY_UNSUPPORTED',
      'Einsätze mit Branchenzuschlag benötigen vor dem Import eine tarifvertragsspezifische Kontinuitätsregel.',
      409,
    );
  }
  const evidence = declaration.continuityEvidence;
  const assessment = evidence.continuityAssessment;
  if (assessment.policyVersion !== SUPPORTED_CONTINUITY_POLICY) {
    throw new PayrollError('DECLARATION_CONTINUITY_POLICY_UNSUPPORTED', 'Die erklärte Kontinuitätsrichtlinie ist nicht als ausführbare Regel freigegeben.', 409);
  }
  const currentFrom = dateOnly(declaration.assignmentPeriod.assignmentFrom, 'Einsatzbeginn');
  const periods = evidence.priorAssignments.map((entry) => ({
    id: entry.priorAssignmentId,
    from: dateOnly(entry.from, `Voriger Einsatz ${entry.priorAssignmentId}`),
    till: dateOnly(entry.till, `Voriger Einsatz ${entry.priorAssignmentId}`),
    entry,
  })).sort((left, right) => left.from - right.from);
  const periodIds = periods.map((entry) => entry.id);
  if (periodIds.includes(declaration.assignmentKey) || new Set(periodIds).size !== periodIds.length) {
    throw new PayrollError('DECLARATION_ASSIGNMENT_ID_DUPLICATE', 'Aktuelle und vorige Einsätze benötigen eindeutige Einsatzschlüssel.', 422);
  }
  periods.forEach((period) => {
    assertDateRange(period.from, period.till, `Voriger Einsatz ${period.id}`);
    if (period.till >= currentFrom) {
      throw new PayrollError('DECLARATION_CONTINUITY_OVERLAP', 'Vorige Einsätze müssen vor dem aktuellen Einsatz enden.', 422);
    }
    if (period.entry.customerIdentifier !== declaration.customer.internalCustomerId) {
      throw new PayrollError('DECLARATION_CONTINUITY_CUSTOMER_MISMATCH', 'Vorige Einsätze müssen den identisch aufgelösten Kunden referenzieren.', 422);
    }
  });
  for (let index = 1; index < periods.length; index += 1) {
    if (periods[index].from <= periods[index - 1].till) {
      throw new PayrollError('DECLARATION_CONTINUITY_OVERLAP', 'Vorige Einsätze dürfen sich nicht überschneiden.', 422);
    }
  }
  periods.push({ id: declaration.assignmentKey, from: currentFrom, till: null, entry: null });

  const interruptions = new Map();
  for (const entry of evidence.exactInterruptionPeriods) {
    const key = `${entry.afterAssignmentId}|${entry.beforeAssignmentId}`;
    if (interruptions.has(key)) throw new PayrollError('DECLARATION_INTERRUPTION_DUPLICATE', 'Unterbrechungsintervalle müssen eindeutig sein.', 422);
    interruptions.set(key, entry);
  }

  const normalized = [];
  let continuityStart = periods[0]?.from || currentFrom;
  for (let index = 0; index < periods.length - 1; index += 1) {
    const previous = periods[index];
    const next = periods[index + 1];
    const expectedFrom = addDays(previous.till, 1);
    const expectedTill = addDays(next.from, -1);
    const key = `${previous.id}|${next.id}`;
    const submitted = interruptions.get(key);
    if (expectedFrom <= expectedTill) {
      if (!submitted) throw new PayrollError('DECLARATION_INTERRUPTION_MISSING', `Die exakte Unterbrechung zwischen ${previous.id} und ${next.id} fehlt.`, 422);
      same(submitted.from, isoDate(expectedFrom), 'Unterbrechungsbeginn');
      same(submitted.till, isoDate(expectedTill), 'Unterbrechungsende');
      const calendarDays = daysInclusive(expectedFrom, expectedTill);
      if (submitted.calendarDays !== calendarDays) {
        throw new PayrollError('DECLARATION_INTERRUPTION_DAYS_MISMATCH', 'Die erklärten Kalendertage der Unterbrechung sind falsch.', 422);
      }
      const resets = next.from > addMonthsClamped(previous.till, 3);
      if (submitted.resetsEqualPayTenure !== resets || submitted.resetsIndustryTenure !== resets) {
        throw new PayrollError('DECLARATION_INTERRUPTION_RESET_MISMATCH', 'Kontinuitäts-Reset und exakte Unterbrechung sind widersprüchlich.', 422);
      }
      if (resets) continuityStart = next.from;
      normalized.push({ ...submitted, from: expectedFrom, till: expectedTill, calendarDays, resets });
      interruptions.delete(key);
    } else if (submitted) {
      throw new PayrollError('DECLARATION_INTERRUPTION_UNEXPECTED', 'Für unmittelbar anschließende Einsätze darf keine Unterbrechung erklärt werden.', 422);
    }
  }
  if (interruptions.size) {
    throw new PayrollError('DECLARATION_INTERRUPTION_UNRESOLVED', 'Mindestens ein Unterbrechungsintervall verweist nicht auf aufeinanderfolgende Einsätze.', 422);
  }

  const threshold = addMonthsClamped(continuityStart, 9);
  same(assessment.asOfDate, isoDate(currentFrom), 'Kontinuitäts-Stichtag');
  if (assessment.countsTowardEqualPay) {
    same(assessment.equalPayContinuityStart, isoDate(continuityStart), 'Equal-Pay-Kontinuitätsbeginn');
    same(assessment.equalPayThresholdDate, isoDate(threshold), 'Equal-Pay-Schwellenwert');
  } else if (assessment.equalPayContinuityStart !== null || assessment.equalPayThresholdDate !== null) {
    throw new PayrollError('DECLARATION_CONTINUITY_ASSESSMENT_INVALID', 'Nicht anrechenbare Einsätze dürfen keine Equal-Pay-Schwellenwerte enthalten.', 422);
  }

  return { periods, normalized, continuityStart, threshold };
}

async function resolveAssignmentDeclaration(declaration, resolution) {
  const employeeId = requiredObjectId(resolution?.employeeId, 'Mitarbeiter-ID');
  const customerId = requiredObjectId(resolution?.customerId, 'Kunden-ID');
  const orderId = requiredObjectId(resolution?.orderId, 'Auftrags-ID');
  const ruleId = requiredObjectId(resolution?.customerPayrollRuleId, 'Standortregel-ID');
  const tariffId = requiredObjectId(resolution?.tariffVersionId, 'Tarifversion-ID');
  same(employeeId, declaration.employee.internalEmployeeId, 'Mitarbeiter-ID');
  same(customerId, declaration.customer.internalCustomerId, 'Kunden-ID');
  same(orderId, declaration.order.internalOrderId, 'Auftrags-ID');
  same(resolution?.employerId, declaration.employer.internalEmployerId, 'Arbeitgeber-ID');
  if (process.env.PAYROLL_EMPLOYER_INTERNAL_ID) {
    same(declaration.employer.internalEmployerId, process.env.PAYROLL_EMPLOYER_INTERNAL_ID, 'Konfigurierte Arbeitgeber-ID');
  }

  const [employee, customer, order, rule, tariff] = await Promise.all([
    Mitarbeiter.findById(employeeId).select('_id personalnr vorname nachname paychex_id integrations.paychex').lean(),
    Kunde.findById(customerId).select('_id kundenNr kundName').lean(),
    Auftrag.findById(orderId).select('_id auftragNr kundenNr').lean(),
    CustomerPayrollRule.findOne({ _id: ruleId, isCurrent: true }).lean(),
    TariffVersion.findById(tariffId).select('_id code status entgeltgruppen').lean(),
  ]);
  if (!employee || !customer || !order || !rule || !tariff) {
    throw new PayrollError('DECLARATION_INTERNAL_REFERENCE_NOT_FOUND', 'Mindestens eine interne Einsatzreferenz konnte nicht aufgelöst werden.', 404);
  }
  same(employee.personalnr, declaration.employee.personnelNumberSnapshot, 'Personalnummer');
  same(`${employee.vorname} ${employee.nachname}`, declaration.employee.displayNameSnapshot, 'Mitarbeitername');
  if (declaration.employee.paychexEmployeeId) {
    same(employee.paychex_id || employee.integrations?.paychex?.employeeUid, declaration.employee.paychexEmployeeId, 'Paychex-Mitarbeiter-ID');
  }
  same(customer.kundenNr, declaration.customer.customerNumberSnapshot, 'Kundennummer');
  same(customer.kundName, declaration.customer.legalName, 'Kundenname');
  same(order.auftragNr, declaration.order.orderNumberSnapshot, 'Auftragsnummer');
  same(order.kundenNr, customer.kundenNr, 'Auftragskunde');
  same(rule.kunde, customer._id, 'Standortregel-Kunde');
  same(rule.siteKey, declaration.siteDeclarationRef.siteKey, 'Standortschlüssel');
  same(rule.industryCode, declaration.siteDeclarationRef.operationalSector, 'Betrieblicher Sektor');
  same(rule.declarationEvidence?.declarationId, declaration.siteDeclarationRef.declarationId, 'Standorterklärungs-ID');
  same(rule.version, declaration.siteDeclarationRef.revision, 'Standorterklärungsrevision');
  if (normalizedHash(rule.declarationEvidence?.signedPayloadHash) !== normalizedHash(declaration.siteDeclarationRef.signedPayloadHash)) {
    throw new PayrollError('DECLARATION_SITE_PAYLOAD_MISMATCH', 'Der signierte Standort-Payload stimmt nicht mit der Ledger-Regel überein.', 409);
  }
  const surchargeDecision = !rule.industrySurchargeTariffCode
    ? 'UNKNOWN'
    : (rule.industrySurchargeTariffCode === 'NONE' ? 'NONE' : 'APPLICABLE');
  same(surchargeDecision, declaration.siteDeclarationRef.industrySurchargeDecision, 'Branchenzuschlagsentscheidung');
  if (tariff.status !== 'APPROVED') throw new PayrollError('DECLARATION_TARIFF_NOT_APPROVED', 'Die Entgeltgruppenentscheidung benötigt eine freigegebene Tarifversion.', 409);
  same(tariff.code, declaration.tariffDecision.tariffVersionRef, 'GVP-Tarifreferenz');
  if (!tariff.entgeltgruppen.some((entry) => entry.code === declaration.tariffDecision.entgeltgruppe.toUpperCase())) {
    throw new PayrollError('DECLARATION_TARIFF_GROUP_NOT_FOUND', 'Die erklärte Entgeltgruppe fehlt in der verknüpften Tarifversion.', 409);
  }

  let deployment = null;
  if (declaration.order.internalDeploymentId !== null) {
    const deploymentId = requiredObjectId(resolution?.deploymentId, 'Einsatz-ID');
    same(deploymentId, declaration.order.internalDeploymentId, 'Einsatz-ID');
    deployment = await Einsatz.findById(deploymentId).select('_id auftragNr personalNr').lean();
    if (!deployment) throw new PayrollError('DECLARATION_DEPLOYMENT_NOT_FOUND', 'Der interne Einsatz wurde nicht gefunden.', 404);
    same(deployment.auftragNr, order.auftragNr, 'Einsatzauftrag');
    const numericPersonnelNumber = Number(employee.personalnr);
    if (Number.isFinite(numericPersonnelNumber) && deployment.personalNr != null) {
      same(deployment.personalNr, numericPersonnelNumber, 'Einsatz-Personalnummer');
    }
  } else if (resolution?.deploymentId) {
    throw new PayrollError('DECLARATION_DEPLOYMENT_UNEXPECTED', 'Die Erklärung enthält keine interne Einsatzreferenz.', 422);
  }
  return { employee, customer, order, rule, tariff, deployment };
}

function assignmentInput(declaration, validation, resolved) {
  const continuity = analyzeContinuity(declaration, declaration.siteDeclarationRef.industrySurchargeDecision);
  const evidence = declaration.continuityEvidence;
  const assessment = evidence.continuityAssessment;
  const recentInterruption = continuity.normalized.at(-1) || null;
  const interruptionByPriorId = new Map(continuity.normalized.map((entry) => [entry.afterAssignmentId, entry]));
  const planned = declaration.plannedWorkingTime;
  const assignmentFrom = new Date(declaration.assignmentPeriod.assignmentFrom);
  const assignmentTill = declaration.assignmentPeriod.assignmentTill ? new Date(declaration.assignmentPeriod.assignmentTill) : null;
  assertDateRange(assignmentFrom, assignmentTill, 'Der Einsatz');

  return {
    mitarbeiter: resolved.employee._id,
    kunde: resolved.customer._id,
    auftrag: resolved.order._id,
    einsatz: resolved.deployment?._id || null,
    customerPayrollRule: resolved.rule._id,
    siteKey: declaration.siteDeclarationRef.siteKey,
    activityCode: declaration.activityProfile.activityCode,
    activityLabel: declaration.activityProfile.activityLabel,
    activityProfile: {
      actualDuties: declaration.activityProfile.actualDuties,
      responsibilityLevel: declaration.activityProfile.responsibilityLevel,
      requiredQualifications: declaration.activityProfile.requiredQualifications,
    },
    employeeTariffDecision: {
      declaredActivity: declaration.activityProfile.declaredActivity,
      entgeltgruppe: declaration.tariffDecision.entgeltgruppe,
      decisionReason: declaration.tariffDecision.decisionReason,
      sourceClause: declaration.tariffDecision.sourceClause,
      tariffVersion: resolved.tariff._id,
      tariffVersionRef: declaration.tariffDecision.tariffVersionRef,
      evidenceRefs: declaration.tariffDecision.evidenceRefs,
      declaredBy: declaration.tariffDecision.declaredBy,
      declaredAt: new Date(declaration.tariffDecision.declaredAt),
      signatureHash: normalizedHash(declaration.tariffDecision.signatureHash),
      evidenceHash: normalizedHash(declaration.tariffDecision.evidenceHash),
    },
    professionCode: declaration.activityProfile.professionCode,
    qualificationCode: declaration.activityProfile.qualificationCode,
    workLocation: declaration.activityProfile.workLocation,
    assignmentFrom,
    assignmentTill,
    plannedStart: planned.plannedStart ? new Date(planned.plannedStart) : null,
    plannedEnd: planned.plannedEnd ? new Date(planned.plannedEnd) : null,
    plannedBreakHours: planned.plannedBreakMinutes == null ? null : planned.plannedBreakMinutes / 60,
    guaranteedHours: planned.contractualGuaranteedHours,
    payrollEligible: declaration.payrollTreatment.payrollEligible,
    continuityKey: evidence.continuityKey,
    continuityEvidence: {
      sameCustomerDefinition: evidence.sameCustomerDefinition,
      historyCompleteness: evidence.historyCompleteness,
      priorAssignments: evidence.priorAssignments.map((entry) => ({
        priorAssignmentId: entry.priorAssignmentId,
        staffingProviderName: entry.staffingProviderName,
        staffingProviderIdentifier: entry.staffingProviderIdentifier,
        customerName: entry.customerName,
        customerIdentifier: entry.customerIdentifier,
        from: dateOnly(entry.from, 'Voriger Einsatzbeginn'),
        till: dateOnly(entry.till, 'Voriges Einsatzende'),
        interruptionAfterDays: interruptionByPriorId.get(entry.priorAssignmentId)?.calendarDays ?? 0,
        evidenceRefs: entry.evidenceRefs,
        evidenceHash: normalizedHash(entry.evidenceHash),
      })),
      exactInterruptionPeriods: continuity.normalized.map((entry) => ({
        interruptionId: entry.interruptionId,
        afterAssignmentId: entry.afterAssignmentId,
        beforeAssignmentId: entry.beforeAssignmentId,
        from: entry.from,
        till: entry.till,
        calendarDays: entry.calendarDays,
        reason: entry.reason,
        resetsEqualPayTenure: entry.resets,
        resetsIndustryTenure: entry.resets,
        evidenceRefs: entry.evidenceRefs,
      })),
      declarationSource: evidence.declarationSource,
      declaredBy: evidence.declaredBy,
      declaredAt: new Date(evidence.declaredAt),
      evidenceRefs: evidence.evidenceRefs,
      signatureHash: normalizedHash(evidence.signatureHash),
      evidenceHash: normalizedHash(evidence.evidenceHash),
      continuityAssessment: {
        policyVersion: assessment.policyVersion,
        asOfDate: dateOnly(assessment.asOfDate, 'Kontinuitäts-Stichtag'),
        countsTowardEqualPay: assessment.countsTowardEqualPay,
        countsTowardIndustryTenure: assessment.countsTowardIndustryTenure,
        equalPayContinuityStart: assessment.equalPayContinuityStart ? continuity.continuityStart : null,
        equalPayThresholdDate: assessment.equalPayThresholdDate ? continuity.threshold : null,
        assessmentEvidenceRefs: assessment.assessmentEvidenceRefs,
        assessmentHash: normalizedHash(assessment.assessmentHash),
      },
    },
    countsTowardIndustryTenure: assessment.countsTowardIndustryTenure,
    countsTowardEqualPay: assessment.countsTowardEqualPay,
    interruption: recentInterruption ? {
      type: recentInterruption.reason.toLowerCase(),
      from: recentInterruption.from,
      till: recentInterruption.till,
      resetsIndustryTenure: recentInterruption.resets,
      resetsEqualPayTenure: recentInterruption.resets,
      reason: `Recomputed from signed interruption ${recentInterruption.interruptionId}`,
    } : { type: 'none' },
    statutoryPriorRelationshipChecks: {
      formerCustomerEmployeeWithinSixMonths: declaration.statutoryPriorRelationshipChecks.formerCustomerEmployeeWithinSixMonths,
      otherProviderWithinThreeMonthsAndOneDay: declaration.statutoryPriorRelationshipChecks.otherProviderWithinThreeMonthsAndOneDay,
      checkedAt: new Date(declaration.statutoryPriorRelationshipChecks.checkedAt),
      checkedByEvidenceParty: declaration.statutoryPriorRelationshipChecks.checkedBy,
      evidenceRefs: declaration.statutoryPriorRelationshipChecks.evidenceRefs,
      evidenceHash: normalizedHash(declaration.statutoryPriorRelationshipChecks.evidenceHash),
      notes: declaration.statutoryPriorRelationshipChecks.notes,
    },
    source: 'import',
    sourceRef: sourceRef(declaration),
    declarationEvidence: declarationEvidence(declaration, validation),
    sourceUpdatedAt: new Date(),
    changeReason: declaration.changeReason,
  };
}

async function importDeclaration(request, actor) {
  const declaration = request?.declaration;
  const validation = DeclarationValidation.validateDeclarationEnvelope({ declaration, artifacts: request?.artifacts });
  if (declaration.declarationType === 'CUSTOMER_SITE_PAYROLL_DECLARATION') {
    const resolved = await resolveCustomerDeclaration(declaration, request?.resolution);
    const input = customerRuleInput(declaration, validation, resolved);
    const record = await PayrollDataService.createDeclarationDraft('customer-rules', input, actor, {
      stableKey: declaration.revision === 1 ? declaration.declarationId : null,
      declarationId: declaration.declarationId,
      revision: declaration.revision,
      supersedesDeclarationId: declaration.supersedesDeclarationId,
    });
    return { validation, resource: 'customer-rules', record };
  }
  if (declaration.declarationType === 'EMPLOYEE_ASSIGNMENT_DECLARATION') {
    const resolved = await resolveAssignmentDeclaration(declaration, request?.resolution);
    const input = assignmentInput(declaration, validation, resolved);
    const record = await PayrollDataService.createDeclarationDraft('assignments', input, actor, {
      stableKey: declaration.assignmentKey,
      declarationId: declaration.declarationId,
      revision: declaration.revision,
      supersedesDeclarationId: declaration.supersedesDeclarationId,
    });
    return { validation, resource: 'assignments', record };
  }
  throw new PayrollError('DECLARATION_TYPE_UNSUPPORTED', 'Der Erklärungstyp wird nicht unterstützt.', 422);
}

module.exports = {
  validateDeclaration: DeclarationValidation.validateDeclarationEnvelope,
  importDeclaration,
  _private: {
    addMonthsClamped,
    analyzeContinuity,
    customerRuleInput,
    assignmentInput,
    sourceRef,
  },
};
