const assert = require('node:assert/strict');
const path = require('node:path');
const XLSX = require('xlsx');
const {
  normalizeExcelTime,
  excelDate,
  sheetToJsonWithFormattedTimes,
} = require('../utils/excelTime');

function readTimeCell(time) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['UHRZEITVON', 'UHRZEITBIS'],
    [time / 24, (time + 8) / 24],
  ]);
  sheet.A2.z = 'h:mm:ss';
  sheet.B2.z = 'h:mm:ss';

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Einsatz');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const parsedWorkbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  return sheetToJsonWithFormattedTimes(
    parsedWorkbook.Sheets.Einsatz,
    ['UHRZEITVON', 'UHRZEITBIS']
  )[0];
}

describe('Excel time parsing', () => {
  it('normalizes Excel display times without changing the wall clock', () => {
    assert.equal(normalizeExcelTime('10:00'), '10:00');
    assert.equal(normalizeExcelTime('9:05:00'), '09:05');
  });

  it('handles numeric serials, General formatting, midnight and overnight clocks', () => {
    assert.equal(normalizeExcelTime(10 / 24), '10:00');
    assert.equal(normalizeExcelTime(18 / 24), '18:00');
    assert.equal(normalizeExcelTime(0), '00:00');
    assert.equal(normalizeExcelTime(1 / 24 + 30 / 1440), '01:30');
    assert.equal(normalizeExcelTime((10 * 3600 + 59) / 86400), '10:00');
    assert.equal(normalizeExcelTime('9:05'), '09:05');
    for (const value of ['25:00', '10:60', '10:00:70', 'invalid', NaN]) {
      assert.throws(() => normalizeExcelTime(value), { statusCode: 400 });
    }
  });

  it('preserves shift and meeting clocks and calendar days across September, October and DST', () => {
    const originalTimezone = process.env.TZ;
    const dates = ['2026-09-30', '2026-10-01', '2026-10-25', '2026-10-26', '2026-12-01'];
    try {
      for (const timezone of ['UTC', 'Europe/Berlin', 'America/Los_Angeles']) {
        process.env.TZ = timezone;
        const sheet = XLSX.utils.aoa_to_sheet([
          ['DETAIL_DATUMVON', 'UHRZEITVON', 'UHRZEITBIS', 'TREFFPUNKTUHRZEIT'],
          ...dates.map(day => [(Date.parse(`${day}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000, 10 / 24, 18 / 24, 9.75 / 24]),
        ]);
        const rows = sheetToJsonWithFormattedTimes(sheet, ['UHRZEITVON', 'UHRZEITBIS', 'TREFFPUNKTUHRZEIT'], {
          dateHeaders: ['DETAIL_DATUMVON'],
        });
        rows.forEach((row, index) => {
          assert.equal(row.DETAIL_DATUMVON.toISOString(), `${dates[index]}T00:00:00.000Z`, timezone);
          assert.equal(row.UHRZEITVON, '10:00', timezone);
          assert.equal(row.UHRZEITBIS, '18:00', timezone);
          assert.equal(row.TREFFPUNKTUHRZEIT, '09:45', timezone);
        });
      }
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('separates calendar dates from Berlin timestamps and supports the 1904 date system', () => {
    assert.equal(excelDate('01.10.2026').toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(excelDate(1, { date1904: true }).toISOString(), '1904-01-02T00:00:00.000Z');
    assert.equal(excelDate('2026-10-01 10:00:30', { timestamp: true }).toISOString(), '2026-10-01T08:00:30.000Z');
    assert.equal(excelDate('2026-10-26 10:00:30', { timestamp: true }).toISOString(), '2026-10-26T09:00:30.000Z');
    assert.throws(() => excelDate('2026-02-30'), { statusCode: 400 });
  });

  it('reads time-only XLSX cells independently of the process timezone', () => {
    const originalTimezone = process.env.TZ;

    try {
      for (const timezone of ['UTC', 'Europe/Berlin', 'America/Los_Angeles']) {
        process.env.TZ = timezone;
        const row = readTimeCell(10);
        assert.equal(row.UHRZEITVON, '10:00', timezone);
        assert.equal(row.UHRZEITBIS, '18:00', timezone);
      }
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('preserves the displayed wall clock from the real Einsatz import format', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';

    try {
      const workbook = XLSX.readFile(path.join(__dirname, '../assets/Einsatz.xlsx'), {
        cellDates: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet);
      const importedRows = sheetToJsonWithFormattedTimes(
        sheet,
        ['UHRZEITVON', 'UHRZEITBIS']
      );
      const rowIndex = importedRows.findIndex((row) => row.UHRZEITVON === '10:00');

      assert.notEqual(rowIndex, -1);
      assert.ok(rawRows[rowIndex].UHRZEITVON instanceof Date);
      assert.equal(rawRows[rowIndex].UHRZEITVON.getUTCHours(), 9);
      assert.equal(importedRows[rowIndex].UHRZEITVON, '10:00');
      assert.equal(importedRows[rowIndex].UHRZEITBIS, '18:00');
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('decodes the real Einsatz export without Date coercion and preserves all Excel clock displays', () => {
    const workbook = XLSX.readFile(path.join(__dirname, '../assets/Einsatz.xlsx'), { cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const timeHeaders = ['UHRZEITVON', 'UHRZEITBIS', 'TREFFPUNKTUHRZEIT'];
    const rows = sheetToJsonWithFormattedTimes(sheet, timeHeaders, {
      dateHeaders: ['DATUMVON', 'DATUMBIS', 'DETAIL_DATUMVON', 'DETAIL_DATUMBIS', 'VONDATUM', 'BISDATUM', 'BESTDATUM', 'KUNDESEIT'],
      timestampHeaders: ['DTPROTDATUM', 'LETZTEAUSSCHREIBUNG', 'DTANGELEGTAM'],
    });
    const displayedRows = XLSX.utils.sheet_to_json(sheet, { raw: false });
    rows.forEach((row, index) => {
      for (const header of timeHeaders) {
        if (displayedRows[index][header] != null) assert.equal(row[header], normalizeExcelTime(displayedRows[index][header]));
      }
    });
  });
});
