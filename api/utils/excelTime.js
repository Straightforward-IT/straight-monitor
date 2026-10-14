const XLSX = require('xlsx');
const { atTime } = require('./orderDay');

function invalidCell(value) {
  const error = new Error(`Ungültiger Excel-Datums-/Zeitwert: ${String(value)}`);
  error.statusCode = 400;
  throw error;
}

function normalizeExcelTime(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) invalidCell(value);
    const parts = XLSX.SSF.parse_date_code(value % 1);
    if (!parts) invalidCell(value);
    return `${String(parts.H).padStart(2, '0')}:${String(parts.M).padStart(2, '0')}`;
  }

  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) invalidCell(value);

  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function excelDate(value, { date1904 = false, timestamp = false } = {}) {
  if (value == null || value === '') return null;
  let parts;
  if (typeof value === 'number' && Number.isFinite(value)) {
    parts = XLSX.SSF.parse_date_code(value, { date1904 });
  } else if (typeof value === 'string') {
    const match = value.trim().match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\.(\d{1,2})\.(\d{4}))(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) parts = {
      y: Number(match[1] || match[6]), m: Number(match[2] || match[5]), d: Number(match[3] || match[4]),
      H: Number(match[7] || 0), M: Number(match[8] || 0), S: Number(match[9] || 0), u: 0,
    };
  }
  if (!parts || parts.H > 23 || parts.M > 59 || parts.S > 59) invalidCell(value);
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  if (date.getUTCFullYear() !== parts.y || date.getUTCMonth() !== parts.m - 1 || date.getUTCDate() !== parts.d) invalidCell(value);
  if (!timestamp) return date;
  const day = date.toISOString().slice(0, 10);
  const clock = `${String(parts.H).padStart(2, '0')}:${String(parts.M).padStart(2, '0')}`;
  return new Date(atTime(day, clock).getTime() + parts.S * 1000 + Math.round((parts.u || 0) * 1000));
}

function sheetToJsonWithFormattedTimes(sheet, timeHeaders, { dateHeaders = [], timestampHeaders = [], date1904 = false } = {}) {
  const rows = XLSX.utils.sheet_to_json(sheet);
  const formattedRows = XLSX.utils.sheet_to_json(sheet, { raw: false });

  return rows.map((row, index) => {
    const formattedRow = formattedRows[index] || {};
    const mergedRow = { ...row };

    for (const header of timeHeaders) {
      if (Object.hasOwn(row, header)) {
        // Serial fractions and HH:MM are wall clocks, not instants. For older
        // callers using cellDates:true, the cached Excel display is authoritative.
        mergedRow[header] = normalizeExcelTime(row[header] instanceof Date ? formattedRow[header] : row[header]);
      }
    }
    for (const header of dateHeaders) {
      if (Object.hasOwn(row, header)) mergedRow[header] = excelDate(row[header], { date1904 });
    }
    for (const header of timestampHeaders) {
      if (Object.hasOwn(row, header)) mergedRow[header] = excelDate(row[header], { date1904, timestamp: true });
    }

    return mergedRow;
  });
}

module.exports = { normalizeExcelTime, excelDate, sheetToJsonWithFormattedTimes };
