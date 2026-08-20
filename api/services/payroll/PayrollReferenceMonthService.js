'use strict';

const mongoose = require('mongoose');
const PayrollReferenceMonth = require('../../models/Payroll/PayrollReferenceMonth');
const PayrollEmployeeSnapshot = require('../../models/Payroll/PayrollEmployeeSnapshot');
const PayrollAuditLog = require('../../models/Payroll/PayrollAuditLog');
const PayrollError = require('../../utils/PayrollError');
const { normalize, sha256 } = require('../../payroll-core/hash');

const CANDIDATE_POLICY_ID = 'GVP_REFERENCE_CANDIDATE_V1';
const ELIGIBLE_SUPPLEMENT_TYPES = new Set([
  'EXPERIENCE_BONUS',
  'INDUSTRY_SURCHARGE',
  'EQUAL_PAY_ADJUSTMENT',
  'NIGHT_PREMIUM',
  'SUNDAY_PREMIUM',
  'HOLIDAY_PREMIUM',
  'TEMP_HIGHER_GRADE_DIFFERENTIAL',
]);

const actorId = (actor) => actor?._id || actor?.id || actor || null;
const idOf = (value) => value?._id || value || null;
const idString = (value) => idOf(value)?.toString?.() || String(idOf(value) || '');
const asPlain = (value) => normalize(value?.toObject ? value.toObject({ depopulate: true }) : value);

function assertObjectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw new PayrollError('PAYROLL_ID_INVALID', `${field} ist ungültig.`, 400);
  }
}

function assertMonth(value, field = 'Referenzmonat') {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) {
    throw new PayrollError('PAYROLL_REFERENCE_MONTH_INVALID', `${field} muss YYYY-MM entsprechen.`, 400);
  }
}

function precedingCalendarMonths(month, count = 3) {
  assertMonth(month, 'Payroll-Monat');
  const [year, monthNumber] = month.split('-').map(Number);
  const periods = [];
  for (let offset = count; offset >= 1; offset -= 1) {
    const date = new Date(Date.UTC(year, monthNumber - 1 - offset, 1));
    periods.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}

function dateOnly(value, field = 'Datum') {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PayrollError('PAYROLL_REFERENCE_DATE_INVALID', `${field} ist ungültig.`, 400);
  }
  return date.toISOString().slice(0, 10);
}

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PayrollError('PAYROLL_REFERENCE_INTEGER_REQUIRED', `${field} muss eine nicht-negative sichere Ganzzahl sein.`, 400);
  }
  return value;
}

function exactMinutesFromTime(entry) {
  if (Number.isSafeInteger(entry.payrollWorkedMinutes) && entry.payrollWorkedMinutes >= 0) {
    return entry.payrollWorkedMinutes;
  }
  const value = Number(entry.actual?.workedHours?.toString?.() ?? entry.actual?.workedHours);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 60))) {
    throw new PayrollError(
      'PAYROLL_REFERENCE_WORKING_TIME_INVALID',
      'Der Quellsnapshot enthält keine ganzzahlig ableitbaren Arbeitsminuten.',
      409,
    );
  }
  return Math.round(value * 60);
}

function candidateHashCore(candidate) {
  return {
    policyId: candidate.policyId,
    baseEarningsCents: candidate.baseEarningsCents,
    supplementEarningsCents: candidate.supplementEarningsCents,
    actualMinutes: candidate.actualMinutes,
    referenceDays: candidate.referenceDays,
    mehrarbeitPremiumCentsExcluded: candidate.mehrarbeitPremiumCentsExcluded,
    components: (candidate.components || []).map((entry) => ({
      componentKey: entry.componentKey,
      type: entry.type,
      amountCents: entry.amountCents,
      payloadHash: entry.payloadHash,
    })),
    workingTimeSourceRefs: [...(candidate.workingTimeSourceRefs || [])],
  };
}

function deriveSourceCandidate(snapshot) {
  const baseComponents = (snapshot.components || []).filter((entry) => entry.type === 'BASE_WAGE');
  const supplementComponents = (snapshot.components || []).filter((entry) => ELIGIBLE_SUPPLEMENT_TYPES.has(entry.type));
  const overtimeComponents = (snapshot.components || []).filter((entry) => entry.type === 'OVERTIME_PREMIUM');
  const selectedComponents = [...baseComponents, ...supplementComponents, ...overtimeComponents];
  for (const entry of selectedComponents) {
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0 || !entry.payloadHash) {
      throw new PayrollError(
        'PAYROLL_REFERENCE_SOURCE_COMPONENT_INVALID',
        'Der Quellsnapshot enthält keine nicht-negative, hashbelegte Kandidatenkomponente.',
        409,
        { componentKey: entry.componentKey || null },
      );
    }
  }
  const baseEarningsCents = baseComponents.reduce((sum, entry) => sum + entry.amountCents, 0);
  if (Number(snapshot.totals?.baseWageCents) !== baseEarningsCents) {
    throw new PayrollError(
      'PAYROLL_REFERENCE_SOURCE_TOTAL_MISMATCH',
      'Basislohn-Komponenten und Basislohn-Summe des Quellsnapshots stimmen nicht überein.',
      409,
    );
  }
  const supplementEarningsCents = supplementComponents.reduce((sum, entry) => sum + entry.amountCents, 0);
  const mehrarbeitPremiumCentsExcluded = overtimeComponents.reduce((sum, entry) => sum + entry.amountCents, 0);
  const workingTimes = snapshot.inputSnapshot?.workingTimes || [];
  const workingTimeSourceRefs = [];
  const workDates = new Set();
  let actualMinutes = 0;
  for (const entry of workingTimes) {
    const minutes = exactMinutesFromTime(entry);
    actualMinutes += minutes;
    const sourceId = idString(entry);
    if (!sourceId) {
      throw new PayrollError('PAYROLL_REFERENCE_WORKING_TIME_ID_REQUIRED', 'Arbeitszeit im Quellsnapshot besitzt keine stabile ID.', 409);
    }
    workingTimeSourceRefs.push(`working-time:${sourceId}`);
    if (minutes > 0) workDates.add(dateOnly(entry.workDate, 'Arbeitsdatum'));
  }
  nonNegativeInteger(actualMinutes, 'Quell-Arbeitsminuten');
  const candidate = {
    policyId: CANDIDATE_POLICY_ID,
    baseEarningsCents,
    supplementEarningsCents,
    actualMinutes,
    referenceDays: workDates.size,
    mehrarbeitPremiumCentsExcluded,
    components: selectedComponents.map((entry) => ({
      componentKey: entry.componentKey,
      type: entry.type,
      amountCents: entry.amountCents,
      payloadHash: entry.payloadHash,
    })),
    workingTimeSourceRefs,
  };
  candidate.candidateHash = sha256(candidateHashCore(candidate));
  return candidate;
}

function normalizeExclusions(values, period) {
  const monthStart = `${period}-01`;
  const [year, month] = period.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return (values || []).map((entry, index) => {
    const from = dateOnly(entry.dateFrom, `Ausschluss ${index + 1} von`);
    const till = dateOnly(entry.dateTill, `Ausschluss ${index + 1} bis`);
    if (from < monthStart || till > monthEnd || till < from) {
      throw new PayrollError(
        'PAYROLL_REFERENCE_EXCLUSION_PERIOD_INVALID',
        'Ausschlüsse müssen vollständig innerhalb des Referenzmonats liegen.',
        400,
      );
    }
    const evidenceRefs = [...new Set((entry.evidenceRefs || []).map(String).map((value) => value.trim()).filter(Boolean))];
    if (!evidenceRefs.length || !String(entry.reason || '').trim()) {
      throw new PayrollError('PAYROLL_REFERENCE_EXCLUSION_EVIDENCE_REQUIRED', 'Jeder Ausschluss benötigt Grund und Evidenz.', 400);
    }
    return {
      exclusionType: entry.exclusionType,
      dateFrom: from,
      dateTill: till,
      earningsExcludedCents: nonNegativeInteger(entry.earningsExcludedCents, 'Ausgeschlossene Entgelt-Cents'),
      minutesExcluded: nonNegativeInteger(entry.minutesExcluded, 'Ausgeschlossene Minuten'),
      referenceDaysExcluded: nonNegativeInteger(entry.referenceDaysExcluded, 'Ausgeschlossene Referenztage'),
      evidenceRefs,
      reason: String(entry.reason).trim(),
    };
  });
}

function referenceContentCore(value) {
  const reference = asPlain(value);
  return {
    referenceKey: reference.referenceKey,
    version: reference.version,
    supersedes: idString(reference.supersedes) || null,
    mitarbeiter: idString(reference.mitarbeiter),
    employment: idString(reference.employment),
    period: reference.period,
    sourceSnapshot: idString(reference.sourceSnapshot),
    sourceSnapshotContentHash: reference.sourceSnapshotContentHash,
    sourceCandidate: candidateHashCore(reference.sourceCandidate),
    sourceCandidateHash: reference.sourceCandidate?.candidateHash,
    eligibleBaseEarningsCents: reference.eligibleBaseEarningsCents,
    eligibleSupplementEarningsCents: reference.eligibleSupplementEarningsCents,
    eligibleActualMinutes: reference.eligibleActualMinutes,
    eligibleReferenceDays: reference.eligibleReferenceDays,
    mehrarbeitPremiumExcluded: reference.mehrarbeitPremiumExcluded,
    exclusions: (reference.exclusions || []).map((entry) => ({
      exclusionType: entry.exclusionType,
      dateFrom: dateOnly(entry.dateFrom),
      dateTill: dateOnly(entry.dateTill),
      earningsExcludedCents: entry.earningsExcludedCents,
      minutesExcluded: entry.minutesExcluded,
      referenceDaysExcluded: entry.referenceDaysExcluded,
      evidenceRefs: [...(entry.evidenceRefs || [])],
      reason: entry.reason,
    })),
    normalizationPolicyId: reference.normalizationPolicyId,
    normalizationClause: reference.normalizationClause,
    evidenceRefs: [...(reference.evidenceRefs || [])],
    evidenceHash: reference.evidenceHash,
  };
}

async function appendAudit({ actor, action, reference, sourceSnapshot, outcome = 'SUCCEEDED', summary }) {
  await PayrollAuditLog.create({
    actor: { user: actorId(actor), actorType: 'USER', displayId: actor?.email || actor?.name || null },
    payrollEmployeeSnapshot: idOf(sourceSnapshot) || idOf(reference.sourceSnapshot),
    mitarbeiter: idOf(reference.mitarbeiter),
    action,
    outcome,
    inputHash: reference.sourceSnapshotContentHash,
    payloadHash: reference.contentHash,
    summary,
    safeMetadata: {
      referenceMonthId: idString(reference),
      period: reference.period,
      version: reference.version,
      sourceCandidateHash: reference.sourceCandidate?.candidateHash,
    },
  });
}

async function preview(input) {
  const mitarbeiterId = input.mitarbeiterId;
  assertObjectId(mitarbeiterId, 'Mitarbeiter-ID');
  assertMonth(input.period);
  const sourceSnapshot = await PayrollEmployeeSnapshot.findOne({
    mitarbeiter: mitarbeiterId,
    month: input.period,
    isCurrent: true,
    status: 'PAYROLL_COMPLETED',
  }).lean();
  if (!sourceSnapshot) {
    throw new PayrollError(
      'PAYROLL_REFERENCE_SOURCE_SNAPSHOT_REQUIRED',
      'Der Referenzmonat benötigt einen aktuellen, abgeschlossenen Payroll-Snapshot desselben Mitarbeiters und Monats.',
      409,
    );
  }
  const employmentId = idOf(sourceSnapshot.inputSnapshot?.employment);
  assertObjectId(employmentId, 'Beschäftigungs-ID im Quellsnapshot');
  return {
    mitarbeiterId: idString(sourceSnapshot.mitarbeiter),
    employmentId: idString(employmentId),
    period: sourceSnapshot.month,
    sourceSnapshotId: idString(sourceSnapshot),
    sourceSnapshotContentHash: sourceSnapshot.contentHash,
    sourceCandidate: deriveSourceCandidate(sourceSnapshot),
  };
}

async function createDraft(input, actor) {
  assertObjectId(input.mitarbeiterId, 'Mitarbeiter-ID');
  assertMonth(input.period);
  const sourceSnapshot = await PayrollEmployeeSnapshot.findOne({
    mitarbeiter: input.mitarbeiterId,
    month: input.period,
    isCurrent: true,
    status: 'PAYROLL_COMPLETED',
  }).lean();
  if (!sourceSnapshot) {
    throw new PayrollError(
      'PAYROLL_REFERENCE_SOURCE_SNAPSHOT_REQUIRED',
      'Der Referenzmonat benötigt einen aktuellen, abgeschlossenen Payroll-Snapshot desselben Mitarbeiters und Monats.',
      409,
    );
  }
  const employmentId = idOf(sourceSnapshot.inputSnapshot?.employment);
  assertObjectId(employmentId, 'Beschäftigungs-ID im Quellsnapshot');
  const sourceCandidate = deriveSourceCandidate(sourceSnapshot);
  const normalized = input.normalized || {};
  const evidenceRefs = [...new Set((input.evidenceRefs || []).map(String).map((entry) => entry.trim()).filter(Boolean))];
  if (!evidenceRefs.length || !/^[a-f0-9]{64}$/.test(String(input.evidenceHash || '').toLowerCase())) {
    throw new PayrollError('PAYROLL_REFERENCE_EVIDENCE_REQUIRED', 'Referenzmonat benötigt Evidenzverweise und einen SHA-256-Evidenzhash.', 400);
  }
  if (input.mehrarbeitPremiumExcluded !== true) {
    throw new PayrollError('PAYROLL_REFERENCE_MEHRARBEIT_EXCLUSION_REQUIRED', 'Der Mehrarbeitszuschlag muss ausdrücklich ausgeschlossen sein.', 400);
  }
  const exclusions = normalizeExclusions(input.exclusions, input.period);
  const previous = await PayrollReferenceMonth.findOne({
    mitarbeiter: input.mitarbeiterId,
    period: input.period,
    isCurrent: true,
  });
  if (previous && (previous.status === 'LOCKED' || (previous.usageLocks || []).length > 0)) {
    throw new PayrollError(
      'PAYROLL_REFERENCE_MONTH_IN_USE',
      'Ein bereits in Payroll-Snapshots verwendeter Referenzmonat darf nicht ersetzt werden; die Änderung erfordert einen Korrekturlauf der betroffenen Abrechnung.',
      409,
      { referenceMonthId: previous._id, usageCount: (previous.usageLocks || []).length },
    );
  }
  const referenceKey = previous?.referenceKey || new mongoose.Types.ObjectId().toString();
  const version = (previous?.version || 0) + 1;
  const data = {
    referenceKey,
    version,
    supersedes: previous?._id || null,
    mitarbeiter: input.mitarbeiterId,
    employment: employmentId,
    period: input.period,
    sourceSnapshot: sourceSnapshot._id,
    sourceSnapshotContentHash: sourceSnapshot.contentHash,
    sourceCandidate,
    eligibleBaseEarningsCents: nonNegativeInteger(normalized.eligibleBaseEarningsCents, 'Finaler Basisentgelt-Zähler'),
    eligibleSupplementEarningsCents: nonNegativeInteger(normalized.eligibleSupplementEarningsCents, 'Finaler Zuschlags-Zähler'),
    eligibleActualMinutes: nonNegativeInteger(normalized.eligibleActualMinutes, 'Finaler Minuten-Zähler'),
    eligibleReferenceDays: nonNegativeInteger(normalized.eligibleReferenceDays, 'Finaler Referenztage-Nenner'),
    mehrarbeitPremiumExcluded: true,
    exclusions,
    normalizationPolicyId: String(input.normalizationPolicyId || '').trim(),
    normalizationClause: String(input.normalizationClause || '').trim(),
    evidenceRefs,
    evidenceHash: String(input.evidenceHash).toLowerCase(),
    status: 'DRAFT',
    createdBy: actorId(actor),
  };
  if (!data.normalizationPolicyId || !data.normalizationClause) {
    throw new PayrollError('PAYROLL_REFERENCE_NORMALIZATION_POLICY_REQUIRED', 'Normalisierungsregel und Tarifklausel sind erforderlich.', 400);
  }
  data.contentHash = sha256(referenceContentCore(data));
  const draft = new PayrollReferenceMonth(data);
  await draft.validate();

  const previousState = previous ? { isCurrent: previous.isCurrent, status: previous.status } : null;
  if (previous) {
    previous.isCurrent = false;
    previous.status = 'SUPERSEDED';
    await previous.save();
  }
  try {
    await draft.save();
  } catch (error) {
    if (previous) {
      previous.isCurrent = previousState.isCurrent;
      previous.status = previousState.status;
      await previous.save();
    }
    throw error;
  }
  await appendAudit({ actor, action: 'CREATE_REFERENCE_MONTH', reference: draft, sourceSnapshot, summary: 'GVP-Referenzmonat als hashgebundener Entwurf angelegt' });
  return draft;
}

async function approve(referenceId, input, actor) {
  assertObjectId(referenceId, 'Referenzmonat-ID');
  const reference = await PayrollReferenceMonth.findOne({
    _id: referenceId,
    isCurrent: true,
    status: 'DRAFT',
  });
  if (!reference) throw new PayrollError('PAYROLL_REFERENCE_DRAFT_NOT_FOUND', 'Aktueller Referenzmonat-Entwurf nicht gefunden.', 404);
  if (idString(reference.createdBy) === idString(actorId(actor))) {
    throw new PayrollError('FOUR_EYES_REQUIRED', 'Erfasser und Freigeber des Referenzmonats müssen verschieden sein.', 409);
  }
  const approvalReason = String(input.approvalReason || '').trim();
  if (!approvalReason) throw new PayrollError('PAYROLL_REFERENCE_APPROVAL_REASON_REQUIRED', 'Freigabegrund fehlt.', 400);
  const sourceSnapshot = await PayrollEmployeeSnapshot.findOne({
    _id: reference.sourceSnapshot,
    mitarbeiter: reference.mitarbeiter,
    month: reference.period,
    isCurrent: true,
    status: 'PAYROLL_COMPLETED',
  }).lean();
  if (!sourceSnapshot || sourceSnapshot.contentHash !== reference.sourceSnapshotContentHash) {
    throw new PayrollError('PAYROLL_REFERENCE_SOURCE_STALE', 'Der Quellsnapshot wurde ersetzt oder sein Hash stimmt nicht mehr.', 409);
  }
  const currentCandidate = deriveSourceCandidate(sourceSnapshot);
  if (currentCandidate.candidateHash !== reference.sourceCandidate?.candidateHash
      || sha256(referenceContentCore(reference)) !== reference.contentHash) {
    throw new PayrollError('PAYROLL_REFERENCE_CONTENT_STALE', 'Kandidat oder normalisierter Referenzinhalt stimmt nicht mehr mit den Hashes überein.', 409);
  }
  reference.status = 'APPROVED';
  reference.approvedBy = actorId(actor);
  reference.approvedAt = new Date();
  reference.approvalReason = approvalReason;
  await reference.save();
  await appendAudit({ actor, action: 'APPROVE_REFERENCE_MONTH', reference, sourceSnapshot, summary: 'GVP-Referenzmonat im Vier-Augen-Prinzip freigegeben' });
  return reference;
}

async function list(query = {}) {
  const filter = {};
  if (query.mitarbeiterId) {
    assertObjectId(query.mitarbeiterId, 'Mitarbeiter-ID');
    filter.mitarbeiter = query.mitarbeiterId;
  }
  if (query.period) {
    assertMonth(query.period);
    filter.period = query.period;
  }
  if (query.status) filter.status = query.status;
  if (query.current !== 'all') filter.isCurrent = true;
  return PayrollReferenceMonth.find(filter).sort({ period: -1, version: -1 }).lean();
}

function referenceIssue(code, message, details = null) {
  return { code, message, fieldPath: 'referenceMonths', details };
}

async function loadForPayroll({ mitarbeiterId, payrollMonth, required }) {
  const periods = precedingCalendarMonths(payrollMonth, 3);
  if (!required) return { periods, records: [], issues: [] };
  const records = await PayrollReferenceMonth.find({
    mitarbeiter: mitarbeiterId,
    period: { $in: periods },
    isCurrent: true,
    status: { $in: ['APPROVED', 'LOCKED'] },
  }).lean();
  const byPeriod = new Map(records.map((entry) => [entry.period, entry]));
  const issues = [];
  const ordered = [];
  const sourceSnapshotIds = records.map((entry) => entry.sourceSnapshot);
  const sourceSnapshots = sourceSnapshotIds.length ? await PayrollEmployeeSnapshot.find({
    _id: { $in: sourceSnapshotIds },
    isCurrent: true,
    status: 'PAYROLL_COMPLETED',
  }).lean() : [];
  const snapshotsById = new Map(sourceSnapshots.map((entry) => [idString(entry), entry]));

  for (const period of periods) {
    const reference = byPeriod.get(period);
    if (!reference) {
      issues.push(referenceIssue('PAYROLL_REFERENCE_MONTH_MISSING', `Freigegebener GVP-Referenzmonat ${period} fehlt.`, { period }));
      continue;
    }
    const sourceSnapshot = snapshotsById.get(idString(reference.sourceSnapshot));
    let candidate = null;
    try {
      if (sourceSnapshot) candidate = deriveSourceCandidate(sourceSnapshot);
    } catch (error) {
      issues.push(referenceIssue(error.code || 'PAYROLL_REFERENCE_SOURCE_INVALID', 'Quellkandidat des Referenzmonats ist nicht mehr reproduzierbar.', { period }));
      continue;
    }
    const stale = !sourceSnapshot
      || sourceSnapshot.month !== period
      || idString(sourceSnapshot.mitarbeiter) !== idString(mitarbeiterId)
      || sourceSnapshot.contentHash !== reference.sourceSnapshotContentHash
      || candidate.candidateHash !== reference.sourceCandidate?.candidateHash
      || sha256(referenceContentCore(reference)) !== reference.contentHash
      || !reference.approvedBy
      || !reference.approvedAt
      || idString(reference.createdBy) === idString(reference.approvedBy)
      || reference.mehrarbeitPremiumExcluded !== true;
    if (stale) {
      issues.push(referenceIssue('PAYROLL_REFERENCE_MONTH_STALE', `GVP-Referenzmonat ${period} stimmt nicht mehr mit seinem abgeschlossenen Quellsnapshot überein.`, { period, referenceMonthId: idString(reference) }));
      continue;
    }
    ordered.push(reference);
  }
  return { periods, records: issues.length ? [] : ordered, issues };
}

function toCoreMonths(records) {
  return (records || []).map((reference) => ({
    period: reference.period,
    settled: true,
    mehrarbeitPremiumExcluded: reference.mehrarbeitPremiumExcluded === true,
    eligibleBaseEarningsCents: reference.eligibleBaseEarningsCents,
    eligibleSupplementEarningsCents: reference.eligibleSupplementEarningsCents,
    eligibleActualMinutes: reference.eligibleActualMinutes,
    eligibleReferenceDays: reference.eligibleReferenceDays,
  }));
}

async function lockForPayroll({ records, run, payrollEmployeeSnapshot, actor }) {
  let locked = 0;
  for (const captured of records || []) {
    const reference = await PayrollReferenceMonth.findById(captured._id);
    if (!reference || !reference.isCurrent || !['APPROVED', 'LOCKED'].includes(reference.status)
        || reference.contentHash !== captured.contentHash) {
      throw new PayrollError('PAYROLL_REFERENCE_MONTH_LOCK_FAILED', 'Ein verwendeter GVP-Referenzmonat konnte nicht unveränderbar gesperrt werden.', 409);
    }
    const alreadyUsed = (reference.usageLocks || []).some((entry) => (
      idString(entry.payrollRun) === idString(run)
      && idString(entry.payrollEmployeeSnapshot) === idString(payrollEmployeeSnapshot)
    ));
    if (alreadyUsed) continue;
    const now = new Date();
    reference.usageLocks.push({
      payrollRun: run._id,
      payrollEmployeeSnapshot: payrollEmployeeSnapshot._id,
      lockedBy: actorId(actor),
      lockedAt: now,
    });
    if (reference.status === 'APPROVED') reference.status = 'LOCKED';
    if (!reference.lockedAt) {
      reference.lockedAt = now;
      reference.lockedBy = actorId(actor);
      reference.payrollRun = run._id;
      reference.payrollEmployeeSnapshot = payrollEmployeeSnapshot._id;
    }
    await reference.save();
    locked += 1;
  }
  return locked;
}

module.exports = {
  preview,
  createDraft,
  approve,
  list,
  loadForPayroll,
  lockForPayroll,
  toCoreMonths,
  _private: {
    precedingCalendarMonths,
    deriveSourceCandidate,
    candidateHashCore,
    referenceContentCore,
    normalizeExclusions,
  },
};
