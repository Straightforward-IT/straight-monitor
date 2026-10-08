const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const tariffs = require('../tariffs/TariffService');
const { findForEmployee } = require('./EinsatzCountingService');
const exact = require('../tariffs/tariffMoney');

const MODES = Object.freeze({
  '21015': { type: 'days-hours', title: 'KZF normal' },
  '21195': { type: 'hours', title: 'Festangestellt' },
  '22436': { type: 'days-hours', title: 'KZF Pauschal' },
  '23437': { type: 'days-earnings', title: 'KZF 603 ohne AZK' },
  '27356': { type: 'days-earnings', title: 'KZF 603 mit AZK' },
});
// Own contracts retain the previous employment-based presentation. Only a
// missing assignment permits this fallback; conflicting tariff rows do not.
const EMPLOYMENT_MODES = Object.freeze({
  0: { type: 'hours', title: 'Vollzeit beschäftigt' },
  1: { type: 'hours', title: 'Teilzeit beschäftigt' },
  3: { type: 'days', title: 'Kurzfristig beschäftigt' },
});
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
function berlinDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function berlinInstant(day, hour = 0, minute = 0) {
  const target = new Date(`${day}T00:00:00Z`).getTime() + (hour * 60 + minute) * 60000;
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' });
  let instant = target;
  for (let i = 0; i < 2; i++) {
    const offset = formatter.formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName').value.match(/GMT([+-])(\d+)(?::(\d+))?/);
    const minutesOffset = offset ? (Number(offset[2]) * 60 + Number(offset[3] || 0)) * (offset[1] === '-' ? -1 : 1) : 0;
    instant = target - minutesOffset * 60000;
  }
  return new Date(instant);
}
function dayWindow(entryValue, year) {
  const first = `${year}-01-01`, last = `${year}-12-31`;
  const entry = entryValue ? berlinDay(entryValue) : null;
  if (entry && entry > last) return null;
  const from = entry && entry.slice(0, 4) !== String(year) ? entry : first;
  return { from, through: last, label: from === first ? `im Kalenderjahr ${year}` : `seit Eintritt am ${from.split('-').reverse().join('.')}` };
}
function clock(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
function assignmentHours(record) {
  const start = clock(record.uhrzeitVon), end = clock(record.uhrzeitBis);
  if (record.endeOffen !== 1 && start !== null && end !== null) {
    let minutes = end - start;
    if (minutes <= 0) minutes += 1440;
    return { numerator: BigInt(minutes), denominator: 60n };
  }
  if (typeof record.bedarf === 'number' && Number.isFinite(record.bedarf) && record.bedarf >= 0) return exact.decimalParts(record.bedarf);
  return null;
}
function error(status, message) { const value = new Error(message); value.status = status; throw value; }

// The injectable facts allow focused verification without network or live data.
async function calculate(employee, { year, month, now = new Date(), context, records } = {}) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const today = berlinDay(now);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const groupDate = today.slice(0, 7) === monthKey ? today : `${monthKey}-${lastDay}`;
  const snapshot = context || await tariffs.createEmployeeContext(employee);
  const assignment = await employee.getTariffBaseRate(groupDate, snapshot);
  const group = assignment.group ? { legacyId: String(assignment.group.legacyId), name: assignment.group.name } : null;
  const fallback = !group && assignment.code === 'ASSIGNMENT_MISSING';
  const mode = group ? MODES[group.legacyId] : fallback ? EMPLOYMENT_MODES[employee.arbeitsverhaeltnis?.typ] : null;
  const result = { employeeId: String(employee._id), employeeName: [employee.vorname, employee.nachname].filter(Boolean).join(' '),
    year, month, groupDate, group, activeImportId: snapshot.importId, basis: 'ASSIGNMENT_PLANNED_HOURS',
    selectionBasis: fallback ? 'EMPLOYMENT_TYPE' : 'TARIFF_GROUP',
    fallbackReason: fallback ? 'Keine gültige Tarifzuordnung. Kontingent anhand des Arbeitsverhältnisses.' : null,
    eyebrow: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${monthKey}-01T12:00:00Z`)),
    type: mode?.type || 'notice', title: mode?.title || 'Tarifkontingent', status: 'RESOLVED', issues: [] };
  const unresolved = (code, message) => ({ ...result, type: 'notice', status: 'UNRESOLVED', issues: [{ code, message }] });
  if (!group && !fallback) return unresolved(assignment.code || 'ASSIGNMENT_MISSING', assignment.message || 'Die Tarifmitarbeitergruppe ist nicht eindeutig zugeordnet.');
  if (!mode) return group
    ? unresolved('GROUP_UNSUPPORTED', `Für Tarifmitarbeitergruppe ${group.legacyId} ist kein Kontingentmodell hinterlegt.`)
    : unresolved('EMPLOYMENT_TYPE_UNSUPPORTED', 'Für dieses Arbeitsverhältnis ist kein Kontingentmodell hinterlegt.');
  const monthWindow = { from: `${monthKey}-01`, through: `${monthKey}-${lastDay}` };
  const days = mode.type !== 'hours' ? dayWindow(employee.eintrittsdatum, year) : null;
  if (mode.type !== 'hours' && !days) return unresolved('EMPLOYMENT_NOT_STARTED', 'Der Eintritt liegt nach dem angezeigten Zeitraum.');
  result.periods = { days, earnings: mode.type === 'days-earnings' ? monthWindow : null, hours: mode.type === 'days' ? null : monthWindow };
  const window = days || monthWindow;
  const nextDay = new Date(`${window.through}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const facts = records || await findForEmployee(employee, {
    from: berlinInstant(window.from), through: new Date(berlinInstant(nextDay.toISOString().slice(0, 10)).getTime() - 1),
    select: 'datumVon uhrzeitVon uhrzeitBis bedarf endeOffen isPseudo',
  });
  const dayStates = new Map(), hourlyCache = new Map();
  const sums = { workedHours: exact.zero(), plannedHours: exact.zero(), workedEarnings: exact.zero(), plannedEarnings: exact.zero() };
  let earningsUnresolved = false;
  for (const record of facts) {
    const date = berlinDay(record.datumVon);
    if (record.isPseudo === true || !date || date < window.from || date > window.through) continue;
    const minutes = clock(record.uhrzeitVon) ?? 0;
    const worked = berlinInstant(date, Math.floor(minutes / 60), minutes % 60) <= now;
    // One started assignment makes the date used, even if another is planned.
    dayStates.set(date, Boolean(dayStates.get(date) || worked));
    if (date < monthWindow.from || date > monthWindow.through) continue;
    const hours = assignmentHours(record);
    if (!hours) {
      if (mode.type === 'days') continue;
      result.issues.push({ code: 'HOURS_MISSING', date, message: `${date}: Einsatzstunden fehlen.` });
      earningsUnresolved = true;
      continue;
    }
    const kind = worked ? 'worked' : 'planned';
    sums[`${kind}Hours`] = exact.add(sums[`${kind}Hours`], hours);
    if (mode.type !== 'days-earnings' || hours.numerator === 0n) continue;
    if (!hourlyCache.has(date)) hourlyCache.set(date, await employee.getTariffHourlyWage(date, snapshot));
    const wage = hourlyCache.get(date);
    if (wage.status !== 'RESOLVED') {
      earningsUnresolved = true;
      if (!result.issues.some(issue => issue.date === date && issue.code === wage.code)) result.issues.push({ code: wage.code, date, message: `${date}: ${wage.message}` });
      continue;
    }
    sums[`${kind}Earnings`] = exact.add(sums[`${kind}Earnings`], exact.multiply(hours, exact.decimalParts(wage.value)));
  }
  result.workedHours = Number(sums.workedHours.numerator) / Number(sums.workedHours.denominator);
  result.plannedHours = Number(sums.plannedHours.numerator) / Number(sums.plannedHours.denominator);
  if (mode.type === 'hours' || mode.type === 'days-hours') {
    const monthlyHours = Number(employee.arbeitszeit?.monat);
    if (!Number.isFinite(monthlyHours) || monthlyHours <= 0) {
      if (mode.type === 'hours') return unresolved('MONTHLY_HOURS_MISSING', 'Es sind keine gültigen Monatsstunden hinterlegt.');
      result.monthlyHours = null;
      result.issues.push({ code: 'MONTHLY_HOURS_MISSING', message: 'Es sind keine gültigen Monatsstunden hinterlegt.' });
    } else result.monthlyHours = monthlyHours;
    result.hoursIssues = result.issues.filter(issue => ['MONTHLY_HOURS_MISSING', 'HOURS_MISSING'].includes(issue.code));
    result.hoursStatus = result.hoursIssues.length ? 'UNRESOLVED' : 'RESOLVED';
  }
  if (mode.type !== 'hours') {
    result.dayLimit = 70;
    result.periodLabel = days.label;
    result.workedDays = [...dayStates.values()].filter(Boolean).length;
    result.plannedDays = dayStates.size - result.workedDays;
    result.priorEmployerDays = employee.vorarbeitgebertage?.year === year ? Math.max(0, Number(employee.vorarbeitgebertage.days) || 0) : 0;
  }
  if (mode.type === 'days-earnings') {
    result.earningsLimit = '603.00';
    result.earningsStatus = earningsUnresolved ? 'UNRESOLVED' : 'RESOLVED';
    result.workedEarnings = earningsUnresolved ? null : exact.money(sums.workedEarnings);
    result.plannedEarnings = earningsUnresolved ? null : exact.money(sums.plannedEarnings);
    result.totalEarnings = earningsUnresolved ? null : exact.money(exact.add(sums.workedEarnings, sums.plannedEarnings));
  }
  if (result.issues.length) result.status = 'UNRESOLVED';
  return result;
}
async function contingent(employeeId, query = {}) {
  if (!/^[a-f\d]{24}$/i.test(String(employeeId))) error(400, 'Ungültige Mitarbeiter-ID.');
  if (!/^\d{4}$/.test(String(query.year)) || !/^\d{1,2}$/.test(String(query.month))) error(400, 'Ein gültiges Jahr und ein Monat sind erforderlich.');
  const year = Number(query.year), month = Number(query.month);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) error(400, 'Jahr oder Monat ist ungültig.');
  const employee = await Mitarbeiter.findById(employeeId).select('personalnr personalnrHistory vorname nachname eintrittsdatum arbeitszeit arbeitsverhaeltnis vorarbeitgebertage');
  if (!employee) error(404, 'Mitarbeiter nicht gefunden.');
  return calculate(employee, { year, month });
}
module.exports = { contingent, calculate, MODES, berlinDay, assignmentHours };
