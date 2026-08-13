'use strict';

const mongoose = require('mongoose');
const Mitarbeiter = require('./models/Mitarbeiter');
const User = require('./models/User');
const AssignmentLedger = require('./models/AssignmentLedger');
const WorkingTimeLedger = require('./models/WorkingTimeLedger');
const PayrollRun = require('./models/PayrollRun');
const PayrollAuditLog = require('./models/PayrollAuditLog');
const PayrollError = require('./utils/PayrollError');
const { sha256 } = require('./payroll-core/hash');
const { markRunRevisionRequired, invalidateEmployeeRuns } = require('./PayrollRunInvalidationService');

const idOf = (value) => value?._id || value || null;
const idString = (value) => idOf(value)?.toString?.() || '';
const actorId = (actor) => actor?._id || actor?.id || actor || null;

function wholeMinute(value, field) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PayrollError('WORKING_TIME_TIMESTAMP_INVALID', `${field} ist kein gültiger Zeitstempel.`, 400);
  }
  if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new PayrollError('WORKING_TIME_WHOLE_MINUTE_REQUIRED', `${field} muss minutengenau ohne Sekunden angegeben werden.`, 400);
  }
  return date;
}

function floorToMinute(value = new Date()) {
  const date = new Date(value);
  date.setUTCSeconds(0, 0);
  return date;
}

function localDate(value, timeZone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    throw new PayrollError('WORKING_TIME_TIMEZONE_INVALID', 'Der Einsatz enthält keine gültige IANA-Zeitzone.', 400);
  }
  const parts = Object.fromEntries(formatter.formatToParts(value)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
}

function normalizeBreaks(breaks, start, end, source = 'employee') {
  if (!Array.isArray(breaks)) {
    throw new PayrollError('WORKING_TIME_BREAKS_REQUIRED', 'Pausen müssen als detaillierte Liste angegeben werden; eine leere Liste ist zulässig.', 400);
  }
  const normalized = breaks.map((entry, index) => {
    const startedAt = wholeMinute(entry.startedAt, `breaks[${index}].startedAt`);
    const endedAt = wholeMinute(entry.endedAt, `breaks[${index}].endedAt`);
    if (endedAt <= startedAt || startedAt < start || endedAt > end) {
      throw new PayrollError('WORKING_TIME_BREAK_INVALID', 'Pausen müssen vollständig innerhalb der Arbeitszeit liegen.', 400, { index });
    }
    return {
      startedAt,
      endedAt,
      minutes: (endedAt - startedAt) / 60000,
      source: entry.source || source,
    };
  }).sort((left, right) => left.startedAt - right.startedAt);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].startedAt < normalized[index - 1].endedAt) {
      throw new PayrollError('WORKING_TIME_BREAK_OVERLAP', 'Pausenzeiten dürfen sich nicht überschneiden.', 400);
    }
  }
  return normalized;
}

function calculatedActual({ start, end, breaks, source }) {
  if (end <= start) throw new PayrollError('WORKING_TIME_RANGE_INVALID', 'Arbeitsende muss nach Arbeitsbeginn liegen.', 400);
  const totalMinutes = (end - start) / 60000;
  if (totalMinutes > 24 * 60) {
    throw new PayrollError('WORKING_TIME_DURATION_IMPLAUSIBLE', 'Eine einzelne Zeitbuchung darf höchstens 24 Stunden umfassen.', 400);
  }
  const normalizedBreaks = normalizeBreaks(breaks, start, end, source);
  const breakMinutes = normalizedBreaks.reduce((sum, entry) => sum + entry.minutes, 0);
  const workedMinutes = totalMinutes - breakMinutes;
  if (workedMinutes < 0) throw new PayrollError('WORKING_TIME_BREAK_INVALID', 'Pausen überschreiten die erfasste Arbeitszeit.', 400);
  return {
    breaks: normalizedBreaks,
    breakMinutes,
    workedMinutes,
    workedHours: (workedMinutes / 60).toFixed(4),
  };
}

async function resolvePublicEmployee({ flipId, email }) {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  let query = null;
  const emailClause = normalizedEmail
    ? { $or: [{ email: normalizedEmail }, { additionalEmails: normalizedEmail }] }
    : null;
  if (flipId && emailClause) query = { $and: [{ flip_id: flipId }, emailClause] };
  else if (flipId) query = { flip_id: flipId };
  else if (emailClause) query = emailClause;
  if (!query) throw new PayrollError('PUBLIC_EMPLOYEE_REQUIRED', 'Mitarbeiteridentität fehlt.', 401);
  const employees = await Mitarbeiter.find(query)
    .select('_id personalnr vorname nachname flip_id email isActive')
    .limit(2)
    .lean();
  if (employees.length > 1) {
    throw new PayrollError('PUBLIC_EMPLOYEE_AMBIGUOUS', 'Die verifizierte Identität ist nicht eindeutig einem Mitarbeiter zugeordnet.', 409);
  }
  const employee = employees[0];
  if (!employee || employee.isActive === false) {
    throw new PayrollError('PUBLIC_EMPLOYEE_NOT_FOUND', 'Kein aktiver Mitarbeiter für diese Sitzung gefunden.', 404);
  }
  return employee;
}

async function linkedUser(employeeId) {
  return User.findOne({ mitarbeiter: employeeId }).select('_id').lean();
}

async function listEmployeeAssignments(employeeId, at = new Date()) {
  const horizon = new Date(at.getTime() + 31 * 24 * 60 * 60 * 1000);
  return AssignmentLedger.find({
    mitarbeiter: employeeId,
    isCurrent: true,
    status: { $in: ['CONFIRMED', 'ACTIVE'] },
    assignmentFrom: { $lte: horizon },
    $or: [{ assignmentTill: null }, { assignmentTill: { $gte: new Date(at.getTime() - 24 * 60 * 60 * 1000) } }],
  })
    .select('_id assignmentKey siteKey activityLabel employeeTariffDecision.entgeltgruppe workLocation assignmentFrom assignmentTill auftrag kunde personalNrSnapshot status')
    .populate('auftrag', 'auftragNr eventTitel vonDatum bisDatum eventLocation eventOrt')
    .populate('kunde', 'kundenNr kundName')
    .sort({ assignmentFrom: 1 })
    .lean();
}

async function listEmployeeEntries(employeeId, { limit = 31 } = {}) {
  return WorkingTimeLedger.find({ mitarbeiter: employeeId, isCurrent: true })
    .select('-contentHash')
    .populate('assignmentLedger', 'activityLabel workLocation assignmentFrom assignmentTill')
    .sort({ workDate: -1, 'actual.start': -1 })
    .limit(Math.min(Math.max(Number(limit) || 31, 1), 100))
    .lean();
}

async function startTimer({ employee, assignmentId, clientTimeZone, deviceId, now = new Date() }) {
  if (!mongoose.isValidObjectId(assignmentId)) throw new PayrollError('ASSIGNMENT_ID_INVALID', 'Einsatz-ID ist ungültig.', 400);
  if (!employee.personalnr) throw new PayrollError('PERSONAL_NUMBER_REQUIRED', 'Vor Zeiterfassung muss eine Personalnummer vorliegen.', 409);
  const assignment = await AssignmentLedger.findOne({
    _id: assignmentId,
    mitarbeiter: employee._id,
    isCurrent: true,
    status: { $in: ['CONFIRMED', 'ACTIVE'] },
    assignmentFrom: { $lte: now },
    $or: [{ assignmentTill: null }, { assignmentTill: { $gte: now } }],
  }).lean();
  if (!assignment) throw new PayrollError('ASSIGNMENT_NOT_AVAILABLE', 'Der Einsatz gehört nicht zum Mitarbeiter oder ist nicht aktiv.', 404);
  const existing = await WorkingTimeLedger.findOne({ mitarbeiter: employee._id, isCurrent: true, status: 'OPEN' }).lean();
  if (existing) throw new PayrollError('WORKING_TIME_TIMER_ALREADY_OPEN', 'Es läuft bereits eine andere Zeitbuchung.', 409, { workingTimeId: existing._id });

  const rawStart = new Date(now);
  const start = floorToMinute(rawStart);
  const timeZone = assignment.workLocation?.timeZone || 'Europe/Berlin';
  const user = await linkedUser(employee._id);
  const sourceRef = `oidc:${sha256({ employeeId: employee._id, flipId: employee.flip_id }).slice(0, 20)}`;
  try {
    return await WorkingTimeLedger.create({
      mitarbeiter: employee._id,
      assignmentLedger: assignment._id,
      auftrag: assignment.auftrag,
      einsatz: assignment.einsatz || null,
      kunde: assignment.kunde,
      personalNrSnapshot: employee.personalnr,
      workDate: localDate(start, timeZone),
      timeZone,
      planned: {
        start: assignment.plannedStart,
        end: assignment.plannedEnd,
        breakMinutes: assignment.plannedBreakHours == null ? null : String(Number(assignment.plannedBreakHours.toString()) * 60),
        hours: assignment.guaranteedHours,
      },
      actual: { start, end: null, breaks: [], breakMinutes: null, workedHours: null },
      capture: {
        rawStart,
        startReceivedAt: new Date(),
        clientTimeZone: clientTimeZone || null,
        siteKey: assignment.siteKey,
        deviceIdHash: deviceId ? sha256(String(deviceId)) : null,
      },
      roundingRule: 'START_FLOOR_TO_MINUTE_END_EXPLICIT_MINUTE',
      status: 'OPEN',
      statusHistory: [{ from: null, to: 'OPEN', at: new Date(), by: user?._id || null, reason: 'Timer im Public Monitor gestartet' }],
      source: 'public-monitor',
      sourceRef,
      sourceRecordedAt: rawStart,
      recordedBy: user?._id || null,
      contentHash: sha256({ employeeId: employee._id, assignmentId: assignment._id, rawStart, start, sourceRef }),
    });
  } catch (error) {
    if (error?.code === 11000) throw new PayrollError('WORKING_TIME_TIMER_ALREADY_OPEN', 'Es läuft bereits eine andere Zeitbuchung.', 409);
    throw error;
  }
}

async function supersedingEntry(current, values) {
  current.isCurrent = false;
  await current.save();
  try {
    return await WorkingTimeLedger.create({
      ...values,
      entryKey: current.entryKey,
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

function inheritedFields(current) {
  return {
    mitarbeiter: current.mitarbeiter,
    assignmentLedger: current.assignmentLedger,
    auftrag: current.auftrag,
    einsatz: current.einsatz,
    kunde: current.kunde,
    personalNrSnapshot: current.personalNrSnapshot,
    workDate: current.workDate,
    timeZone: current.timeZone,
    planned: current.planned?.toObject ? current.planned.toObject() : current.planned,
    roundingRule: current.roundingRule,
    source: current.source,
    sourceRef: current.sourceRef,
    sourceRecordedAt: current.sourceRecordedAt,
    recordedBy: current.recordedBy,
    recordedAt: current.recordedAt,
  };
}

async function auditInput({ actor = null, entry, action, outcome = 'SUCCEEDED', previousStatus, newStatus, summary, reasonCode }) {
  const userId = actorId(actor);
  await PayrollAuditLog.create({
    actor: {
      user: userId,
      actorType: userId ? 'USER' : 'SYSTEM',
      displayId: actor?.email || actor?.name || null,
    },
    payrollRun: entry.payrollRun || null,
    mitarbeiter: entry.mitarbeiter,
    action,
    outcome,
    previousStatus,
    newStatus,
    inputHash: entry.contentHash,
    reasonCode,
    summary,
    safeMetadata: {
      workingTimeId: entry._id,
      entryKey: entry.entryKey,
      version: entry.version,
    },
  });
}

async function submitTimer({ employee, entryId, actualStart, actualEnd, breaks = [], clientTimeZone, deviceId, now = new Date() }) {
  if (!mongoose.isValidObjectId(entryId)) throw new PayrollError('WORKING_TIME_ID_INVALID', 'Zeitbuchungs-ID ist ungültig.', 400);
  const current = await WorkingTimeLedger.findOne({ _id: entryId, mitarbeiter: employee._id, isCurrent: true, status: 'OPEN' });
  if (!current) throw new PayrollError('WORKING_TIME_OPEN_ENTRY_NOT_FOUND', 'Keine offene Zeitbuchung gefunden.', 404);
  const start = actualStart ? wholeMinute(actualStart, 'actualStart') : new Date(current.actual.start);
  const rawEnd = new Date(now);
  const end = actualEnd ? wholeMinute(actualEnd, 'actualEnd') : floorToMinute(rawEnd);
  const actual = calculatedActual({ start, end, breaks, source: 'employee' });
  const user = await linkedUser(employee._id);
  const submitted = await supersedingEntry(current, {
    ...inheritedFields(current),
    workDate: localDate(start, current.timeZone),
    actual: {
      start,
      end,
      breaks: actual.breaks,
      breakMinutes: String(actual.breakMinutes),
      workedHours: actual.workedHours,
    },
    capture: {
      rawStart: current.capture?.rawStart || current.actual.start,
      rawEnd,
      startReceivedAt: current.capture?.startReceivedAt,
      endReceivedAt: new Date(),
      clientTimeZone: clientTimeZone || current.capture?.clientTimeZone || null,
      siteKey: current.capture?.siteKey || null,
      deviceIdHash: deviceId ? sha256(String(deviceId)) : current.capture?.deviceIdHash || null,
    },
    status: 'SUBMITTED',
    statusHistory: [...(current.statusHistory || []).map((entry) => entry.toObject ? entry.toObject() : entry), {
      from: 'OPEN', to: 'SUBMITTED', at: new Date(), by: user?._id || null, reason: 'Mitarbeiter hat die Ist-Zeit eingereicht',
    }],
    changeReason: actualStart ? 'Mitarbeiter bestätigte oder korrigierte die minutengenaue Startzeit.' : null,
    submittedBy: user?._id || null,
    submittedAt: new Date(),
    contentHash: sha256({ entryKey: current.entryKey, version: current.version + 1, start, end, breaks: actual.breaks, employeeId: employee._id }),
  });
  await auditInput({
    actor: user,
    entry: submitted,
    action: 'SUBMIT_INPUT',
    previousStatus: 'OPEN',
    newStatus: 'SUBMITTED',
    reasonCode: 'EMPLOYEE_TIME_SUBMISSION',
    summary: 'Mitarbeiter hat eine minutengenaue Ist-Zeit eingereicht.',
  });
  return submitted;
}

async function approve(entryId, actor) {
  const entry = await WorkingTimeLedger.findOne({ _id: entryId, isCurrent: true, status: 'SUBMITTED' });
  if (!entry) throw new PayrollError('WORKING_TIME_SUBMITTED_NOT_FOUND', 'Keine eingereichte aktuelle Zeitbuchung gefunden.', 404);
  if (entry.submittedBy && idString(entry.submittedBy) === idString(actor)) {
    throw new PayrollError('FOUR_EYES_REQUIRED', 'Einreicher und Freigeber müssen unterschiedliche Benutzer sein.', 409);
  }
  entry.status = 'APPROVED';
  entry.approvedBy = actorId(actor);
  entry.approvedAt = new Date();
  entry.statusHistory.push({ from: 'SUBMITTED', to: 'APPROVED', at: new Date(), by: actorId(actor), reason: 'Ist-Zeit freigegeben' });
  await entry.save();
  await auditInput({
    actor,
    entry,
    action: 'APPROVE_INPUT',
    previousStatus: 'SUBMITTED',
    newStatus: 'APPROVED',
    reasonCode: 'WORKING_TIME_APPROVED',
    summary: 'Ist-Zeit im Vier-Augen-Prinzip freigegeben.',
  });
  return entry;
}

async function reject(entryId, actor, reason) {
  if (!String(reason || '').trim()) throw new PayrollError('REJECTION_REASON_REQUIRED', 'Ablehnung benötigt einen Grund.', 400);
  const entry = await WorkingTimeLedger.findOne({ _id: entryId, isCurrent: true, status: 'SUBMITTED' });
  if (!entry) throw new PayrollError('WORKING_TIME_SUBMITTED_NOT_FOUND', 'Keine eingereichte aktuelle Zeitbuchung gefunden.', 404);
  entry.status = 'REJECTED';
  entry.rejectedBy = actorId(actor);
  entry.rejectedAt = new Date();
  entry.rejectionReason = String(reason).trim();
  entry.statusHistory.push({ from: 'SUBMITTED', to: 'REJECTED', at: new Date(), by: actorId(actor), reason: entry.rejectionReason });
  await entry.save();
  await auditInput({
    actor,
    entry,
    action: 'REJECT_INPUT',
    outcome: 'REJECTED',
    previousStatus: 'SUBMITTED',
    newStatus: 'REJECTED',
    reasonCode: 'WORKING_TIME_REJECTED',
    summary: entry.rejectionReason,
  });
  return entry;
}

async function correct(entryId, actor, { actualStart, actualEnd, breaks = [], reason, evidenceRefs = [] }) {
  if (!String(reason || '').trim() || !Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    throw new PayrollError('CORRECTION_EVIDENCE_REQUIRED', 'Korrekturen benötigen Grund und mindestens einen Evidenzverweis.', 400);
  }
  const current = await WorkingTimeLedger.findOne({ _id: entryId, isCurrent: true, status: { $in: ['APPROVED', 'LOCKED', 'REJECTED'] } });
  if (!current) throw new PayrollError('WORKING_TIME_CORRECTION_NOT_ALLOWED', 'Die Zeitbuchung kann in diesem Status nicht korrigiert werden.', 409);
  const start = wholeMinute(actualStart, 'actualStart');
  const end = wholeMinute(actualEnd, 'actualEnd');
  const actual = calculatedActual({ start, end, breaks, source: 'office' });
  const previousRun = current.payrollRun ? await PayrollRun.findById(current.payrollRun) : null;
  const corrected = await supersedingEntry(current, {
    ...inheritedFields(current),
    workDate: localDate(start, current.timeZone),
    actual: { start, end, breaks: actual.breaks, breakMinutes: String(actual.breakMinutes), workedHours: actual.workedHours },
    capture: current.capture?.toObject ? current.capture.toObject() : current.capture,
    status: 'SUBMITTED',
    statusHistory: [...(current.statusHistory || []).map((entry) => entry.toObject ? entry.toObject() : entry), {
      from: current.status, to: 'SUBMITTED', at: new Date(), by: actorId(actor), reason: String(reason).trim(),
    }],
    changeReason: `${String(reason).trim()} | evidence:${evidenceRefs.map(String).join(',')}`,
    submittedBy: actorId(actor),
    submittedAt: new Date(),
    contentHash: sha256({ entryKey: current.entryKey, version: current.version + 1, start, end, breaks: actual.breaks, reason, evidenceRefs }),
  });
  const revisionReason = `Zeitkorrektur ${corrected._id}`;
  if (previousRun) await markRunRevisionRequired(previousRun._id, actor, revisionReason);
  await invalidateEmployeeRuns({
    employeeId: current.mitarbeiter,
    validFrom: current.actual?.start || current.workDate,
    validTill: current.actual?.end || current.workDate,
    actor,
    reason: revisionReason,
  });
  await PayrollAuditLog.create({
    actor: { user: actorId(actor), actorType: 'USER', displayId: actor?.email || actor?.name || null },
    payrollRun: previousRun?._id || null,
    mitarbeiter: current.mitarbeiter,
    action: 'CREATE_REVISION',
    outcome: 'SUCCEEDED',
    previousStatus: current.status,
    newStatus: 'SUBMITTED',
    inputHash: corrected.contentHash,
    reasonCode: 'WORKING_TIME_CORRECTION',
    summary: String(reason).trim(),
    safeMetadata: { previousWorkingTimeId: current._id, correctedWorkingTimeId: corrected._id, evidenceCount: evidenceRefs.length },
  });
  return corrected;
}

async function listForPayroll({ month, status, employeeId } = {}) {
  const query = { isCurrent: true };
  if (status) query.status = status;
  if (employeeId) query.mitarbeiter = employeeId;
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new PayrollError('PAYROLL_MONTH_INVALID', 'Monat muss YYYY-MM sein.', 400);
    const [year, value] = month.split('-').map(Number);
    query.workDate = { $gte: new Date(Date.UTC(year, value - 1, 1)), $lt: new Date(Date.UTC(year, value, 1)) };
  }
  return WorkingTimeLedger.find(query)
    .populate('mitarbeiter', 'personalnr vorname nachname')
    .populate('assignmentLedger', 'activityLabel workLocation assignmentFrom assignmentTill')
    .sort({ workDate: -1, 'actual.start': -1 })
    .limit(1000)
    .lean();
}

module.exports = {
  resolvePublicEmployee,
  listEmployeeAssignments,
  listEmployeeEntries,
  startTimer,
  submitTimer,
  approve,
  reject,
  correct,
  listForPayroll,
  _private: { wholeMinute, floorToMinute, localDate, normalizeBreaks, calculatedActual },
};
