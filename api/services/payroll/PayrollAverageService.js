const accounting = require('./AbrechnungService');
const hoursService = require('./ZvooveHoursService');
const history = require('./AusweislohnHistoryService');
const Lohnart = require('../../models/Payroll/Lohnart');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const average = require('../../domain/payroll/averageCalculation');
const { fail } = require('../../domain/payroll/detailImport');

async function calculate(user, employeeId, query) {
  if (!accounting.isPayroll(user)) fail('Für die Schnittberechnung fehlt die Lohnberechtigung.', 'AVERAGE_FORBIDDEN', 403);
  if (Object.keys(query).some(key => !['cutoff', 'months'].includes(key))) fail('Nur Stichtag und Monatsanzahl sind zulässig.');
  const employee = await accounting.employeeFor(user, employeeId);
  const months = average.period(query.cutoff, query.months ?? 3);
  const numbers = [...new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry.value)].filter(Boolean).map(String))];
  if (!numbers.length) fail('Für den Mitarbeiter fehlt die Personalnummer.', 'AVERAGE_PERSONNEL_MISSING', 422);
  const identities = await Mitarbeiter.find({ $or: [{ personalnr: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } }] }).select('personalnr personalnrHistory').lean();
  if (identities.some(row => String(row._id) !== String(employee._id))) fail('Eine historische Personalnummer ist mehreren Mitarbeitern zugeordnet.', 'AVERAGE_IDENTITY_AMBIGUOUS', 409);
  const wages = await Lohnart.find().select('lohnartNummer lohnartBezeichnung durchschnittsspeicherCode fuerGesamtstunden kb').lean();
  const sources = await Promise.all([...new Set(months.map(month => month.slice(0, 4)))].map(year => history.read(year)));
  const positions = sources.flatMap(source => source.rows).filter(row => numbers.includes(row.personalNr) && row.side === 'L' && months.includes(row.month));
  const monthly = [];
  for (const month of months) monthly.push(await hoursService.month(user, employeeId, month));
  const result = average.calculate({ months, positions, wages,
    dayEntries: monthly.flatMap(month => month.monthlyReference.entries),
    missingDayMonths: monthly.filter(month => !month.monthlyReference.available || !month.monthlyReference.entries.length && positions.some(row => row.month === month.month)).map(month => month.month),
    missingWageMonths: months.filter(month => !sources.some(source => source.rows.some(row => row.side === 'L' && row.month === month))),
  });
  if (months.includes('2026-10')) { result.status = 'PROVISIONAL'; result.issues.push({ code: 'HISTORY_PROVISIONAL', message: 'Oktober 2026 ist in der bereitgestellten AUSWEISLOHN-Datei vorläufig.' }); }
  return { ...result, employee: { id: employeeId, personalNr: employee.personalnr, name: [employee.vorname, employee.nachname].filter(Boolean).join(' ') },
    cutoff: query.cutoff, months, storage: 'SP1', mode: 'ZVOOVE_HISTORY',
    sources: sources.map(source => ({ filename: source.filename, hash: source.hash })),
    daySources: monthly.map(month => ({ month: month.month, revision: month.monthlyReference.datasetRevision })),
    rounding: 'HALF_UP_FINAL_2', dayBasis: 'CALENDAR_MONDAY_TO_FRIDAY' };
}
module.exports = { calculate };
