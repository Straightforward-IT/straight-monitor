'use strict';

const {
  componentMappingEntries,
  componentMappingKey,
  buildProviderSalaryComponent,
} = require('./PayrollProviderPayload');

const VALID_PAYROLL_STATUSES = new Set(['APPROVED', 'LOCKED']);
const READY_COMPONENT_TYPES = new Set([
  'BASE_WAGE',
  'EXPERIENCE_BONUS',
  'INDUSTRY_SURCHARGE',
  'EQUAL_PAY_ADJUSTMENT',
  'NIGHT_PREMIUM',
  'SUNDAY_PREMIUM',
  'HOLIDAY_PREMIUM',
  'OVERTIME_PREMIUM',
  'AZK_WITHDRAWAL',
  'AZK_PAYOUT',
  'VACATION_PAY',
  'SICK_PAY',
  'SHORT_TIME',
  'CORRECTION',
  'TEMP_HIGHER_GRADE_DIFFERENTIAL',
  'TRAVEL_TIME',
  'SPECIAL_PAYMENT',
  'OTHER',
]);

function issue(code, message, fieldPath, details = null, severity = 'ERROR') {
  return {
    code,
    severity,
    blocking: severity === 'ERROR',
    message,
    fieldPath,
    details,
  };
}

function decimalNumber(value) {
  if (value == null) return null;
  return Number(typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value);
}

function valueOfRef(value) {
  if (!value) return null;
  return value._id || value;
}

function overlapsMonth(recordFrom, recordTill, periodStart, periodEndExclusive) {
  if (!recordFrom) return false;
  const from = new Date(recordFrom);
  const till = recordTill ? new Date(recordTill) : null;
  return from < periodEndExclusive && (!till || till >= periodStart);
}

function validateInput(input = {}) {
  const errors = [];
  const warnings = [];
  const {
    employee,
    employment,
    providerProfile = null,
    assignments = [],
    workingTimes = [],
    absences = [],
    azk = [],
    azkDisposition = null,
    adjustments = [],
    customerRules = [],
    pendingInputs = {},
    allocationIssues = [],
    referenceMonthIssues = [],
  } = input;

  for (const allocationIssue of allocationIssues) {
    errors.push(issue(
      allocationIssue.code || 'PAYROLL_PERIOD_ALLOCATION_FAILED',
      allocationIssue.message || 'Eine freigegebene Quelle konnte dem Abrechnungsmonat nicht eindeutig zugeordnet werden.',
      allocationIssue.fieldPath || 'allocationIssues',
      allocationIssue.details || null,
    ));
  }
  for (const referenceMonthIssue of referenceMonthIssues) {
    errors.push(issue(
      referenceMonthIssue.code || 'PAYROLL_REFERENCE_MONTH_INVALID',
      referenceMonthIssue.message || 'Ein benötigter GVP-Referenzmonat fehlt oder ist nicht mehr hashgültig.',
      referenceMonthIssue.fieldPath || 'referenceMonths',
      referenceMonthIssue.details || null,
    ));
  }
  for (const [kind, records] of Object.entries({
    workingTimes: pendingInputs.workingTimes || [],
    absences: pendingInputs.absences || [],
    adjustments: pendingInputs.adjustments || [],
    azkDispositions: pendingInputs.azkDispositions || [],
  })) {
    if (records.length) {
      errors.push(issue(
        `PENDING_${kind.replace(/([A-Z])/g, '_$1').toUpperCase()}`,
        `${records.length} abrechnungsrelevante Datensätze sind noch nicht freigegeben.`,
        `pendingInputs.${kind}`,
        { recordIds: records.map((entry) => valueOfRef(entry)).filter(Boolean) },
      ));
    }
  }

  if (!employee?._id) errors.push(issue('EMPLOYEE_REQUIRED', 'Mitarbeiterstammdaten fehlen.', 'employee'));
  if (!employee?.personalnr && !employee?.personalNumber) {
    errors.push(issue('PERSONAL_NUMBER_REQUIRED', 'Eine eindeutige Personalnummer fehlt.', 'employee.personalnr'));
  }
  const paychexId = employee?.paychex_id || employee?.paychexEmployeeUid || employee?.integrations?.paychex?.employeeUid;
  if (!paychexId) {
    errors.push(issue('PAYCHEX_EMPLOYEE_ID_REQUIRED', 'Die Paychex Employee UID fehlt.', 'employee.paychex_id'));
  }

  if (!providerProfile) {
    errors.push(issue(
      'PAYCHEX_PROVIDER_PROFILE_REQUIRED',
      'Ein freigegebenes, zeitlich gültiges Paychex-Mitarbeiter-/Vertragsprofil fehlt.',
      'providerProfile',
    ));
  } else {
    const expectedEmployeeId = String(paychexId || '');
    const expectedEmploymentId = String(valueOfRef(employment) || '');
    if (providerProfile.status !== 'APPROVED'
        || providerProfile.provider !== 'paychex'
        || providerProfile.apiVersion !== 'v1.3') {
      errors.push(issue(
        'PAYCHEX_PROVIDER_PROFILE_NOT_APPROVED',
        'Das Paychex-Profil ist nicht für Public API v1.3 freigegeben.',
        'providerProfile.status',
      ));
    }
    if (String(providerProfile.paychexEmployeeUid || '') !== expectedEmployeeId
        || String(valueOfRef(providerProfile.employment) || '') !== expectedEmploymentId) {
      errors.push(issue(
        'PAYCHEX_PROVIDER_PROFILE_IDENTITY_MISMATCH',
        'Paychex-Profil, Mitarbeiter-ID und Beschäftigung gehören nicht eindeutig zusammen.',
        'providerProfile',
      ));
    }
    const statutory = providerProfile.providerOwnedStatutoryData || {};
    if (statutory.status !== 'COMPLETE_IN_PAYCHEX'
        || !statutory.includesTaxData || !statutory.includesSocialInsuranceData
        || !statutory.includesBankData || !statutory.includesHealthInsuranceData
        || !statutory.verifiedInPaychexAt || !statutory.evidenceHash) {
      errors.push(issue(
        'PAYCHEX_STATUTORY_MASTER_DATA_INCOMPLETE',
        'Steuer-, SV-, Krankenversicherungs- oder Bankdaten sind in Paychex nicht vollständig und evidenzbasiert bestätigt.',
        'providerProfile.providerOwnedStatutoryData',
      ));
    }
  }

  if (!employment) {
    errors.push(issue('PAYROLL_EMPLOYMENT_REQUIRED', 'Für den Abrechnungsmonat fehlt eine freigegebene Beschäftigung.', 'employment'));
  } else {
    if (!employment.tariff?.group) {
      errors.push(issue('ENTGELTGRUPPE_REQUIRED', 'Die GVP-Entgeltgruppe ist unbekannt.', 'employment.tariff.group'));
    }
    if (!employment.tariff?.ruleVersion) {
      errors.push(issue('TARIFF_VERSION_REQUIRED', 'Die verwendete Tarifversion ist nicht referenziert.', 'employment.tariff.ruleVersion'));
    } else if (employment.tariff.ruleVersion?.status && employment.tariff.ruleVersion.status !== 'APPROVED') {
      errors.push(issue('TARIFF_VERSION_NOT_APPROVED', 'Die verwendete Tarifversion ist nicht freigegeben.', 'employment.tariff.ruleVersion.status'));
    } else if (employment.tariff.ruleVersion?.entgeltgruppen) {
      const group = String(employment.tariff?.group || '').toUpperCase();
      const approvedGroup = employment.tariff.ruleVersion.entgeltgruppen.find((entry) => (
        String(entry.code || '').toUpperCase() === group
      ));
      if (!approvedGroup || !Number.isInteger(approvedGroup.hourlyRateCents)) {
        errors.push(issue(
          'ENTGELTGRUPPE_RATE_REQUIRED',
          'Die Beschäftigungs-Entgeltgruppe ist in der freigegebenen Tarifversion nicht enthalten.',
          'employment.tariff.group',
          { group },
        ));
      } else if (employment.baseHourlyRateCents !== approvedGroup.hourlyRateCents) {
        errors.push(issue(
          'EMPLOYMENT_TARIFF_RATE_MISMATCH',
          'Der Beschäftigungs-Basisstundenlohn entspricht nicht der freigegebenen Tarifversion.',
          'employment.baseHourlyRateCents',
          {
            group,
            expectedRateCents: approvedGroup.hourlyRateCents,
            actualRateCents: employment.baseHourlyRateCents,
          },
        ));
      }
    }
    if (!Number.isFinite(decimalNumber(employment.monthlyTargetHours))) {
      errors.push(issue('MONTHLY_TARGET_HOURS_REQUIRED', 'Vertragliche Monats-Sollstunden fehlen.', 'employment.monthlyTargetHours'));
    }
    if (employment.status !== 'active' || !employment.approvedAt || !employment.approvedBy) {
      errors.push(issue('EMPLOYMENT_NOT_APPROVED', 'Die Beschäftigung ist nicht wirksam freigegeben.', 'employment.status'));
    }
    if (!employment.tariff?.transitionRule || employment.tariff.transitionRule === 'unknown') {
      errors.push(issue('TARIFF_TRANSITION_UNRESOLVED', 'Der GVP/iGZ/BAP-Übergangsstatus des Vertrags ist ungeklärt.', 'employment.tariff.transitionRule'));
    }
    if (employment.contractEvidence?.collectiveAgreementIncorporated !== true
        || !employment.contractEvidence?.signatureHash || !employment.contractEvidence?.evidenceHash) {
      errors.push(issue('TARIFF_INCORPORATION_EVIDENCE_REQUIRED', 'Die wirksame Einbeziehung des Tarifwerks ist nicht belegt.', 'employment.contractEvidence'));
    }
    if (!employment.experiencePolicy?.policy?.policyId
        || !employment.experiencePolicy?.evidenceHash
        || !employment.experiencePolicy?.approvedAt
        || !employment.experiencePolicy?.approvedBy) {
      errors.push(issue('EXPERIENCE_POLICY_REQUIRED', 'Die Auslegung des Erfahrungszuschlags ist nicht freigegeben.', 'employment.experiencePolicy'));
    }
  }

  const assignmentsById = new Map(assignments.map((entry) => [String(valueOfRef(entry)), entry]));
  if (workingTimes.length && !assignments.length) {
    errors.push(issue('ASSIGNMENT_LEDGER_REQUIRED', 'Arbeitszeiten sind keinem unveränderbaren Einsatzverlauf zugeordnet.', 'assignments'));
  }

  for (const time of workingTimes) {
    if (!VALID_PAYROLL_STATUSES.has(time.status)) {
      errors.push(issue(
        'WORKING_TIME_NOT_APPROVED',
        'Nur freigegebene oder bereits gesperrte Ist-Zeit darf abgerechnet werden.',
        'workingTimes.status',
        { workingTimeId: valueOfRef(time) },
      ));
    }
    if (!time.actual?.start || !time.actual?.end || time.actual?.workedHours == null || time.actual?.breakMinutes == null) {
      errors.push(issue(
        'ACTUAL_TIME_INCOMPLETE',
        'Ist-Zeit benötigt Beginn, Ende, Pause und berechnete Arbeitsstunden.',
        'workingTimes.actual',
        { workingTimeId: valueOfRef(time) },
      ));
    }
    const assignmentId = String(valueOfRef(time.assignmentLedger) || '');
    if (!assignmentId || !assignmentsById.has(assignmentId)) {
      errors.push(issue(
        'WORKING_TIME_ASSIGNMENT_MISSING',
        'Die Ist-Zeit verweist nicht auf einen Einsatz im Abrechnungssnapshot.',
        'workingTimes.assignmentLedger',
        { workingTimeId: valueOfRef(time) },
      ));
    } else {
      const assignment = assignmentsById.get(assignmentId);
      if (!time.capture?.siteKey || time.capture.siteKey !== assignment.siteKey) {
        errors.push(issue(
          'WORKING_TIME_SITE_MISMATCH',
          'Die Ist-Zeit muss den unveränderbaren Standortschlüssel des Einsatzes enthalten.',
          'workingTimes.capture.siteKey',
          {
            workingTimeId: valueOfRef(time),
            expectedSiteKey: assignment.siteKey || null,
            actualSiteKey: time.capture?.siteKey || null,
          },
        ));
      }
      if (!time.timeZone || time.timeZone !== assignment.workLocation?.timeZone) {
        errors.push(issue(
          'WORKING_TIME_TIMEZONE_MISMATCH',
          'Die Ist-Zeit und der Einsatz müssen dieselbe geprüfte IANA-Zeitzone verwenden.',
          'workingTimes.timeZone',
          {
            workingTimeId: valueOfRef(time),
            expectedTimeZone: assignment.workLocation?.timeZone || null,
            actualTimeZone: time.timeZone || null,
          },
        ));
      }
    }
  }

  for (const absence of absences) {
    if (!VALID_PAYROLL_STATUSES.has(absence.status)) {
      errors.push(issue(
        'ABSENCE_NOT_APPROVED',
        'Abwesenheiten müssen vor der Abrechnung freigegeben sein.',
        'absences.status',
        { absenceId: valueOfRef(absence) },
      ));
    }
    if (!absence.absenceType || absence.payrollHours == null || !absence.payTreatment || absence.payTreatment === 'UNKNOWN') {
      errors.push(issue(
        'ABSENCE_TREATMENT_REQUIRED',
        'Abwesenheitsgrund oder anzurechnende Stunden sind ungeklärt.',
        'absences.payrollHours',
        { absenceId: valueOfRef(absence) },
      ));
    }
    if (!absence.azkCreditTreatment || absence.azkCreditTreatment === 'UNKNOWN') {
      errors.push(issue(
        'ABSENCE_AZK_TREATMENT_REQUIRED',
        'Die AZK-Anrechnung der Abwesenheit ist nicht ausdrücklich freigegeben.',
        'absences.azkCreditTreatment',
        { absenceId: valueOfRef(absence) },
      ));
    }
    if (!absence.paychexAbsenceType || !absence.paychexStatus) {
      errors.push(issue(
        'PAYCHEX_ABSENCE_MAPPING_REQUIRED',
        'Abwesenheitsgrund und Provider-Status müssen als freigegebene Paychex-Werte vorliegen.',
        'absences.paychexAbsenceType',
        { absenceId: valueOfRef(absence) },
      ));
    }
    if (!absence.evidenceRefs?.length && ['SICKNESS', 'SPECIAL_LEAVE'].includes(absence.absenceType)) {
      warnings.push(issue(
        'ABSENCE_EVIDENCE_MISSING',
        'Für die Abwesenheit ist kein Evidenzverweis hinterlegt.',
        'absences.evidenceRefs',
        { absenceId: valueOfRef(absence) },
        'WARNING',
      ));
    }
  }

  for (const adjustment of adjustments) {
    if (!VALID_PAYROLL_STATUSES.has(adjustment.status)) {
      errors.push(issue(
        'PAYROLL_ADJUSTMENT_NOT_APPROVED',
        'Manuelle Entgeltanpassungen müssen im Vier-Augen-Prinzip freigegeben sein.',
        'adjustments.status',
        { adjustmentId: valueOfRef(adjustment) },
      ));
    }
    if (!Number.isInteger(adjustment.amountCents) || !adjustment.adjustmentType
        || !adjustment.mappingKey || !adjustment.evidenceRefs?.length
        || !adjustment.evidenceHash || !adjustment.clause || !adjustment.ruleVersion) {
      errors.push(issue(
        'PAYROLL_ADJUSTMENT_EVIDENCE_REQUIRED',
        'Entgeltanpassungen benötigen Betrag, Mapping, Regel, Klausel und unveränderbare Evidenz.',
        'adjustments',
        { adjustmentId: valueOfRef(adjustment) },
      ));
    }
  }

  const rulesById = new Map(customerRules.map((entry) => [String(valueOfRef(entry)), entry]));
  for (const assignment of assignments) {
    const rule = rulesById.get(String(valueOfRef(assignment.customerPayrollRule) || ''));
    if (!rule || String(valueOfRef(rule.kunde)) !== String(valueOfRef(assignment.kunde))
        || rule.siteKey !== assignment.siteKey) {
      errors.push(issue(
        'CUSTOMER_PAYROLL_RULE_REQUIRED',
        'Für den konkreten Einsatzort fehlt eine eindeutig verknüpfte Standort-/Premiumerklärung.',
        'assignments.customerPayrollRule',
        { assignmentId: valueOfRef(assignment), customerPayrollRuleId: valueOfRef(assignment.customerPayrollRule) },
      ));
    }
  }

  for (const rule of customerRules) {
    if (rule.status !== 'active' || !rule.approvedAt || !rule.approvedBy) {
      errors.push(issue(
        'CUSTOMER_PAYROLL_RULE_NOT_APPROVED',
        'Eine Kundenregel ist nicht im Vier-Augen-Prinzip freigegeben.',
        'customerRules.status',
        { customerPayrollRuleId: valueOfRef(rule) },
      ));
    }
    if (rule.source === 'import'
        && rule.declarationEvidence?.signatureVerificationMode !== 'CRYPTOGRAPHICALLY_VERIFIED') {
      errors.push(issue(
        'DECLARATION_SIGNATURE_AUTHENTICITY_REQUIRED',
        'Die importierte Standortdeklaration ist nur hashgleich, aber nicht kryptografisch als echte Signatur verifiziert.',
        'customerRules.declarationEvidence.signatureVerificationMode',
        { customerPayrollRuleId: valueOfRef(rule) },
      ));
    }
    if (!rule.industryCode) {
      errors.push(issue('OPERATIONAL_SECTOR_REQUIRED', 'Der operative Sektor ist unbekannt.', 'customerRules.industryCode'));
    }
    if (rule.industrySurchargeTariffCode == null) {
      errors.push(issue(
        'INDUSTRY_SURCHARGE_DECISION_REQUIRED',
        'Branchenzuschlag muss ausdrücklich als NONE oder als verifizierter Tarif festgelegt sein.',
        'customerRules.industrySurchargeTariffCode',
      ));
    }
    if (!rule.premiumOverrides?.decision || rule.premiumOverrides.decision === 'UNKNOWN') {
      errors.push(issue(
        'CUSTOMER_PREMIUM_DECISION_REQUIRED',
        'Nacht-, Sonntag- und Feiertagsregeln müssen ausdrücklich erklärt sein.',
        'customerRules.premiumOverrides.decision',
      ));
    }
    if (!rule.holidayFederalState) {
      errors.push(issue('HOLIDAY_JURISDICTION_REQUIRED', 'Das Bundesland des Einsatzorts fehlt.', 'customerRules.holidayFederalState'));
    }
    if (!rule.siteKey || !rule.siteDeclaration?.signatureHash || !rule.siteDeclaration?.evidenceHash) {
      errors.push(issue(
        'SITE_DECLARATION_REQUIRED',
        'Einsatzort, Unterzeichner und unveränderbare Standort-Evidenz fehlen.',
        'customerRules.siteDeclaration',
        { customerPayrollRuleId: valueOfRef(rule) },
      ));
    }
    if (!rule.holidayCalendar?.calendarId || !Array.isArray(rule.holidayCalendar?.dates)
        || !rule.holidayCalendar?.evidenceHash) {
      errors.push(issue(
        'HOLIDAY_CALENDAR_REQUIRED',
        'Ein versionierter Feiertagskalender für den Einsatzort fehlt.',
        'customerRules.holidayCalendar',
        { customerPayrollRuleId: valueOfRef(rule) },
      ));
    }
    if (rule.equalPay?.status === 'pending' || rule.equalPay?.status === 'expired') {
      errors.push(issue(
        'EQUAL_PAY_COMPARATOR_REQUIRED',
        'Equal-Pay-Vergleichsentgelt ist ungeprüft oder abgelaufen.',
        'customerRules.equalPay',
        { customerPayrollRuleId: valueOfRef(rule) },
      ));
    }
    if (rule.equalPay?.status === 'verified'
        && (rule.equalPay?.comparisonMonthlyAmountCents != null || rule.equalPay?.regularComponents?.length)) {
      errors.push(issue(
        'EQUAL_PAY_PACKAGE_ENGINE_REQUIRED',
        'Das verifizierte Vergleichspaket enthält Monats- oder regelmäßige Zusatzbestandteile, die noch nicht vollständig in die Equal-Pay-Berechnung einbezogen werden.',
        'customerRules.equalPay',
        { customerPayrollRuleId: valueOfRef(rule) },
      ));
    }
  }

  for (const assignment of assignments) {
    if (!['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(assignment.status)) {
      errors.push(issue(
        'ASSIGNMENT_NOT_CONFIRMED',
        'Der Einsatz ist nicht abrechnungswirksam bestätigt.',
        'assignments.status',
        { assignmentId: valueOfRef(assignment) },
      ));
    }
    if (assignment.source === 'import'
        && assignment.declarationEvidence?.signatureVerificationMode !== 'CRYPTOGRAPHICALLY_VERIFIED') {
      errors.push(issue(
        'DECLARATION_SIGNATURE_AUTHENTICITY_REQUIRED',
        'Die importierte Einsatzdeklaration ist nur hashgleich, aber nicht kryptografisch als echte Signatur verifiziert.',
        'assignments.declarationEvidence.signatureVerificationMode',
        { assignmentId: valueOfRef(assignment) },
      ));
    }
    if (!assignment.employeeTariffDecision?.entgeltgruppe
        || !assignment.employeeTariffDecision?.reviewedAt
        || !assignment.employeeTariffDecision?.reviewedBy) {
      errors.push(issue(
        'ASSIGNMENT_TARIFF_DECISION_REQUIRED',
        'Tätigkeitsprofil und Entgeltgruppenentscheidung des Einsatzes fehlen.',
        'assignments.employeeTariffDecision',
        { assignmentId: valueOfRef(assignment) },
      ));
    }
    if (assignment.continuityEvidence?.historyCompleteness === 'UNKNOWN'
        || !assignment.continuityEvidence?.reviewedAt
        || !assignment.continuityEvidence?.reviewedBy) {
      errors.push(issue(
        'ASSIGNMENT_HISTORY_INCOMPLETE',
        'Die Einsatzhistorie einschließlich anderer Verleiher ist nicht vollständig bestätigt.',
        'assignments.continuityEvidence',
        { assignmentId: valueOfRef(assignment) },
      ));
    }
    const priorWithoutCustomerId = (assignment.continuityEvidence?.priorAssignments || [])
      .some((entry) => !String(entry.customerIdentifier || '').trim());
    if (priorWithoutCustomerId) {
      errors.push(issue(
        'PRIOR_ASSIGNMENT_CUSTOMER_ID_REQUIRED',
        'Frühere Überlassungen benötigen eine stabile Kundenkennung; sie dürfen nicht pauschal dem aktuellen Kunden zugerechnet werden.',
        'assignments.continuityEvidence.priorAssignments.customerIdentifier',
        { assignmentId: valueOfRef(assignment) },
      ));
    }
  }

  const openingBalance = azk.some((entry) => (
    entry.movementType === 'OPENING_BALANCE'
    && entry.policyContext?.openingBalanceAsserted === true
    && entry.policyContext?.openingBalanceEvidenceHash
  ));
  if (!openingBalance) {
    errors.push(issue(
      'AZK_OPENING_BALANCE_REQUIRED',
      'Ein bestätigter AZK-Eröffnungssaldo fehlt.',
      'azk',
    ));
  }
  if (!azkDisposition) {
    errors.push(issue(
      'AZK_DISPOSITION_REQUIRED',
      'Für den Abrechnungsmonat fehlt die ausdrücklich freigegebene AZK-Disposition, einschließlich NONE.',
      'azkDisposition',
    ));
  } else {
    if (!VALID_PAYROLL_STATUSES.has(azkDisposition.status)) {
      errors.push(issue(
        'AZK_DISPOSITION_NOT_APPROVED',
        'Die monatliche AZK-Disposition muss im Vier-Augen-Prinzip freigegeben sein.',
        'azkDisposition.status',
        { dispositionId: valueOfRef(azkDisposition) },
      ));
    }
    if (!azkDisposition.kind || !azkDisposition.evidenceRefs?.length
        || !azkDisposition.evidenceHash || !azkDisposition.reason
        || !azkDisposition.createdBy || !azkDisposition.approvedBy
        || String(valueOfRef(azkDisposition.createdBy)) === String(valueOfRef(azkDisposition.approvedBy))) {
      errors.push(issue(
        'AZK_DISPOSITION_EVIDENCE_REQUIRED',
        'AZK-Disposition benötigt Art, Grund, unveränderbare Evidenz und unterschiedliche Erfassungs-/Freigabebenutzer.',
        'azkDisposition',
        { dispositionId: valueOfRef(azkDisposition) },
      ));
    }
  }

  const latestAzkPolicy = [...azk].reverse().find((entry) => entry.balanceAfterHours != null)?.policyContext;
  if (latestAzkPolicy) {
    const numerator = latestAzkPolicy.partTimeNumerator;
    const denominator = latestAzkPolicy.partTimeDenominator;
    const fullTimeCap = latestAzkPolicy.capType === 'SEASONAL' ? 230 : 200;
    const expectedCap = Number.isInteger(numerator) && Number.isInteger(denominator) && denominator > 0
      ? Math.round((fullTimeCap * 6000 * numerator) / denominator) / 6000
      : null;
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)
        || numerator <= 0 || denominator <= 0 || numerator > denominator) {
      errors.push(issue(
        'AZK_PART_TIME_POLICY_REQUIRED',
        'Der geprüfte AZK-Policy-Kontext benötigt das anwendbare Teilzeitverhältnis.',
        'azk.policyContext.partTimeNumerator',
      ));
    } else if (latestAzkPolicy.applicableCapHours == null
        || Math.abs(decimalNumber(latestAzkPolicy.applicableCapHours) - expectedCap) > (0.5 / 6000)) {
      errors.push(issue(
        'AZK_APPLICABLE_CAP_MISMATCH',
        'Der freigegebene AZK-Cap entspricht nicht Teilzeitverhältnis und saisonaler Freigabe.',
        'azk.policyContext.applicableCapHours',
        { expectedCapHours: expectedCap, actualCapHours: decimalNumber(latestAzkPolicy.applicableCapHours) },
      ));
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}

function validateSnapshot(snapshot, mapping) {
  const errors = [...(snapshot.issues || []).filter((entry) => entry.blocking)];
  const warnings = [...(snapshot.issues || []).filter((entry) => !entry.blocking)];
  const mappings = Object.fromEntries(
    componentMappingEntries(mapping).map((entry) => [entry.componentKey, entry]),
  );

  if (!snapshot.employeeIdentity?.personalNr) {
    errors.push(issue('PERSONAL_NUMBER_REQUIRED', 'Eine eindeutige Personalnummer fehlt.', 'employeeIdentity.personalNr'));
  }
  if (!snapshot.employeeIdentity?.paychexEmployeeUid) {
    errors.push(issue('PAYCHEX_EMPLOYEE_ID_REQUIRED', 'Die Paychex Employee UID fehlt.', 'employeeIdentity.paychexEmployeeUid'));
  }
  if (!snapshot.components?.length) {
    errors.push(issue('PAYROLL_COMPONENTS_REQUIRED', 'Es wurden keine Lohnarten berechnet.', 'components'));
  }

  for (const component of snapshot.components || []) {
    if (!Number.isInteger(component.amountCents)) {
      errors.push(issue(
        'COMPONENT_AMOUNT_INVALID',
        'Der erwartete Lohnartenbetrag muss in ganzen Cent vorliegen.',
        'components.amountCents',
        { componentKey: component.componentKey },
      ));
    }
    if (!component.sourceRefs?.length) {
      errors.push(issue(
        'COMPONENT_TRACE_MISSING',
        'Die Lohnart verweist auf keine Quellfakten oder Regelquelle.',
        'components.sourceRefs',
        { componentKey: component.componentKey },
      ));
    }
    if (['AZK_ACCRUAL', 'AZK_WITHDRAWAL'].includes(component.type)
        || component.componentKey === 'AZK_MOVEMENT') continue;
    if (!READY_COMPONENT_TYPES.has(component.type)) {
      errors.push(issue('COMPONENT_TYPE_UNSUPPORTED', 'Die berechnete Lohnart ist nicht exportfähig.', 'components.type', { type: component.type }));
      continue;
    }
    const key = componentMappingKey(component);
    const providerMapping = mappings[key];
    if (!providerMapping?.companySalaryComponentUid && !providerMapping?.salaryComponentUid) {
      errors.push(issue(
        'PAYCHEX_WAGE_TYPE_MAPPING_REQUIRED',
        'Für eine interne Lohnart fehlt die freigegebene Paychex-Zuordnung.',
        'components.mappingKey',
        { mappingKey: key },
      ));
      continue;
    }
    try {
      buildProviderSalaryComponent({
        component,
        mappingEntry: providerMapping,
        month: snapshot.month,
      });
    } catch (error) {
      errors.push(issue(
        error.code || 'PAYCHEX_PAYLOAD_PREFLIGHT_FAILED',
        error.message || 'Die Paychex-Payload konnte nicht sicher erzeugt werden.',
        'components.mappingKey',
        {
          mappingKey: key,
          ...(error.details || {}),
        },
      ));
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}

function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
    throw Object.assign(new Error('Monat muss im Format YYYY-MM angegeben werden.'), {
      statusCode: 400,
      code: 'PAYROLL_MONTH_INVALID',
    });
  }
  const [year, value] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, value - 1, 1)),
    endExclusive: new Date(Date.UTC(year, value, 1)),
  };
}

module.exports = {
  validateInput,
  validateSnapshot,
  monthRange,
  overlapsMonth,
  issue,
};
