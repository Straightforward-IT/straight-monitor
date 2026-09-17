const mongoose = require('mongoose');
const Stundenzeit = require('../models/Stundenzeit');
const Einsatz = require('../models/Event/Einsatz');
const Schicht = require('../models/Event/Schicht');
const Auftrag = require('../models/Event/Auftrag');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Lohnart = require('../models/Payroll/Lohnart');

const DAY_ENTRY_TYPES = Object.freeze({
  M: { kind: 'correction', credited: true },
  U: { kind: 'vacation', credited: true },
  K: { kind: 'sick', credited: true },
  F: { kind: 'absence', credited: true },
  FA: { kind: 'absence', credited: true },
  BG: { kind: 'absence', credited: true },
  BI: { kind: 'absence', credited: true },
  EZ: { kind: 'absence', credited: false },
  FE: { kind: 'absence', credited: false },
  FS: { kind: 'absence', credited: false },
  FU: { kind: 'absence', credited: false },
  GW: { kind: 'absence', credited: false },
  KA: { kind: 'sick', credited: true },
  KE: { kind: 'sick', credited: false },
  KF: { kind: 'absence', credited: false },
  KG: { kind: 'absence', credited: false },
  KI: { kind: 'sick', credited: false },
  KK: { kind: 'sick', credited: false },
  KO: { kind: 'sick', credited: false },
  KW: { kind: 'absence', credited: false },
  MS: { kind: 'absence', credited: false },
  NV: { kind: 'absence', credited: false },
  PZ: { kind: 'absence', credited: false },
  Q: { kind: 'absence', credited: true },
  UB: { kind: 'vacation', credited: true },
  US: { kind: 'vacation', credited: true },
  UU: { kind: 'vacation', credited: false },
  V: { kind: 'absence', credited: false },
});

function fail(statusCode, message, code = 'TIME_CAPTURE_INVALID') {
  throw Object.assign(new Error(message), { statusCode, code });
}
function objectId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail(400, 'Ungültige ID.');
  return value;
}
function canAccess(user, location) {
  if ([user.role, ...(user.roles || [])].some(role => String(role).toUpperCase() === 'ADMIN')) return true;
  return !!location && [user.locationV2, ...(user.locationAccess || [])].filter(Boolean).some(id => String(id) === String(location));
}
function minute(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(400, 'Beginn und Ende im Format HH:MM angeben.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function scheduledMinutes(start, end) {
  if (typeof start !== 'string' || typeof end !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return 0;
  const from = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const till = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  return till > from ? till - from : till + 1440 - from;
}
function count(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1440) fail(400, 'Pausen müssen ganze Minuten zwischen 0 und 1440 sein.');
  return value;
}
const employeeNumbers = employee => [...new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry?.value)].filter(value => value != null && String(value).trim() !== '').map(Number).filter(Number.isSafeInteger))];
const employeeNumberQuery = numbers => ({ $or: [{ personalnr: { $in: numbers.map(String) } }, { 'personalnrHistory.value': { $in: numbers.map(String) } }] });
const berlin = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function instant(date, clock, offset = 0) {
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) fail(400, 'Dem Einsatz fehlt ein gültiges Tagesdatum.');
  day.setUTCDate(day.getUTCDate() + offset);
  const expected = `${day.toISOString().slice(0, 10)} ${clock}`;
  const wall = day.getTime() + minute(clock) * 60000;
  const candidates = [60, 120].map(minutes => new Date(wall - minutes * 60000)).filter(value => berlin.format(value) === expected);
  if (candidates.length !== 1) fail(400, 'Diese Uhrzeit ist durch die Zeitumstellung nicht eindeutig. Bitte die Zeit separat klären.');
  return candidates[0];
}
function calculate(date, input, employee = false) {
  if (!input || typeof input !== 'object') fail(400, 'Zeitangaben fehlen.');
  const start = minute(input.start), end = minute(input.end);
  if (start === end) fail(400, 'Beginn und Ende dürfen nicht gleich sein.');
  const actualStart = instant(date, input.start), actualEnd = instant(date, input.end, end < start ? 1 : 0);
  const duration = (actualEnd - actualStart) / 60000;
  if (duration <= 0 || duration > 1440) fail(400, 'Eine Erfassung darf höchstens 24 Stunden umfassen.');
  const blocks = input.breaks ?? [];
  if (!Array.isArray(blocks) || blocks.length > 3) fail(400, 'Höchstens drei Pausenblöcke sind möglich.');
  let breakMinutes = count(input.breakMinutes ?? 0), paidBreakMinutes = count(input.paidBreakMinutes ?? 0);
  const breaks = [], intervals = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') fail(400, 'Ungültiger Pausenblock.');
    if (!block.start && !block.end) continue;
    const from = minute(block.start), till = minute(block.end);
    const a = instant(date, block.start, from < start ? 1 : 0), b = instant(date, block.end, till < start ? 1 : 0);
    if (a < actualStart || b > actualEnd || b <= a) fail(400, 'Pausen müssen innerhalb der Arbeitszeit liegen.');
    if (typeof block.paid !== 'boolean') fail(400, 'Pausenstatus fehlt.');
    breaks.push({ start: block.start, end: block.end, paid: employee ? false : block.paid });
    intervals.push({ from: +a, till: +b, paid: employee ? false : block.paid });
  }
  if (intervals.length) {
    intervals.sort((a, b) => a.from - b.from);
    if (intervals.some((item, index) => index > 0 && item.from < intervals[index - 1].till)) fail(400, 'Pausen dürfen sich nicht überschneiden.');
    breakMinutes = intervals.reduce((sum, item) => sum + (item.till - item.from) / 60000, 0);
    paidBreakMinutes = intervals.reduce((sum, item) => sum + (item.paid ? (item.till - item.from) / 60000 : 0), 0);
  }
  if (employee) paidBreakMinutes = 0;
  if (breakMinutes > duration || paidBreakMinutes > breakMinutes) fail(400, 'Die Pausen überschreiten die Arbeitszeit bzw. die gesamte Pause.');
  return { date, start: input.start, end: input.end, actualStart, actualEnd, breakMinutes, paidBreakMinutes, breaks, netMinutes: duration - breakMinutes + paidBreakMinutes };
}
async function assignment(id, session = null) {
  const einsatz = await Einsatz.findById(objectId(id)).session(session).lean();
  if (!einsatz || einsatz.isPseudo || einsatz.personalNr == null) fail(404, 'Einsatz nicht verfügbar.');
  let shift = einsatz.schicht ? await Schicht.findOne({ _id: einsatz.schicht, auftragNr: einsatz.auftragNr }).session(session).lean() : null;
  const date = einsatz.detailDatumVon || einsatz.datumVon;
  if (!shift && einsatz.idAuftragArbeitsschichten != null) {
    const matches = await Schicht.find({ auftragNr: einsatz.auftragNr, idAuftragArbeitsschichten: einsatz.idAuftragArbeitsschichten }).session(session).lean();
    shift = matches.find(item => String(item.datumVon?.toISOString()).slice(0, 10) === String(date?.toISOString()).slice(0, 10));
  }
  return { einsatz, shift, date: (einsatz.detailDatumVon || shift?.datumVon || einsatz.datumVon)?.toISOString().slice(0, 10) };
}
async function ownedAssignment(employee, id) {
  const context = await assignment(id);
  if (!employeeNumbers(employee).includes(context.einsatz.personalNr)) fail(404, 'Eigener Einsatz nicht gefunden.');
  return context;
}
async function publicStatus(employee, id) {
  await ownedAssignment(employee, id);
  const entry = await Stundenzeit.findById(id).lean();
  const own = entry && String(entry.mitarbeiter) === String(employee._id);
  // Existence locks self-service even if office created/corrected the first entry.
  return { locked: !!entry, status: own ? entry.status : null, submittedAt: own ? entry.employeeSubmittedAt : null, original: own ? entry.employeeSubmission : null };
}
async function submitEmployee(employee, id, input) {
  const { einsatz, shift, date } = await ownedAssignment(employee, id);
  const current = calculate(date, input, true);
  try {
    return await Stundenzeit.create({
      _id: einsatz._id, mitarbeiter: employee._id, personalNr: einsatz.personalNr, auftragNr: einsatz.auftragNr,
      schicht: shift?._id || null, revision: 1, status: 'SUBMITTED', current,
      employeeSubmission: current, employeeSubmittedAt: new Date(),
      history: [{ revision: 1, action: 'SUBMITTED', at: new Date(), values: current }],
    });
  } catch (error) {
    if (error.code === 11000) fail(409, 'Für diesen Einsatz sind bereits Stunden erfasst. Änderungen sind nur noch intern möglich.', 'TIME_ALREADY_SUBMITTED');
    throw error;
  }
}
async function orderForUser(user, number, session = null) {
  const auftragNr = Number(number);
  if (!Number.isSafeInteger(auftragNr) || auftragNr <= 0) fail(400, 'Ungültige Auftragsnummer.');
  const order = await Auftrag.findOne({ auftragNr }).session(session).lean();
  if (!order) fail(404, 'Auftrag nicht gefunden.');
  if (!canAccess(user, order.locationV2)) fail(403, 'Für diesen Auftragsstandort fehlt die Berechtigung.');
  return order;
}
async function employeeForUser(user, id) {
  const employee = await Mitarbeiter.findById(objectId(id)).select('personalnr personalnrHistory vorname nachname locationV2 arbeitszeit arbeitsverhaeltnis').lean();
  if (!employee) fail(404, 'Mitarbeiter nicht gefunden.');
  if (!canAccess(user, employee.locationV2)) fail(403, 'Für diesen Mitarbeiterstandort fehlt die Berechtigung.');
  return employee;
}
function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail(400, 'Monat im Format YYYY-MM angeben.');
  const from = `${month}-01`;
  const till = new Date(`${from}T00:00:00Z`);
  till.setUTCMonth(till.getUTCMonth() + 1);
  return { from, till: till.toISOString().slice(0, 10) };
}
async function dayEntryTypes() {
  const lohnarten = await Lohnart.find({ kb: { $ne: '' } })
    .select('lohnartNummer kb lohnartBezeichnung')
    .sort({ lohnartNummer: 1 })
    .lean();
  const types = new Map();
  for (const lohnart of lohnarten) {
    const code = String(lohnart.kb || '').trim().toUpperCase();
    const definition = DAY_ENTRY_TYPES[code];
    if (!definition || types.has(code)) continue;
    types.set(code, {
      code,
      label: lohnart.lohnartBezeichnung || code,
      lohnartNummer: lohnart.lohnartNummer,
      ...definition,
    });
  }
  return [...types.values()].sort((left, right) => left.label.localeCompare(right.label, 'de'));
}
async function review(user, number, employeeId) {
  const auftrag = await orderForUser(user, number);
  const filter = { auftragNr: auftrag.auftragNr, isPseudo: { $ne: true }, personalNr: { $ne: null } };
  if (employeeId) filter.personalNr = { $in: employeeNumbers(await employeeForUser(user, employeeId)) };
  const einsaetze = await Einsatz.find(filter).sort({ datumVon: 1, personalNr: 1 }).lean();
  const employees = await Mitarbeiter.find(employeeNumberQuery(einsaetze.map(item => item.personalNr))).select('personalnr personalnrHistory vorname nachname').lean();
  const schichten = await Schicht.find({ auftragNr: auftrag.auftragNr }).sort({ datumVon: 1 }).lean();
  const entries = await Stundenzeit.find({ _id: { $in: einsaetze.map(item => item._id) } }).populate('history.by', 'name').lean();
  return { auftrag, schichten, einsaetze: einsaetze.map(item => ({ ...item, mitarbeiterData: employees.find(employee => employeeNumbers(employee).includes(item.personalNr)) })), entries };
}
async function employeeOrders(user, employeeId, month) {
  const employee = await employeeForUser(user, employeeId);
  const { from, till } = monthRange(month);
  const assignments = await Einsatz.find({ personalNr: { $in: employeeNumbers(employee) }, $or: [
    { detailDatumVon: { $gte: new Date(from), $lt: new Date(till) } },
    { detailDatumVon: null, datumVon: { $gte: new Date(from), $lt: new Date(till) } },
  ] }).select('auftragNr').lean();
  const orders = await Auftrag.find({ auftragNr: { $in: assignments.map(item => item.auftragNr) } }).select('auftragNr eventTitel locationV2 vonDatum').sort({ vonDatum: -1 }).lean();
  return orders.filter(order => canAccess(user, order.locationV2));
}
async function saveReview(user, number, input) {
  if (!['save', 'release', 'withdraw'].includes(input.action)) fail(400, 'Unbekannte Aktion.');
  if (!Array.isArray(input.entries) || !input.entries.length || input.entries.length > 500) fail(400, 'Zwischen 1 und 500 Einsätzen angeben.');
  if (new Set(input.entries.map(row => row.einsatzId)).size !== input.entries.length) fail(400, 'Einsatz mehrfach enthalten.');
  const reason = String(input.reason || '').trim();
  if (reason.length > 1000) fail(400, 'Der Bearbeitungsvermerk darf maximal 1000 Zeichen enthalten.');
  // The entire order action succeeds or fails. Revisions prevent lost edits and
  // a concurrent public submission cannot be overwritten by an office draft.
  try {
    await mongoose.connection.transaction(async session => {
      const order = await orderForUser(user, number, session);
      for (const row of input.entries) {
        const { einsatz, shift, date } = await assignment(row.einsatzId, session);
        if (einsatz.auftragNr !== order.auftragNr) fail(400, 'Einsatz gehört nicht zu diesem Auftrag.');
        const previous = await Stundenzeit.findById(einsatz._id).session(session).lean();
        if (!Number.isInteger(row.revision) || row.revision !== (previous?.revision || 0)) fail(409, 'Stunden wurden inzwischen geändert. Bitte neu laden und die Änderungen prüfen.', 'TIME_REVISION_CONFLICT');
        if (previous && (previous.personalNr !== einsatz.personalNr || previous.auftragNr !== einsatz.auftragNr)) fail(409, 'Die Einsatzzuordnung wurde verändert. Bitte separat klären.');
        const revision = row.revision + 1, at = new Date();
        if (input.action === 'withdraw') {
          if (!previous?.released) fail(409, 'Einsatz ist nicht an die Zeitverwaltung übergeben.', 'TIME_NOT_RELEASED');
          const result = await Stundenzeit.updateOne(
            { _id: einsatz._id, revision: row.revision },
            {
              $set: { revision, status: 'DRAFT' },
              $unset: { released: 1, releasedAt: 1, releasedBy: 1 },
              $push: { history: { revision, action: 'WITHDRAWN', at, by: user._id, reason, values: previous.current } },
            },
            { session, runValidators: true },
          );
          if (result.modifiedCount !== 1) fail(409, 'Stunden wurden inzwischen geändert.', 'TIME_REVISION_CONFLICT');
          continue;
        }
        const current = calculate(date, row);
        const status = input.action === 'release' ? 'RELEASED' : 'DRAFT';
        const patch = { current, revision, status, ...(status === 'RELEASED' ? { released: current, releasedAt: at, releasedBy: user._id } : {}) };
        const history = { revision, action: status, at, by: user._id, reason, values: current };
        if (previous) {
          const result = await Stundenzeit.updateOne({ _id: einsatz._id, revision: row.revision }, { $set: patch, $push: { history } }, { session, runValidators: true });
          if (result.modifiedCount !== 1) fail(409, 'Stunden wurden inzwischen geändert.', 'TIME_REVISION_CONFLICT');
        } else {
          const employees = await Mitarbeiter.find(employeeNumberQuery([einsatz.personalNr])).select('_id').limit(2).session(session).lean();
          if (employees.length !== 1) fail(409, 'Der Mitarbeiter ist nicht eindeutig zugeordnet.');
          await Stundenzeit.create([{ _id: einsatz._id, mitarbeiter: employees[0]._id, personalNr: einsatz.personalNr, auftragNr: einsatz.auftragNr, schicht: shift?._id || null, ...patch, history: [history] }], { session });
        }
      }
    });
  } catch (error) {
    if (error.code === 11000) fail(409, 'Inzwischen wurden Stunden erfasst. Bitte neu laden.', 'TIME_REVISION_CONFLICT');
    throw error;
  }
}
async function monthView(user, employeeId, month) {
  const employee = await employeeForUser(user, employeeId);
  const { from, till } = monthRange(month);
  const [entries, availableDayEntryTypes] = await Promise.all([
    Stundenzeit.find({ mitarbeiter: employee._id, 'released.date': { $gte: from, $lt: till } }).lean(),
    dayEntryTypes(),
  ]);
  const assignments = await Einsatz.find({ personalNr: { $in: employeeNumbers(employee) }, isPseudo: { $ne: true }, $or: [
    { detailDatumVon: { $gte: new Date(from), $lt: new Date(till) } },
    { detailDatumVon: null, datumVon: { $gte: new Date(from), $lt: new Date(till) } },
  ] }).select('_id auftragNr schicht detailDatumVon datumVon uhrzeitVon uhrzeitBis').lean();
  // Access to a complete employee month is governed by the employee's location,
  // while editing an individual order separately requires that order's location.
  const orders = await Auftrag.find({ auftragNr: { $in: [...entries, ...assignments].map(item => item.auftragNr) } }).select('auftragNr eventTitel eventLocation eventOrt locationV2').lean();
  const shifts = await Schicht.find({ _id: { $in: assignments.map(item => item.schicht).filter(Boolean) } }).select('_id uhrzeitVon uhrzeitBis').lean();
  const releasedIds = new Set(entries.map(item => String(item._id)));
  const pending = assignments.filter(item => !releasedIds.has(String(item._id)) && canAccess(user, orders.find(order => order.auftragNr === item.auftragNr)?.locationV2));
  return {
    employee: { id: String(employee._id), personalNr: employee.personalnr, name: [employee.vorname, employee.nachname].filter(Boolean).join(' '), monthlyHours: employee.arbeitszeit?.monat ?? 0, employmentLabel: ['Vollzeit', 'Teilzeit', 'Geringfügig beschäftigt', 'Kurzfristig beschäftigt'][employee.arbeitsverhaeltnis?.typ] || 'Arbeitsverhältnis' },
    month,
    dayEntryTypes: availableDayEntryTypes,
    initialData: { bankMinutes: 0, entries: [...entries.map(item => {
      const order = orders.find(value => value.auftragNr === item.auftragNr);
      return { id: String(item._id), einsatzId: String(item._id), schichtId: item.schicht ? String(item.schicht) : null, auftragNr: item.auftragNr,
        date: item.released.date, kind: 'productive', code: 'P', credited: true,
        minutes: item.released.netMinutes, originalMinutes: item.employeeSubmission?.netMinutes ?? item.released.netMinutes,
        label: order?.eventTitel || `Auftrag ${item.auftragNr}`, location: order?.eventLocation || order?.eventOrt || '',
        source: 'Schnellerfassung · übergeben', note: `${item.released.start}–${item.released.end} · ${item.released.breakMinutes} Min. Pause`,
      };
    }), ...pending.map(item => {
      const order = orders.find(value => value.auftragNr === item.auftragNr);
      const shift = shifts.find(value => String(value._id) === String(item.schicht));
      const start = item.uhrzeitVon || shift?.uhrzeitVon;
      const end = item.uhrzeitBis || shift?.uhrzeitBis;
      return { id: String(item._id), einsatzId: String(item._id), schichtId: item.schicht ? String(item.schicht) : null, auftragNr: item.auftragNr,
        date: (item.detailDatumVon || item.datumVon).toISOString().slice(0, 10), kind: 'planned', code: 'O', credited: false,
        minutes: scheduledMinutes(start, end), originalMinutes: scheduledMinutes(start, end), locked: true, label: order?.eventTitel || `Auftrag ${item.auftragNr}`,
        location: order?.eventLocation || order?.eventOrt || '', source: 'Ausstehend · Schnellerfassung öffnen', note: start && end ? `${start}–${end} · geplant` : '',
      };
    })] },
  };
}
module.exports = { publicStatus, submitEmployee, review, employeeOrders, saveReview, monthView, dayEntryTypes, calculate, canAccess, orderForUser, objectId, fail };
