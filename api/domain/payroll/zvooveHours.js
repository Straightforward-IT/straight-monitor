const crypto = require('node:crypto');
const XLSX = require('xlsx');
const COLUMNS = ['PERSONALNR', 'JAHR', 'MONAT', 'WOCHE', 'KW', ...Array.from({ length: 7 }, (_, i) => `T${i + 1}`), ...Array.from({ length: 7 }, (_, i) => `KZ${i + 1}`), 'ERSTELLTAM', 'GEAENDERAM'];
const empty = value => value === null || value === undefined || (typeof value === 'string' && !value.trim());
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const issue = (severity, code, message, source) => ({ severity, code, message, ...(source ? { source } : {}) });
function fail(message, code = 'PAYROLL_IMPORT_INVALID', statusCode = 400) { throw Object.assign(new Error(message), { code, statusCode }); }
function decimal(value) {
  if (empty(value)) return null;
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Ungültiger Dezimalwert.');
  const input = String(value).trim().replace(',', '.');
  const match = input.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error('Ungültiger Dezimalwert.');
  const exponent = Number(match[4] || 0);
  if (Math.abs(exponent) > 100) throw new Error('Dezimalwert außerhalb des unterstützten Bereichs.');
  let digits = match[2] + (match[3] || '');
  const point = match[2].length + exponent;
  let result = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  result = result.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return match[1] === '-' && /[1-9]/.test(result) ? `-${result}` : result;
}
function sumDecimals(values) {
  const parts = values.filter(value => value !== null && value !== undefined).map(value => decimal(value));
  const scale = Math.max(0, ...parts.map(value => (value.split('.')[1] || '').length));
  const total = parts.reduce((sum, value) => {
    const negative = value.startsWith('-'), positive = negative ? value.slice(1) : value;
    const [whole, fraction = ''] = positive.split('.');
    const n = BigInt(whole + fraction.padEnd(scale, '0'));
    return sum + (negative ? -n : n);
  }, 0n);
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0');
  return decimal(`${total < 0n ? '-' : ''}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`);
}
function integer(value, name, min, max) {
  const normalized = decimal(value);
  if (normalized === null || !/^\d+$/.test(normalized) || Number(normalized) < min || Number(normalized) > max) throw new Error(`${name} ist ungültig.`);
  return Number(normalized);
}
function personnel(value) {
  if (empty(value)) throw new Error('PERSONALNR fehlt.');
  const text = typeof value === 'number' ? decimal(value) : String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error('PERSONALNR ist ungültig.');
  return text;
}
function isoWeek(date) {
  const d = new Date(date); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function weekDays(year, month, week) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  first.setUTCDate(1 - ((first.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => new Date(first.getTime() + i * 86400000));
}
function parseWorkbook(buffer, filename = 'Stunden.xlsx') {
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false }); } catch { fail('Die Excel-Datei konnte nicht gelesen werden.'); }
  const rows = [], sourceRows = [], issues = [], periods = new Set(), seen = new Map();
  let receivedRows = 0;
  for (const sheet of workbook.SheetNames) {
    const rowOffset = workbook.Sheets[sheet]['!ref'] ? XLSX.utils.decode_range(workbook.Sheets[sheet]['!ref']).s.r : 0;
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: null, raw: true, blankrows: true });
    if (!data.some(row => row.some(value => !empty(value)))) continue;
    const headerIndex = data.findIndex(row => row.some(value => !empty(value)));
    const headers = data[headerIndex].map(value => empty(value) ? '' : String(value).trim());
    const missing = COLUMNS.filter(column => !headers.includes(column));
    if (missing.length || headers.filter(Boolean).length !== new Set(headers.filter(Boolean)).size) {
      issues.push(issue('ERROR', 'INVALID_COLUMNS', missing.length ? `Pflichtspalten fehlen: ${missing.join(', ')}.` : 'Spaltenüberschriften sind mehrfach vorhanden.', { filename, sheet, row: rowOffset + headerIndex + 1 }));
      for (let index = headerIndex + 1; index < data.length; index++) if (!data[index].every(empty)) {
        receivedRows++; sourceRows.push({ headers, rawCells: data[index], source: { filename, sheet, row: rowOffset + index + 1 } });
      }
      continue;
    }
    for (let index = headerIndex + 1; index < data.length; index++) {
      if (data[index].every(empty)) continue;
      receivedRows++;
      const raw = Object.fromEntries(headers.filter(Boolean).map(column => [column, data[index][headers.indexOf(column)] ?? null]));
      const source = { filename, sheet, row: rowOffset + index + 1 };
      sourceRows.push({ raw, source });
      try {
        const personalNr = personnel(raw.PERSONALNR), year = integer(raw.JAHR, 'JAHR', 1900, 9999), monthNumber = integer(raw.MONAT, 'MONAT', 1, 12), week = integer(raw.WOCHE, 'WOCHE', 1, 6);
        const month = `${year}-${String(monthNumber).padStart(2, '0')}`;
        periods.add(month);
        const dates = weekDays(year, monthNumber, week), inMonth = dates.filter(date => date.getUTCMonth() === monthNumber - 1 && date.getUTCFullYear() === year);
        const kw = empty(raw.KW) ? null : integer(raw.KW, 'KW', 1, 53);
        if (inMonth.length && kw === null) throw new Error('KW fehlt für eine Kalenderwoche innerhalb des Monats.');
        if (kw !== null && kw !== isoWeek(dates[0])) throw new Error(`KW ${kw} passt nicht zur Wochenposition ${week} (erwartet: ${isoWeek(dates[0])}).`);
        const days = [];
        for (let i = 0; i < 7; i++) {
          const hours = decimal(raw[`T${i + 1}`]);
          const kb = empty(raw[`KZ${i + 1}`]) ? '' : String(raw[`KZ${i + 1}`]).trim().toUpperCase();
          if (hours === null && !kb) continue;
          const date = dates[i];
          if (date.getUTCMonth() !== monthNumber - 1 || date.getUTCFullYear() !== year) throw new Error(`T${i + 1}/KZ${i + 1} enthält einen Wert außerhalb des Monats.`);
          days.push({ date: date.toISOString().slice(0, 10), hours, kb, daySlot: i + 1 });
        }
        const key = JSON.stringify([personalNr, month, week]);
        const row = { key, personalNr, month, week, kw, raw, source, days };
        const rawHash = hash(raw);
        if (seen.has(key)) {
          if (seen.get(key) !== rawHash) issues.push(issue('ERROR', 'CONFLICTING_WEEK', `Widersprüchliche Wochenzeilen für Personalnummer ${personalNr}, ${month}, Woche ${week}.`, source));
          else issues.push(issue('WARNING', 'DUPLICATE_WEEK', `Identische Wochenzeile ${week} für Personalnummer ${personalNr} mehrfach vorhanden.`, source));
          continue;
        }
        seen.set(key, rawHash); rows.push(row);
      } catch (error) { issues.push(issue('ERROR', 'INVALID_ROW', error.message, source)); }
    }
  }
  if (!receivedRows) issues.push(issue('ERROR', 'EMPTY_FILE', 'Die Datei enthält keine Stundenzeilen.'));
  if (periods.size > 1) issues.push(issue('ERROR', 'MULTIPLE_MONTHS', 'Eine Importdatei darf nur genau einen Monat enthalten.'));
  return { rows, sourceRows, issues, month: periods.size === 1 ? [...periods][0] : null, receivedRows, filename };
}
function resolveRows(rows, employees, lohnarten) {
  const numbers = new Map(), codes = new Map(), issues = [];
  for (const employee of employees) {
    for (const number of new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry.value)].filter(value => !empty(value)).map(value => String(value).trim()))) {
      if (!numbers.has(number)) numbers.set(number, []);
      numbers.get(number).push(employee);
    }
  }
  for (const category of lohnarten) {
    const kb = String(category.kb || '').trim().toUpperCase();
    if (!kb) continue;
    if (!codes.has(kb)) codes.set(kb, []);
    codes.get(kb).push(category);
  }
  const warnedPersonnel = new Map(), warnedKb = new Map();
  const resolved = rows.map(row => {
    const matches = numbers.get(row.personalNr) || [], matchStatus = matches.length === 1 ? 'MATCHED' : matches.length ? 'AMBIGUOUS' : 'MISSING';
    if (matchStatus !== 'MATCHED') {
      if (warnedPersonnel.has(row.personalNr)) warnedPersonnel.get(row.personalNr).occurrences++;
      else {
        const warning = { ...issue('WARNING', `EMPLOYEE_${matchStatus}`, `Personalnummer ${row.personalNr} ist ${matches.length ? 'mehreren Mitarbeitern zugeordnet' : 'keinem Mitarbeiter zugeordnet'}.`, row.source), occurrences: 1 };
        issues.push(warning); warnedPersonnel.set(row.personalNr, warning);
      }
    }
    const days = row.days.map(day => {
      if (!day.kb) return { ...day, kind: 'productive', label: 'Produktive Stunden', resolution: 'PRODUCTIVE' };
      if (day.kb === 'FS') return { ...day, kind: 'marker', label: 'FS · Tageskennzeichnung', resolution: 'INTERNAL_MARKER' };
      const categories = codes.get(day.kb) || [];
      if (categories.length === 1) return { ...day, kind: 'absence', label: categories[0].lohnartBezeichnung || day.kb, lohnartNummer: String(categories[0].lohnartNummer), resolution: 'MATCHED' };
      const status = categories.length ? 'AMBIGUOUS' : 'MISSING';
      if (warnedKb.has(day.kb)) warnedKb.get(day.kb).occurrences++;
      else {
        const warning = { ...issue('WARNING', `KB_${status}`, `KB ${day.kb} ist ${categories.length ? 'mehreren Lohnarten zugeordnet' : 'keiner Lohnart zugeordnet'}.`, row.source), occurrences: 1 };
        issues.push(warning); warnedKb.set(day.kb, warning);
      }
      return { ...day, kind: 'unresolved', label: `KB ${day.kb} · Zuordnung offen`, resolution: status };
    });
    return { ...row, employeeId: matches.length === 1 ? String(matches[0]._id) : null, matchStatus, days };
  });
  return { rows: resolved, issues };
}
function rowHash(row) {
  // File/row provenance belongs to the import run; business identity is reusable.
  return hash({ key: row.key, raw: Object.fromEntries(Object.entries(row.raw).sort(([a], [b]) => a.localeCompare(b))), employeeId: row.employeeId, matchStatus: row.matchStatus, days: row.days });
}
module.exports = { COLUMNS, empty, hash, issue, fail, decimal, sumDecimals, isoWeek, weekDays, parseWorkbook, resolveRows, rowHash };
