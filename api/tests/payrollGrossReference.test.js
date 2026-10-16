const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const hours = require('../domain/payroll/zvooveHours');
const { WageCalculationType } = require('../domain/payroll/wageCalculationTypes');
const exact = require('../services/tariffs/tariffMoney');
const referenceCase = require('./fixtures/payroll/1003293-2026-06.json');

function inputs() {
  const { employee: record, hoursSource, tariffContext, wageTypes } = structuredClone(referenceCase);
  const employee = new Mitarbeiter(record);
  const sheet = XLSX.utils.aoa_to_sheet([hoursSource.columns]);
  for (const row of hoursSource.rows) {
    XLSX.utils.sheet_add_aoa(sheet, [row.values], { origin: { r: row.row - 1, c: 0 } });
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, hoursSource.sheet);
  const parsed = hours.parseWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), hoursSource.filename);
  assert.deepEqual(parsed.issues, [], 'The independent hours source must parse without issues.');
  const resolved = hours.resolveRows(parsed.rows, [employee], wageTypes);
  assert.deepEqual(resolved.issues, [], 'Personnel and KB assignments must be unambiguous.');
  assert.ok(resolved.rows.every(row => row.employeeId === String(employee._id) && row.matchStatus === 'MATCHED'));
  return { employee, context: tariffContext, wageTypes, rows: resolved.rows, month: parsed.month };
}

// A bounded reference calculation, not a general payroll engine. The amount
// under test is derived only from imported hours and the real employee methods;
// the expected monthly result is deliberately not an argument to this function.
async function normalHoursAmount({ employee, context, wageTypes, rows }) {
  const normalHours = wageTypes.filter(type => type.lohnartNummer === '100');
  assert.equal(normalHours.length, 1, 'Basis-Lohnart 100 must exist exactly once.');
  assert.equal(normalHours[0].berechnungsartCode, WageCalculationType.HOURS_RATE);
  const days = rows.flatMap(row => row.days);
  assert.ok(days.every(day => ['productive', 'marker'].includes(day.kind)),
    'This reference calculation does not cover paid absences or unresolved KB.');
  const productive = days.filter(day => day.kind === 'productive');
  const rates = [];
  let amount = exact.zero();
  for (const day of productive) {
    const wage = await employee.getTariffHourlyWage(day.date, context);
    assert.equal(wage.status, 'RESOLVED', `${day.date}: ${wage.code || wage.message || 'Hourly wage unresolved'}`);
    assert.equal(wage.aboveTariff, '0', `${day.date}: Nonzero ÜTZ requires a separate 110/offset calculation.`);
    // Position 100 uses the base rate. Never count an additional 110 twice.
    amount = exact.add(amount, exact.multiply(exact.decimalParts(day.hours), exact.decimalParts(wage.baseRate)));
    rates.push(wage.baseRate);
  }
  return { amount: exact.money(amount), hours: hours.sumDecimals(productive.map(day => day.hours)),
    days: new Set(productive.map(day => day.date)).size, rates: [...new Set(rates)] };
}

describe('Zvoove gross reference: Personalnummer 1003293, June 2026', () => {
  it('reproduces the independent monthly gross of EUR 1162.04 from actual hours and dated tariff data', async () => {
    const data = inputs();
    const expected = referenceCase.reference;
    assert.equal(expected.personalNr, data.employee.personalnr);
    assert.equal(data.month, `${expected.year}-${String(expected.month).padStart(2, '0')}`);
    assert.equal(data.rows.length, 6);
    assert.deepEqual(data.rows.map(row => row.source.row), [302, 810, 1818, 1970, 3052, 3344]);
    assert.equal(data.rows.flatMap(row => row.days).filter(day => day.kind === 'marker').length, 18);
    assert.deepEqual(data.context.data.allowances, []);

    const result = await normalHoursAmount(data);
    assert.equal(result.hours, '76');
    assert.equal(result.days, 12);
    assert.deepEqual(result.rates, ['15.29']);
    assert.equal(result.amount, expected.gross);
    assert.equal(result.amount, '1162.04');
  });

  it('uses the June rate rather than the later rate of EUR 15.67', async () => {
    const { employee, context } = inputs();
    assert.equal((await employee.getTariffHourlyWage('2026-08-31', context)).value, '15.29');
    assert.equal((await employee.getTariffHourlyWage('2026-09-01', context)).value, '15.67');
  });

  it('fails with the affected date when a tariff rate is missing instead of assuming zero', async () => {
    const data = inputs();
    data.context.data.periods[0].rates = [];
    await assert.rejects(() => normalHoursAmount(data), /2026-06-02: RATE_MISSING/);
  });

  it('fails with the affected date when ÜTZ is ambiguous instead of silently omitting it', async () => {
    const data = inputs();
    const row = { employeeId: String(data.employee._id), personalNr: data.employee.personalnr,
      matchStatus: 'MATCHED', validFrom: '2026-01-01', validUntil: null };
    data.context.data.allowances = [{ ...row, values: { DPREIS: '1' } }, { ...row, values: { DPREIS: '2' } }];
    await assert.rejects(() => normalHoursAmount(data), /2026-06-02: ABOVE_TARIFF_AMBIGUOUS/);
  });

  it('requires a separate calculation if the case acquires a nonzero ÜTZ', async () => {
    const data = inputs();
    data.context.data.allowances = [{ employeeId: String(data.employee._id), personalNr: data.employee.personalnr,
      matchStatus: 'MATCHED', validFrom: '2026-01-01', validUntil: null, values: { DPREIS: '1' } }];
    await assert.rejects(() => normalHoursAmount(data), /Nonzero ÜTZ requires a separate 110\/offset calculation/);
  });
});
