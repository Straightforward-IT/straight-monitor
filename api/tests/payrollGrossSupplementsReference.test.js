const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const hours = require('../domain/payroll/zvooveHours');
const exact = require('../services/tariffs/tariffMoney');
const fixture = require('./fixtures/payroll/supplements-2026-06-09.json');

function difference(left, right) {
  const subtrahend = exact.decimalParts(right);
  return exact.money(exact.add(exact.decimalParts(left), { ...subtrahend, numerator: -subtrahend.numerator }));
}

// Deliberately derives only the productive 100/110 subtotal. Reference gross,
// taxable totals, planned shifts and customer F rules are never rate inputs.
async function productiveSubtotal({ personalNr, month, rows }) {
  const staff = structuredClone(fixture.employees.find(e => e.employee.personalnr === personalNr));
  const employee = new Mitarbeiter(staff.employee);
  const sheet = XLSX.utils.aoa_to_sheet([fixture.hoursColumns]);
  for (const [row, ...values] of rows) XLSX.utils.sheet_add_aoa(sheet, [values], { origin: { r: row - 1, c: 0 } });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Tabelle1');
  const parsed = hours.parseWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), fixture.hoursSources[month]);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.month, month);
  const resolved = hours.resolveRows(parsed.rows, [employee], fixture.wageTypes);
  assert.deepEqual(resolved.issues, []);
  assert.ok(resolved.rows.every(row => row.employeeId === String(employee._id) && row.matchStatus === 'MATCHED'));
  const days = resolved.rows.flatMap(row => row.days);
  assert.ok(days.every(day => ['productive', 'marker'].includes(day.kind)), 'Paid absences require their own calculation.');
  for (const number of ['100', '110']) {
    assert.equal(fixture.wageTypes.find(type => type.lohnartNummer === number).berechnungsartCode, '2');
  }
  const productive = days.filter(day => day.kind === 'productive');
  let base = exact.zero(), allowance = exact.zero();
  const dailyRates = [];
  for (const day of productive) {
    const wage = await employee.getTariffHourlyWage(day.date, staff.context);
    assert.equal(wage.status, 'RESOLVED', `${personalNr} ${day.date}: ${wage.code}`);
    const quantity = exact.decimalParts(day.hours);
    base = exact.add(base, exact.multiply(quantity, exact.decimalParts(wage.baseRate)));
    allowance = exact.add(allowance, exact.multiply(quantity, exact.decimalParts(wage.aboveTariff)));
    dailyRates.push({ date: day.date, base: wage.baseRate, allowance: wage.aboveTariff });
  }
  return { hours: hours.sumDecimals(productive.map(day => day.hours)), base: exact.money(base),
    allowance: exact.money(allowance), subtotal: exact.money(exact.add(base, allowance)), dailyRates };
}

describe('Zvoove supplement references: ten monthly rows, June–September 2026', () => {
  const expected = [
    ['48.5', '741.57', '84.10'], ['0', '0.00', '0.00'],
    ['5', '76.45', '13.38'], ['38.75', '607.21', '0.00'],
    ['12', '183.48', '0.00'], ['24.5', '374.61', '19.11'],
    ['41.25', '630.71', '13.38'], ['53.75', '860.00', '0.00'],
    ['48.75', '763.91', '-161.24'], ['8', '125.36', '0.00'],
  ];
  for (const [index, record] of fixture.cases.entries()) {
    const [quantity, subtotal, gap] = expected[index];
    it(`${record.personalNr} ${record.month}: derives EUR ${subtotal}; unexplained gross difference EUR ${gap}`, async () => {
      const result = await productiveSubtotal(record);
      assert.equal(result.hours, quantity);
      assert.equal(result.subtotal, subtotal);
      // A nonzero difference is a documented missing component, not an
      // automatically inferred night premium or a successful gross calculation.
      assert.equal(difference(record.reference.gross, result.subtotal), gap);
      if (record.personalNr !== '2001170') {
        assert.equal(result.subtotal, exact.money(exact.decimalParts(record.reference.taxableCurrent)));
      }
    });
  }

  it('includes the independent September ÜTZ of EUR 0.33 exactly once, separately from position 100', async () => {
    const record = fixture.cases.find(c => c.personalNr === '2001120' && c.month === '2026-09');
    const result = await productiveSubtotal(record);
    assert.equal(result.base, '842.26');
    assert.equal(result.allowance, '17.74');
    assert.equal(result.subtotal, '860.00');
    assert.deepEqual([...new Set(result.dailyRates.map(r => `${r.base}+${r.allowance}`))], ['15.67+0.33']);
  });

  it('keeps the AZK case and its other taxable payment unresolved instead of forcing the gross limit', async () => {
    const record = fixture.cases.find(c => c.personalNr === '2001170');
    const staff = fixture.employees.find(e => e.employee.personalnr === record.personalNr);
    assert.equal(staff.context.data.assignments.find(a => a.validFrom <= '2026-09-30' && (!a.validUntil || a.validUntil >= '2026-09-01')).employeeGroupId, '27356');
    assert.ok(staff.context.data.periods.some(p => p.wageRules.some(r => r.values.ILOHNARTNR === 192)));
    const result = await productiveSubtotal(record);
    assert.equal(result.subtotal, '763.91');
    assert.equal(record.reference.taxableCurrent, '485.14');
    assert.equal(record.reference.taxableOther, '117.53');
    assert.equal(exact.money(exact.decimalParts(exact.addDecimals(record.reference.taxableCurrent, record.reference.taxableOther))), '602.67');
    assert.notEqual(result.subtotal, record.reference.gross);
  });

  it('finds invoice night conditions but no employee wage condition or released actual interval', () => {
    const { candidateCustomerConditions, releasedActualIntervals, plannedNightExample } = fixture.coverage;
    assert.equal(candidateCustomerConditions.filter(c => c.verwendung === 'L').length, 0);
    assert.ok(candidateCustomerConditions.some(c => c.verwendung === 'F' && c.lohnartNummer === '166' && c.regelArt === 'uhrzeit'));
    assert.deepEqual(releasedActualIntervals, []);
    const plan = plannedNightExample[0];
    assert.equal(plan.kind, 'planned');
    assert.equal(plan.date, '2026-08-29');
    assert.equal(plan.start, '21:30');
    assert.equal(plan.end, '03:30');
    // Six planned hours versus five imported productive hours do not specify
    // the actual night interval or when the unpaid time occurred.
    const record = fixture.cases.find(c => c.personalNr === plan.personalNr && c.month === '2026-08');
    const rawHours = record.rows.flatMap(([, ...values]) => fixture.hoursColumns
      .filter(key => /^T\d$/.test(key)).map(key => values[fixture.hoursColumns.indexOf(key)]));
    assert.equal(hours.sumDecimals(rawHours), '5');
  });
});
