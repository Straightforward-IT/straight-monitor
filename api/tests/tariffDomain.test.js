const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const domain = require('../services/tariffs/tariffDomain');
const { employees, validRows, workbookFile, fixtureFiles } = require('./fixtures/tariffs');
const errors = dataset => dataset.issues.filter(issue => issue.severity === 'ERROR');
const datasetFrom = (rows = validRows(), staff = employees) => domain.buildDataset(domain.parseFiles(fixtureFiles(rows)), staff);

describe('Independent Zvoove tariff import and dated base value', () => {
  it('imports all fourteen roles and resolves both documented rates by relational matrix positions', () => {
    const parsed = domain.parseFiles(fixtureFiles());
    assert.deepEqual(parsed.issues, []);
    assert.equal(parsed.files.length, 14);
    const dataset = domain.buildDataset(parsed, employees);
    assert.deepEqual(errors(dataset), []);
    assert.equal(Object.keys(dataset.counts).length, 14);
    assert.equal(dataset.counts.aboveTariff, 1);
    const first = domain.resolveBaseRate(dataset, 'employee-1', '2026-09-30');
    const second = domain.resolveBaseRate(dataset, 'employee-2', '2026-09-30');
    assert.equal(first.status, 'RESOLVED'); assert.equal(first.value, '15.33');
    assert.equal(second.value, '16.08');
    assert.equal(second.payGroup.legacyId, '24932'); assert.equal(second.payGroup.position, 3);
    assert.equal(first.assignment.personalNr, '1000001');
    assert.equal(first.assignment.employeeId, 'employee-1'); // Historical personal number.
    assert.equal(first.period.legacyId, '1108622');
    assert.equal(first.stage.legacyId, '21025'); assert.equal(first.stage.position, 1);
    assert.equal(first.allowances[0].values.DPREIS, '2.4');
    assert.equal(first.currency, 'EUR');
  });

  it('preserves every column and source location, multiple rules for one wage type, and unknown codes', () => {
    const rows = validRows(); rows.employeeGroups[0].UNBEKANNT = 'uninterpretiert';
    const dataset = datasetFrom(rows);
    assert.equal(dataset.groups[0].source.filename, 'Tarifmitarbeitergruppe.xlsx');
    assert.equal(dataset.groups[0].source.sheet, 'Export'); assert.equal(dataset.groups[0].source.row, 2);
    assert.equal(dataset.groups[0].source.raw.UNBEKANNT, 'uninterpretiert');
    const period = dataset.periods.find(entry => entry.legacyId === '1108622');
    assert.equal(period.wageRules.filter(rule => rule.values.ILOHNARTNR === 166).length, 2);
    assert.equal(period.wageRules[1].values.DPROZENT, '25');
    assert.equal(period.wageRules[1].source.raw.DPROZENT, '25,00');
    assert.equal(period.wageRules[1].values.ID_LCS_TARIFGRUPPEN, -1);
    assert.equal(period.specialPayments[0].source.raw.KUENBER, 7);
    assert.equal(dataset.groups[0].referenceWages[0].values.ISTUFE, 2); // No invented matrix mapping.
    assert.ok(dataset.issues.some(issue => issue.code === 'UNINTERPRETED_FIELDS'));
    assert.ok(dataset.issues.some(issue => issue.code === 'RULES_NOT_EVALUATED'));
    assert.deepEqual(errors(dataset), []);
  });

  it('uses inclusive historical boundaries, open end dates, and preserves all matching ÜTZ history', () => {
    const rows = validRows();
    rows.aboveTariff.unshift({ ...rows.aboveTariff[0], DTVON: '01.01.2020', DTBIS: '31.03.2022', DPREIS: '1,20' });
    const dataset = datasetFrom(rows);
    assert.equal(dataset.counts.aboveTariff, 2);
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-08-31').value, '13.1');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-01').value, '15.33');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2099-12-31').value, '15.33');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2022-03-31').allowances[0].values.DPREIS, '1.2');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2022-04-01').allowances[0].values.DPREIS, '2.4');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2017-11-11').code, 'ASSIGNMENT_MISSING');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2017-11-12').code, 'PERIOD_MISSING');
  });

  it('retains missing and ambiguous employee matches and never guesses an employee', () => {
    const dataset = datasetFrom(validRows(), [employees[0], { ...employees[0], _id: 'employee-duplicate' }]);
    assert.equal(dataset.assignments[0].matchStatus, 'AMBIGUOUS'); assert.equal(dataset.assignments[0].employeeId, null);
    assert.equal(dataset.assignments[1].matchStatus, 'MISSING'); assert.equal(dataset.assignments[1].personalNr, '1000002');
    assert.ok(dataset.issues.some(issue => issue.code === 'EMPLOYEE_AMBIGUOUS'));
    assert.ok(dataset.issues.some(issue => issue.code === 'EMPLOYEE_MISSING'));
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-30').code, 'ASSIGNMENT_MISSING');
    assert.deepEqual(errors(dataset), []);
  });

  it('deduplicates current/history matches of the same stable employee and keeps original personal numbers', () => {
    const rows = validRows(); rows.employeeAssignments[0].IPERSONALNR = '01000001';
    const staff = [{ ...employees[0], personalnr: '1000001', personalnrHistory: [{ value: '01000001' }, { value: '1000001' }] }, employees[1]];
    const dataset = datasetFrom(rows, staff);
    assert.equal(dataset.assignments[0].matchStatus, 'MATCHED');
    assert.equal(dataset.assignments[0].personalNr, '01000001');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-30').value, '15.33');
    assert.deepEqual(domain.collectPersonalNumbers(domain.parseFiles(fixtureFiles(rows))), ['01000001', '1000001', '1000002']);
  });

  it('uses dated current-number rows before open history aliases and preserves both histories', () => {
    const rows = validRows();
    rows.employeeAssignments.push({ ...rows.employeeAssignments[0], ID: 903, IPERSONALNR: 2000001, ID_LCS_TARIFGRUPPEN: 24932, DTVON: '01.09.2026' });
    rows.aboveTariff.push({ ...rows.aboveTariff[0], IPERSONALNR: 2000001, DTVON: '01.09.2026', DPREIS: '1,83' });
    const data = datasetFrom(rows);
    const before = JSON.stringify(data);
    const rate = domain.resolveBaseRate(data, 'employee-1', '2026-09-30', '02000001');
    assert.equal(rate.value, '16.08'); assert.equal(rate.assignment.personalNr, '2000001');
    assert.deepEqual(rate.assignmentSelection.excludedPersonalNumbers, ['1000001']);
    assert.equal(rate.allowances.length, 1); assert.equal(rate.allowances[0].values.DPREIS, '1.83');
    const above = domain.resolveAboveTariff(data, 'employee-1', '2026-09-30', '2000001');
    assert.equal(above.status, 'RESOLVED'); assert.equal(above.values.DPREIS, '1.83');
    assert.deepEqual(above.selection.excludedPersonalNumbers, ['1000001']);
    assert.equal(domain.resolveBaseRate(data, 'employee-1', '2026-08-31', '2000001').value, '13.1');
    assert.equal(domain.resolveAboveTariff(data, 'employee-1', '2026-08-31', '2000001').values.DPREIS, '2.4');
    assert.equal(JSON.stringify(data), before); // No invented end dates or source mutations.
  });

  it('keeps same-number overlaps and competing historical aliases ambiguous even with a current number', () => {
    const rows = validRows();
    rows.employeeAssignments.push({ ...rows.employeeAssignments[0], ID: 903, DTVON: '01.09.2026' });
    rows.aboveTariff.push({ ...rows.aboveTariff[0], DPREIS: '1,83' });
    const data = datasetFrom(rows);
    for (const number of ['1000001', '2000001']) {
      assert.equal(domain.resolveBaseRate(data, 'employee-1', '2026-09-30', number).code, 'ASSIGNMENT_AMBIGUOUS');
      assert.equal(domain.resolveAboveTariff(data, 'employee-1', '2026-09-30', number).code, 'ABOVE_TARIFF_AMBIGUOUS');
    }
    data.assignments[2].personalNr = '3000001';
    assert.equal(domain.resolveBaseRate(data, 'employee-1', '2026-09-30', '2000001').code, 'ASSIGNMENT_AMBIGUOUS');
  });

  it('reports simultaneous periods and assignments as unavailable and keeps ÜTZ separate', () => {
    const rows = validRows(); rows.periods[0].DTBIS = '01.09.2026';
    let dataset = datasetFrom(rows);
    assert.ok(dataset.issues.some(issue => issue.code === 'OVERLAPPING_INTERVALS' && issue.table === 'periods'));
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-01').code, 'PERIOD_AMBIGUOUS');
    rows.periods[0].DTBIS = '31.08.2026';
    rows.employeeAssignments.push({ ...rows.employeeAssignments[0], ID: 903, DTVON: '01.09.2026' });
    dataset = datasetFrom(rows);
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-01').code, 'ASSIGNMENT_AMBIGUOUS');
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-08-31').value, '13.1');
    rows.employeeAssignments.pop(); rows.aboveTariff.push({ ...rows.aboveTariff[0], DPREIS: '3,00' });
    dataset = datasetFrom(rows);
    const resolved = domain.resolveBaseRate(dataset, 'employee-1', '2026-09-01');
    assert.equal(resolved.value, '15.33'); assert.equal(resolved.allowances.length, 2);
  });

  it('keeps reversed employee intervals as ineffective history without applying them or reporting false overlaps', () => {
    const rows = validRows();
    rows.employeeAssignments.push({ ...rows.employeeAssignments[0], ID: 903, DTVON: '01.09.2026', DTBIS: '31.08.2026' });
    rows.aboveTariff.push({ ...rows.aboveTariff[0], ID: 602, DTVON: '01.09.2026', DTBIS: '31.08.2026', DPREIS: '9,99' });
    const dataset = datasetFrom(rows);
    assert.deepEqual(errors(dataset), []);
    const reversed = dataset.issues.filter(issue => issue.code === 'REVERSED_INTERVAL');
    assert.equal(reversed.length, 2); assert.ok(reversed.every(issue => issue.severity === 'WARNING'));
    assert.equal(dataset.counts.employeeAssignments, 3); assert.equal(dataset.counts.aboveTariff, 2);
    const assignment = dataset.assignments.find(entry => entry.legacyId === '903');
    const allowance = dataset.allowances.find(entry => entry.legacyId === '602');
    assert.equal(assignment.intervalStatus, 'INEFFECTIVE'); assert.equal(allowance.intervalStatus, 'INEFFECTIVE');
    assert.equal(assignment.validFrom, '2026-09-01'); assert.equal(assignment.validUntil, '2026-08-31');
    assert.equal(assignment.source.raw.DTVON, '01.09.2026'); assert.equal(allowance.values.DPREIS, '9.99');
    assert.equal(dataset.assignments[0].intervalStatus, 'VALID'); assert.equal(dataset.allowances[0].intervalStatus, 'VALID');
    assert.ok(!dataset.issues.some(issue => issue.code === 'OVERLAPPING_INTERVALS'));
    for (const date of ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2099-12-31']) {
      const result = domain.resolveBaseRate(dataset, 'employee-1', date);
      assert.equal(result.status, 'RESOLVED'); assert.equal(result.assignment.legacyId, '901');
      assert.equal(result.allowances.length, 1); assert.equal(result.allowances[0].values.DPREIS, '2.4');
    }
  });

  it('explicitly excludes an ineffective status even if calendar bounds would otherwise include the date', () => {
    const dataset = datasetFrom();
    dataset.allowances[0].intervalStatus = 'INEFFECTIVE';
    assert.deepEqual(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-30').allowances, []);
    dataset.assignments[0].intervalStatus = 'INEFFECTIVE';
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-30').code, 'ASSIGNMENT_MISSING');
  });

  it('scopes variants, periods and ÜTZ through contract 17055 while keeping inactive variants', () => {
    const rows = validRows();
    rows.contract.push({ ID: 99999, CBEZEICHNUNG: 'Anderer Tarif' });
    rows.employeeGroups.push({ ID: 77777, ID_LCS_TARIF: 99999, CGRUPPE: 'Fremd' });
    rows.employeeGroups.push({ ID: 17089, ID_LCS_TARIF: 17055, CGRUPPE: 'Lohn Ost Allgemein', CBEZEICHNUNG: 'Inaktiv' });
    rows.payGroups.push({ ID: 77778, ID_LCS_TARIFMAGRUPPE: 77777, INR: 1, CBEZEICHNUNG: 'Fremd' });
    rows.periods.push({ ID: 77779, ID_LCS_TARIFMAGRUPPE: 77777, DTVON: '01.01.2026', DTBIS: null });
    rows.employeeAssignments.push({ ...rows.employeeAssignments[0], ID: 904, IPERSONALNR: 8999000, ID_LCS_TARIF: 99999, ID_LCS_TARIFMAGRUPPE: 77777 });
    const dataset = datasetFrom(rows);
    assert.equal(dataset.groups.length, 2);
    assert.equal(dataset.groups[1].statusLabel, 'Inaktiv');
    assert.equal(dataset.periods.length, 2); assert.equal(dataset.assignments.length, 2); assert.equal(dataset.allowances.length, 1);
    assert.deepEqual(errors(dataset), []);
  });

  it('requires all fourteen explicitly assigned files and their documented column headers', () => {
    const files = fixtureFiles();
    assert.ok(domain.parseFiles(files.filter(file => file.fieldname !== 'payGroups')).issues.some(issue => issue.code === 'MISSING_FILE' && issue.table === 'payGroups'));
    assert.ok(domain.parseFiles([...files, files[0]]).issues.some(issue => issue.code === 'DUPLICATE_FILE'));
    const malformed = files.map(file => file.fieldname === 'rates' ? workbookFile('rates', validRows().rates, { headers: ['ID_LCS_TARIFZEIT', 'IX', 'DWERT'] }) : file);
    assert.ok(domain.parseFiles(malformed).issues.some(issue => issue.code === 'MISSING_COLUMNS'));
    // A filename can be misleading; the explicit file field determines the role.
    files.find(file => file.fieldname === 'employeeGroups').originalname = 'Tarifgruppe.xlsx';
    assert.deepEqual(errors(domain.buildDataset(domain.parseFiles(files), employees)), []);
  });

  it('accepts header-only rule tables and the documented PERSONALNR alias', () => {
    const rows = validRows(); rows.noticePeriods = []; rows.wageRules = [];
    const files = fixtureFiles(rows);
    const assignments = rows.employeeAssignments.map(({ IPERSONALNR, ...row }) => ({ ...row, PERSONALNR: IPERSONALNR }));
    files[files.findIndex(file => file.fieldname === 'employeeAssignments')] = workbookFile('employeeAssignments', assignments, { headers: [...domain.TABLES.find(table => table.key === 'employeeAssignments').requiredColumns.filter(header => header !== 'IPERSONALNR'), 'PERSONALNR'] });
    const dataset = domain.buildDataset(domain.parseFiles(files), employees);
    assert.deepEqual(errors(dataset), []);
    assert.equal(dataset.counts.noticePeriods, 0); assert.equal(dataset.counts.wageRules, 0);
    assert.equal(dataset.assignments[0].personalNr, '1000001');
  });

  it('rejects duplicate, prototype and ambiguous personal number headers without dropping source columns silently', () => {
    for (const [headers, code] of [
      [['ID', ' CBEZEICHNUNG ', 'id'], 'DUPLICATE_HEADER'],
      [['ID', 'CBEZEICHNUNG', '__proto__'], 'UNSAFE_HEADER'],
      [['ID', 'CBEZEICHNUNG', 'constructor'], 'UNSAFE_HEADER'],
    ]) {
      const files = fixtureFiles(); files[0] = workbookFile('contract', [], { headers });
      assert.ok(domain.parseFiles(files).issues.some(issue => issue.code === code));
    }
    const files = fixtureFiles();
    const table = domain.TABLES.find(table => table.key === 'employeeAssignments');
    files[files.findIndex(file => file.fieldname === table.key)] = workbookFile(table.key, [], { headers: [...table.requiredColumns, 'PERSONALNR'] });
    assert.ok(domain.parseFiles(files).issues.some(issue => issue.code === 'AMBIGUOUS_PERSONAL_NUMBER_HEADER'));
  });

  it('rejects invalid identifiers, dangling tariff relationships and foreign group restrictions', () => {
    for (const mutate of [
      rows => { rows.payGroups[0].ID = Number.MAX_SAFE_INTEGER + 1; },
      rows => { rows.periods[0].ID_LCS_TARIFMAGRUPPE = 999; },
      rows => { rows.rates[0].ID_LCS_TARIFZEIT = 999; },
      rows => { rows.employeeAssignments[0].ID_LCS_TARIFGRUPPEN = 999; },
      rows => { rows.employeeAssignments[0].IPERSONALNR = 'n/a'; },
      rows => { rows.wageRules[0].ID_LCS_TARIFGRUPPEN = 999; },
      rows => { rows.rates[0].IY = 99; },
      rows => { rows.stages[0].INR = '9007199254740992'; },
    ]) {
      const rows = validRows(); mutate(rows);
      assert.ok(errors(datasetFrom(rows)).length);
    }
  });

  it('blocks colliding global IDs even when one duplicate belongs to another contract', () => {
    const rows = validRows();
    rows.employeeGroups.push({ ...rows.employeeGroups[0], ID_LCS_TARIF: 99999 });
    const dataset = datasetFrom(rows);
    assert.ok(errors(dataset).some(issue => issue.code === 'DUPLICATE_ID' && issue.table === 'employeeGroups'));
  });

  it('rejects impossible/reversed dates and ambiguous matrix cells and entity keys', () => {
    for (const [mutate, code] of [
      [rows => { rows.periods[0].DTVON = '30.02.2026'; }, 'INVALID_DATE'],
      [rows => { rows.employeeAssignments[0].DTVON = null; }, 'INVALID_DATE'],
      [rows => { rows.periods[0].DTBIS = '01.01.2000'; }, 'REVERSED_INTERVAL'],
      [rows => { rows.employeeAssignments[0].DTVON = '30.02.2026'; }, 'INVALID_DATE'],
      [rows => { rows.aboveTariff[0].DTBIS = '31.02.2026'; }, 'INVALID_DATE'],
      [rows => { rows.rates.push({ ...rows.rates[0] }); }, 'DUPLICATE_RATE'],
      [rows => { rows.payGroups.push({ ...rows.payGroups[0] }); }, 'DUPLICATE_ID'],
      [rows => { rows.rates[0].DWERT = '15,33 Euro'; }, 'INVALID_DECIMAL'],
    ]) {
      const rows = validRows(); mutate(rows);
      assert.ok(datasetFrom(rows).issues.some(issue => issue.severity === 'ERROR' && issue.code === code));
    }
    assert.equal(domain.resolveBaseRate(datasetFrom(), 'employee-1', '2026-02-30').code, 'INVALID_DATE');
    assert.equal(domain.resolveBaseRate(datasetFrom(), 'employee-1', null).code, 'INVALID_DATE');
  });

  it('decodes both Excel epochs and leap days without changing the calendar date', () => {
    const rows = validRows(); rows.periods[1].DTVON = 46266; // 2026-09-01 in the 1900 epoch.
    let files = fixtureFiles(rows);
    let dataset = domain.buildDataset(domain.parseFiles(files), employees);
    assert.equal(dataset.periods[1].validFrom, '2026-09-01');
    rows.periods[1].DTVON = 44804; // Same day in the 1904 epoch.
    files[files.findIndex(file => file.fieldname === 'periods')] = workbookFile('periods', rows.periods, { date1904: true });
    dataset = domain.buildDataset(domain.parseFiles(files), employees);
    assert.equal(dataset.periods[1].validFrom, '2026-09-01');
    assert.equal(domain.dateString('29.02.2024'), '2024-02-29');
    assert.throws(() => domain.dateString('29.02.2026'));
  });

  it('preserves exact decimal text rather than rounding through Number', () => {
    const rows = validRows(); rows.rates[2].DWERT = '12345678901234567890,12345678901234';
    const result = domain.resolveBaseRate(datasetFrom(rows), 'employee-1', '2026-09-01');
    assert.equal(result.value, '12345678901234567890.12345678901234');
    assert.equal(domain.decimalString('1.234,5600'), '1234.56');
    assert.equal(domain.decimalString('00015.3300'), '15.33');
    assert.equal(domain.decimalString('1.23456789e-12'), '0.00000000000123456789');
    assert.equal(domain.decimalString('-0.00'), '0');
    assert.throws(() => domain.decimalString('1,234.56'));
    assert.throws(() => domain.decimalString('Infinity'));
    rows.rates[2].DWERT = '12345678901234567890,123456789012345';
    assert.ok(errors(datasetFrom(rows)).some(issue => issue.code === 'INVALID_DECIMAL'));
  });

  it('compares a repeat import without duplicate records and reports additions, removals and monetary changes', () => {
    const first = datasetFrom();
    const changedFiles = fixtureFiles().map(file => ({ ...file, originalname: `erneut-${file.originalname}` }));
    const repeated = domain.buildDataset(domain.parseFiles(changedFiles), employees);
    for (const change of Object.values(domain.compareDatasets(first, repeated))) {
      assert.equal(change.added + change.removed + change.changed, 0);
    }
    const rows = validRows(); rows.rates[2].DWERT = '16,00'; rows.vacationRules.pop();
    rows.employeeAssignments.push({ ...rows.employeeAssignments[1], ID: 903, IPERSONALNR: 1000003 });
    const changes = domain.compareDatasets(first, datasetFrom(rows));
    assert.deepEqual(changes.rates, { added: 0, removed: 0, changed: 1, unchanged: 3 });
    assert.equal(changes.vacationRules.removed, 1); assert.equal(changes.employeeAssignments.added, 1);
  });

  it('returns a visible clarification message instead of choosing a missing or duplicated rate', () => {
    const dataset = datasetFrom();
    const period = dataset.periods.find(entry => entry.legacyId === '1108622');
    const original = period.rates.shift();
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-01').code, 'RATE_MISSING');
    period.rates.push(original, { ...original, value: '99' });
    assert.equal(domain.resolveBaseRate(dataset, 'employee-1', '2026-09-01').code, 'RATE_AMBIGUOUS');
  });
});

describe('Independent employee ÜTZ lookup', () => {
  it('resolves historical personal numbers and inclusive dates without requiring a tariff assignment', () => {
    const data = datasetFrom();
    data.assignments = [];
    const current = data.allowances[0];
    data.allowances.unshift({ ...current, legacyId: 'earlier', validFrom: '2020-01-01', validUntil: '2022-03-31', values: { DPREIS: '0', DPREISPROD: '7.1234567890123456789', DEINSATZZULAGE: null, DPREISGEHALT: null } });
    const prior = domain.resolveAboveTariff(data, 'employee-1', '2022-03-31');
    assert.equal(prior.status, 'RESOLVED'); assert.equal(prior.values.DPREIS, '0');
    assert.equal(prior.values.DPREISPROD, '7.1234567890123456789');
    assert.equal(prior.record.personalNr, '1000001');
    assert.equal(domain.resolveAboveTariff(data, 'employee-1', '2022-04-01').values.DPREIS, '2.4');
    assert.equal(domain.resolveAboveTariff(data, 'employee-1', '2099-12-31').values.DPREIS, '2.4');
    assert.equal(domain.resolveBaseRate(data, 'employee-1', '2026-10-07').code, 'ASSIGNMENT_MISSING');
  });
  it('never chooses an overlapping, ineffective or unmatched ÜTZ row', () => {
    const data = datasetFrom();
    data.allowances.push({ ...data.allowances[0], legacyId: 'ignored', intervalStatus: 'INEFFECTIVE' });
    data.allowances.push({ ...data.allowances[0], legacyId: 'unmatched', matchStatus: 'AMBIGUOUS' });
    assert.equal(domain.resolveAboveTariff(data, 'employee-1', '2026-10-07').candidateCount, 1);
    data.allowances.push({ ...data.allowances[0], legacyId: 'overlap' });
    const result = domain.resolveAboveTariff(data, 'employee-1', '2026-10-07');
    assert.equal(result.code, 'ABOVE_TARIFF_AMBIGUOUS'); assert.equal(result.candidateCount, 2);
    assert.equal(result.values, undefined);
    assert.equal(domain.resolveAboveTariff(data, 'employee-2', '2026-10-07').code, 'ABOVE_TARIFF_MISSING');
    assert.equal(domain.resolveAboveTariff(data, 'employee-1', '2026-02-30').code, 'INVALID_DATE');
  });
});
