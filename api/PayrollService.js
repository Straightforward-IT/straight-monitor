'use strict';

const mongoose = require('mongoose');
const Mitarbeiter = require('./models/Mitarbeiter');
const PayrollEmployment = require('./models/PayrollEmployment');
const CustomerPayrollRule = require('./models/CustomerPayrollRule');
const AssignmentLedger = require('./models/EinsatzBuch');
const WorkingTimeLedger = require('./models/ArbeitszeitBuch');
const AbsenceLedger = require('./models/AbwesenheitsBuch');
const AZKLedger = require('./models/AZKBuch');
const PayrollAzkDisposition = require('./models/PayrollAzkDisposition');
const PayrollAdjustmentLedger = require('./models/PayrollAdjustmentLedger');
const TariffVersion = require('./models/TariffVersion');
const PayrollRun = require('./models/PayrollRun');
const PayrollEmployeeSnapshot = require('./models/PayrollEmployeeSnapshot');
const PayrollProviderProfile = require('./models/PayrollProviderProfile');
const PayrollProviderMapping = require('./models/PayrollProviderMapping');
const PayrollAuditLog = require('./models/PayrollAuditLog');
const PaychexService = require('./PaychexService');
const PayrollProviderOperationService = require('./PayrollProviderOperationService');
const PayrollProviderProfileService = require('./PayrollProviderProfileService');
const PayrollReferenceMonthService = require('./PayrollReferenceMonthService');
const {
  inputSourceHash,
  componentPayloadHash,
  snapshotContentHash,
  verifySnapshotIntegrity,
} = require('./PayrollSnapshotIntegrity');
const {
  findComponentMapping,
  buildProviderSalaryComponent,
} = require('./PayrollProviderPayload');
const PayrollError = require('./utils/PayrollError');
const logger = require('./utils/logger');
const { validateInput, validateSnapshot, monthRange } = require('./PayrollValidationService');
const {
  CALCULATION_VERSION,
  calculateTargetBaseWage,
  calculateExperienceSupplement,
  segmentPremiumTime,
  allocateOvertimePremiumIntervals,
  calculateOvertimePremium,
  evaluateEqualPayContinuity,
  calculateAzk,
  calculateGvpAbsenceAverage,
  selectTariffRate,
  allocateWorkingTimeToPayrollMonth,
  allocateApprovedAbsenceToPayrollMonth,
} = require('./payroll-core');
const { normalize, sha256 } = require('./payroll-core/hash');
const { hourlyRateTimesMinutesAndBps, roundRational } = require('./payroll-core/rounding');

const GROSS_COMPONENT_TYPES = new Set([
  'BASE_WAGE', 'EXPERIENCE_BONUS', 'INDUSTRY_SURCHARGE', 'EQUAL_PAY_ADJUSTMENT',
  'NIGHT_PREMIUM', 'SUNDAY_PREMIUM', 'HOLIDAY_PREMIUM', 'OVERTIME_PREMIUM',
  'AZK_PAYOUT', 'VACATION_PAY', 'SICK_PAY', 'SHORT_TIME', 'CORRECTION', 'OTHER',
  'TEMP_HIGHER_GRADE_DIFFERENTIAL', 'TRAVEL_TIME', 'SPECIAL_PAYMENT',
]);

const COHORT_SELECTION_POLICY = 'MONTH_EFFECTIVE_EMPLOYEE_V1';

const idOf = (value) => value?._id || value || null;
const idString = (value) => idOf(value)?.toString?.() || String(idOf(value) || '');
const decimalNumber = (value) => value == null ? null : Number(value.toString());
const hoursToHundredths = (value) => Math.round(decimalNumber(value) * 100);
const hoursToMinutes = (value) => Math.round(decimalNumber(value) * 60);
const hoursToMinuteHundredths = (value) => Math.round(decimalNumber(value) * 6000);
const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);
const asPlain = (document) => normalize(document?.toObject ? document.toObject({ depopulate: true }) : document);

function actorId(actor) {
  return actor?._id || actor?.id || actor || null;
}

function assertObjectId(value, field = 'id') {
  if (!mongoose.isValidObjectId(value)) {
    throw new PayrollError('PAYROLL_ID_INVALID', `${field} ist ungültig.`, 400);
  }
}

function assertRunState(run, allowed, action) {
  if (!allowed.includes(run.status)) {
    throw new PayrollError(
      'PAYROLL_RUN_STATE_INVALID',
      `${action} ist im Status ${run.status} nicht zulässig.`,
      409,
      { currentStatus: run.status, allowedStatuses: allowed },
    );
  }
}

function buildGrossReconciliation({ snapshots, input = {}, reviewer, synchronizer, reviewedAt = new Date() }) {
  const reviewerId = actorId(reviewer);
  const synchronizerId = actorId(synchronizer);
  if (!reviewerId || !mongoose.isValidObjectId(reviewerId)) {
    throw new PayrollError('PAYROLL_RECONCILIATION_REVIEWER_REQUIRED', 'Der Bruttoabgleich benötigt einen authentifizierten Prüfer.', 400);
  }
  if (!synchronizerId || !mongoose.isValidObjectId(synchronizerId)) {
    throw new PayrollError(
      'PAYROLL_SYNC_ACTOR_MISSING',
      'Der verantwortliche Paychex-Synchronisierer ist nicht revisionssicher gespeichert; der Lauf darf nicht abgeschlossen werden.',
      409,
    );
  }
  if (idString(reviewerId) === idString(synchronizerId)) {
    throw new PayrollError(
      'PAYROLL_RECONCILIATION_FOUR_EYES_REQUIRED',
      'Paychex-Synchronisation und Bruttoabgleich müssen von unterschiedlichen Payroll-Benutzern durchgeführt werden.',
      409,
    );
  }
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new PayrollError('PAYROLL_RECONCILIATION_COVERAGE_EMPTY', 'Für den Bruttoabgleich fehlen aktuelle Mitarbeiter-Snapshots.', 409);
  }
  if (snapshots.some((snapshot) => !['SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(snapshot.status))) {
    throw new PayrollError('PAYROLL_RECONCILIATION_SNAPSHOT_STATE_INVALID', 'Alle Mitarbeiter müssen vollständig zu Paychex synchronisiert sein.', 409);
  }

  const providerGrossCents = input.providerGrossCents;
  if (!Number.isSafeInteger(providerGrossCents)) {
    throw new PayrollError(
      'PAYROLL_PROVIDER_GROSS_INVALID',
      'providerGrossCents muss als sicherer ganzzahliger Cent-Betrag übergeben werden.',
      400,
    );
  }
  const expectedGrossCents = snapshots.reduce((total, snapshot) => {
    const amount = snapshot?.totals?.expectedGrossCents;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(total + amount)) {
      throw new PayrollError('PAYROLL_EXPECTED_GROSS_INVALID', 'Der erwartete Bruttobetrag ist nicht als sicherer Cent-Betrag gespeichert.', 409);
    }
    return total + amount;
  }, 0);
  const differenceCents = providerGrossCents - expectedGrossCents;
  if (!Number.isSafeInteger(differenceCents)) {
    throw new PayrollError('PAYROLL_GROSS_DIFFERENCE_INVALID', 'Die Bruttodifferenz überschreitet den sicheren Cent-Bereich.', 409);
  }

  const providerFinalizationReference = String(input.providerFinalizationReference || '').trim();
  const reason = String(input.reason || '').trim();
  const evidenceHash = String(input.evidenceHash || '').trim().toLowerCase();
  const evidenceRefs = Array.isArray(input.evidenceRefs)
    ? [...new Set(input.evidenceRefs.map((value) => String(value || '').trim()).filter(Boolean))]
    : [];
  if (!providerFinalizationReference || providerFinalizationReference.length > 500) {
    throw new PayrollError('PAYROLL_FINALIZATION_REFERENCE_REQUIRED', 'Der Bruttoabgleich benötigt eine Paychex-Finalisierungsreferenz.', 400);
  }
  if (!reason || reason.length > 2000) {
    throw new PayrollError('PAYROLL_RECONCILIATION_REASON_REQUIRED', 'Der Bruttoabgleich benötigt einen dokumentierten Prüfgrund.', 400);
  }
  if (evidenceRefs.length === 0 || evidenceRefs.length > 20 || evidenceRefs.some((value) => value.length > 1000)) {
    throw new PayrollError('PAYROLL_RECONCILIATION_EVIDENCE_REQUIRED', 'Der Bruttoabgleich benötigt ein bis zwanzig gültige Evidenzverweise.', 400);
  }
  if (!/^[a-f0-9]{64}$/.test(evidenceHash)) {
    throw new PayrollError('PAYROLL_RECONCILIATION_HASH_INVALID', 'Der Evidenz-Hash muss ein SHA-256-Wert mit 64 Hex-Zeichen sein.', 400);
  }

  return {
    status: differenceCents === 0 ? 'PASSED' : 'FAILED',
    expectedGrossCents,
    providerGrossCents,
    differenceCents,
    providerFinalizationReference,
    evidenceRefs,
    evidenceHash,
    reviewedBy: reviewerId,
    reviewedAt,
    reason,
  };
}

function appendStatus(run, nextStatus, actor, reason) {
  const previousStatus = run.status;
  if (previousStatus === nextStatus) return previousStatus;
  run.statusHistory.push({
    from: previousStatus,
    to: nextStatus,
    at: new Date(),
    by: actorId(actor),
    reason,
  });
  run.status = nextStatus;
  return previousStatus;
}

async function guardedRunFinalTransition({
  run,
  expectedStatus,
  targetStatus,
  actor,
  reason,
  at = new Date(),
  finalFields = {},
  revisionSafeFields = {},
}) {
  const transitioned = await PayrollRun.findOneAndUpdate(
    { _id: run._id, status: expectedStatus },
    {
      $set: { ...finalFields, status: targetStatus },
      $push: {
        statusHistory: {
          from: expectedStatus,
          to: targetStatus,
          at,
          by: actorId(actor),
          reason,
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!transitioned) {
    const revisionRequired = await PayrollRun.findOneAndUpdate(
      { _id: run._id, status: 'REVISION_REQUIRED' },
      { $set: revisionSafeFields },
      { new: true, runValidators: true },
    );
    if (revisionRequired) return { run: revisionRequired, revisionRequired: true };
    throw new PayrollError(
      'PAYROLL_RUN_CONCURRENT_STATE_CHANGE',
      `Der Payroll-Lauf wurde während ${reason} parallel in einen unerwarteten Status versetzt.`,
      409,
    );
  }

  // Re-read after the compare-and-set. If an input revision wins immediately
  // after our transition, callers must observe REVISION_REQUIRED rather than a
  // stale ready/calculated document.
  const persisted = await PayrollRun.findById(run._id);
  const current = persisted || transitioned;
  return { run: current, revisionRequired: current.status === 'REVISION_REQUIRED' };
}

async function audit({ actor, run, snapshot = null, employee = null, action, outcome = 'SUCCEEDED', previousStatus = null, newStatus = null, payloadHash = null, inputHash = null, providerRef = null, error = null, reasonCode = null, summary = null, safeMetadata = {} }) {
  try {
    await PayrollAuditLog.create({
      actor: {
        user: actorId(actor),
        actorType: actor ? 'USER' : 'SYSTEM',
        displayId: actor?.email || actor?.name || null,
      },
      payrollRun: idOf(run),
      payrollEmployeeSnapshot: idOf(snapshot),
      mitarbeiter: idOf(employee),
      action,
      outcome,
      previousStatus,
      newStatus,
      payloadHash,
      inputHash,
      providerRef,
      errorCode: error?.code || null,
      errorMessage: error ? String(error.message || error).slice(0, 2000) : null,
      reasonCode,
      summary,
      safeMetadata,
    });
  } catch (auditError) {
    logger.error('Payroll audit append failed', {
      action,
      runId: idString(run),
      code: auditError.code || 'AUDIT_WRITE_FAILED',
    });
    if (!error) throw auditError;
  }
}

function monthEffectiveEmployeeQuery(month, scope = {}) {
  const range = monthRange(month);
  const query = {
    isBewerberstatus: { $ne: true },
    $and: [
      {
        $or: [
          { eintrittsdatum: null },
          { eintrittsdatum: { $lt: range.endExclusive } },
        ],
      },
      {
        $or: [
          { austrittsdatum: null },
          { austrittsdatum: { $gte: range.start } },
        ],
      },
      {
        // Active employees remain eligible even when legacy master data has no
        // dates. Inactive employees are retained only when their recorded exit
        // overlaps the payroll month, so final payroll cannot silently vanish.
        $or: [
          { isActive: { $ne: false } },
          { austrittsdatum: { $gte: range.start } },
        ],
      },
    ],
  };
  if (scope.employeeIds?.length) query._id = { $in: scope.employeeIds };
  if (scope.locationIds?.length) query.locationV2 = { $in: scope.locationIds };
  return query;
}

function frozenCohortIds(run) {
  return (run.cohort?.employeeIds || []).map(idString).filter(Boolean);
}

function assessCohortCoverage(run, snapshots) {
  const entries = snapshots || [];
  const expectedIds = frozenCohortIds(run);
  const expectedSet = new Set(expectedIds);
  const snapshotIds = entries.map((entry) => idString(entry.mitarbeiter)).filter(Boolean);
  const snapshotSet = new Set(snapshotIds);
  const snapshotCounts = snapshotIds.reduce((counts, employeeId) => {
    counts.set(employeeId, (counts.get(employeeId) || 0) + 1);
    return counts;
  }, new Map());
  const missingEmployeeIds = expectedIds.filter((employeeId) => !snapshotSet.has(employeeId));
  const unexpectedEmployeeIds = [...snapshotSet].filter((employeeId) => !expectedSet.has(employeeId));
  const duplicateEmployeeIds = [...snapshotCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([employeeId]) => employeeId);
  const complete = expectedIds.length > 0
    && expectedIds.length === expectedSet.size
    && entries.length === expectedIds.length
    && missingEmployeeIds.length === 0
    && unexpectedEmployeeIds.length === 0
    && duplicateEmployeeIds.length === 0;
  return {
    complete,
    expectedCount: expectedIds.length,
    snapshotCount: entries.length,
    missingEmployeeIds,
    unexpectedEmployeeIds,
    duplicateEmployeeIds,
  };
}

function coverageState(coverage) {
  return {
    status: coverage.complete ? 'COMPLETE' : 'INCOMPLETE',
    checkedAt: new Date(),
    expectedCount: coverage.expectedCount,
    snapshotCount: coverage.snapshotCount,
    missingEmployeeIds: coverage.missingEmployeeIds,
    unexpectedEmployeeIds: coverage.unexpectedEmployeeIds,
  };
}

function setRunCoverage(run, coverage) {
  run.coverage = coverageState(coverage);
}

function assertCompleteCohortCoverage(run, snapshots) {
  const coverage = assessCohortCoverage(run, snapshots);
  if (!coverage.complete) {
    throw new PayrollError(
      'PAYROLL_COVERAGE_INCOMPLETE',
      'Der eingefrorene Mitarbeiter-Cohort ist nicht exakt durch aktuelle Payroll-Snapshots abgedeckt.',
      409,
      coverage,
    );
  }
  return coverage;
}

function periodQuery(fromField, tillField, range) {
  return {
    [fromField]: { $lt: range.endExclusive },
    $or: [{ [tillField]: null }, { [tillField]: { $gte: range.start } }],
  };
}

function tariffVersionFromEmployment(employment) {
  return employment?.tariff?.ruleVersion?._id
    ? employment.tariff.ruleVersion
    : null;
}

function workedMinutes(workingTimes) {
  return workingTimes.reduce((total, entry) => total + Math.max(
    0,
    Number.isSafeInteger(entry.payrollWorkedMinutes)
      ? entry.payrollWorkedMinutes
      : hoursToMinutes(entry.actual?.workedHours || 0),
  ), 0);
}

function absenceMinutes(absences) {
  return absences.reduce((total, entry) => total + Math.max(0, hoursToMinutes(entry.payrollHours || 0)), 0);
}

function absenceAzkMinutes(absences) {
  return absenceMinutes(absences.filter((entry) => entry.azkCreditTreatment === 'CREDIT'));
}

function exactScaledInteger(value, scale) {
  if (value == null) return null;
  const result = decimalNumber(value) * scale;
  return Number.isSafeInteger(result) ? result : null;
}

function component({ type, key = type, amountCents, quantity = null, unit = 'AMOUNT', rateCents = null, factor = null, percentBasisPoints = null, explanation = {}, sourceRefs = [] }) {
  const normalizedAmount = Number(amountCents || 0);
  const payloadCore = {
    type,
    componentKey: key,
    mappingKey: type,
    quantity,
    unit,
    rateCents,
    factor,
    percentBasisPoints,
    amountCents: normalizedAmount,
    explanation,
    sourceRefs: [...new Set(sourceRefs.filter(Boolean).map(String))],
  };
  return {
    ...payloadCore,
    currency: 'EUR',
    taxable: null,
    socialSecurityRelevant: null,
    payloadHash: componentPayloadHash(payloadCore),
  };
}

function coreIssue(result, fieldPath) {
  return {
    code: result.code || 'PAYROLL_CORE_UNKNOWN',
    severity: 'ERROR',
    blocking: true,
    message: result.message || 'Payroll-Regel konnte nicht eindeutig ausgeführt werden.',
    fieldPath,
    details: result.partial || null,
  };
}

function warningIssues(result, fieldPath) {
  return (result?.warnings || []).map((warning) => ({
    code: warning.code || 'PAYROLL_CORE_WARNING',
    severity: 'WARNING',
    blocking: false,
    message: warning.message || 'Payroll-Hinweis',
    fieldPath,
    details: null,
  }));
}

function assignedCustomerRule(assignment, customerRules) {
  const explicit = idString(assignment.customerPayrollRule);
  if (explicit) return customerRules.find((rule) => idString(rule) === explicit) || null;
  return customerRules.find((rule) => idString(rule.kunde) === idString(assignment.kunde)
    && rule.siteKey === (assignment.siteKey || assignment.workLocation?.siteKey)) || null;
}

function assignmentPeriods(assignments, customerId) {
  const current = assignments
    .filter((entry) => idString(entry.kunde) === customerId && entry.countsTowardEqualPay !== false)
    .map((entry) => ({
      customerId,
      startDate: dateOnly(entry.assignmentFrom),
      endDateExclusive: entry.assignmentTill
        ? dateOnly(new Date(new Date(entry.assignmentTill).getTime() + 24 * 60 * 60 * 1000))
        : null,
    }));
  const previous = assignments
    .filter((entry) => idString(entry.kunde) === customerId)
    .flatMap((entry) => (entry.continuityEvidence?.priorAssignments || []).filter((prior) => {
      const priorCustomerIdentifier = String(prior.customerIdentifier || '');
      return priorCustomerIdentifier === customerId
        || priorCustomerIdentifier === String(entry.kundenNrSnapshot || '');
    }))
    .map((entry) => ({
      customerId,
      startDate: dateOnly(entry.from),
      endDateExclusive: dateOnly(new Date(new Date(entry.till).getTime() + 24 * 60 * 60 * 1000)),
    }));
  return [...current, ...previous];
}

function payableIntervals(startValue, endValue, breaks = []) {
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const normalized = (breaks || []).map((entry) => ({
    start: new Date(entry.startedAt).getTime(),
    end: new Date(entry.endedAt).getTime(),
  })).sort((left, right) => left.start - right.start);
  let cursor = start;
  const intervals = [];
  for (const pause of normalized) {
    if (!Number.isFinite(pause.start) || !Number.isFinite(pause.end)
        || pause.end <= pause.start || pause.start < cursor || pause.end > end) return null;
    if (pause.start > cursor) intervals.push({ start: new Date(cursor).toISOString(), end: new Date(pause.start).toISOString() });
    cursor = pause.end;
  }
  if (cursor < end) intervals.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString() });
  return intervals;
}

function calculateComponents({ run, employee, employment, assignments, workingTimes, absences, azk, azkDisposition = null, adjustments = [], customerRules, referenceMonths = [], referenceMonthIssues = [] }) {
  const issues = [];
  const components = [];
  const asOfDate = `${run.month}-${new Date(Date.UTC(Number(run.month.slice(0, 4)), Number(run.month.slice(5, 7)), 0)).getUTCDate()}`;
  const group = String(employment.tariff.group).replace(/^EG/i, '').toLowerCase();
  const targetHoursHundredths = hoursToHundredths(employment.monthlyTargetHours);
  const actualMinutes = workedMinutes(workingTimes);
  const creditedAbsenceMinutes = absenceAzkMinutes(absences);
  const paychexId = employee.paychex_id || employee.integrations?.paychex?.employeeUid;

  const period = monthRange(run.month);
  const periodLastInstant = new Date(period.endExclusive.getTime() - 1);
  const partialEmploymentMonth = new Date(employment.validFrom) > period.start
    || (employment.validTill && new Date(employment.validTill) < periodLastInstant);
  const targetOverride = (employment.periodTargetOverrides || []).find((entry) => entry.month === run.month);
  let contractualPayableTargetHoursHundredths = targetOverride
    ? hoursToHundredths(targetOverride.payableTargetHours)
    : targetHoursHundredths;
  if (partialEmploymentMonth && !targetOverride) {
    issues.push({
      code: 'PARTIAL_MONTH_TARGET_REQUIRED', severity: 'ERROR', blocking: true,
      message: 'Eintritt/Austritt im Monat benötigt freigegebene abrechenbare Sollstunden; eine Kalenderquotelung wird nicht geraten.',
      fieldPath: 'employment.periodTargetOverrides', details: { month: run.month },
    });
    contractualPayableTargetHoursHundredths = null;
  }
  const replacementOrUnpaidHoursHundredths = absences
    .filter((entry) => ['PAID_REFERENCE_AVERAGE', 'UNPAID'].includes(entry.payTreatment))
    .reduce((sum, entry) => sum + hoursToHundredths(entry.payrollHours || 0), 0);
  const payableTargetHoursHundredths = contractualPayableTargetHoursHundredths == null
    ? null
    : Math.max(0, contractualPayableTargetHoursHundredths - replacementOrUnpaidHoursHundredths);
  const base = payableTargetHoursHundredths == null
    ? { status: 'UNKNOWN', blocking: true, code: 'PARTIAL_MONTH_TARGET_REQUIRED', message: 'Freigegebene Sollstunden für den Teilmonat fehlen.', sourceRefs: [], warnings: [] }
    : calculateTargetBaseWage({
      date: asOfDate,
      entgeltgruppe: group,
      target: { model: 'GVP_FIXED', fullTimeHoursHundredths: targetHoursHundredths },
      payableTargetHoursHundredths,
    });
  if (base.status === 'OK') {
    components.push(component({
      type: 'BASE_WAGE',
      amountCents: base.data.expectedAmountCents,
      quantity: payableTargetHoursHundredths / 100,
      unit: 'HOURS',
      rateCents: base.data.wage.hourlyRateCents,
      explanation: {
        rule: 'GVP target wage', core: base.data, texts: base.explanations,
        absenceReplacementHoursHundredths: replacementOrUnpaidHoursHundredths,
        note: 'PAID_REFERENCE_AVERAGE and UNPAID hours reduce base wage so absence components cannot be paid twice.',
      },
      sourceRefs: [`employment:${idString(employment)}`, `tariff:${idString(employment.tariff.ruleVersion)}`, ...absences.filter((entry) => ['PAID_REFERENCE_AVERAGE', 'UNPAID'].includes(entry.payTreatment)).map((entry) => `absence:${idString(entry)}`), ...base.sourceRefs],
    }));
  } else issues.push(coreIssue(base, 'employment.tariff'));
  issues.push(...warningIssues(base, 'employment.tariff'));

  const experiencePolicy = employment.experiencePolicy?.policy;
  const experienceRateByCustomer = new Map();
  const assignmentsById = new Map(assignments.map((entry) => [idString(entry), entry]));
  const customerMinutes = new Map();
  for (const time of workingTimes) {
    const assignment = assignmentsById.get(idString(time.assignmentLedger));
    const customerId = idString(assignment?.kunde);
    if (!customerId) continue;
    customerMinutes.set(customerId, (customerMinutes.get(customerId) || 0) + workedMinutes([time]));
  }
  for (const [customerId, eligibleMinutes] of customerMinutes) {
    const customerAssignments = assignments.filter((entry) => idString(entry.kunde) === customerId);
    const historyComplete = customerAssignments.every((entry) => (
      entry.continuityEvidence?.historyCompleteness
      && entry.continuityEvidence.historyCompleteness !== 'UNKNOWN'
    ));
    const experience = calculateExperienceSupplement({
      asOfDate,
      entgeltgruppe: group,
      eligibleMinutes,
      employment: { startDate: dateOnly(employment.validFrom), nonCreditedDays: 0 },
      currentCustomerId: customerId,
      assignmentPeriods: assignmentPeriods(assignments, customerId),
      assignmentHistoryComplete: historyComplete,
      policy: experiencePolicy,
    });
    if (experience.status === 'OK') {
      experienceRateByCustomer.set(customerId, experience.data.totalHourlyCents);
      if (experience.data.expectedAmountCents !== 0) {
        components.push(component({
          type: 'EXPERIENCE_BONUS',
          key: `EXPERIENCE_BONUS:${customerId}`,
          amountCents: experience.data.expectedAmountCents,
          quantity: eligibleMinutes / 60,
          unit: 'HOURS',
          rateCents: experience.data.supplementHourlyCents,
          explanation: { rule: experience.data.policyId, core: experience.data, texts: experience.explanations },
          sourceRefs: [`employment:${idString(employment)}`, ...customerAssignments.map((entry) => `assignment:${idString(entry)}`), ...experience.sourceRefs],
        }));
      }
    } else {
      issues.push(coreIssue(experience, `employment.experiencePolicy.${customerId}`));
    }
    issues.push(...warningIssues(experience, `employment.experiencePolicy.${customerId}`));
  }

  const rate = selectTariffRate({ date: asOfDate, entgeltgruppe: group });
  const premiumIntervals = [];
  for (const time of workingTimes) {
    const assignment = assignments.find((entry) => idString(entry) === idString(time.assignmentLedger));
    const rule = assignment && assignedCustomerRule(assignment, customerRules);
    // Period allocation can attach already-clipped/payable intervals. An empty
    // array intentionally means this record contributes no time to this month.
    const intervals = Array.isArray(time.payrollIntervals)
      ? time.payrollIntervals.map((interval) => ({
        start: interval.start,
        end: interval.end,
        sourceRefs: interval.sourceRefs || [],
      }))
      : payableIntervals(time.actual?.start, time.actual?.end, time.actual?.breaks);
    if (!intervals) {
      issues.push({
        code: 'WORKING_TIME_BREAK_INTERVAL_INVALID', severity: 'ERROR', blocking: true,
        message: 'Pausenintervalle sind unvollständig, überlappend oder außerhalb der Ist-Zeit.',
        fieldPath: `workingTimes.${idString(time)}.actual.breaks`, details: null,
      });
      continue;
    }
    for (const interval of intervals) {
      premiumIntervals.push({
        ...interval,
        time,
        assignment,
        rule,
        sourceRefs: [...new Set([
          `working-time:${idString(time)}`,
          assignment ? `assignment:${idString(assignment)}` : null,
          rule ? `customer-rule:${idString(rule)}` : null,
          ...(interval.sourceRefs || []),
        ].filter(Boolean))],
      });
    }
  }

  const premiumWorkedMinutes = premiumIntervals.reduce((sum, interval) => {
    const startMs = Date.parse(interval.start);
    const endMs = Date.parse(interval.end);
    const minutes = (endMs - startMs) / 60000;
    return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum;
  }, 0);
  const vacationMinutes = absences
    .filter((entry) => entry.absenceType === 'VACATION')
    .reduce((sum, entry) => sum + hoursToMinutes(entry.payrollHours || 0), 0);
  const overtime = calculateOvertimePremium({
    policy: employment.overtimeModel === 'legacy_igz_workdays' ? 'LEGACY_IGZ_VARIABLE' : 'GVP_STANDARD',
    targetHoursHundredths,
    workedMinutes: premiumWorkedMinutes,
    vacationMinutes,
    premiumBaseHourlyCents: rate.status === 'OK' ? rate.data.baseHourlyCents : null,
  });
  let overtimeAllocation = null;
  if (overtime.status === 'OK') {
    issues.push(...warningIssues(overtime, 'workingTimes.overtime'));
    overtimeAllocation = allocateOvertimePremiumIntervals({
      workedIntervals: premiumIntervals.map((interval) => ({
        start: interval.start,
        end: interval.end,
        sourceRefs: interval.sourceRefs,
      })),
      premiumMinutes: overtime.data.premiumMinutes,
      premiumBps: overtime.data.premiumBps,
    });
    if (overtimeAllocation.status !== 'OK') {
      issues.push(coreIssue(overtimeAllocation, 'workingTimes.overtime.intervals'));
    } else {
      issues.push(...warningIssues(overtimeAllocation, 'workingTimes.overtime.intervals'));
    }
  } else {
    issues.push(coreIssue(overtime, 'workingTimes.overtime'));
    issues.push(...warningIssues(overtime, 'workingTimes.overtime'));
  }

  const premiumTotals = new Map();
  for (const interval of premiumIntervals) {
    const { time, assignment, rule } = interval;
    const premiumDecision = rule?.premiumOverrides?.decision;
    const overlapPolicy = rule?.premiumOverrides?.overlapPolicy;
    if (!rule || rule.status !== 'active'
        || !['NONE', 'CUSTOMER_RULES'].includes(premiumDecision)
        || overlapPolicy !== 'highest_only') {
      issues.push({
        code: 'CUSTOMER_PREMIUM_RULES_REQUIRED', severity: 'ERROR', blocking: true,
        message: 'Einsatzort und Kunden-Zuschlagsregeln müssen aktiv, ausdrücklich erklärt und auf highest_only freigegeben sein.',
        fieldPath: `workingTimes.${idString(time)}.premium`,
        details: {
          assignmentId: idString(assignment),
          customerRuleId: idString(rule),
          decision: premiumDecision || null,
          overlapPolicy: overlapPolicy || null,
        },
      });
      continue;
    }

    const premium = segmentPremiumTime({
      start: interval.start,
      end: interval.end,
      timeZone: time.timeZone || assignment?.workLocation?.timeZone,
      holidayDates: rule?.holidayCalendar?.dates,
      holidayCalendarId: rule?.holidayCalendar?.calendarId,
      customerPremiums: {
        nightBps: rule?.premiumOverrides?.nightBasisPoints,
        sundayBps: rule?.premiumOverrides?.sundayBasisPoints,
        holidayBps: rule?.premiumOverrides?.holidayBasisPoints,
      },
      premiumBaseHourlyCents: rate.status === 'OK' ? rate.data.baseHourlyCents : null,
      extraPremiums: overtimeAllocation?.status === 'OK'
        ? overtimeAllocation.data.intervals
        : [],
    });
    if (premium.status !== 'OK') {
      issues.push(coreIssue(premium, `workingTimes.${idString(time)}.premium`));
      continue;
    }
    issues.push(...warningIssues(premium, `workingTimes.${idString(time)}.premium`));
    for (const line of premium.data.wageLines) {
      const type = ({
        NIGHT: 'NIGHT_PREMIUM',
        SUNDAY: 'SUNDAY_PREMIUM',
        HOLIDAY: 'HOLIDAY_PREMIUM',
        HOLIDAY_SPECIAL: 'HOLIDAY_PREMIUM',
        OVERTIME: 'OVERTIME_PREMIUM',
      })[line.code] || 'OTHER';
      const key = `${type}:${line.bps}`;
      const aggregate = premiumTotals.get(key) || {
        type, minutes: 0, bps: line.bps, sourceRefs: [], overlapDecisions: [],
      };
      aggregate.minutes += line.minutes;
      aggregate.sourceRefs.push(...interval.sourceRefs, ...(line.sourceRefs || []));
      aggregate.overlapDecisions.push(...(line.overlapDecisions || []).map((decision) => ({
        ...decision,
        interval: { start: interval.start, end: interval.end },
      })));
      premiumTotals.set(key, aggregate);
    }
  }
  for (const [key, premium] of premiumTotals) {
    const amountCents = hourlyRateTimesMinutesAndBps(rate.data.baseHourlyCents, premium.minutes, premium.bps);
    components.push(component({
      type: premium.type,
      key,
      amountCents,
      quantity: premium.minutes / 60,
      unit: 'HOURS',
      rateCents: rate.status === 'OK' ? rate.data.baseHourlyCents : null,
      percentBasisPoints: premium.bps,
      explanation: {
        rule: 'GVP highest-only premium overlap',
        minutes: premium.minutes,
        overlapDecisions: premium.overlapDecisions,
        overtime: overtime.status === 'OK' ? overtime.data : null,
        overtimeAllocation: overtimeAllocation?.status === 'OK' ? overtimeAllocation.data : null,
        rounding: 'Aggregated employee/month wage line, rounded once after minute classification.',
      },
      sourceRefs: [...new Set(premium.sourceRefs)],
    }));
  }

  for (const customerRule of customerRules) {
    const customerId = idString(customerRule.kunde);
    const ruleId = idString(customerRule);
    const relevantAssignments = assignments.filter((entry) => (
      idString(entry.kunde) === customerId && idString(entry.customerPayrollRule) === ruleId
    ));
    if (!relevantAssignments.length) continue;
    if (customerRule.industrySurchargeTariffCode !== 'NONE') {
      issues.push({
        code: 'INDUSTRY_SURCHARGE_ENGINE_CONFIGURATION_REQUIRED', severity: 'ERROR', blocking: true,
        message: `Branchenzuschlag ${customerRule.industrySurchargeTariffCode} ist noch nicht als geprüfte Regel implementiert.`,
        fieldPath: 'customerRules.industrySurchargeTariffCode', details: { customerRuleId: idString(customerRule) },
      });
    }
    const equalPay = evaluateEqualPayContinuity({
      asOfDate,
      customerId,
      assignmentPeriods: assignmentPeriods(assignments, customerId),
      assignmentHistoryComplete: relevantAssignments.every((entry) => (
        entry.continuityEvidence?.historyCompleteness
        && entry.continuityEvidence.historyCompleteness !== 'UNKNOWN'
      )),
      policy: { policyId: 'AUEG_8_NINE_MONTHS_V1', sourceRef: 'AÜG § 8', thresholdMonths: 9, interruptionMonths: 3 },
      comparisonHourlyCents: customerRule.equalPay?.comparisonHourlyRateCents,
      currentRelevantHourlyCents: experienceRateByCustomer.get(customerId)
        || (rate.status === 'OK' ? rate.data.baseHourlyCents : null),
      eligibleMinutes: relevantAssignments.reduce((total, assignment) => total + workingTimes
        .filter((time) => idString(time.assignmentLedger) === idString(assignment))
        .reduce((sum, time) => sum + workedMinutes([time]), 0), 0),
    });
    if (equalPay.status === 'OK' && equalPay.data.expectedAmountCents !== 0) {
      components.push(component({
        type: 'EQUAL_PAY_ADJUSTMENT', key: `EQUAL_PAY_ADJUSTMENT:${ruleId}`,
        amountCents: equalPay.data.expectedAmountCents, quantity: equalPay.data.eligibleMinutes / 60,
        unit: 'HOURS', rateCents: equalPay.data.topUpHourlyCents,
        explanation: { rule: equalPay.data.policyId, core: equalPay.data, texts: equalPay.explanations },
        sourceRefs: [`customer-rule:${idString(customerRule)}`, ...relevantAssignments.map((entry) => `assignment:${idString(entry)}`), ...equalPay.sourceRefs],
      }));
    } else if (equalPay.status !== 'OK') issues.push(coreIssue(equalPay, 'customerRules.equalPay'));
    issues.push(...warningIssues(equalPay, 'customerRules.equalPay'));
  }

  const openingEntry = [...azk].reverse().find((entry) => entry.policyContext?.openingBalanceAsserted);
  const latestEntry = [...azk].reverse().find((entry) => entry.balanceAfterHours != null) || openingEntry;
  const openingMinutesHundredths = latestEntry ? hoursToMinuteHundredths(latestEntry.balanceAfterHours) : null;
  const azkPolicy = latestEntry?.policyContext;
  const requestedMinutesHundredths = azkDisposition?.requestedHours == null
    ? undefined
    : hoursToMinuteHundredths(azkDisposition.requestedHours);
  const payout = azkDisposition ? {
    kind: azkDisposition.kind,
    requestedMinutesHundredths,
    reconciliationDue: azkDisposition.reconciliationDue === true,
  } : null;
  const azkResult = calculateAzk({
    openingBalanceMinutesHundredths: openingMinutesHundredths,
    targetHoursHundredths,
    actualCreditedMinutes: actualMinutes + creditedAbsenceMinutes,
    partTimeNumerator: azkPolicy?.partTimeNumerator,
    partTimeDenominator: azkPolicy?.partTimeDenominator,
    seasonalCapAuthorized: azkPolicy?.capType === 'SEASONAL',
    applicableCapMinutesHundredths: azkPolicy?.applicableCapHours == null
      ? undefined
      : hoursToMinuteHundredths(azkPolicy.applicableCapHours),
    insolvencyProtectionConfirmed: azkPolicy?.insolvencyProtectionStatus === 'PROTECTED',
    payout,
    payoutHourlyRateCents: rate.status === 'OK' ? rate.data.baseHourlyCents : null,
  });
  if (azkResult.status === 'OK') {
    const type = azkResult.data.deltaMinutesHundredths >= 0 ? 'AZK_ACCRUAL' : 'AZK_WITHDRAWAL';
    components.push(component({
      type, key: 'AZK_MOVEMENT', amountCents: 0,
      quantity: Math.abs(azkResult.data.deltaMinutesHundredths) / 6000,
      unit: 'HOURS',
      explanation: {
        rule: 'GVP AZK', core: azkResult.data, texts: azkResult.explanations,
        disposition: azkDisposition ? {
          id: idString(azkDisposition), kind: azkDisposition.kind,
          contentHash: azkDisposition.contentHash,
        } : null,
      },
      sourceRefs: [`azk:${idString(latestEntry)}`, azkDisposition ? `azk-disposition:${idString(azkDisposition)}` : null, ...workingTimes.map((entry) => `working-time:${idString(entry)}`), ...azkResult.sourceRefs].filter(Boolean),
    }));
    if (azkResult.data.payoutMinutesHundredths > 0) {
      components.push(component({
        type: 'AZK_PAYOUT', key: 'AZK_PAYOUT',
        amountCents: azkResult.data.expectedAmountCents,
        quantity: azkResult.data.payoutMinutesHundredths / 6000,
        unit: 'HOURS',
        rateCents: azkResult.data.payoutHourlyRateCents,
        explanation: {
          rule: 'GVP AZK payout calculated from approved monthly disposition',
          core: azkResult.data,
          disposition: {
            id: idString(azkDisposition), kind: azkDisposition.kind,
            contentHash: azkDisposition.contentHash,
            evidenceHash: azkDisposition.evidenceHash,
          },
        },
        sourceRefs: [
          `azk:${idString(latestEntry)}`,
          `azk-disposition:${idString(azkDisposition)}`,
          ...(azkDisposition.evidenceRefs || []).map((entry) => `evidence:${entry}`),
          ...azkResult.sourceRefs,
        ],
      }));
    }
  } else issues.push(coreIssue(azkResult, 'azk'));
  issues.push(...warningIssues(azkResult, 'azk'));

  const averageAbsences = absences.filter((entry) => ['VACATION', 'SICKNESS'].includes(entry.absenceType)
    && entry.payTreatment === 'PAID_REFERENCE_AVERAGE');
  if (averageAbsences.length) {
    if (averageAbsences.some((entry) => entry.unit !== 'DAYS')) {
      issues.push({
        code: 'REFERENCE_AVERAGE_DAYS_REQUIRED', severity: 'ERROR', blocking: true,
        message: 'Urlaubs-/Krankheitsentgelt nach Drei-Monats-Durchschnitt benötigt geprüfte Ausfalltage; Stunden werden nicht stillschweigend in Tage umgerechnet.',
        fieldPath: 'absences.unit', details: null,
      });
    }
    const coreReferenceMonths = PayrollReferenceMonthService.toCoreMonths(referenceMonths);
    const absenceDaysHundredths = averageAbsences.reduce(
      (sum, entry) => sum + (entry.unit === 'DAYS' ? exactScaledInteger(entry.quantity, 100) : 0),
      0,
    );
    const average = calculateGvpAbsenceAverage({
      months: coreReferenceMonths,
      lastThreeSettledMonthsConfirmed: coreReferenceMonths.length === 3 && referenceMonthIssues.length === 0,
      absenceDaysHundredths,
    });
    if (average.status === 'OK') {
      const byType = new Map();
      for (const absence of averageAbsences) {
        const type = absence.absenceType === 'VACATION' ? 'VACATION_PAY' : 'SICK_PAY';
        byType.set(type, (byType.get(type) || 0)
          + (absence.unit === 'DAYS' ? exactScaledInteger(absence.quantity, 100) : 0));
      }
      for (const [type, daysHundredths] of byType) {
        components.push(component({
          type,
          amountCents: roundRational(
            BigInt(average.data.dailyAmountCents) * BigInt(daysHundredths),
            100n,
          ),
          quantity: daysHundredths / 100,
          unit: 'DAYS',
          explanation: { rule: 'GVP three-settled-month average', core: average.data, texts: average.explanations },
          sourceRefs: [
            ...averageAbsences.filter((entry) => (type === 'VACATION_PAY' ? entry.absenceType === 'VACATION' : entry.absenceType === 'SICKNESS')).map((entry) => `absence:${idString(entry)}`),
            ...referenceMonths.flatMap((entry) => [
              `reference-month:${idString(entry)}`,
              `snapshot:${idString(entry.sourceSnapshot)}`,
              ...(entry.evidenceRefs || []).map((evidenceRef) => `evidence:${evidenceRef}`),
            ]),
            ...average.sourceRefs,
          ],
        }));
      }
    } else issues.push(coreIssue(average, 'absences.referenceAverage'));
    issues.push(...warningIssues(average, 'absences.referenceAverage'));
  }

  for (const adjustment of adjustments) {
    components.push(component({
      type: adjustment.componentType,
      key: `${adjustment.mappingKey}:${adjustment.adjustmentKey || idString(adjustment)}`,
      amountCents: adjustment.amountCents,
      quantity: decimalNumber(adjustment.quantity),
      unit: adjustment.unit,
      rateCents: adjustment.rateCents,
      factor: decimalNumber(adjustment.factor),
      percentBasisPoints: adjustment.percentBasisPoints,
      explanation: {
        rule: adjustment.ruleVersion,
        clause: adjustment.clause,
        reason: adjustment.reason,
        adjustmentType: adjustment.adjustmentType,
      },
      sourceRefs: [`adjustment:${idString(adjustment)}`, ...(adjustment.evidenceRefs || []).map((entry) => `evidence:${entry}`)],
    }));
  }

  const baseWageCents = components.filter((entry) => entry.type === 'BASE_WAGE').reduce((sum, entry) => sum + entry.amountCents, 0);
  const premiumsCents = components.filter((entry) => ['EXPERIENCE_BONUS', 'INDUSTRY_SURCHARGE', 'NIGHT_PREMIUM', 'SUNDAY_PREMIUM', 'HOLIDAY_PREMIUM', 'OVERTIME_PREMIUM'].includes(entry.type)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const equalPayAdjustmentCents = components.filter((entry) => entry.type === 'EQUAL_PAY_ADJUSTMENT').reduce((sum, entry) => sum + entry.amountCents, 0);
  const azkPayoutCents = components.filter((entry) => entry.type === 'AZK_PAYOUT').reduce((sum, entry) => sum + entry.amountCents, 0);
  const absencePayCents = components.filter((entry) => ['VACATION_PAY', 'SICK_PAY', 'SHORT_TIME'].includes(entry.type)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const correctionsCents = components.filter((entry) => entry.type === 'CORRECTION').reduce((sum, entry) => sum + entry.amountCents, 0);
  const expectedGrossCents = components.filter((entry) => GROSS_COMPONENT_TYPES.has(entry.type)).reduce((sum, entry) => sum + entry.amountCents, 0);

  return {
    paychexId,
    components,
    issues,
    totals: { baseWageCents, premiumsCents, equalPayAdjustmentCents, azkPayoutCents, absencePayCents, correctionsCents, expectedGrossCents, currency: 'EUR' },
  };
}

async function loadEmployeeInput(run, employee) {
  const range = monthRange(run.month);
  const employment = await PayrollEmployment.findOne({
    mitarbeiter: employee._id,
    isCurrent: true,
    status: 'active',
    ...periodQuery('validFrom', 'validTill', range),
  }).populate('tariff.ruleVersion').lean();

  const assignments = await AssignmentLedger.find({
    mitarbeiter: employee._id,
    isCurrent: true,
    payrollEligible: true,
    ...periodQuery('assignmentFrom', 'assignmentTill', range),
  }).lean();
  const assignmentIds = assignments.map((entry) => entry._id);
  const bufferStart = new Date(range.start.getTime() - (2 * 24 * 60 * 60 * 1000));
  const bufferEnd = new Date(range.endExclusive.getTime() + (2 * 24 * 60 * 60 * 1000));
  const [allWorkingTimes, allAbsences, azk, allAdjustments, allAzkDispositions, providerProfile] = await Promise.all([
    WorkingTimeLedger.find({
      mitarbeiter: employee._id,
      isCurrent: true,
      workDate: { $gte: bufferStart, $lt: bufferEnd },
      status: { $in: ['OPEN', 'SUBMITTED', 'APPROVED', 'LOCKED'] },
    }).lean(),
    AbsenceLedger.find({
      mitarbeiter: employee._id,
      isCurrent: true,
      dateFrom: { $lt: range.endExclusive },
      dateTill: { $gte: range.start },
      status: { $in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED'] },
    }).lean(),
    AZKLedger.find({
      mitarbeiter: employee._id,
      effectiveDate: { $lte: range.start },
      status: { $in: ['APPROVED', 'LOCKED'] },
    }).sort({ effectiveDate: 1, createdAt: 1 }).lean(),
    PayrollAdjustmentLedger.find({
      mitarbeiter: employee._id,
      payrollMonth: run.month,
      isCurrent: true,
      status: { $in: ['DRAFT', 'APPROVED', 'LOCKED'] },
    }).lean(),
    PayrollAzkDisposition.find({
      mitarbeiter: employee._id,
      ...(employment?._id ? { employment: employment._id } : {}),
      payrollMonth: run.month,
      isCurrent: true,
      status: { $in: ['DRAFT', 'APPROVED', 'LOCKED'] },
    }).lean(),
    employment?._id ? PayrollProviderProfile.findOne({
      mitarbeiter: employee._id,
      employment: employment._id,
      isCurrent: true,
      status: 'APPROVED',
      ...periodQuery('validFrom', 'validTill', range),
    }).lean() : null,
  ]);

  const pendingInputs = {
    workingTimes: allWorkingTimes.filter((entry) => {
      if (['APPROVED', 'LOCKED'].includes(entry.status)) return false;
      const start = entry.actual?.start ? new Date(entry.actual.start) : null;
      const end = entry.actual?.end ? new Date(entry.actual.end) : null;
      if (start && end) return start < range.endExclusive && end > range.start;
      return new Date(entry.workDate) >= range.start && new Date(entry.workDate) < range.endExclusive;
    }),
    absences: allAbsences.filter((entry) => !['APPROVED', 'LOCKED'].includes(entry.status)),
    adjustments: allAdjustments.filter((entry) => !['APPROVED', 'LOCKED'].includes(entry.status)),
    azkDispositions: allAzkDispositions.filter((entry) => !['APPROVED', 'LOCKED'].includes(entry.status)),
  };
  const allocationIssues = [];
  const workingTimes = [];
  for (const entry of allWorkingTimes.filter((record) => ['APPROVED', 'LOCKED'].includes(record.status))) {
    const allocation = allocateWorkingTimeToPayrollMonth({
      payrollMonth: run.month,
      timeZone: entry.timeZone,
      intervals: [{
        start: entry.actual?.start,
        end: entry.actual?.end,
        breaks: (entry.actual?.breaks || []).map((pause) => ({
          start: pause.startedAt,
          end: pause.endedAt,
        })),
        sourceRef: `working-time:${idString(entry)}`,
      }],
    });
    if (allocation.status !== 'OK') {
      allocationIssues.push({
        code: allocation.code,
        message: allocation.message,
        fieldPath: `workingTimes.${idString(entry)}.periodAllocation`,
        details: allocation.partial || null,
      });
      continue;
    }
    const actualStart = new Date(entry.actual?.start);
    const actualEnd = new Date(entry.actual?.end);
    const overlapsPeriod = actualStart < new Date(allocation.data.periodEnd)
      && actualEnd > new Date(allocation.data.periodStart);
    if (!overlapsPeriod) continue;
    workingTimes.push({
      ...entry,
      payrollIntervals: allocation.data.intervals.map((interval) => ({
        ...interval,
        sourceRefs: [interval.sourceRef].filter(Boolean),
      })),
      payrollWorkedMinutes: allocation.data.totalMinutes,
      payrollAllocation: allocation.data,
    });
  }
  const absences = [];
  for (const entry of allAbsences.filter((record) => ['APPROVED', 'LOCKED'].includes(record.status))) {
    const totalCreditedMinutes = exactScaledInteger(entry.payrollHours, 60);
    const totalQuantityHundredths = exactScaledInteger(entry.quantity, 100);
    const allocation = allocateApprovedAbsenceToPayrollMonth({
      payrollMonth: run.month,
      status: entry.status,
      dateFrom: dateOnly(entry.dateFrom),
      dateTill: dateOnly(entry.dateTill),
      totalCreditedMinutes,
      totalQuantityHundredths,
      dayAllocations: entry.dayAllocations,
    });
    if (allocation.status !== 'OK') {
      allocationIssues.push({
        code: allocation.code,
        message: allocation.message,
        fieldPath: `absences.${idString(entry)}.periodAllocation`,
        details: allocation.partial || null,
      });
      continue;
    }
    absences.push({
      ...entry,
      payrollHours: allocation.data.allocatedCreditedMinutes / 60,
      quantity: allocation.data.allocatedQuantityHundredths == null
        ? decimalNumber(entry.quantity)
        : allocation.data.allocatedQuantityHundredths / 100,
      payrollAllocation: allocation.data,
    });
  }
  const adjustments = allAdjustments.filter((entry) => ['APPROVED', 'LOCKED'].includes(entry.status));
  const approvedAzkDispositions = allAzkDispositions.filter((entry) => ['APPROVED', 'LOCKED'].includes(entry.status));
  const azkDisposition = approvedAzkDispositions.length === 1 ? approvedAzkDispositions[0] : null;
  if (approvedAzkDispositions.length > 1) {
    allocationIssues.push({
      code: 'AZK_DISPOSITION_AMBIGUOUS',
      message: 'Mehr als eine aktuelle freigegebene AZK-Disposition existiert für den Abrechnungsmonat.',
      fieldPath: 'azkDisposition',
      details: { recordIds: approvedAzkDispositions.map((entry) => idString(entry)) },
    });
  }

  const explicitRuleIds = assignments.map((entry) => idOf(entry.customerPayrollRule)).filter(Boolean);
  const customerRules = explicitRuleIds.length ? await CustomerPayrollRule.find({
    isCurrent: true,
    status: 'active',
    $and: [
      { _id: { $in: explicitRuleIds } },
      {
        validFrom: { $lt: range.endExclusive },
        $or: [{ validTill: null }, { validTill: { $gte: range.start } }],
      },
    ],
  }).lean() : [];

  const referenceAverageRequired = absences.some((entry) => (
    ['VACATION', 'SICKNESS'].includes(entry.absenceType)
    && entry.payTreatment === 'PAID_REFERENCE_AVERAGE'
  ));
  const referenceSelection = await PayrollReferenceMonthService.loadForPayroll({
    mitarbeiterId: employee._id,
    payrollMonth: run.month,
    required: referenceAverageRequired,
  });

  return {
    employee,
    employment,
    providerProfile,
    assignments,
    assignmentIds,
    workingTimes,
    absences,
    azk,
    azkDisposition,
    adjustments,
    pendingInputs,
    allocationIssues,
    customerRules,
    referenceMonths: referenceSelection.records,
    referenceMonthIssues: referenceSelection.issues,
  };
}

async function nextRevision(runId, employeeId) {
  const latest = await PayrollEmployeeSnapshot.findOne({ payrollRun: runId, mitarbeiter: employeeId })
    .sort({ revision: -1 }).select('revision').lean();
  return (latest?.revision || 0) + 1;
}

async function lockSnapshotInputs(run, input, actor, snapshot) {
  if (run.runType === 'SHADOW') return;
  const now = new Date();
  const user = actorId(actor);
  const workingTimeIds = input.workingTimes.map((entry) => entry._id);
  const absenceIds = input.absences.map((entry) => entry._id);
  const assignmentIds = input.assignments.map((entry) => entry._id);
  const adjustmentIds = input.adjustments.map((entry) => entry._id);
  const azkDispositionId = input.azkDisposition?._id;

  const [workingTimeResult, absenceResult, adjustmentResult, azkDispositionResult] = await Promise.all([
    WorkingTimeLedger.updateMany(
      { _id: { $in: workingTimeIds }, status: 'APPROVED' },
      {
        $set: { status: 'LOCKED', lockedBy: user, lockedAt: now, payrollRun: run._id },
        $push: { statusHistory: { from: 'APPROVED', to: 'LOCKED', at: now, by: user, reason: `Payroll snapshot ${snapshot._id}` } },
      },
    ),
    AbsenceLedger.updateMany(
      { _id: { $in: absenceIds }, status: 'APPROVED' },
      {
        $set: { status: 'LOCKED', lockedBy: user, lockedAt: now, payrollRun: run._id },
        $push: { statusHistory: { from: 'APPROVED', to: 'LOCKED', at: now, by: user, reason: `Payroll snapshot ${snapshot._id}` } },
      },
    ),
    PayrollAdjustmentLedger.updateMany(
      { _id: { $in: adjustmentIds }, status: 'APPROVED' },
      {
        $set: {
          status: 'LOCKED', lockedBy: user, lockedAt: now,
          payrollRun: run._id, payrollEmployeeSnapshot: snapshot._id,
        },
      },
    ),
    azkDispositionId ? PayrollAzkDisposition.updateOne(
      { _id: azkDispositionId, status: 'APPROVED', isCurrent: true },
      {
        $set: {
          status: 'LOCKED', lockedBy: user, lockedAt: now,
          payrollRun: run._id, payrollEmployeeSnapshot: snapshot._id,
        },
      },
    ) : Promise.resolve({ modifiedCount: 0 }),
  ]);
  if (azkDispositionId && azkDispositionResult.modifiedCount === 0) {
    const alreadyLocked = await PayrollAzkDisposition.findOne({
      _id: azkDispositionId,
      status: 'LOCKED',
      isCurrent: true,
      contentHash: input.azkDisposition.contentHash,
    }).select('_id').lean();
    if (!alreadyLocked) {
      throw new PayrollError('AZK_DISPOSITION_LOCK_FAILED', 'Die freigegebene AZK-Disposition konnte nicht unveränderbar gesperrt werden.', 409);
    }
  }
  await AssignmentLedger.updateMany(
    { _id: { $in: assignmentIds }, payrollLockedAt: null },
    { $set: { payrollLockedAt: now, payrollRun: run._id } },
  );
  const referenceMonthsLocked = await PayrollReferenceMonthService.lockForPayroll({
    records: input.referenceMonths,
    run,
    payrollEmployeeSnapshot: snapshot,
    actor,
  });
  await audit({
    actor, run, snapshot, employee: input.employee,
    action: 'LOCK_INPUT',
    inputHash: snapshot.inputSnapshot.sourceHash,
    summary: 'Abrechnungsquellen gegen stille Änderungen gesperrt',
    safeMetadata: {
      workingTimesLocked: workingTimeResult.modifiedCount,
      absencesLocked: absenceResult.modifiedCount,
      assignmentCount: assignmentIds.length,
      adjustmentsLocked: adjustmentResult.modifiedCount,
      azkDispositionsLocked: azkDispositionResult.modifiedCount,
      referenceMonthsLocked,
    },
  });
}

async function calculateEmployee(run, employee, actor, { recalculate = false } = {}) {
  const input = await loadEmployeeInput(run, employee);
  const baseValidation = validateInput(input);
  const issues = [...baseValidation.errors, ...baseValidation.warnings];
  let calculated = { paychexId: null, components: [], issues: [], totals: { baseWageCents: 0, premiumsCents: 0, equalPayAdjustmentCents: 0, azkPayoutCents: 0, absencePayCents: 0, correctionsCents: 0, expectedGrossCents: 0, currency: 'EUR' } };
  if (input.employment) calculated = calculateComponents({ run, ...input });
  issues.push(...calculated.issues);

  const tariff = tariffVersionFromEmployment(input.employment);
  const inputSnapshot = {
    capturedAt: new Date(),
    employment: asPlain(input.employment),
    providerProfile: asPlain(input.providerProfile),
    assignments: asPlain(input.assignments),
    workingTimes: asPlain(input.workingTimes),
    absences: asPlain(input.absences),
    azk: asPlain(input.azk),
    azkDisposition: asPlain(input.azkDisposition),
    adjustments: asPlain(input.adjustments),
    customerRules: asPlain(input.customerRules),
    referenceMonths: asPlain(input.referenceMonths),
    referenceMonthIssues: asPlain(input.referenceMonthIssues),
    tariffVersions: tariff ? [asPlain(tariff)] : [],
    pendingInputs: asPlain(input.pendingInputs),
    allocationIssues: asPlain(input.allocationIssues),
  };
  inputSnapshot.sourceHash = inputSourceHash(inputSnapshot);
  const revision = await nextRevision(run._id, employee._id);
  const prior = await PayrollEmployeeSnapshot.findOne({ payrollRun: run._id, mitarbeiter: employee._id, isCurrent: true });
  const employeeIdentity = {
    personalNr: employee.personalnr || '',
    paychexEmployeeUid: calculated.paychexId || employee.paychex_id || employee.integrations?.paychex?.employeeUid || null,
    firstName: employee.vorname,
    lastName: employee.nachname,
    employmentType: input.employment?.employmentType || null,
  };
  const tariffVersions = tariff ? [tariff._id] : [];
  const contentCore = {
    payrollRun: idString(run), mitarbeiter: idString(employee), month: run.month,
    revision, employeeIdentity, inputSnapshot, components: calculated.components, totals: calculated.totals,
    calculationVersion: CALCULATION_VERSION, tariffVersions,
  };
  const snapshot = new PayrollEmployeeSnapshot({
    payrollRun: run._id,
    mitarbeiter: employee._id,
    month: run.month,
    revision,
    isCurrent: true,
    supersedes: prior?._id || null,
    status: issues.some((entry) => entry.blocking) ? 'VALIDATION_FAILED' : 'CALCULATED',
    employeeIdentity,
    inputSnapshot,
    components: calculated.components,
    totals: calculated.totals,
    calculationVersion: CALCULATION_VERSION,
    tariffVersions,
    calculatedBy: actorId(actor),
    contentHash: snapshotContentHash(contentCore),
    issues,
  });

  if (prior) {
    prior.isCurrent = false;
    prior.status = 'SUPERSEDED';
    await prior.save();
  }
  try {
    await snapshot.save();
  } catch (error) {
    if (prior) {
      prior.isCurrent = true;
      prior.status = prior.validation?.status === 'PASSED' ? 'READY_FOR_EXPORT' : 'CALCULATED';
      await prior.save();
    }
    throw error;
  }
  try {
    await lockSnapshotInputs(run, input, actor, snapshot);
  } catch (error) {
    snapshot.status = 'ERROR';
    snapshot.issues.push({
      code: 'INPUT_LOCK_FAILED',
      severity: 'ERROR',
      blocking: true,
      message: 'Die Abrechnungsquellen konnten nicht vollständig gesperrt werden.',
      fieldPath: 'inputSnapshot',
      details: { errorCode: error.code || 'INPUT_LOCK_FAILED' },
    });
    await snapshot.save();
    await audit({ actor, run, snapshot, employee, action: 'LOCK_INPUT', outcome: 'FAILED', error, inputHash: inputSnapshot.sourceHash });
    throw error;
  }
  await audit({
    actor, run, snapshot, employee,
    action: recalculate ? 'RECALCULATE' : 'CALCULATE',
    inputHash: inputSnapshot.sourceHash,
    summary: `${calculated.components.length} Lohnarten, ${issues.filter((entry) => entry.blocking).length} Blocker`,
    safeMetadata: { revision, componentCount: calculated.components.length, expectedGrossCents: calculated.totals.expectedGrossCents },
  });
  return snapshot;
}

function emptyPayrollTotals() {
  return {
    baseWageCents: 0,
    premiumsCents: 0,
    equalPayAdjustmentCents: 0,
    azkPayoutCents: 0,
    absencePayCents: 0,
    correctionsCents: 0,
    expectedGrossCents: 0,
    currency: 'EUR',
  };
}

async function persistCalculationFailureSnapshot(run, employeeOrId, actor, error) {
  const employeeId = idOf(employeeOrId);
  const errorCode = String(error?.code || 'PAYROLL_EMPLOYEE_CALCULATION_FAILED').toUpperCase();
  const current = await PayrollEmployeeSnapshot.findOne({
    payrollRun: run._id,
    mitarbeiter: employeeId,
    isCurrent: true,
  });
  const failureIssue = {
    code: 'PAYROLL_EMPLOYEE_CALCULATION_FAILED',
    severity: 'ERROR',
    blocking: true,
    message: 'Die Mitarbeiterberechnung ist fehlgeschlagen. Der Payroll-Lauf bleibt bis zur Korrektur blockiert.',
    fieldPath: 'calculation',
    details: { errorCode },
  };

  // calculateEmployee can persist an ERROR snapshot itself when source locking
  // fails and then throw. Preserve its captured evidence instead of replacing it
  // with an empty failure shell.
  if (current?.status === 'ERROR') {
    if (!(current.issues || []).some((issue) => issue.code === failureIssue.code)) {
      current.issues.push(failureIssue);
    }
    current.validation = { status: 'NOT_RUN' };
    await current.save();
    return current;
  }

  const employee = employeeOrId?._id ? employeeOrId : null;
  const capturedAt = new Date();
  const inputSnapshot = {
    capturedAt,
    employment: null,
    providerProfile: null,
    assignments: [],
    workingTimes: [],
    absences: [],
    azk: [],
    azkDisposition: null,
    adjustments: [],
    customerRules: [],
    referenceMonths: [],
    referenceMonthIssues: [],
    tariffVersions: [],
    pendingInputs: { workingTimes: [], absences: [], adjustments: [], azkDispositions: [] },
    allocationIssues: [],
  };
  inputSnapshot.sourceHash = inputSourceHash(inputSnapshot);
  const revision = await nextRevision(run._id, employeeId);
  const totals = emptyPayrollTotals();
  const employeeIdentity = {
    personalNr: employee?.personalnr || null,
    paychexEmployeeUid: employee?.paychex_id || employee?.integrations?.paychex?.employeeUid || null,
    firstName: employee?.vorname || '[nicht verfügbar]',
    lastName: employee?.nachname || '[nicht verfügbar]',
    employmentType: null,
  };
  const contentCore = {
    payrollRun: idString(run),
    mitarbeiter: idString(employeeId),
    month: run.month,
    revision,
    employeeIdentity,
    inputSnapshot,
    components: [],
    totals,
    calculationVersion: CALCULATION_VERSION,
    tariffVersions: [],
  };
  const snapshot = new PayrollEmployeeSnapshot({
    payrollRun: run._id,
    mitarbeiter: employeeId,
    month: run.month,
    revision,
    isCurrent: true,
    supersedes: current?._id || null,
    status: 'ERROR',
    employeeIdentity,
    inputSnapshot,
    components: [],
    totals,
    calculationVersion: CALCULATION_VERSION,
    tariffVersions: [],
    calculatedBy: actorId(actor),
    contentHash: snapshotContentHash(contentCore),
    issues: [failureIssue],
  });

  const previousStatus = current?.status;
  if (current) {
    current.isCurrent = false;
    current.status = 'SUPERSEDED';
    await current.save();
  }
  try {
    await snapshot.save();
  } catch (persistError) {
    if (current) {
      current.isCurrent = true;
      current.status = previousStatus;
      await current.save();
    }
    throw persistError;
  }
  return snapshot;
}

function queryWithSession(query, session) {
  return session && typeof query?.session === 'function' ? query.session(session) : query;
}

async function countersForRun(runId, session = null) {
  const query = queryWithSession(
    PayrollEmployeeSnapshot.find({ payrollRun: runId, isCurrent: true }),
    session,
  );
  const snapshots = await (typeof query?.lean === 'function' ? query.lean() : query);
  return {
    calculated: snapshots.filter((entry) => entry.status !== 'ERROR').length,
    validated: snapshots.filter((entry) => entry.validation?.status === 'PASSED').length,
    readyForExport: snapshots.filter((entry) => ['READY_FOR_EXPORT', 'SYNC_PENDING', 'SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(entry.status)).length,
    synced: snapshots.filter((entry) => ['SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(entry.status)).length,
    completed: snapshots.filter((entry) => entry.status === 'PAYROLL_COMPLETED').length,
    documentsImported: 0,
    warnings: snapshots.reduce((sum, entry) => sum + (entry.issues || []).filter((issue) => issue.severity === 'WARNING').length, 0),
    errors: snapshots.reduce((sum, entry) => sum + (entry.issues || []).filter((issue) => issue.blocking).length, 0),
  };
}

function buildAzkLedgerMovementPlan(run, snapshot) {
  const projection = snapshot.components.find((entry) => entry.componentKey === 'AZK_MOVEMENT');
  if (!projection?.explanation?.core) {
    throw new PayrollError('AZK_PROJECTION_REQUIRED', 'Validierter Snapshot enthält keine ausführbare AZK-Projektion.', 409);
  }
  const core = projection.explanation.core;
  const payoutProjection = snapshot.components.find((entry) => entry.componentKey === 'AZK_PAYOUT');
  const disposition = snapshot.inputSnapshot?.azkDisposition;
  if (!disposition || !['APPROVED', 'LOCKED'].includes(disposition.status)) {
    throw new PayrollError('AZK_DISPOSITION_REQUIRED', 'AZK-Projektion hat keine freigegebene Monatsdisposition.', 409);
  }
  if (Number(core.payoutMinutesHundredths || 0) > 0 && !payoutProjection) {
    throw new PayrollError('AZK_PAYOUT_COMPONENT_REQUIRED', 'Berechnete AZK-Auszahlung hat keine korrespondierende Lohnart.', 409);
  }
  if (Number(core.payoutMinutesHundredths || 0) === 0 && payoutProjection) {
    throw new PayrollError('AZK_PAYOUT_COMPONENT_UNEXPECTED', 'AZK-Auszahlungslohnart existiert ohne berechnete Auszahlung.', 409);
  }
  const sourceEntries = snapshot.inputSnapshot?.azk || [];
  const opening = [...sourceEntries].reverse().find((entry) => entry.balanceAfterHours != null);
  if (!opening?.policyContext) throw new PayrollError('AZK_OPENING_BALANCE_REQUIRED', 'AZK-Projektion hat keinen geprüften Eröffnungssaldo.', 409);
  const delta = Number(core.deltaMinutesHundredths);
  const payoutMinutesHundredths = Number(core.payoutMinutesHundredths || 0);
  const openingBalance = Number(core.openingBalanceMinutesHundredths);
  const prePayoutBalance = Number(core.prePayoutBalanceMinutesHundredths);
  const closingBalance = Number(core.closingBalanceMinutesHundredths);
  if (![delta, payoutMinutesHundredths, openingBalance, prePayoutBalance, closingBalance].every(Number.isSafeInteger)
      || openingBalance + delta !== prePayoutBalance
      || prePayoutBalance - payoutMinutesHundredths !== closingBalance) {
    throw new PayrollError('AZK_LEDGER_RECONCILIATION_FAILED', 'AZK-Core-Ergebnis stimmt nicht ganzzahlig vom Eröffnungs- bis zum Schlusssaldo überein.', 409);
  }
  const baseMovementType = delta > 0 ? 'ACCRUAL' : delta < 0 ? 'WITHDRAWAL' : 'NO_CHANGE';
  const commonHashFacts = {
    employee: idString(snapshot.mitarbeiter), month: run.month,
    projectionHash: projection.payloadHash,
    dispositionHash: disposition.contentHash,
    openingEntry: idString(opening), policyVersion: opening.policyContext.policyVersion,
  };
  const entries = [{
    sequence: 'movement',
    movementType: baseMovementType,
    deltaMinutesHundredths: delta,
    hoursDelta: (delta / 6000).toFixed(4),
    balanceAfterHours: (prePayoutBalance / 6000).toFixed(4),
    payoutRateCents: null,
    payoutAmountCents: null,
    reason: 'Deterministische AZK-Zeitbewegung aus freigegebenen Ist-Zeiten, Abwesenheiten und Sollstunden.',
  }];
  if (payoutMinutesHundredths > 0) {
    entries.push({
      sequence: 'payout',
      movementType: core.payoutKind === 'CYCLE_OVERFLOW' ? 'OVERFLOW_PAYOUT' : 'PAYOUT',
      deltaMinutesHundredths: -payoutMinutesHundredths,
      hoursDelta: (-payoutMinutesHundredths / 6000).toFixed(4),
      balanceAfterHours: (closingBalance / 6000).toFixed(4),
      payoutRateCents: payoutProjection.rateCents,
      payoutAmountCents: payoutProjection.amountCents,
      reason: `Deterministische AZK-Auszahlung gemäß freigegebener Disposition ${core.payoutKind}; Menge, Tarifrate und Betrag wurden vom Payroll Core berechnet.`,
    });
  }
  for (const entry of entries) {
    entry.idempotencyKey = `payroll:${idString(run)}:${idString(snapshot.mitarbeiter)}:r${snapshot.revision}:${entry.sequence}`;
    entry.contentHash = sha256({
      ...commonHashFacts,
      sequence: entry.sequence,
      movementType: entry.movementType,
      deltaMinutesHundredths: entry.deltaMinutesHundredths,
      balanceAfterHours: entry.balanceAfterHours,
      payoutProjectionHash: entry.sequence === 'payout' ? payoutProjection.payloadHash : null,
    });
  }
  const totalPlannedDelta = entries.reduce((sum, entry) => sum + entry.deltaMinutesHundredths, 0);
  if (openingBalance + totalPlannedDelta !== closingBalance) {
    throw new PayrollError('AZK_LEDGER_DOUBLE_COUNT_GUARD', 'Geplante AZK-Buchungen führen nicht exakt einmal zum berechneten Schlusssaldo.', 409);
  }
  return { core, projection, payoutProjection, disposition, opening, entries };
}

function assertAzkFinalizationBoundary(run, snapshot, reconciliation) {
  if (!['SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(run.status)) {
    throw new PayrollError(
      'AZK_POSTING_FINALIZATION_REQUIRED',
      'AZK-Buchungen dürfen erst nach der Paychex-Synchronisation und dem abschließenden Bruttoabgleich gespeichert werden.',
      409,
    );
  }
  if (!['SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(snapshot.status)) {
    throw new PayrollError(
      'AZK_POSTING_SNAPSHOT_STATE_INVALID',
      'Die AZK-Projektion darf nur aus einem vollständig zu Paychex synchronisierten Snapshot gebucht werden.',
      409,
    );
  }
  if (reconciliation?.status !== 'PASSED'
      || reconciliation.differenceCents !== 0
      || reconciliation.expectedGrossCents !== reconciliation.providerGrossCents) {
    throw new PayrollError(
      'AZK_POSTING_RECONCILIATION_REQUIRED',
      'AZK-Buchungen benötigen einen centgenau bestandenen Paychex-Bruttoabgleich.',
      409,
    );
  }
}

async function persistAzkMovement(run, snapshot, actor, reconciliation, session = null) {
  if (run.runType === 'SHADOW') return [];
  assertAzkFinalizationBoundary(run, snapshot, reconciliation);
  const plan = buildAzkLedgerMovementPlan(run, snapshot);
  const range = monthRange(run.month);
  const now = new Date();
  const movements = [];
  for (const entry of plan.entries) {
    const existing = await queryWithSession(
      AZKLedger.findOne({ idempotencyKey: entry.idempotencyKey }),
      session,
    );
    if (existing) {
      if (existing.contentHash !== entry.contentHash) {
        throw new PayrollError('AZK_LEDGER_IDEMPOTENCY_CONFLICT', 'Bestehende AZK-Buchung besitzt denselben Idempotenzschlüssel mit anderem Inhalt.', 409);
      }
      movements.push(existing);
      continue;
    }
    const payload = {
        idempotencyKey: entry.idempotencyKey,
        mitarbeiter: snapshot.mitarbeiter,
        employment: snapshot.inputSnapshot.employment?._id,
        personalNrSnapshot: snapshot.employeeIdentity.personalNr,
        effectiveDate: new Date(range.endExclusive.getTime() - 1),
        payrollMonth: run.month,
        movementType: entry.movementType,
        hoursDelta: entry.hoursDelta,
        balanceAfterHours: entry.balanceAfterHours,
        payoutRateCents: entry.payoutRateCents,
        payoutAmountCents: entry.payoutAmountCents,
        tariffVersion: snapshot.tariffVersions?.[0] || null,
        policyContext: clonePolicyContext(plan.opening.policyContext),
        payrollRun: run._id,
        payrollEmployeeSnapshot: snapshot._id,
        status: 'LOCKED',
        source: 'payroll-core',
        sourceRef: `snapshot:${idString(snapshot)};azk-disposition:${idString(plan.disposition)}`,
        reason: entry.reason,
        recordedBy: actorId(actor),
        approvedBy: actorId(actor),
        approvedAt: now,
        lockedBy: actorId(actor),
        lockedAt: now,
        contentHash: entry.contentHash,
      };
    try {
      const created = session
        ? await AZKLedger.create([payload], { session })
        : await AZKLedger.create(payload);
      movements.push(session ? created[0] : created);
    } catch (error) {
      // A concurrent completion request can win the unique idempotency key
      // between findOne and create. Treat the identical row as success, while
      // retaining a hard conflict for any different content.
      if (error?.code !== 11000) throw error;
      const raced = await queryWithSession(
        AZKLedger.findOne({ idempotencyKey: entry.idempotencyKey }),
        session,
      );
      if (!raced || raced.contentHash !== entry.contentHash) {
        throw new PayrollError('AZK_LEDGER_IDEMPOTENCY_CONFLICT', 'Bestehende AZK-Buchung besitzt denselben Idempotenzschlüssel mit anderem Inhalt.', 409);
      }
      movements.push(raced);
    }
  }
  const currentIds = movements.map((entry) => entry._id);
  const previous = await queryWithSession(AZKLedger.find({
      payrollRun: run._id,
      mitarbeiter: snapshot.mitarbeiter,
      source: 'payroll-core',
      status: 'LOCKED',
      _id: { $nin: currentIds },
    }), session);
  for (const prior of previous) {
    prior.status = 'REVERSED';
    prior.reversedByEntry = movements[0]._id;
    await prior.save(session ? { session } : undefined);
  }
  return movements;
}

async function persistFinalizedAzkMovements(run, snapshots, actor, reconciliation, session = null) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new PayrollError('AZK_POSTING_COVERAGE_EMPTY', 'Für die abschließende AZK-Buchung fehlen Mitarbeiter-Snapshots.', 409);
  }
  const movements = [];
  for (const snapshot of snapshots) {
    movements.push(...await persistAzkMovement(run, snapshot, actor, reconciliation, session));
  }
  return movements;
}

function clonePolicyContext(policy) {
  return normalize(policy);
}

async function requireRun(runId, session = null) {
  assertObjectId(runId, 'PayrollRun-ID');
  const run = await queryWithSession(PayrollRun.findById(runId), session);
  if (!run) throw new PayrollError('PAYROLL_RUN_NOT_FOUND', 'Payroll-Lauf nicht gefunden.', 404);
  return run;
}

function normalizeScopeObjectIds(values, field) {
  const normalized = [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
  for (const value of normalized) assertObjectId(value, field);
  return normalized;
}

async function createRun({ month, companyKey = 'straightforward', runType = 'REGULAR', parentRun = null, scope = {}, inputCutoffAt = new Date() }, actor) {
  monthRange(month);
  const normalizedInputCutoffAt = new Date(inputCutoffAt);
  if (!Number.isFinite(normalizedInputCutoffAt.getTime())) {
    throw new PayrollError('PAYROLL_INPUT_CUTOFF_INVALID', 'Der Eingabestichtag ist ungültig.', 400);
  }
  const normalizedCompany = String(companyKey || '').trim().toLowerCase();
  if (normalizedCompany !== 'straightforward') {
    throw new PayrollError('PAYROLL_COMPANY_UNSUPPORTED', 'Aktuell ist ausschließlich der Arbeitgeber straightforward konfiguriert.', 400);
  }
  if (!['REGULAR', 'CORRECTION', 'SHADOW'].includes(runType)) {
    throw new PayrollError('PAYROLL_RUN_TYPE_INVALID', 'Ungültiger Abrechnungstyp.', 400);
  }
  if (runType === 'CORRECTION' && !parentRun) {
    throw new PayrollError('PAYROLL_PARENT_RUN_REQUIRED', 'Korrekturläufe benötigen einen Ursprungslauf.', 400);
  }
  let correctionParent = null;
  if (runType === 'CORRECTION') {
    assertObjectId(parentRun, 'Ursprungslauf-ID');
    correctionParent = await PayrollRun.findById(parentRun).lean();
    if (!correctionParent) {
      throw new PayrollError('PAYROLL_PARENT_RUN_NOT_FOUND', 'Der Ursprungslauf der Korrektur wurde nicht gefunden.', 404);
    }
    if (correctionParent.month !== month || correctionParent.companyKey !== normalizedCompany) {
      throw new PayrollError(
        'PAYROLL_CORRECTION_PARENT_MISMATCH',
        'Korrektur- und Ursprungslauf müssen denselben Arbeitgeber und Abrechnungsmonat haben.',
        409,
      );
    }
    if (!['PAYROLL_COMPLETED', 'DOCUMENTS_IMPORTED', 'CLOSED'].includes(correctionParent.status)) {
      throw new PayrollError(
        'PAYROLL_CORRECTION_PARENT_NOT_FINAL',
        'Ein Korrekturlauf benötigt einen vollständig finalisierten Ursprungslauf.',
        409,
      );
    }
  }
  const teamKeys = (scope.teamKeys || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  if (teamKeys.length > 0) {
    throw new PayrollError(
      'PAYROLL_TEAM_SCOPE_UNSUPPORTED',
      'Team-basierte Payroll-Cohorts sind noch nicht mit einer unveränderbaren, zeitbezogenen Teamhistorie abgesichert.',
      400,
    );
  }
  if (correctionParent && ((scope.locationIds || []).length > 0 || (scope.employeeIds || []).length > 0)) {
    throw new PayrollError(
      'PAYROLL_CORRECTION_SCOPE_IMMUTABLE',
      'Korrekturläufe übernehmen den unveränderbaren Scope und Cohort des Ursprungslaufs.',
      400,
    );
  }
  const normalizedScope = {
    locationIds: normalizeScopeObjectIds(
      correctionParent?.scope?.locationIds || scope.locationIds,
      'Standort-ID',
    ),
    teamKeys: [],
    employeeIds: normalizeScopeObjectIds(
      correctionParent?.scope?.employeeIds || scope.employeeIds,
      'Mitarbeiter-ID',
    ),
  };
  if (runType === 'REGULAR') {
    const existing = await PayrollRun.findOne({ month, companyKey: normalizedCompany, runType: 'REGULAR' });
    if (existing) {
      throw new PayrollError(
        'PAYROLL_REGULAR_LINEAGE_EXISTS',
        'Für diesen Arbeitgeber und Monat existiert bereits ein regulärer Ursprungslauf. Weitere Abrechnungen müssen als Korrekturlauf mit finalisiertem Ursprung angelegt werden.',
        409,
        { runId: existing._id, status: existing.status, requiredRunType: 'CORRECTION' },
      );
    }
  }
  const cohortEmployeeIds = correctionParent
    ? (correctionParent.cohort?.employeeIds || []).map((employeeId) => new mongoose.Types.ObjectId(idString(employeeId)))
    : (await Mitarbeiter.find(monthEffectiveEmployeeQuery(month, normalizedScope))
      .select('_id')
      .sort({ _id: 1 })
      .lean())
      .map((employee) => employee._id);
  if (cohortEmployeeIds.length === 0) {
    throw new PayrollError(
      'PAYROLL_COHORT_EMPTY',
      'Der gewählte Abrechnungsmonat und Scope enthalten keine abrechnungsrelevanten Mitarbeiter.',
      409,
    );
  }
  const frozenAt = new Date();
  const cohortSourceHash = sha256({
    selectionPolicy: COHORT_SELECTION_POLICY,
    month,
    companyKey: normalizedCompany,
    scope: {
      locationIds: normalizedScope.locationIds.map(String).sort(),
      employeeIds: normalizedScope.employeeIds.map(String).sort(),
    },
    employeeIds: cohortEmployeeIds.map(String),
    parentRun: correctionParent ? idString(correctionParent) : null,
    frozenAt: frozenAt.toISOString(),
  });
  const lastRun = await PayrollRun.findOne({ month, companyKey: normalizedCompany }).sort({ runNumber: -1 }).lean();
  const run = await PayrollRun.create({
    month,
    companyKey: normalizedCompany,
    runNumber: (lastRun?.runNumber || 0) + 1,
    runType,
    parentRun: correctionParent?._id || parentRun,
    scope: normalizedScope,
    cohort: {
      employeeIds: cohortEmployeeIds,
      frozenAt,
      sourceHash: cohortSourceHash,
      selectionPolicy: COHORT_SELECTION_POLICY,
    },
    calculationVersion: CALCULATION_VERSION,
    inputCutoffAt: normalizedInputCutoffAt,
    inputHash: sha256({ cohortSourceHash, inputCutoffAt: normalizedInputCutoffAt.toISOString() }),
    employeeCount: cohortEmployeeIds.length,
    coverage: {
      status: 'INCOMPLETE',
      checkedAt: frozenAt,
      expectedCount: cohortEmployeeIds.length,
      snapshotCount: 0,
      missingEmployeeIds: cohortEmployeeIds,
      unexpectedEmployeeIds: [],
    },
    statusHistory: [{ from: null, to: 'DRAFT', at: new Date(), by: actorId(actor), reason: 'Payroll-Lauf angelegt' }],
    provider: { name: 'paychex', companyUid: PaychexService.config?.company?.uid || null },
    createdBy: actorId(actor),
  });
  await audit({
    actor,
    run,
    action: 'CREATE_RUN',
    newStatus: 'DRAFT',
    inputHash: cohortSourceHash,
    summary: `Payroll-Lauf ${month}/${run.runNumber} mit ${cohortEmployeeIds.length} Mitarbeitern angelegt`,
    safeMetadata: {
      employeeCount: cohortEmployeeIds.length,
      cohortSelectionPolicy: COHORT_SELECTION_POLICY,
    },
  });
  logger.info('Payroll run created', { runId: idString(run), month, runType });
  return run;
}

async function listRuns(query = {}) {
  const filter = {};
  if (query.month) filter.month = query.month;
  if (query.status) filter.status = query.status;
  return PayrollRun.find(filter).sort({ month: -1, runNumber: -1 }).lean();
}

async function getRun(runId) {
  assertObjectId(runId, 'PayrollRun-ID');
  const run = await PayrollRun.findById(runId).lean();
  if (!run) throw new PayrollError('PAYROLL_RUN_NOT_FOUND', 'Payroll-Lauf nicht gefunden.', 404);
  return run;
}

async function listEmployees(runId) {
  await getRun(runId);
  return PayrollEmployeeSnapshot.find({ payrollRun: runId, isCurrent: true })
    .populate('mitarbeiter', 'personalnr vorname nachname paychex_id integrations.paychex')
    .sort({ 'employeeIdentity.lastName': 1, 'employeeIdentity.firstName': 1 })
    .lean();
}

async function getEmployeeSnapshot(runId, employeeId) {
  assertObjectId(employeeId, 'Mitarbeiter-ID');
  const snapshot = await PayrollEmployeeSnapshot.findOne({ payrollRun: runId, mitarbeiter: employeeId, isCurrent: true })
    .populate('mitarbeiter', 'personalnr vorname nachname paychex_id integrations.paychex').lean();
  if (!snapshot) throw new PayrollError('PAYROLL_EMPLOYEE_NOT_FOUND', 'Kein aktuelles Mitarbeiterergebnis im Lauf gefunden.', 404);
  return snapshot;
}

async function getEmployeeReadiness(employeeId, month) {
  assertObjectId(employeeId, 'Mitarbeiter-ID');
  monthRange(month);
  const employee = await Mitarbeiter.findById(employeeId).select('_id personalnr vorname nachname paychex_id integrations.paychex isActive locationV2').lean();
  if (!employee) throw new PayrollError('PAYROLL_EMPLOYEE_NOT_FOUND', 'Mitarbeiter nicht gefunden.', 404);
  const input = await loadEmployeeInput({ month }, employee);
  const validation = validateInput(input);
  return {
    month,
    employee,
    input: asPlain(input),
    validation,
    ready: validation.errors.length === 0,
  };
}

async function calculateRun(runId, actor) {
  const run = await requireRun(runId);
  assertRunState(run, ['DRAFT', 'CALCULATED', 'VALIDATED', 'READY_FOR_EXPORT'], 'Berechnen');
  const cohortIds = frozenCohortIds(run);
  if (cohortIds.length === 0 || cohortIds.length !== run.employeeCount) {
    throw new PayrollError(
      'PAYROLL_COHORT_NOT_FROZEN',
      'Der Payroll-Lauf besitzt keinen gültigen, unveränderbaren Mitarbeiter-Cohort.',
      409,
    );
  }
  const previousStatus = appendStatus(run, 'CALCULATING', actor, 'Berechnung gestartet');
  run.calculationStartedAt = new Date();
  await run.save();
  await audit({ actor, run, action: 'CALCULATE', outcome: 'STARTED', previousStatus, newStatus: 'CALCULATING' });

  const employees = await Mitarbeiter.find({ _id: { $in: run.cohort.employeeIds } })
    .select('_id personalnr vorname nachname paychex_id integrations.paychex isActive locationV2 eintrittsdatum austrittsdatum')
    .lean();
  const employeeById = new Map(employees.map((employee) => [idString(employee), employee]));
  let failures = 0;
  for (const employeeId of cohortIds) {
    const employee = employeeById.get(employeeId);
    try {
      if (!employee) {
        throw new PayrollError(
          'PAYROLL_COHORT_EMPLOYEE_MISSING',
          'Ein im Payroll-Cohort eingefrorener Mitarbeiter ist im Personalstamm nicht mehr vorhanden.',
          409,
        );
      }
      await calculateEmployee(run, employee, actor, { recalculate: true });
    } catch (error) {
      failures += 1;
      let failureSnapshot;
      try {
        failureSnapshot = await persistCalculationFailureSnapshot(run, employee || employeeId, actor, error);
      } catch (persistError) {
        appendStatus(run, 'FAILED', actor, 'Fehler-Snapshot konnte nicht gespeichert werden');
        run.failure = {
          code: 'PAYROLL_FAILURE_SNAPSHOT_PERSIST_FAILED',
          message: 'Ein blockierendes Mitarbeiterergebnis konnte nicht dauerhaft gespeichert werden.',
          at: new Date(),
        };
        await run.save();
        await audit({ actor, run, employee: employee || employeeId, action: 'CALCULATE', outcome: 'FAILED', error: persistError, newStatus: 'FAILED', summary: 'Fehler-Snapshot konnte nicht gespeichert werden' });
        throw persistError;
      }
      await audit({ actor, run, snapshot: failureSnapshot, employee: employee || employeeId, action: 'RECALCULATE', outcome: 'FAILED', error, summary: 'Mitarbeiterberechnung fehlgeschlagen und blockierend gespeichert' });
    }
  }
  const counters = await countersForRun(run._id);
  const currentSnapshots = await PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true }).lean();
  const coverage = assessCohortCoverage(run, currentSnapshots);
  const calculatedAt = new Date();
  const finalTransition = await guardedRunFinalTransition({
    run,
    expectedStatus: 'CALCULATING',
    targetStatus: 'CALCULATED',
    actor,
    reason: 'Berechnung abgeschlossen',
    at: calculatedAt,
    finalFields: { counters, coverage: coverageState(coverage), calculatedAt },
    revisionSafeFields: { counters, coverage: coverageState(coverage), calculatedAt },
  });
  const finalRun = finalTransition.run;
  const revisionWon = finalTransition.revisionRequired;
  await audit({ actor, run: finalRun, action: 'CALCULATE', outcome: revisionWon ? 'REJECTED' : 'SUCCEEDED', previousStatus: 'CALCULATING', newStatus: finalRun.status, summary: revisionWon ? 'Eine parallele Eingaberevision verhindert die Freigabe.' : `${cohortIds.length} Cohort-Mitarbeiter verarbeitet`, safeMetadata: { employeeCount: run.employeeCount, failures, coverage } });
  return finalRun;
}

async function recalculateEmployee(runId, employeeId, actor) {
  const run = await requireRun(runId);
  assertRunState(run, ['DRAFT', 'CALCULATED', 'VALIDATED', 'READY_FOR_EXPORT', 'REVISION_REQUIRED'], 'Neu berechnen');
  assertObjectId(employeeId, 'Mitarbeiter-ID');
  if (!new Set(frozenCohortIds(run)).has(String(employeeId))) {
    throw new PayrollError(
      'PAYROLL_EMPLOYEE_OUTSIDE_COHORT',
      'Der Mitarbeiter gehört nicht zum bei Anlage eingefrorenen Payroll-Cohort.',
      409,
    );
  }
  const employee = await Mitarbeiter.findById(employeeId).select('_id personalnr vorname nachname paychex_id integrations.paychex isActive locationV2').lean();
  let snapshot;
  let calculationError = null;
  try {
    if (!employee) {
      throw new PayrollError('PAYROLL_COHORT_EMPLOYEE_MISSING', 'Der eingefrorene Mitarbeiter ist im Personalstamm nicht mehr vorhanden.', 409);
    }
    snapshot = await calculateEmployee(run, employee, actor, { recalculate: true });
  } catch (error) {
    calculationError = error;
    snapshot = await persistCalculationFailureSnapshot(run, employee || employeeId, actor, error);
    await audit({ actor, run, snapshot, employee: employee || employeeId, action: 'RECALCULATE', outcome: 'FAILED', error, summary: 'Mitarbeiterrevision fehlgeschlagen und blockierend gespeichert' });
  }
  const counters = await countersForRun(run._id);
  const currentSnapshots = await PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true }).lean();
  setRunCoverage(run, assessCohortCoverage(run, currentSnapshots));
  run.counters = counters;
  appendStatus(run, 'CALCULATED', actor, 'Mitarbeiterrevision berechnet');
  await run.save();
  if (calculationError) throw calculationError;
  return snapshot;
}

async function validateRun(runId, actor) {
  const run = await requireRun(runId);
  assertRunState(run, ['CALCULATED', 'VALIDATED', 'READY_FOR_EXPORT'], 'Validieren');
  const previousStatus = appendStatus(run, 'VALIDATING', actor, 'Validierung gestartet');
  run.validationStartedAt = new Date();
  await run.save();
  await audit({ actor, run, action: 'VALIDATE', outcome: 'STARTED', previousStatus, newStatus: 'VALIDATING' });

  const mapping = await PayrollProviderMapping.findActive('paychex', run.companyKey, run.inputCutoffAt).lean();
  const snapshots = await PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true });
  const expectedEmployeeIds = new Set(frozenCohortIds(run));
  for (const snapshot of snapshots.filter((entry) => expectedEmployeeIds.has(idString(entry.mitarbeiter)))) {
    const currentIssues = (snapshot.issues || []).map((entry) => entry.toObject ? entry.toObject() : entry);
    const integrity = verifySnapshotIntegrity(snapshot);
    const providerValidation = validateSnapshot({ ...snapshot.toObject(), issues: currentIssues }, mapping);
    const issueMap = new Map();
    for (const entry of [...currentIssues, ...integrity.issues, ...providerValidation.errors, ...providerValidation.warnings]) {
      const key = `${entry.code}:${entry.fieldPath || ''}:${JSON.stringify(entry.details || null)}`;
      issueMap.set(key, entry);
    }
    snapshot.issues = [...issueMap.values()];
    const failed = snapshot.issues.some((entry) => entry.blocking);
    if (snapshot.status === 'ERROR') {
      snapshot.validation = {
        status: 'FAILED',
        validatedAt: new Date(),
        validatedBy: actorId(actor),
        validationVersion: 'payroll-validation-1.0.0',
        hash: sha256({ contentHash: snapshot.contentHash, issues: snapshot.issues, mappingHash: mapping?.contentHash || null }),
      };
      await snapshot.save();
      await audit({ actor, run, snapshot, employee: snapshot.mitarbeiter, action: 'VALIDATE', outcome: 'REJECTED', inputHash: snapshot.contentHash, summary: 'Fehlgeschlagene Berechnung bleibt als ERROR blockiert', safeMetadata: { blockerCount: snapshot.issues.filter((entry) => entry.blocking).length } });
      continue;
    }
    snapshot.validation = {
      status: failed ? 'FAILED' : 'PASSED',
      validatedAt: new Date(),
      validatedBy: actorId(actor),
      validationVersion: 'payroll-validation-1.0.0',
      hash: sha256({ contentHash: snapshot.contentHash, issues: snapshot.issues, mappingHash: mapping?.contentHash || null }),
    };
    snapshot.status = failed ? 'VALIDATION_FAILED' : 'READY_FOR_EXPORT';
    await snapshot.save();
    await audit({ actor, run, snapshot, employee: snapshot.mitarbeiter, action: 'VALIDATE', outcome: failed ? 'REJECTED' : 'SUCCEEDED', inputHash: snapshot.contentHash, summary: failed ? 'Validierung blockiert' : 'Validierung bestanden', safeMetadata: { blockerCount: snapshot.issues.filter((entry) => entry.blocking).length } });
  }
  const counters = await countersForRun(run._id);
  const refreshedSnapshots = await PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true }).lean();
  const coverage = assessCohortCoverage(run, refreshedSnapshots);
  const coverageErrors = coverage.missingEmployeeIds.length
    + coverage.unexpectedEmployeeIds.length
    + coverage.duplicateEmployeeIds.length;
  const finalCounters = { ...counters, errors: counters.errors + coverageErrors };
  const targetStatus = coverage.complete && counters.errors === 0 && counters.readyForExport === run.employeeCount
      ? 'READY_FOR_EXPORT'
      : 'VALIDATED';
  const validatedAt = new Date();
  const readyForExport = targetStatus === 'READY_FOR_EXPORT';
  const finalTransition = await guardedRunFinalTransition({
    run,
    expectedStatus: 'VALIDATING',
    targetStatus,
    actor,
    reason: 'Validierung abgeschlossen',
    at: validatedAt,
    finalFields: {
      counters: finalCounters,
      coverage: coverageState(coverage),
      validatedAt,
      validatedBy: actorId(actor),
      readyForExportAt: readyForExport ? validatedAt : null,
      readyForExportBy: readyForExport ? actorId(actor) : null,
    },
    revisionSafeFields: {
      counters: finalCounters,
      coverage: coverageState(coverage),
      readyForExportAt: null,
      readyForExportBy: null,
    },
  });
  const finalRun = finalTransition.run;
  const revisionWon = finalTransition.revisionRequired;
  await audit({ actor, run: finalRun, action: revisionWon ? 'VALIDATE' : finalRun.status === 'READY_FOR_EXPORT' ? 'READY_FOR_EXPORT' : 'VALIDATE', outcome: revisionWon ? 'REJECTED' : 'SUCCEEDED', previousStatus: 'VALIDATING', newStatus: finalRun.status, summary: revisionWon ? 'Eine parallele Eingaberevision verhindert die Freigabe.' : `${finalCounters.errors} Blocker`, safeMetadata: { counters: finalCounters, coverage } });
  return finalRun;
}

function mappingFor(mapping, componentEntry) {
  return findComponentMapping(mapping, componentEntry);
}

function providerPayload(componentEntry, mappingEntry, month) {
  return buildProviderSalaryComponent({
    component: componentEntry,
    mappingEntry,
    month,
  }).payload;
}

function plainRemote(value) {
  return value?.data || value?.result || value || {};
}

function equalRemoteFields(remote, expected) {
  const source = plainRemote(remote);
  return Object.entries(expected).every(([key, value]) => String(source?.[key] ?? '') === String(value ?? ''));
}

function paychexEmployeeUid(employee) {
  return employee?.paychex_id || employee?.integrations?.paychex?.employeeUid || null;
}

async function employmentForMonth(employeeId, month) {
  const range = monthRange(month);
  return PayrollEmployment.findOne({
    mitarbeiter: employeeId,
    isCurrent: true,
    status: 'active',
    ...periodQuery('validFrom', 'validTill', range),
  }).lean();
}

function assertProviderProfileForSync({ profile, employee, employment, month }) {
  if (!profile) {
    throw new PayrollError(
      'PAYCHEX_PROVIDER_PROFILE_REQUIRED',
      'Vor dem Stammdatenabgleich fehlt ein freigegebenes, zeitlich gültiges Paychex-Profil.',
      409,
    );
  }
  const employeeUid = paychexEmployeeUid(employee);
  const range = monthRange(month);
  const validFrom = new Date(profile.validFrom);
  const validTill = profile.validTill ? new Date(profile.validTill) : null;
  const statutory = profile.providerOwnedStatutoryData || {};
  const identityMatches = idString(profile.mitarbeiter) === idString(employee?._id)
    && idString(profile.employment) === idString(employment?._id)
    && String(profile.paychexEmployeeUid || '') === String(employeeUid || '');
  const validForMonth = Number.isFinite(validFrom.getTime())
    && validFrom < range.endExclusive
    && (!validTill || (Number.isFinite(validTill.getTime()) && validTill >= range.start));
  const statutoryComplete = statutory.status === 'COMPLETE_IN_PAYCHEX'
    && statutory.includesTaxData === true
    && statutory.includesSocialInsuranceData === true
    && statutory.includesBankData === true
    && statutory.includesHealthInsuranceData === true
    && Boolean(statutory.verifiedInPaychexAt)
    && Boolean(statutory.evidenceHash);
  if (profile.status !== 'APPROVED' || profile.provider !== 'paychex' || profile.apiVersion !== 'v1.3'
      || !identityMatches || !validForMonth || !statutoryComplete) {
    throw new PayrollError(
      'PAYCHEX_PROVIDER_PROFILE_INVALID',
      'Das freigegebene Paychex-Profil stimmt nicht vollständig mit Mitarbeiter, Beschäftigung, Abrechnungsmonat und bestätigten gesetzlichen Stammdaten überein.',
      409,
    );
  }
  return {
    employeeUid,
    employeePayload: PayrollProviderProfileService.paychexEmployeePayload(profile),
    contractPayload: PayrollProviderProfileService.paychexContractPayload(profile),
    profileHash: profile.contentHash,
  };
}

async function syncEmployeeMasterData({ employee, employment, providerProfile, month, companyKey, actor, run = null }) {
  const employeeUid = paychexEmployeeUid(employee);
  if (!employeeUid) {
    throw new PayrollError(
      'PAYCHEX_EMPLOYEE_PREPROVISION_REQUIRED',
      'Der Mitarbeiter muss wegen der erforderlichen gesetzlichen Stammdaten zuerst vollständig in Paychex angelegt und dann per Employee-ID verknüpft werden.',
      409,
    );
  }
  if (!employment) throw new PayrollError('PAYROLL_EMPLOYMENT_REQUIRED', 'Aktive Beschäftigung für den Synchronisationsmonat fehlt.', 409);

  const reviewed = assertProviderProfileForSync({
    profile: providerProfile,
    employee,
    employment,
    month,
  });
  const employeePayload = reviewed.employeePayload;
  const employeeHash = require('./PaychexService').createPayloadHash(employeePayload);
  const remoteEmployee = await PaychexService.getEmployee(employeeUid, { companyKey });
  if (!equalRemoteFields(remoteEmployee, employeePayload)) {
    await PaychexService.patchEmployee(employeeUid, employeePayload, { companyKey });
  }

  const contractPayload = reviewed.contractPayload;
  const contractHash = require('./PaychexService').createPayloadHash(contractPayload);
  const validFrom = dateOnly(providerProfile.validFrom).slice(0, 7);
  const validTill = providerProfile.validTill ? dateOnly(providerProfile.validTill).slice(0, 7) : null;
  const remoteContract = await PaychexService.getEmployeeContract(employeeUid, { companyKey, validAt: month });
  if (!equalRemoteFields(remoteContract, contractPayload)) {
    await PaychexService.patchEmployeeContract(employeeUid, contractPayload, { companyKey, validFrom, validTill });
  }

  await Mitarbeiter.updateOne(
    { _id: employee._id },
    {
      $set: {
        paychex_id: employeeUid,
        'integrations.paychex.employeeUid': employeeUid,
        'integrations.paychex.masterDataSyncedAt': new Date(),
        'integrations.paychex.masterDataPayloadHash': employeeHash,
        'integrations.paychex.contractSyncedAt': new Date(),
        'integrations.paychex.contractPayloadHash': contractHash,
        'integrations.paychex.lastSyncErrorCode': null,
      },
    },
  );
  await audit({
    actor, run, employee, action: 'SYNC_EMPLOYEE', payloadHash: sha256({ employeeHash, contractHash }),
    providerRef: { provider: 'paychex', companyUid: PaychexService.config?.company?.uid, employeeUid, resourceType: 'employee_and_contract', referenceId: employeeUid },
    summary: 'Vorhandenen Paychex-Mitarbeiter und zeitlich begrenzten Vertrag abgeglichen.',
    safeMetadata: { validFrom, validTill, providerProfileHash: reviewed.profileHash },
  });
  return { employeeUid, employeeHash, contractHash, providerProfileHash: reviewed.profileHash };
}

function absencePayload(absence) {
  return {
    ...(absence.paychexPayloadDetails || {}),
    absence_reason: absence.paychexAbsenceType,
    status: absence.paychexStatus,
    start_date: dateOnly(absence.dateFrom),
    end_date: dateOnly(absence.dateTill),
  };
}

async function syncEmployeeAbsences({ run, snapshot, employeeUid, actor }) {
  const ids = (snapshot.inputSnapshot?.absences || []).map((entry) => entry._id).filter(Boolean);
  if (!ids.length) return;
  const absences = await AbsenceLedger.find({ _id: { $in: ids }, isCurrent: true, status: 'LOCKED', payrollRun: run._id });
  if (absences.length !== ids.length) {
    throw new PayrollError('PAYROLL_ABSENCE_LOCK_COVERAGE', 'Nicht alle Snapshot-Abwesenheiten sind unverändert für diesen Lauf gesperrt.', 409);
  }
  for (const absence of absences) {
    const payload = absencePayload(absence);
    const payloadHash = require('./PaychexService').createPayloadHash(payload);
    const sync = absence.providerSync || {};
    if (sync.remoteAbsenceId && sync.remoteAbsenceReason && sync.remoteAbsenceReason !== payload.absence_reason) {
      throw new PayrollError(
        'PAYCHEX_ABSENCE_REASON_IMMUTABLE',
        'Der Paychex-Abwesenheitstyp kann laut Public API nicht geändert werden. Die alte Abwesenheit muss in Paychex kontrolliert storniert und als Revision neu angelegt werden.',
        409,
        { absenceId: absence._id },
      );
    }
    const plan = require('./PaychexService').planIdempotentWrite({
      remoteComponentId: sync.remoteAbsenceId || null,
      previousPayloadHash: sync.payloadHash || null,
      payload,
    });
    absence.providerSync.attempts = Number(sync.attempts || 0) + (plan.action === 'SKIP' ? 0 : 1);
    absence.providerSync.lastAttemptAt = new Date();
    try {
      let remote = null;
      if (plan.action === 'CREATE') {
        remote = await PaychexService.createEmployeeAbsence(employeeUid, payload, { companyKey: run.companyKey });
      } else if (plan.action === 'UPDATE') {
        const patchPayload = { ...payload };
        delete patchPayload.absence_reason;
        remote = await PaychexService.patchEmployeeAbsence(employeeUid, sync.remoteAbsenceId, patchPayload, { companyKey: run.companyKey });
      }
      const remoteId = plainRemote(remote).id || sync.remoteAbsenceId;
      if (!remoteId) throw new PayrollError('PAYCHEX_ABSENCE_ID_MISSING', 'Paychex lieferte keine ID für die Abwesenheit.', 502);
      absence.providerSync.remoteAbsenceId = remoteId;
      absence.providerSync.remoteAbsenceReason = payload.absence_reason;
      absence.providerSync.payloadHash = payloadHash;
      absence.providerSync.status = 'SYNCED';
      absence.providerSync.syncedAt = new Date();
      absence.providerSync.errorCode = null;
      absence.providerSync.errorMessage = null;
      await absence.save();
      await audit({
        actor, run, snapshot, employee: snapshot.mitarbeiter, action: 'SYNC_ABSENCE', payloadHash,
        providerRef: { provider: 'paychex', companyUid: PaychexService.config?.company?.uid, employeeUid, resourceType: 'employee_absence', referenceId: remoteId },
        summary: `Paychex ${plan.action} Abwesenheit`, safeMetadata: { absenceId: absence._id },
      });
    } catch (error) {
      absence.providerSync.status = 'FAILED';
      absence.providerSync.errorCode = error.code || 'PAYCHEX_ABSENCE_SYNC_FAILED';
      absence.providerSync.errorMessage = String(error.message || error).slice(0, 1000);
      await absence.save();
      throw error;
    }
  }
}

async function syncEmployee(employeeId, { month, companyKey = 'straightforward' } = {}, actor) {
  assertObjectId(employeeId, 'Mitarbeiter-ID');
  monthRange(month);
  const employee = await Mitarbeiter.findById(employeeId).select('_id personalnr vorname nachname paychex_id integrations.paychex').lean();
  if (!employee) throw new PayrollError('PAYROLL_EMPLOYEE_NOT_FOUND', 'Mitarbeiter nicht gefunden.', 404);
  const employment = await employmentForMonth(employeeId, month);
  const range = monthRange(month);
  const providerProfile = employment?._id ? await PayrollProviderProfile.findOne({
    mitarbeiter: employeeId,
    employment: employment._id,
    isCurrent: true,
    status: 'APPROVED',
    ...periodQuery('validFrom', 'validTill', range),
  }).lean() : null;
  return syncEmployeeMasterData({ employee, employment, providerProfile, month, companyKey, actor });
}

async function getPaychexStatus(employeeId, companyKey = 'straightforward') {
  assertObjectId(employeeId, 'Mitarbeiter-ID');
  const [employee, latest] = await Promise.all([
    Mitarbeiter.findById(employeeId).select('personalnr vorname nachname paychex_id integrations.paychex').lean(),
    PayrollEmployeeSnapshot.findOne({ mitarbeiter: employeeId, isCurrent: true }).sort({ month: -1 }).select('month status validation.status providerExports').lean(),
  ]);
  if (!employee) throw new PayrollError('PAYROLL_EMPLOYEE_NOT_FOUND', 'Mitarbeiter nicht gefunden.', 404);
  return {
    companyKey,
    employeeId,
    paychexEmployeeUid: paychexEmployeeUid(employee),
    masterData: employee.integrations?.paychex || {},
    latestPayroll: latest,
    configuration: PaychexService.configurationStatus(),
  };
}

async function syncPaychex(runId, actor) {
  let run = await requireRun(runId);
  if (run.runType === 'SHADOW') {
    throw new PayrollError(
      'PAYROLL_SHADOW_PROVIDER_WRITE_FORBIDDEN',
      'Shadow-Läufe dürfen unter keinen Umständen Daten an Paychex schreiben.',
      409,
    );
  }
  if (run.runType === 'CORRECTION') {
    throw new PayrollError(
      'PAYROLL_CORRECTION_PROVIDER_PROTOCOL_REQUIRED',
      'Korrekturläufe dürfen erst nach einem im Paychex-Sandboxlauf bestätigten Verfahren für gesperrte Perioden und negative Deltas übertragen werden.',
      409,
    );
  }
  assertRunState(run, ['READY_FOR_EXPORT', 'SYNCING_TO_PAYCHEX'], 'Paychex-Synchronisation');
  const allCurrentSnapshots = await PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true });
  const coverage = assertCompleteCohortCoverage(run, allCurrentSnapshots);
  const configStatus = PaychexService.configurationStatus();
  if (!configStatus.canWrite) {
    throw new PayrollError(configStatus.status === 'READ_ONLY' ? 'PAYCHEX_WRITE_DISABLED' : 'PAYCHEX_NOT_READY', 'Paychex-Schreibzugriff ist nicht vollständig freigeschaltet.', 409, configStatus);
  }
  const mapping = await PayrollProviderMapping.findActive('paychex', run.companyKey, run.inputCutoffAt);
  if (!mapping) throw new PayrollError('PAYCHEX_MAPPING_REQUIRED', 'Keine freigegebene Paychex-Lohnartenzuordnung gefunden.', 409);
  const snapshots = allCurrentSnapshots.filter((snapshot) => (
    ['READY_FOR_EXPORT', 'SYNC_PENDING', 'SYNCED_TO_PAYCHEX'].includes(snapshot.status)
    && snapshot.validation?.status === 'PASSED'
  ));
  if (snapshots.length !== run.employeeCount) {
    throw new PayrollError('PAYROLL_COVERAGE_INCOMPLETE', 'Nicht alle Cohort-Mitarbeiter sind validiert und exportbereit.', 409, { ...coverage, ready: snapshots.length });
  }

  if (run.status !== 'SYNCING_TO_PAYCHEX') {
    const startedAt = new Date();
    const started = await PayrollRun.findOneAndUpdate(
      { _id: run._id, status: 'READY_FOR_EXPORT' },
      {
        $set: { status: 'SYNCING_TO_PAYCHEX' },
        $push: {
          statusHistory: {
            from: 'READY_FOR_EXPORT',
            to: 'SYNCING_TO_PAYCHEX',
            at: startedAt,
            by: actorId(actor),
            reason: 'Provider-Synchronisation gestartet',
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!started) {
      throw new PayrollError(
        'PAYROLL_RUN_CONCURRENT_STATE_CHANGE',
        'Der Payroll-Lauf wurde vor Beginn der Paychex-Synchronisation parallel geändert.',
        409,
      );
    }
    run = started;
  }
  for (const snapshot of snapshots) {
    const integrity = verifySnapshotIntegrity(snapshot);
    if (!integrity.valid) {
      throw new PayrollError(
        'PAYROLL_SNAPSHOT_INTEGRITY_FAILED',
        'Mindestens ein Payroll-Snapshot oder eine Lohnart stimmt nicht mehr mit den unveränderlichen Hashes und Summen überein.',
        409,
        { issueCodes: [...new Set(integrity.issues.map((entry) => entry.code))] },
      );
    }
    snapshot.status = 'SYNC_PENDING';
    await snapshot.save();
    const employee = await Mitarbeiter.findById(snapshot.mitarbeiter).select('_id personalnr vorname nachname paychex_id integrations.paychex').lean();
    const employment = snapshot.inputSnapshot?.employment;
    const providerProfile = snapshot.inputSnapshot?.providerProfile;
    const master = await syncEmployeeMasterData({
      employee,
      employment,
      providerProfile,
      month: run.month,
      companyKey: run.companyKey,
      actor,
      run,
    });
    const verifiedEmployeeUid = String(master.employeeUid || '').trim();
    const snapshottedEmployeeUid = String(snapshot.employeeIdentity?.paychexEmployeeUid || '').trim();
    if (!verifiedEmployeeUid || snapshottedEmployeeUid !== verifiedEmployeeUid) {
      throw new PayrollError(
        'PAYROLL_SNAPSHOT_PAYCHEX_EMPLOYEE_MISMATCH',
        'Die im Payroll-Snapshot eingefrorene Paychex-Mitarbeiter-ID stimmt nicht mit dem geprüften Provider-Stamm überein.',
        409,
        {
          payrollEmployeeSnapshotId: idString(snapshot),
          hasSnapshotEmployeeUid: Boolean(snapshottedEmployeeUid),
          hasVerifiedEmployeeUid: Boolean(verifiedEmployeeUid),
        },
      );
    }
    await syncEmployeeAbsences({ run, snapshot, employeeUid: verifiedEmployeeUid, actor });
    for (const componentEntry of snapshot.components.filter((entry) => (
      !['AZK_ACCRUAL', 'AZK_WITHDRAWAL'].includes(entry.type)
      && entry.componentKey !== 'AZK_MOVEMENT'
    ))) {
      const mappingEntry = mappingFor(mapping, componentEntry);
      if (!mappingEntry) throw new PayrollError('PAYCHEX_WAGE_TYPE_MAPPING_REQUIRED', `Mapping ${componentEntry.mappingKey} fehlt.`, 409);
      const payload = providerPayload(componentEntry, mappingEntry, run.month);
      const payloadHash = require('./PaychexService').createPayloadHash(payload);
      const previous = snapshot.providerExports.find((entry) => entry.componentKey === componentEntry.componentKey && entry.status !== 'SUPERSEDED');
      const plan = require('./PaychexService').planIdempotentWrite({
        remoteComponentId: previous?.remoteComponentId || null,
        previousPayloadHash: previous?.payloadHash || null,
        payload,
      });
      const idempotencyKey = require('./PaychexService').buildIdempotencyKey({
        companyUid: mapping.companyUid,
        employeeUid: verifiedEmployeeUid,
        localComponentId: componentEntry._id,
        payload,
      });
      let remote = null;
      let remoteId = previous?.remoteComponentId || null;
      let providerOperation = null;

      if (plan.action !== 'SKIP') {
        providerOperation = await PayrollProviderOperationService.findOrCreateOperation({
          idempotencyKey,
          payrollRun: run._id,
          payrollEmployeeSnapshot: snapshot._id,
          mitarbeiter: snapshot.mitarbeiter,
          payrollComponentId: componentEntry._id,
          componentKey: componentEntry.componentKey,
          providerAction: plan.action,
          payloadHash,
          safePayloadMetadata: {
            companySalaryComponentUid: mappingEntry.companySalaryComponentUid,
            payloadMode: mappingEntry.payloadMode,
            validFromMonth: payload.valid_from_month,
            validTillMonth: payload.valid_till_month,
            componentType: componentEntry.type,
            mappingKey: componentEntry.mappingKey || componentEntry.type,
          },
          createdBy: actorId(actor),
        });
        const result = await PayrollProviderOperationService.executeCheckpointedMutation({
          operation: providerOperation,
          actor,
          fallbackRemoteId: plan.remoteComponentId,
          execute: () => plan.action === 'CREATE'
            ? PaychexService.createEmployeeSalaryComponent(
              verifiedEmployeeUid,
              payload,
              { companyKey: run.companyKey },
            )
            : PaychexService.updateEmployeeSalaryComponent(
              verifiedEmployeeUid,
              previous.remoteComponentId,
              payload,
              { companyKey: run.companyKey, partial: false },
            ),
        });
        remote = result.remote || null;
        remoteId = result.remoteComponentId;

        const alreadyPersisted = snapshot.providerExports.find((entry) => entry.idempotencyKey === idempotencyKey);
        if (!alreadyPersisted) {
          if (previous) previous.status = 'SUPERSEDED';
          snapshot.providerExports.push({
            provider: 'paychex',
            componentKey: componentEntry.componentKey,
            companySalaryComponentUid: mappingEntry.companySalaryComponentUid,
            remoteComponentId: remoteId,
            payloadHash,
            idempotencyKey,
            status: 'SYNCED',
            attempts: providerOperation.attempts,
            lastAttemptAt: providerOperation.lastAttemptAt,
            syncedAt: providerOperation.syncedAt,
          });
        }
        // A successful provider write must be recoverable even if the process
        // stops before the next component. Persist the local mirror now.
        await snapshot.save();
      }
      await audit({
        actor, run, snapshot, employee: snapshot.mitarbeiter, action: plan.action === 'UPDATE' ? 'UPDATE_REMOTE_COMPONENT' : 'SYNC_PAYCHEX', payloadHash,
        providerRef: { provider: 'paychex', companyUid: mapping.companyUid, employeeUid: verifiedEmployeeUid, resourceType: 'employee_salary_component', referenceId: remoteId },
        summary: `Paychex ${plan.action} ${componentEntry.componentKey}`,
        safeMetadata: providerOperation ? { providerOperationId: idString(providerOperation) } : {},
      });
    }
    snapshot.status = 'SYNCED_TO_PAYCHEX';
    await snapshot.save();
  }
  const counters = await countersForRun(run._id);
  const syncedAt = new Date();
  const providerFields = {
    counters,
    'provider.mappingVersion': mapping._id,
    'provider.lastSyncedAt': syncedAt,
    'provider.lastSyncedBy': actorId(actor),
  };
  const finalTransition = await guardedRunFinalTransition({
    run,
    expectedStatus: 'SYNCING_TO_PAYCHEX',
    targetStatus: 'SYNCED_TO_PAYCHEX',
    actor,
    reason: 'Provider-Synchronisation abgeschlossen',
    at: syncedAt,
    finalFields: providerFields,
    revisionSafeFields: providerFields,
  });
  return finalTransition.run;
}

async function listProviderOperations(runId) {
  await requireRun(runId);
  return PayrollProviderOperationService.listRunOperations(runId);
}

async function reconcileProviderOperation(operationId, actor, input) {
  const operation = await PayrollProviderOperationService.reconcileOperation(operationId, input, actor);
  await audit({
    actor,
    run: operation.payrollRun,
    snapshot: operation.payrollEmployeeSnapshot,
    employee: operation.mitarbeiter,
    action: 'RECONCILE_PROVIDER_OPERATION',
    payloadHash: operation.payloadHash,
    providerRef: {
      provider: 'paychex',
      resourceType: 'employee_salary_component',
      referenceId: operation.remoteComponentId || null,
      correlationId: operation.idempotencyKey,
    },
    reasonCode: input.outcome,
    summary: input.outcome === 'REMOTE_FOUND'
      ? 'Unklarer Provider-Vorgang wurde als bei Paychex vorhanden bestätigt.'
      : 'Unklarer Provider-Vorgang wurde als bei Paychex nicht vorhanden bestätigt.',
    safeMetadata: {
      providerOperationId: idString(operation),
      evidenceRef: String(input.evidenceRef).slice(0, 1000),
    },
  });
  return operation;
}

async function closeRun(runId, actor) {
  const run = await requireRun(runId);
  assertRunState(run, ['DOCUMENTS_IMPORTED'], 'Schließen');
  const previousStatus = appendStatus(run, 'CLOSED', actor, 'Payroll-Lauf geschlossen');
  run.closedAt = new Date();
  run.closedBy = actorId(actor);
  await run.save();
  await audit({ actor, run, action: 'CLOSE_RUN', previousStatus, newStatus: 'CLOSED' });
  return run;
}

async function markPayrollCompleteInTransaction(runId, actor, input = {}, session) {
  const run = await requireRun(runId, session);
  assertRunState(run, ['SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'], 'Paychex-Abschluss bestätigen');
  const snapshots = await queryWithSession(
    PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true }),
    session,
  );
  assertCompleteCohortCoverage(run, snapshots);
  const reviewedAt = new Date();
  const reconciliation = buildGrossReconciliation({
    snapshots,
    input,
    reviewer: actor,
    synchronizer: run.provider?.lastSyncedBy,
    reviewedAt,
  });

  const previousStatus = run.status;
  if (previousStatus === 'PAYROLL_COMPLETED') {
    const existing = run.reconciliation || {};
    const sameConfirmation = existing.status === 'PASSED'
      && existing.providerGrossCents === reconciliation.providerGrossCents
      && existing.providerFinalizationReference === reconciliation.providerFinalizationReference
      && existing.evidenceHash === reconciliation.evidenceHash
      && idString(existing.reviewedBy) === idString(reconciliation.reviewedBy);
    if (!sameConfirmation) {
      throw new PayrollError(
        'PAYROLL_RECONCILIATION_ALREADY_COMPLETED',
        'Der Lauf ist bereits mit einem anderen Bruttoabgleich abgeschlossen.',
        409,
      );
    }
  } else if (reconciliation.status === 'FAILED') {
    run.reconciliation = reconciliation;
    await run.save({ session });
    return {
      run,
      reconciliation,
      movements: [],
      rejection: new PayrollError(
      'PAYROLL_GROSS_RECONCILIATION_FAILED',
      'Das Paychex-Brutto stimmt nicht centgenau mit dem erwarteten StraightMonitor-Brutto überein.',
      409,
      {
        expectedGrossCents: reconciliation.expectedGrossCents,
        providerGrossCents: reconciliation.providerGrossCents,
        differenceCents: reconciliation.differenceCents,
      },
      ),
    };
  }

  // Ledger rows, snapshot completion, and run completion share one MongoDB
  // transaction. A process failure after any individual insert therefore
  // cannot leave an authoritative partial AZK balance behind.
  const movements = await persistFinalizedAzkMovements(run, snapshots, actor, reconciliation, session);
  if (previousStatus !== 'PAYROLL_COMPLETED') {
    appendStatus(run, 'PAYROLL_COMPLETED', actor, reconciliation.reason);
    run.reconciliation = reconciliation;
    run.payrollCompletedAt = reviewedAt;
    run.payrollCompletedBy = actorId(actor);
  }

  await PayrollEmployeeSnapshot.updateMany(
    { payrollRun: run._id, isCurrent: true, status: 'SYNCED_TO_PAYCHEX' },
    { $set: { status: 'PAYROLL_COMPLETED', providerCompletedAt: reviewedAt, providerCompletedBy: actorId(actor) } },
    { session },
  );
  run.counters = await countersForRun(run._id, session);
  await run.save({ session });
  return { run, reconciliation, movements, rejection: null, previousStatus };
}

async function markPayrollComplete(runId, actor, input = {}) {
  let session;
  let result;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      result = await markPayrollCompleteInTransaction(runId, actor, input, session);
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } catch (error) {
    await audit({
      actor,
      run: runId,
      action: 'MARK_PAYROLL_COMPLETE',
      outcome: 'REJECTED',
      previousStatus: 'SYNCED_TO_PAYCHEX',
      newStatus: 'SYNCED_TO_PAYCHEX',
      reasonCode: error.code || 'AZK_FINALIZATION_TRANSACTION_FAILED',
      summary: 'Paychex-Abschluss und AZK-Buchung wurden vollständig zurückgerollt.',
    });
    throw error;
  } finally {
    if (session) await session.endSession();
  }

  if (result.rejection) {
    await audit({
      actor,
      run: result.run,
      action: 'MARK_PAYROLL_COMPLETE',
      outcome: 'REJECTED',
      previousStatus: 'SYNCED_TO_PAYCHEX',
      newStatus: 'SYNCED_TO_PAYCHEX',
      reasonCode: result.rejection.code,
      summary: 'Paychex-Abschluss wegen einer Bruttodifferenz abgelehnt.',
    });
    throw result.rejection;
  }

  if (result.movements.length > 0) {
    await audit({
      actor,
      run: result.run,
      action: 'LOCK_INPUT',
      inputHash: sha256(result.movements.map((entry) => entry.contentHash)),
      summary: `${result.movements.length} finale AZK-Monatsbuchung(en) atomar bestätigt`,
      safeMetadata: { azkEntryIds: result.movements.map((entry) => idString(entry)) },
    });
  }
  await audit({
    actor,
    run: result.run,
    action: 'MARK_PAYROLL_COMPLETE',
    previousStatus: result.previousStatus,
    newStatus: 'PAYROLL_COMPLETED',
    reasonCode: 'PAYCHEX_GROSS_RECONCILED',
    summary: 'Paychex-Abschluss und AZK-Ledger nach centgenauem Bruttoabgleich atomar bestätigt.',
  });
  return result.run;
}

async function listAudit(runId) {
  await getRun(runId);
  return PayrollAuditLog.find({ payrollRun: runId }).sort({ occurredAt: 1 }).lean();
}

async function getMappings(companyKey = 'straightforward') {
  return PayrollProviderMapping.find({ provider: 'paychex', companyKey }).sort({ version: -1 }).lean();
}

async function saveMapping(input, actor) {
  const companyKey = String(input.companyKey || 'straightforward').toLowerCase();
  if (companyKey !== 'straightforward') throw new PayrollError('PAYROLL_COMPANY_UNSUPPORTED', 'Unbekannte Arbeitgeberzuordnung.', 400);
  const last = await PayrollProviderMapping.findOne({ provider: 'paychex', companyKey }).sort({ version: -1 });
  if (input.activate === true) {
    throw new PayrollError('PAYCHEX_MAPPING_FOUR_EYES_REQUIRED', 'Mappings werden zunächst als Entwurf gespeichert und anschließend von einem zweiten PAYROLL-Benutzer freigegeben.', 409);
  }
  const mapping = await PayrollProviderMapping.create({
      provider: 'paychex', companyKey,
      companyUid: input.companyUid || PaychexService.config?.company?.uid,
      version: (last?.version || 0) + 1,
      status: 'DRAFT',
      isActive: false,
      supersedes: last?._id || null,
      validFrom: input.validFrom || new Date(),
      components: input.components,
      referenceDataSyncedAt: input.referenceDataSyncedAt,
      referenceDataHash: input.referenceDataHash,
      source: input.source || 'manual',
      sourceRef: input.sourceRef,
      contentHash: input.contentHash || sha256(input.components),
      changeReason: input.changeReason || input.approvalReason,
      createdBy: actorId(actor),
      approvedBy: null,
      approvedAt: null,
    });
  await audit({ actor, action: 'PROVIDER_REFERENCE_SYNC', payloadHash: mapping.contentHash, summary: `Provider-Mapping v${mapping.version}`, safeMetadata: { mappingId: mapping._id, componentCount: mapping.components.length } });
  return mapping;
}

async function approveMapping(mappingId, input, actor) {
  assertObjectId(mappingId, 'Provider-Mapping-ID');
  const mapping = await PayrollProviderMapping.findOne({ _id: mappingId, status: 'DRAFT', isActive: false });
  if (!mapping) throw new PayrollError('PAYCHEX_MAPPING_DRAFT_NOT_FOUND', 'Provider-Mapping-Entwurf nicht gefunden.', 404);
  if (idString(mapping.createdBy) === idString(actorId(actor))) {
    throw new PayrollError('FOUR_EYES_REQUIRED', 'Erfasser und Freigeber der Lohnartenzuordnung müssen unterschiedlich sein.', 409);
  }
  if (!String(input.reason || '').trim() || !String(input.paychexApprovalReference || '').trim()
      || !Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0
      || !String(input.evidenceHash || '').trim()) {
    throw new PayrollError('PAYCHEX_MAPPING_APPROVAL_REQUIRED', 'Freigabe benötigt Paychex-Bestätigung, Grund, Evidenzverweise und Evidenz-Hash.', 400);
  }
  const current = await PayrollProviderMapping.findOne({ provider: 'paychex', companyKey: mapping.companyKey, isActive: true });
  const now = new Date();
  if (current) {
    current.isActive = false;
    current.status = 'RETIRED';
    current.validTill = now;
    current.retiredBy = actorId(actor);
    current.retiredAt = now;
    await current.save();
  }
  try {
    mapping.status = 'ACTIVE';
    mapping.isActive = true;
    mapping.approvedBy = actorId(actor);
    mapping.approvedAt = now;
    mapping.approvalReview = {
      reason: String(input.reason).trim(),
      paychexApprovalReference: String(input.paychexApprovalReference).trim(),
      evidenceRefs: input.evidenceRefs.map(String),
      evidenceHash: String(input.evidenceHash).trim(),
    };
    await mapping.save();
  } catch (error) {
    if (current) {
      current.isActive = true;
      current.status = 'ACTIVE';
      current.validTill = null;
      current.retiredBy = null;
      current.retiredAt = null;
      await current.save();
    }
    throw error;
  }
  await audit({ actor, action: 'PROVIDER_REFERENCE_SYNC', payloadHash: mapping.contentHash, summary: `Provider-Mapping v${mapping.version} im Vier-Augen-Prinzip aktiviert`, safeMetadata: { mappingId: mapping._id } });
  return mapping;
}

module.exports = {
  createRun,
  listRuns,
  getRun,
  listEmployees,
  getEmployeeSnapshot,
  getEmployeeReadiness,
  calculateRun,
  recalculateEmployee,
  validateRun,
  syncPaychex,
  listProviderOperations,
  reconcileProviderOperation,
  closeRun,
  markPayrollComplete,
  listAudit,
  getMappings,
  saveMapping,
  approveMapping,
  syncEmployee,
  getPaychexStatus,
  _private: {
    calculateComponents,
    providerPayload,
    absencePayload,
    equalRemoteFields,
    payableIntervals,
    monthEffectiveEmployeeQuery,
    assessCohortCoverage,
    setRunCoverage,
    persistCalculationFailureSnapshot,
    guardedRunFinalTransition,
    buildGrossReconciliation,
    buildAzkLedgerMovementPlan,
    assertAzkFinalizationBoundary,
    persistAzkMovement,
    persistFinalizedAzkMovements,
    markPayrollCompleteInTransaction,
    assertProviderProfileForSync,
  },
};
