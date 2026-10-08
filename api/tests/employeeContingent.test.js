const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const { calculate, assignmentHours, berlinDay } = require('../services/operations/EmployeeContingentService');
const exact = require('../services/tariffs/tariffMoney');

function fixture(groupId = '23437') {
  const employee = new Mitarbeiter({ _id: new mongoose.Types.ObjectId(), personalnr: '2001113', personalnrHistory: [{ value: '2000841' }],
    vorname: 'Eva', nachname: 'Test', eintrittsdatum: '2025-11-15', arbeitszeit: { monat: 100 }, vorarbeitgebertage: { year: 2026, days: 5 }, arbeitsverhaeltnis: { typ: 0 } });
  const row = { employeeId: String(employee._id), personalNr: '2001113', matchStatus: 'MATCHED', validFrom: '2025-01-01', validUntil: null };
  const context = { employeeId: String(employee._id), importId: 'snapshot', data: {
    currentPersonalNr: employee.personalnr,
    assignments: [{ ...row, legacyId: '1', employeeGroupId: groupId, payGroupId: 'eg', stageId: 'stage' }],
    allowances: [],
    groups: [{ legacyId: groupId, name: 'Testvariante', payGroups: [{ legacyId: 'eg', position: 1 }], stages: [{ legacyId: 'stage', position: 1 }] }],
    periods: [{ legacyId: 'old', employeeGroupId: groupId, validFrom: '2025-01-01', validUntil: '2026-10-15', rates: [{ stagePosition: 1, groupPosition: 1, value: '15.33' }] },
      { legacyId: 'new', employeeGroupId: groupId, validFrom: '2026-10-16', validUntil: null, rates: [{ stagePosition: 1, groupPosition: 1, value: '16.08' }] }],
  } };
  const run = (records = [], overrides = {}) => calculate(employee, { year: 2026, month: 10, now: new Date('2026-10-08T10:00:00Z'), context, records, ...overrides });
  return { employee, context, row, run };
}
const shift = (day, from = '08:00', to = '10:00') => ({ datumVon: new Date(`${day}T00:00:00Z`), uhrzeitVon: from, uhrzeitBis: to });

describe('Tarifgesteuerte Mitarbeiterkontingente', () => {
  it('ordnet alle fünf Varianten ausschließlich anhand der Tarifmitarbeitergruppe zu', async () => {
    for (const [id, type] of [['21015', 'days-hours'], ['21195', 'hours'], ['22436', 'days-hours'], ['23437', 'days-earnings'], ['27356', 'days-earnings']]) {
      const { run } = fixture(id);
      const result = await run([shift('2026-10-01')]);
      assert.equal(result.type, type);
      assert.equal(result.group.legacyId, id);
      if (type === 'hours') assert.equal(result.monthlyHours, 100);
      else assert.equal(result.dayLimit, 70);
      if (type === 'days-hours') {
        assert.equal(result.monthlyHours, 100);
        assert.equal(result.workedHours, 2);
        assert.equal(result.totalEarnings, undefined);
      }
    }
  });
  it('summiert Tariflohn und ÜTZ exakt über die Mitarbeiter-Methode, fehlende ÜTZ ist null Euro', async () => {
    const { employee, context, row } = fixture();
    assert.equal((await employee.getTariffHourlyWage('2026-10-01', context)).value, '15.33');
    context.data.allowances = [{ ...row, values: { DPREIS: '0.22' } }];
    assert.equal((await employee.getTariffHourlyWage('2026-10-01', context)).value, '15.55');
    context.data.allowances.push({ ...row, values: { DPREIS: '0.22' } });
    assert.equal((await employee.getTariffHourlyWage('2026-10-01', context)).code, 'ABOVE_TARIFF_AMBIGUOUS');
  });
  it('bewertet Tarif- und ÜTZ-Wechsel am jeweiligen Einsatzdatum mit inklusiven Grenzen', async () => {
    const { run, context, row } = fixture();
    context.data.allowances = [{ ...row, validUntil: '2026-10-15', values: { DPREIS: '0.22' } },
      { ...row, validFrom: '2026-10-16', values: { DPREIS: '1.00' } }];
    const result = await run([shift('2026-10-15'), shift('2026-10-16')], { now: new Date('2026-10-16T09:00:00Z') });
    assert.equal(result.workedEarnings, '65.26');
    assert.equal(result.totalEarnings, '65.26');
    assert.equal(result.earningsLimit, '603.00');
  });
  it('rundet Minutenstunden erst bei der abschließenden Monatssumme und cached identische Stichtage', async () => {
    const { run, employee, context } = fixture();
    context.data.periods[0].rates[0].value = '0.20';
    let calls = 0;
    const method = employee.getTariffHourlyWage;
    employee.getTariffHourlyWage = function (...args) { calls++; return method.apply(this, args); };
    const result = await run([shift('2026-10-01', '08:00', '08:01'), shift('2026-10-01', '09:00', '09:01'), shift('2026-10-01', '10:00', '10:01')]);
    assert.equal(result.totalEarnings, '0.01');
    assert.equal(calls, 1);
    assert.equal(result.workedDays, 1);
    assert.equal(exact.addDecimals('0.1', '0.2'), '0.3');
    assert.equal(exact.money(exact.decimalParts('1.005')), '1.01');
  });
  it('bewahrt die Tagesprüfung bei ungeklärten Löhnen und zeigt keinen vollständigen Betrag', async () => {
    const { run, context, row } = fixture();
    context.data.allowances = [{ ...row, values: { DPREIS: '1' } }, { ...row, values: { DPREIS: '2' } }];
    const result = await run([shift('2026-10-01')]);
    assert.equal(result.workedDays, 1);
    assert.equal(result.earningsStatus, 'UNRESOLVED');
    assert.equal(result.totalEarnings, null);
    assert.equal(result.issues[0].date, '2026-10-01');
  });
  it('verwendet heute im aktuellen Monat, sonst das Monatsende als Gruppenstichtag', async () => {
    const { run } = fixture();
    assert.equal((await run()).groupDate, '2026-10-08');
    assert.equal((await run([], { month: 9 })).groupDate, '2026-09-30');
    assert.equal((await run([], { month: 11 })).groupDate, '2026-11-30');
  });
  it('verwendet historische Personalnummern, aktuelle Nummern haben weiterhin Vorrang', async () => {
    const { run, context } = fixture();
    context.data.assignments[0].personalNr = '2000841';
    assert.equal((await run()).type, 'days-earnings');
    context.data.assignments.push({ ...context.data.assignments[0], personalNr: '2001113' });
    assert.equal((await run()).status, 'RESOLVED');
    context.data.assignments.push({ ...context.data.assignments[1], legacyId: 'duplicate' });
    assert.equal((await run()).issues[0].code, 'ASSIGNMENT_AMBIGUOUS');
  });
  it('zählt Tage eindeutig über den bisherigen Zeitraum mit Vorarbeitgebern und ohne Pseudo-Einsätze', async () => {
    const { run } = fixture('21015');
    const result = await run([shift('2025-11-16'), shift('2026-10-08', '08:00', '10:00'), shift('2026-10-08', '18:00', '20:00'),
      shift('2026-12-01'), { ...shift('2026-12-02'), isPseudo: true }, shift('2027-01-01')]);
    assert.equal(result.workedDays, 2);
    assert.equal(result.plannedDays, 1);
    assert.equal(result.priorEmployerDays, 5);
    assert.equal(result.periodLabel, 'seit Eintritt am 15.11.2025');
    assert.equal(result.periods.days.from, '2025-11-15');
  });
  it('zeigt fehlende Monatsstunden und unbekannte Gruppen ausdrücklich', async () => {
    const fixed = fixture('21195'); fixed.employee.arbeitszeit.monat = 0;
    assert.equal((await fixed.run()).issues[0].code, 'MONTHLY_HOURS_MISSING');
    assert.equal((await fixture('99999').run()).issues[0].code, 'GROUP_UNSUPPORTED');
    const missing = fixture(); missing.context.data.assignments = []; missing.employee.arbeitsverhaeltnis.typ = 2;
    assert.equal((await missing.run()).issues[0].code, 'EMPLOYMENT_TYPE_UNSUPPORTED');
  });
  it('isoliert Geld und Tage auf ihre jeweiligen Zeiträume', async () => {
    const { run } = fixture();
    const result = await run([shift('2026-09-01'), shift('2026-10-01'), shift('2026-11-01')]);
    assert.equal(result.totalEarnings, '30.66');
    assert.equal(result.workedDays, 2);
    assert.equal(result.plannedDays, 1);
  });
  it('behandelt offene Endzeiten, Nachtarbeit und Berliner Datumsgrenzen', async () => {
    const hours = assignmentHours({ uhrzeitVon: '22:00', uhrzeitBis: '02:00' });
    assert.equal(Number(hours.numerator) / Number(hours.denominator), 4);
    assert.equal(assignmentHours({ endeOffen: 1, bedarf: 1.25 }).numerator, 125n);
    assert.equal(berlinDay('2026-09-30T22:30:00Z'), '2026-10-01');
    const { run } = fixture('21015');
    const incomplete = await run([{ datumVon: '2026-10-01T00:00:00Z' }]);
    assert.equal(incomplete.workedDays, 1);
    assert.equal(incomplete.hoursStatus, 'UNRESOLVED');
  });
  it('erhält Tage neben fehlenden Monatsstunden für beide KZF-Gruppen', async () => {
    for (const id of ['21015', '22436']) {
      const { employee, run } = fixture(id);
      employee.arbeitszeit.monat = 0;
      const result = await run([shift('2026-10-01')]);
      assert.equal(result.type, 'days-hours');
      assert.equal(result.workedDays, 1);
      assert.equal(result.hoursStatus, 'UNRESOLVED');
      assert.equal(result.monthlyHours, null);
      assert.equal(result.hoursIssues[0].code, 'MONTHLY_HOURS_MISSING');
    }
  });
  it('fällt bei fehlender Tarifzuordnung auf Vollzeit, Teilzeit oder Kurzfristig zurück', async () => {
    for (const [typ, type] of [[0, 'hours'], [1, 'hours'], [3, 'days']]) {
      const { employee, context, run } = fixture();
      context.data.assignments = [];
      employee.arbeitsverhaeltnis.typ = typ;
      const result = await run([shift('2026-10-01')]);
      assert.equal(result.type, type);
      assert.equal(result.status, 'RESOLVED');
      assert.equal(result.selectionBasis, 'EMPLOYMENT_TYPE');
      assert.equal(result.group, null);
      assert.match(result.fallbackReason, /Arbeitsverhältnis/);
      assert.equal(result.totalEarnings, undefined);
      if (type === 'hours') assert.equal(result.monthlyHours, 100);
      else assert.equal(result.workedDays, 1);
    }
  });
  it('verwendet den Fallback nicht bei mehrdeutigen Tarifzuordnungen oder fehlenden Tarifgruppen', async () => {
    const ambiguous = fixture();
    ambiguous.context.data.assignments.push({ ...ambiguous.context.data.assignments[0], legacyId: '2' });
    assert.equal((await ambiguous.run()).issues[0].code, 'ASSIGNMENT_AMBIGUOUS');
    const missingGroup = fixture(); missingGroup.context.data.groups = [];
    assert.equal((await missingGroup.run()).issues[0].code, 'GROUP_MISSING_OR_AMBIGUOUS');
  });
});
