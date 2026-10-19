const XLSX = require('xlsx');
const { decimal, weekDays } = require('./zvooveHours');
const d = require('./detailImport');
const COLUMNS = ['PERSONALNR', 'AUFTRAGNR', 'EINSORTNR', 'JAHR', 'MONAT', 'WOCHE', 'TAG', 'VERWENDUNG', 'TAETNR', 'LOHNARTNR', 'LFDNR', 'VON', 'BIS', 'EINFAKTURA', 'STUNDEN', 'PREIS', 'PROZENT', 'BETRAG', 'RECHNUNGNR', 'ADDLOHNART', 'FKENNZ', 'UMLAGE', 'CPROTBEDIENER', 'DTPROTDATUM'];
function parse(buffer, filename, expectedYear) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const rows = [], keys = new Set();
  for (const sheet of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: null, raw: true, blankrows: true });
    const start = grid.findIndex(row => row.some(value => !d.empty(value)));
    if (start < 0) continue;
    const headers = grid[start].map(value => String(value ?? '').trim());
    if (COLUMNS.some(column => !headers.includes(column)) || new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) d.fail(`${filename}: Ungültige AUSWEISLOHN-Spalten.`);
    const offset = XLSX.utils.decode_range(workbook.Sheets[sheet]['!ref']).s.r;
    for (let index = start + 1; index < grid.length; index++) {
      if (grid[index].every(d.empty)) continue;
      const fields = Object.fromEntries(COLUMNS.map(column => [column, grid[index][headers.indexOf(column)] ?? null]));
      const text = column => d.empty(fields[column]) ? null : String(fields[column]).trim();
      const integer = (column, min, max) => {
        const value = Number(fields[column]);
        if (d.empty(fields[column]) || !Number.isSafeInteger(value) || value < min || value > max) d.fail(`${filename}, Zeile ${index + offset + 1}: ${column} ungültig.`);
        return value;
      };
      const year = integer('JAHR', 1900, 9999), monthNumber = integer('MONAT', 1, 12), week = integer('WOCHE', 1, 6), weekday = integer('TAG', 1, 7);
      if (year !== expectedYear) d.fail(`${filename}: Das Quelljahr stimmt nicht mit ${expectedYear} überein.`);
      const date = weekDays(year, monthNumber, week)[weekday - 1].toISOString().slice(0, 10), month = `${year}-${String(monthNumber).padStart(2, '0')}`;
      if (!date.startsWith(month) || !['L', 'F'].includes(text('VERWENDUNG'))) d.fail(`${filename}: Datum oder Verwendung ungültig.`);
      if (!/^\d+$/.test(text('PERSONALNR') || '') || !/^\d+$/.test(text('LOHNARTNR') || '')) d.fail(`${filename}: Personalnummer oder Lohnart fehlt.`);
      for (const column of ['VON', 'BIS']) if (!d.empty(fields[column]) && d.date(fields[column], !!workbook.Workbook?.WBProps?.date1904) !== date) d.fail(`${filename}: Kalenderfelder widersprechen ${column}.`);
      const key = JSON.stringify(['PERSONALNR', 'AUFTRAGNR', 'EINSORTNR', 'JAHR', 'MONAT', 'WOCHE', 'TAG', 'VERWENDUNG', 'TAETNR', 'LOHNARTNR', 'LFDNR'].map(column => text(column)));
      if (keys.has(key)) d.fail(`${filename}: Doppelte AUSWEISLOHN-Identität in Zeile ${index + offset + 1}.`);
      keys.add(key);
      rows.push({ personalNr: text('PERSONALNR'), wageType: text('LOHNARTNR'), side: text('VERWENDUNG'), date, month,
        hours: decimal(fields.STUNDEN), amount: decimal(fields.BETRAG), fields,
        source: { filename, sheet, row: index + offset + 1 } });
    }
  }
  if (!rows.length || rows.length > 100000) d.fail(`${filename}: Keine oder zu viele AUSWEISLOHN-Zeilen.`);
  return rows;
}
module.exports = { COLUMNS, parse };
