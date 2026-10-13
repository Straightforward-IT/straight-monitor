const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const { parseWageTypeWorkbook, SQL_COLUMNS, FIELD_NAMES } = require('../domain/payroll/wageTypeImport');

function workbook(rows, additionalSheet) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Import');
  if (additionalSheet) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(additionalSheet), 'Anderes Blatt');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
function rejects(rows, code) {
  assert.throws(() => parseWageTypeWorkbook(workbook(rows)), error => {
    assert.equal(error.status, 400);
    assert.ok(error.issues.some(issue => issue.severity === 'error' && issue.code === code));
    return true;
  });
}

describe('Lohnarten workbook adapters', () => {
  it('keeps SQL compatibility fields independent of the new wide-export meanings', () => {
    const values = { LOHNARTNR: '110', CSTEUERSPE: '17', BGSPALTE: '9', IBRANCHENZUSCHLAG: '3', ILOHNARTBRANCHENZ: '602', PRIORITAETBZ: '1' };
    const parsed = parseWageTypeWorkbook(workbook([SQL_COLUMNS.map(([column]) => column), SQL_COLUMNS.map(([column]) => values[column] || '')]));
    assert.equal(parsed.format, 'sql');
    const { fields } = parsed.records[0];
    assert.equal(fields.steuerSpezialCode, '17');
    assert.equal(fields.berechnungsgrundlageSpalte, '9');
    assert.equal(fields.branchenzuschlagCode, '3');
    assert.equal(fields.branchenzuschlagLohnartNummer, '602');
    assert.equal(fields.branchenzuschlagPrioritaet, '1');
    assert.ok(!('steuerungSpeicherungCode' in fields));
    assert.ok(!('bgPflichtCode' in fields));
    assert.ok(!('verrechnungCode' in fields));
  });

  it('maps named SQL columns after reorder and leaves absent columns out of the update', () => {
    const parsed = parseWageTypeWorkbook(workbook([
      ['LOHNARTTXT', 'LOHNARTNR', 'CBERECHNUN'], ['ÜTZ', '110', '2'],
    ]));
    assert.deepEqual(parsed.records[0].fields, { lohnartNummer: '110', lohnartBezeichnung: 'ÜTZ', berechnungsartCode: '2' });
    assert.ok(!('kb' in parsed.records[0].fields));
  });

  it('distinguishes missing columns, delivered empty cells and real zero values', () => {
    const parsed = parseWageTypeWorkbook(workbook([
      ['Lohnart', 'Fehlzeitenkürzel', 'Code für Berechnung', 'Code für Berechnung'],
      [100, '', 0, 'Betrag'],
    ]));
    const existing = { kb: 'X', durchschnittsspeicher2Code: '1', berechnungsartCode: '2' };
    const updated = { ...existing, ...parsed.records[0].fields };
    assert.equal(updated.kb, '');
    assert.equal(updated.berechnungsartCode, '0');
    assert.equal(updated.durchschnittsspeicher2Code, '1');
    const repeated = { ...updated, ...parseWageTypeWorkbook(workbook([
      ['Lohnart', 'Fehlzeitenkürzel', 'Code für Berechnung', 'Code für Berechnung'], [100, '', 0, 'Betrag'],
    ])).records[0].fields };
    assert.deepEqual(updated, repeated);
  });

  it('preserves duplicate header occurrences and raw unknown source columns', () => {
    const parsed = parseWageTypeWorkbook(workbook([
      ['Lohnart', 'Code für Berechnung', 'Code für Berechnung', 'IBGSPALTESTD_SUB', 'Sonstiges', 'Sonstiges'],
      [100, 2, 'Stunden * Stundenlohn', 0, 'A', 'B'],
    ]), { filename: 'Stamm.xlsx' });
    const { fields, source } = parsed.records[0];
    assert.equal(fields.berechnungsartCode, '2');
    assert.ok(!Object.keys(fields).some(key => /bg2/i.test(key)));
    assert.equal(source.filename, 'Stamm.xlsx');
    assert.equal(source.sheet, 'Import');
    assert.equal(source.row, 2);
    assert.deepEqual(source.columns.slice(1, 3).map(column => [column.index, column.occurrence, column.value]), [[2, 1, 2], [3, 2, 'Stunden * Stundenlohn']]);
    assert.deepEqual(source.columns.slice(4).map(column => column.value), ['A', 'B']);
  });

  it('stores independent SP1 and SP2 contributions and independent flags', () => {
    const { fields } = parseWageTypeWorkbook(workbook([
      ['Lohnart', 'Code für durch. Speich. SP1 ', 'Code für durch. Speich. SP1 ', 'Code für durch. Speich. SP2 ', 'Code für durch. Speich. SP2 ', 'Für Gesamtstunden', 'In Auswertungen berücksichtigen'],
      [100, 1, 'Addition im Durchschnitt (Tage, Stunden, Betrag)', 0, 'Keine Addition im Durchschnittsbetrag', 'Ja', 'Nein'],
    ])).records[0];
    assert.equal(fields.durchschnittsspeicherCode, '1');
    assert.equal(fields.durchschnittsspeicher2Code, '0');
    assert.equal(fields.fuerGesamtstunden, 'Ja');
    assert.equal(fields.inAuswertungenBeruecksichtigen, 'Nein');
  });

  it('preserves unknown codes with hints instead of guessing definitions', () => {
    const parsed = parseWageTypeWorkbook(workbook([
      ['Lohnart', 'Verrechnung', 'Verrechnung'], [110, 99, 'Tariflicher Zuschlag'],
    ]));
    assert.equal(parsed.records[0].fields.verrechnungCode, '99');
    assert.ok(parsed.issues.some(issue => issue.code === 'UNKNOWN_CODE' && issue.value === '99'));
  });

  it('rejects known-code/display conflicts, missing codes with text and invalid reference keys', () => {
    rejects([['Lohnart', 'Code für Berechnung', 'Code für Berechnung'], [100, 2, 'Betrag']], 'CODE_TEXT_CONFLICT');
    rejects([['Lohnart', 'Verrechnung', 'Verrechnung'], [110, '', 'ÜTZ']], 'CODE_TEXT_CONFLICT');
    rejects([['Lohnart', 'Verrechnungslohnart'], [110, '602x']], 'INVALID_REFERENCE');
  });

  it('rejects invalid IDs, duplicate IDs and ambiguous mapped headers across the whole file', () => {
    rejects([['Lohnart'], [100], ['x']], 'INVALID_NUMBER');
    rejects([['Lohnart'], [100], [100]], 'DUPLICATE_NUMBER');
    rejects([['Lohnart'], [0]], 'INVALID_NUMBER');
    rejects([['Lohnart', 'Lohnart'], [100, 110]], 'AMBIGUOUS_HEADERS');
    rejects([['Lohnart', 'Code für Berechnung', 'Code für Berechnung', 'Code für Berechnung'], [100, 2, '', '']], 'AMBIGUOUS_HEADERS');
    rejects([['LOHNARTNR', 'LOHNARTNR'], [100, 110]], 'AMBIGUOUS_HEADERS');
    rejects([['LOHNARTNR', 'Lohnart'], [100, 110]], 'AMBIGUOUS_HEADERS');
  });

  it('only accepts a headerless export with exactly 24 SQL columns and valid IDs', () => {
    const rows = [Array.from({ length: 24 }, (_, index) => index === 0 ? 100 : index === 23 ? 'Nein' : '')];
    const parsed = parseWageTypeWorkbook(workbook(rows));
    assert.equal(parsed.format, 'sql-headerless');
    assert.equal(parsed.records[0].source.row, 1);
    assert.equal(parsed.records[0].fields.equalPayRelevanz, 'Nein');
    rejects([[100, 'NST', 'Normalstunden']], 'UNRECOGNIZED_HEADERS');
    const wide = Array.from({ length: 129 }, (_, index) => index === 0 ? 100 : index === 128 ? 0 : '');
    rejects([wide], 'UNRECOGNIZED_HEADERS');
  });

  it('rejects multiple filled sheets instead of silently discarding a table', () => {
    assert.throws(() => parseWageTypeWorkbook(workbook([['Lohnart'], [100]], [['Lohnart'], [110]])), error => error.issues.some(issue => issue.code === 'SHEET_SELECTION'));
  });

  it('keeps original row positions when blank rows precede the header or data', () => {
    const parsed = parseWageTypeWorkbook(workbook([[], ['Lohnart', 'Fehlzeitenkürzel'], [], [503, 'Q']]));
    assert.equal(parsed.records[0].source.row, 4);
    assert.equal(parsed.records[0].fields.kb, 'Q');
  });

  it('parses all 153 real source rows with 129 columns and the confirmed reference settings', () => {
    const file = path.resolve(__dirname, '../../Documentation/Lohnarten/Lohnarten.xlsx');
    const parsed = parseWageTypeWorkbook(fs.readFileSync(file), { filename: 'Lohnarten.xlsx' });
    assert.equal(parsed.format, 'zvoove');
    assert.equal(parsed.records.length, 153);
    assert.ok(parsed.records.every(record => record.source.columns.length === 129));
    const byNumber = new Map(parsed.records.map(record => [record.lohnartNummer, record]));
    const utz = byNumber.get('110').fields;
    assert.equal(utz.verrechnungCode, '3');
    assert.equal(utz.verrechnungslohnartNummer, '602');
    assert.equal(utz.verrechnungsPrioritaet, '1');
    assert.equal(byNumber.get('191').fields.fakturierungCode, '3');
    assert.equal(byNumber.get('192').fields.fakturierungCode, '1');
    assert.equal(byNumber.get('503').fields.kb, 'Q');
    assert.equal(byNumber.get('506').fields.kb, 'Q');
    assert.equal(byNumber.get('100').fields.fuerGesamtstunden, 'Ja');
    assert.equal(byNumber.get('100').fields.durchschnittsspeicherCode, '1');
    assert.equal(byNumber.get('100').fields.durchschnittsspeicher2Code, '0');
    assert.ok(parsed.records.every(record => Object.keys(record.fields).every(field => FIELD_NAMES.includes(field))));
  });
});
