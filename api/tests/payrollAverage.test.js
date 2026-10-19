const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const average = require('../domain/payroll/averageCalculation');
const history = require('../domain/payroll/ausweislohnHistory');
const { parseWageTypeWorkbook } = require('../domain/payroll/wageTypeImport');
const wage = (number, code, extra = {}) => ({ lohnartNummer: number, durchschnittsspeicherCode: code, lohnartBezeichnung: `Lohnart ${number}`, fuerGesamtstunden: number === '100' ? 'Ja' : 'Nein', ...extra });
const row = (wageType, hours, amount, extra = {}) => ({ wageType, hours, amount, side: 'L', month: '2026-07', personalNr: '1', date: '2026-07-31', ...extra });
const day = (date, extra = {}) => ({ date, kind: 'productive', kb: '', ...extra });
const calculate = extra => average.calculate({ months: ['2026-07'], positions: [row('100', '8', '160')], wages: [wage('100', '1')], dayEntries: [day('2026-07-01')], ...extra });

describe('SP1 historical average calculation', () => {
  it('uses full months preceding the cutoff including year transitions and rejects invalid input', () => {
    assert.deepEqual(average.period('2026-08-01', 3), ['2026-05', '2026-06', '2026-07']);
    assert.deepEqual(average.period('2026-01-15', '3'), ['2025-10', '2025-11', '2025-12']);
    for (const value of ['2026-02-30', '2026-12-99', '', ['2026-08-01']]) assert.throws(() => average.period(value), error => error.statusCode === 400);
    for (const value of [0, 13, '3x', 2.5]) assert.throws(() => average.period('2026-08-01', value));
  });
  it('applies SP1 to hours and amounts, ignores F and retains the full calendar denominator', () => {
    const result = calculate({ positions: [row('100', '8', '160'), row('110', '8', '10'), row('146', '4', '20'), row('100', '999', '99999', { side: 'F' }), row('522', '0', '25')],
      wages: [wage('100', '1'), wage('110', '2'), wage('146', '2'), wage('522', '0')],
      dayEntries: [day('2026-07-01'), day('2026-07-01'), day('2026-07-02', { kind: 'marker', kb: 'FS' }), day('2026-07-02', { kind: 'marker', kb: 'FS' })] });
    assert.equal(result.rows.length, 3); assert.equal(result.rows.find(row => row.wageType === '110').hours, '0');
    assert.deepEqual(result.totals, { hours: '8', days: '23', amount: '190', averageHours: '0.35', averageAmount: '23.75', dailyRate: '8.26' });
    assert.equal(result.days[0].fsDays, 1);
  });
  it('supports subtraction and hours-only contributions without multiplying wage type days', () => {
    const result = calculate({ positions: [row('100', '8', '160'), row('6', '8', '10'), row('7', '1', '300'), row('4', '2', '999')], wages: [wage('100', '1'), wage('6', '6'), wage('7', '7'), wage('4', '4')] });
    assert.equal(result.totals.hours, '9'); assert.equal(result.totals.amount, '150'); assert.equal(result.totals.days, '23');
  });
  it('counts every Monday through Friday and restricts the FS breakdown to those weekdays', () => {
    const result = calculate({ wages: [wage('100', '1'), wage('310', '1', { kb: 'U' })], dayEntries: [day('2026-07-03', { kb: 'FS', kind: 'marker' }), day('2026-07-04'), day('2026-07-05', { kb: 'U', kind: 'absence', lohnartNummer: '310' }), day('2026-07-11', { kb: 'FS', kind: 'marker' })] });
    assert.equal(result.totals.days, '23'); assert.equal(result.days[0].fsDays, 1); assert.equal(result.totals.hours, '8');
    assert.equal(calculate({ dayEntries: [] }).totals.days, '23');
    assert.equal(average.workingDates('2024-02').size, 21);
    assert.equal(average.workingDates('2026-02').size, 20);
  });
  it('retains real zero, marks unknown metadata and keeps unqualified amounts from blocking hours', () => {
    const result = calculate({ positions: [row('100', '0', '0')] });
    assert.equal(result.totals.hours, '0'); assert.equal(result.totals.averageHours, '0.00'); assert.equal(result.totals.averageAmount, null);
    const missing = calculate({ wages: [] }); assert.equal(missing.totals.hours, null); assert.equal(missing.totals.amount, null); assert.equal(missing.totals.days, '23');
    const zero = calculate({ positions: [row('100', '8', '160'), row('4', '2', null)], wages: [wage('100', '1'), wage('4', '4')] });
    assert.equal(zero.totals.amount, '160'); assert.equal(zero.totals.hours, '10');
  });
  it('keeps calendar weekdays independent of absence SP1 and missing daily source coverage', () => {
    const result = calculate({ wages: [wage('100', '1'), wage('310', '0', { kb: 'U' })], dayEntries: [day('2026-07-01', { kind: 'absence', kb: 'U', lohnartNummer: '310' })] });
    assert.equal(result.totals.days, '23'); assert.equal(result.totals.dailyRate, '6.96');
    const missingDaily = calculate({ missingDayMonths: ['2026-07'] });
    assert.equal(missingDaily.totals.days, '23'); assert.equal(missingDaily.days[0].fsDays, null);
    assert.equal(missingDaily.status, 'CALCULATED'); assert.ok(missingDaily.issues.some(issue => issue.code === 'FS_SOURCE_MISSING'));
    assert.equal(calculate({ missingWageMonths: ['2026-07'] }).totals.amount, null);
  });
  it('rounds each ratio from exact sums, avoiding a one-cent error from multiplying displayed averages', () => {
    assert.equal(average.ratio('4855.5', '264'), '18.39'); assert.equal(average.ratio('264', '66'), '4.00');
    assert.equal(average.ratio('4855.5', '66'), '73.57'); assert.equal(average.ratio('73.56', '1'), '73.56');
    assert.equal(average.ratio('1.005', '1'), '1.01'); assert.equal(average.ratio('-1.005', '1'), '-1.01');
    assert.equal(average.ratio('1', '0'), null); assert.equal(average.ratio(null, '3'), null);
  });
  it('reproduces the reference wage groups from every real AUSWEISLOHN row and the real SP1 master', function () {
    this.timeout(30000);
    const positions = history.parse(fs.readFileSync(path.join(__dirname, '../assets/Ausweislohn 2026.xlsx')), 'Ausweislohn 2026.xlsx', 2026);
    assert.equal(positions.length, 66349); assert.equal(Object.keys(positions[0].fields).length, 24);
    const wages = parseWageTypeWorkbook(fs.readFileSync(path.join(__dirname, '../../Documentation/Lohnarten/Lohnarten.xlsx'))).records.map(record => ({ lohnartNummer: record.lohnartNummer, ...record.fields }));
    const months = ['2026-05', '2026-06', '2026-07'];
    const dayEntries = months.flatMap(month => Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
      .map(date => day(date, { kb: 'FS', kind: 'marker' })));
    const result = average.calculate({ months, positions: positions.filter(row => row.personalNr === '2000638'), wages, dayEntries });
    assert.equal(result.rows.length, 7); assert.deepEqual(result.days.map(row => row.days), ['21', '22', '23']);
    assert.deepEqual(result.totals, { hours: '264', days: '66', amount: '4855.5', averageHours: '4.00', averageAmount: '18.39', dailyRate: '73.57' });
    assert.equal(result.status, 'CALCULATED');
    const corrected = average.calculate({ months, positions: positions.filter(row => row.personalNr === '2000134'), wages,
      dayEntries: dayEntries.map(entry => entry.date >= '2026-07-13' && entry.date <= '2026-07-15' ? { ...entry, kb: 'FA', kind: 'absence', lohnartNummer: '306' } : entry) });
    assert.deepEqual(corrected.days.map(row => row.days), ['21', '22', '23']);
    // Preserve the export's stored decimal precision; the displayed hours are 470,00.
    assert.deepEqual(corrected.totals, { hours: '469.9999999999999976', days: '66', amount: '7430.55', averageHours: '7.12', averageAmount: '15.81', dailyRate: '112.58' });
  });
});

describe('AUSWEISLOHN source adapter', () => {
  function file(records, columns = history.COLUMNS) {
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns, ...records.map(record => columns.map(column => record[column] ?? null))]), 'Tabelle1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
  const sample = { PERSONALNR: 1, JAHR: 2026, MONAT: 7, WOCHE: 5, TAG: 5, VERWENDUNG: 'L', LOHNARTNR: 100, LFDNR: 1, STUNDEN: 8, BETRAG: 0 };
  it('keeps all 24 explicit fields, missing orders, zero and signed corrections', () => {
    const result = history.parse(file([sample, { ...sample, LFDNR: 2, STUNDEN: -2, BETRAG: -40 }]), 'fixture.xlsx', 2026);
    assert.equal(result[0].date, '2026-07-31'); assert.equal(result[0].fields.AUFTRAGNR, null); assert.equal(result[0].amount, '0'); assert.equal(result[1].hours, '-2');
  });
  it('rejects duplicates, incompatible columns, wrong years, and conflicting calendar dates', () => {
    assert.throws(() => history.parse(file([sample, sample]), 'fixture.xlsx', 2026), /Doppelte/);
    assert.throws(() => history.parse(file([sample], history.COLUMNS.slice(1)), 'fixture.xlsx', 2026), /Spalten/);
    assert.throws(() => history.parse(file([sample]), 'fixture.xlsx', 2025), /Quelljahr/);
    assert.throws(() => history.parse(file([{ ...sample, VON: '2026-07-30' }]), 'fixture.xlsx', 2026), /Kalenderfelder/);
  });
});
