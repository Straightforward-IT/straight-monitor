const { getAverageStorageType } = require('./averageStorageTypes');
const { decimal, sumDecimals } = require('./zvooveHours');
const exact = require('../../services/tariffs/tariffMoney');
const { fail } = require('./detailImport');

function period(cutoff, count = 3) {
  const parsed = typeof cutoff === 'string' ? new Date(`${cutoff}T12:00:00Z`) : null;
  if (typeof cutoff !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(cutoff) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== cutoff) fail('Gültigen Stichtag angeben.');
  if (!/^\d+$/.test(String(count)) || Number(count) < 1 || Number(count) > 12) fail('Zwischen 1 und 12 Monate auswählen.');
  const [year, month] = cutoff.split('-').map(Number);
  return Array.from({ length: Number(count) }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - Number(count) + index, 1));
    return date.toISOString().slice(0, 7);
  });
}
const signValue = (value, sign) => sign === 0 ? '0' : value == null || sign == null ? null : decimal(sign < 0 ? String(value).startsWith('-') ? String(value).slice(1) : `-${value}` : value);
const total = values => values.some(value => value == null) ? null : sumDecimals(values);
function ratio(numerator, denominator) {
  if (numerator == null || denominator == null || Number(denominator) <= 0) return null;
  const a = exact.decimalParts(numerator), b = exact.decimalParts(denominator);
  return exact.money({ numerator: a.numerator * b.denominator, denominator: a.denominator * b.numerator });
}

function workingDates(month) {
  const date = new Date(`${month}-01T12:00:00Z`), dates = new Set();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(+date)) fail('Gültigen Kalendermonat angeben.');
  while (date.toISOString().startsWith(month)) {
    if (![0, 6].includes(date.getUTCDay())) dates.add(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

/** SP1 controls historical L quantities/amounts; calendar weekdays form the denominator. */
function calculate({ months, positions, dayEntries, wages, missingDayMonths = [], missingWageMonths = [] }) {
  const wageMap = new Map(wages.map(wage => [String(wage.lohnartNummer), wage]));
  const issues = [], groups = new Map();
  const addIssue = (code, message, extra = {}) => issues.push({ code, message, ...extra });
  for (const row of positions.filter(row => row.side === 'L' && months.includes(row.month))) {
    const wage = wageMap.get(String(row.wageType)), storage = getAverageStorageType(wage?.durchschnittsspeicherCode);
    const contributions = storage?.contributions;
    const key = JSON.stringify([row.month, row.personalNr, row.wageType]);
    if (!groups.has(key)) groups.set(key, { month: row.month, personalNr: row.personalNr, wageType: row.wageType,
      label: wage?.lohnartBezeichnung || `Lohnart ${row.wageType}`, sp1: wage?.durchschnittsspeicherCode || null,
      rule: storage?.label || 'SP1 ungeklärt', hours: [], amount: [], sourceRows: 0, contributions });
    const group = groups.get(key); group.sourceRows++;
    group.hours.push(signValue(row.hours, contributions?.hours)); group.amount.push(signValue(row.amount, contributions?.amount));
    if (!storage) addIssue('SP1_UNKNOWN', `SP1 für Lohnart ${row.wageType} fehlt oder ist unbekannt.`, { month: row.month, wageType: row.wageType });
  }
  // Fully excluded amounts stay out of the table; unknown settings stay visible.
  const rows = [...groups.values()].filter(group => !group.contributions || Object.values(group.contributions).some(value => value === 1 || value === -1))
    .map(({ contributions, hours, amount, ...group }) => ({ ...group, hours: total(hours), amount: total(amount) }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.personalNr.localeCompare(b.personalNr) || Number(a.wageType) - Number(b.wageType));
  const days = months.map(month => {
    const dates = workingDates(month);
    const fs = new Set(dayEntries.filter(entry => dates.has(entry.date) && String(entry.kb).toUpperCase() === 'FS').map(entry => entry.date));
    if (missingDayMonths.includes(month)) addIssue('FS_SOURCE_MISSING', `Für ${month} fehlt der Tagesstand zur FS-Aufschlüsselung. Die Werktage werden vollständig aus dem Kalender gezählt.`, { month });
    if (missingWageMonths.includes(month)) addIssue('WAGE_SOURCE_MISSING', `Für ${month} fehlen historische AUSWEISLOHN-Positionen im Quelldatenstand.`, { month });
    return { month, days: String(dates.size), knownDays: String(dates.size), fsDays: missingDayMonths.includes(month) ? null : fs.size };
  });
  const hours = missingWageMonths.length ? null : total(rows.map(row => row.hours));
  const amount = missingWageMonths.length ? null : total(rows.map(row => row.amount));
  const workdays = total(days.map(row => row.days));
  if (hours == null) addIssue('HOURS_INCOMPLETE', 'Die Stundensumme ist wegen fehlender Quelldaten oder SP1-Einstellungen unvollständig.');
  if (amount == null) addIssue('AMOUNT_INCOMPLETE', 'Die Betragssumme ist wegen fehlender Quelldaten oder SP1-Einstellungen unvollständig.');
  if (workdays != null && Number(workdays) <= 0) addIssue('NO_WORKDAYS', 'Für den Schnitt sind positive Arbeitstage erforderlich.');
  if (hours != null && Number(hours) <= 0) addIssue('NO_HOURS', 'Für den Stundenbetrag sind positive Stunden erforderlich.');
  return { rows, days, totals: { hours, days: workdays, amount, averageHours: ratio(hours, workdays), averageAmount: ratio(amount, hours), dailyRate: ratio(amount, workdays) },
    status: issues.some(issue => issue.code !== 'FS_SOURCE_MISSING') ? 'INCOMPLETE' : 'CALCULATED', issues: [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()] };
}
module.exports = { period, calculate, ratio, workingDates };
