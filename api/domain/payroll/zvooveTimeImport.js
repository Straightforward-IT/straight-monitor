const XLSX = require('xlsx');
const d = require('./detailImport');
const { decimal, sumDecimals } = require('./zvooveHours');
const exact = require('../../services/tariffs/tariffMoney');

// Explicit contracts from assets/Stundenvortrag 2026.xlsx and Stunduhr 2026.xlsx.
const VORTRAG_COLUMNS = 'ID DBID IDARBEITSSCHICHT DBIDARBEITSSCHICHT PERSONALNR ISTZEITENVON ISTZEITENBIS ISTSTUNDEN PAUSE ISTUEBETRAGEN ANLAGEDATUM ANLAGEBEDIENER UEBETRAGUNGSBEDIENER TRFIELD REPL_ID REPL_DATABASE UEBERTRAGUNGSDATUM PAUSE1VON PAUSE1BIS PAUSE2VON PAUSE2BIS PAUSE3VON PAUSE3BIS EDITSTATE PAUSE1ISTBEZAHLT PAUSE2ISTBEZAHLT PAUSE3ISTBEZAHLT PAUSEBEZAHLT PAUSE1VONBEZAHLT PAUSE1BISBEZAHLT PAUSE2VONBEZAHLT PAUSE2BISBEZAHLT PAUSE3VONBEZAHLT PAUSE3BISBEZAHLT SATZSPERREDURCH BEARBEITUNGABGESCHLOSSEN ID_STVORTRAG_ERFASSUNGSINFO DBID_STVORTRAG_ERFASSUNGSINFO BEARBEITUNGPERSONALNR DATUM'.split(' ');
const UHR_COLUMNS = 'PERSONALNR AUFTRAGSNR EINSORT JAHR MONAT WOCHE TAG PAUSE LFDNR VON BIS KZ STUNDEN EINSBEZ PROJEKT ERFPRNR TRANS TRFIELD REPL_ID REPL_DATABASE BEMERKUNG LEISTUNGPOSNR ARBABK ID_AKKPRODUKTE DBID_AKKPRODUKTE AKKMENGE1 AKKMENGE2 LEISTUNGSGENERIERUNGSET DATUM IDARBEITSSCHICHT DBIDARBEITSSCHICHT GUID_ARBEITSZEITEN GUID_PAUSEN BEZAHLTE_PAUSE'.split(' ');
const PROFILES = { STUNDENVORTRAG: VORTRAG_COLUMNS, STUNDUHR: UHR_COLUMNS };
const issue = (code, message) => ({ code, message });
const value = d.str;
function minutes(hours) {
  if (hours == null) return null;
  const part = exact.decimalParts(hours), numerator = part.numerator * 60n;
  if (numerator < 0n || numerator % part.denominator !== 0n) return null;
  const result = Number(numerator / part.denominator);
  return Number.isSafeInteger(result) ? result : null;
}
function parse(files, year) {
  if (!Number.isSafeInteger(year) || year < 1900 || year > 9999) d.fail('Gültiges Importjahr angeben.');
  if (!files?.length || files.length > 2 || new Set(files.map(file => file.fieldname)).size !== files.length) d.fail('Eine Datei je Tabellenrolle liefern.');
  const rows = [], roles = [], fileInfo = [];
  for (const file of files) {
    const columns = PROFILES[file.fieldname];
    if (!columns) d.fail('Nur STUNDENVORTRAG und STUNDUHR sind hier zulässig.');
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
    let filled = 0;
    for (const sheet of workbook.SheetNames) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: null, blankrows: true, raw: true });
      const head = data.findIndex(row => row.some(v => v != null && v !== ''));
      if (head < 0) continue;
      filled++;
      const originalHeaders = data[head].map(String), headers = originalHeaders.map(h => h.trim().toUpperCase());
      if (headers.some(h => !h) || new Set(headers).size !== headers.length) d.fail('Spaltenüberschriften sind leer oder mehrdeutig.');
      const missing = columns.filter(h => !headers.includes(h));
      if (missing.length) d.fail(`${file.fieldname}: Pflichtspalten fehlen: ${missing.join(', ')}.`);
      const offset = XLSX.utils.decode_range(workbook.Sheets[sheet]['!ref']).s.r;
      const before = rows.length;
      for (let i = head + 1; i < data.length; i++) {
        if (data[i].every(v => v == null || v === '')) continue;
        if (data[i].slice(headers.length).some(v => v != null && v !== '')) d.fail('Zellwert ohne Spaltenüberschrift.');
        const raw = Object.fromEntries(headers.map((h, col) => [h, data[i][col] ?? null]));
        const role = file.fieldname, day = d.date(raw.DATUM, !!workbook.Workbook?.WBProps?.date1904);
        if (!day?.startsWith(`${year}-`)) d.fail(`${role}, Zeile ${offset + i + 1}: Datum liegt nicht im Importjahr.`);
        const database = value(raw.REPL_DATABASE), recordId = value(raw.REPL_ID);
        if (!/^[1-9]\d*$/.test(database || '') || !/^[1-9]\d*$/.test(recordId || '') || !/^\d+$/.test(value(raw.PERSONALNR) || '')) d.fail('Stabile REPL_DATABASE/REPL_ID oder Personalnummer fehlen.');
        const fields = Object.fromEntries(columns.map(column => [column, raw[column] == null ? null : String(raw[column])]));
        const row = { role, year, sourceKey: `${role}:${database}:${recordId}`, date: day, personalNr: value(raw.PERSONALNR), shiftId: value(raw.IDARBEITSSCHICHT), shiftDatabase: value(raw.DBIDARBEITSSCHICHT),
          fields, source: { filename: file.originalname, sheet, row: offset + i + 1 }, originalHeaders, cells: data[i], raw, date1904: !!workbook.Workbook?.WBProps?.date1904 };
        row.contentHash = d.hash({ role, year, raw, date: day });
        rows.push(row);
      }
      fileInfo.push({ role: file.fieldname, filename: file.originalname, sheet, rows: rows.length - before, headers: originalHeaders });
    }
    if (filled !== 1) d.fail(`${file.fieldname}: Genau ein befülltes Tabellenblatt ist erforderlich.`);
    roles.push(file.fieldname);
  }
  if (rows.length > 200000) d.fail('Maximal 200000 Quellzeilen je Jahresimport.');
  const seen = new Map();
  for (const row of rows) {
    if (seen.has(row.sourceKey)) d.fail(`Quell-ID ${row.sourceKey} ist mehrfach vorhanden. Keine Zeile wird verworfen.`);
    seen.set(row.sourceKey, row.contentHash);
  }
  return { rows, roles, files: fileInfo };
}
function source(row) { return { role: row.role, ...row.source, recordId: row.fields.REPL_ID, sourceKey: row.sourceKey }; }
function rowValues(row) {
  const r = row.raw, issues = [];
  let start = null, end = null;
  try {
    const a = d.clock(r.ISTZEITENVON), b = d.clock(r.ISTZEITENBIS, true);
    if (a == null || b == null || a === b) throw new Error('Beginn/Ende des Vortrags fehlen oder sind gleich.');
    start = d.instant(row.date, a); end = d.instant(row.date, b < a ? b + 1440 : b);
  } catch (error) { issues.push(issue('VORTRAG_TIME_UNRESOLVED', error.message)); }
  const netMinutes = minutes(decimal(r.ISTSTUNDEN)), breakMinutes = minutes(decimal(r.PAUSE));
  const paidBreakMinutes = minutes(decimal(r.PAUSEBEZAHLT));
  if (netMinutes == null || breakMinutes == null || paidBreakMinutes == null) issues.push(issue('VORTRAG_QUANTITY_UNRESOLVED', 'Stunden-/Pausenwerte sind nicht als ganze Minuten darstellbar.'));
  // Raw paid flags/intervals are retained independently; never reinterpret a flag as a duration.
  const breaks = [];
  for (let n = 1; n <= 3; n++) {
    if (r[`PAUSE${n}VON`] == null && r[`PAUSE${n}BIS`] == null) continue;
    try {
      const a = d.clock(r[`PAUSE${n}VON`]), b = d.clock(r[`PAUSE${n}BIS`], true), first = d.clock(r.ISTZEITENVON);
      if (a == null || b == null || a === b || first == null) throw new Error('Unvollständiges oder leeres Pausenintervall im Vortrag.');
      const from = d.instant(row.date, a < first ? a + 1440 : a), till = d.instant(row.date, b < first ? b + 1440 : b);
      if (!start || from < start || till > end || till <= from) throw new Error('Vortragspause liegt außerhalb der Arbeitszeit.');
      breaks.push({ start: from, end: till, paid: d.flag(r[`PAUSE${n}ISTBEZAHLT`]) });
    } catch (error) { issues.push(issue('VORTRAG_BREAK_UNRESOLVED', error.message)); }
  }
  return { start, end, netMinutes, breakMinutes, paidBreakMinutes, breaks, issues };
}
function normalize(rows) {
  const vortraege = rows.filter(r => r.role === 'STUNDENVORTRAG'), uhr = rows.filter(r => r.role === 'STUNDUHR');
  const draftKey = r => JSON.stringify([r.fields.REPL_DATABASE, r.shiftId, r.personalNr, r.date]);
  const draftMap = new Map();
  for (const row of vortraege) { const k = draftKey(row), list = draftMap.get(k) || []; list.push(row); draftMap.set(k, list); }
  const groupKey = r => JSON.stringify([r.fields.REPL_DATABASE, r.personalNr, r.fields.AUFTRAGSNR, r.fields.EINSORT, r.date, r.shiftId, r.fields.LFDNR]);
  const baseKey = r => JSON.stringify([r.fields.REPL_DATABASE, r.personalNr, r.fields.AUFTRAGSNR, r.fields.EINSORT, r.date, r.fields.LFDNR]);
  const workByBase = new Map();
  for (const row of uhr.filter(row => row.fields.PAUSE === '0')) { const k = baseKey(row), list = workByBase.get(k) || []; list.push(row); workByBase.set(k, list); }
  const groups = new Map();
  for (const row of uhr) {
    const candidates = row.shiftDatabase === '-1' && row.fields.PAUSE !== '0' ? workByBase.get(baseKey(row)) || [] : [];
    const k = candidates.length === 1 ? groupKey(candidates[0]) : groupKey(row), list = groups.get(k) || [];
    list.push(row); groups.set(k, list);
  }
  const bookings = [], orphanPauses = [];
  for (const group of groups.values()) {
    const work = group.filter(r => r.fields.PAUSE === '0'), pauses = group.filter(r => ['1', '2', '3'].includes(r.fields.PAUSE));
    if (work.length !== 1) { orphanPauses.push(...group.map(r => ({ sourceKey: r.sourceKey, code: work.length ? 'MULTIPLE_WORK_ROWS' : 'WORK_ROW_MISSING' }))); continue; }
    const row = work[0], r = row.raw, issues = [], hints = [];
    const booking = { ordinal: bookings.length, sourceSystem: 'zvoove', sourceKey: row.sourceKey, employeeId: null, assignmentId: null,
      assignmentNumber: null, guaranteedMinutes: null, personalNr: row.personalNr, auftragNr: Number(r.AUFTRAGSNR), einsortNr: value(r.EINSORT), shiftId: row.shiftId, date: row.date, start: null, end: null, timeZone: 'Europe/Berlin',
      reportedHours: decimal(r.STUNDEN), reportedBreak: sumDecimals(pauses.map(p => decimal(p.raw.STUNDEN))), reportedPaidBreak: decimal(r.BEZAHLTE_PAUSE),
      breakMinutes: null, paidBreakMinutes: null, productiveMinutes: minutes(decimal(r.STUNDEN)), breaks: [], sources: [source(row)], issues, hints, breakLocationKnown: true };
    const candidates = (draftMap.get(draftKey(row)) || []).filter(draft => row.shiftDatabase === '-1' || draft.shiftDatabase === '-1' || row.shiftDatabase === draft.shiftDatabase);
    if (candidates.length === 1) booking.sources.push(source(candidates[0]));
    if (candidates.length > 1) hints.push(issue('VORTRAG_AMBIGUOUS', 'Mehrere Vorträge passen; gebuchte STUNDUHR-Zeit bleibt führend.'));
    try {
      if (!Number.isSafeInteger(booking.auftragNr) || booking.auftragNr <= 0) throw new Error('Ungültige Auftragsnummer.');
      const a = d.clock(r.VON), b = d.clock(r.BIS, true);
      if (a == null || b == null || a === b) throw new Error('Arbeitsintervall fehlt oder ist leer.');
      booking.start = d.instant(row.date, a); booking.end = d.instant(row.date, b < a ? b + 1440 : b);
      if (booking.productiveMinutes == null) throw new Error('Gebuchte Stunden sind nicht minutengenau.');
      if (group.length !== pauses.length + 1) throw new Error('Unbekannter STUNDUHR-PAUSE-Code.');
      booking.breakMinutes = minutes(booking.reportedBreak);
      if (booking.breakMinutes == null) throw new Error('Pausendauer ist nicht minutengenau.');
      for (const pause of pauses) {
        booking.sources.push(source(pause));
        if (row.shiftDatabase !== pause.shiftDatabase) {
          if (![row.shiftDatabase, pause.shiftDatabase].includes('-1')) throw new Error('Schichtdatenbanken der Arbeits-/Pausenzeilen widersprechen sich.');
          hints.push(issue('SHIFT_DATABASE_PLACEHOLDER', 'DBID=-1 nur innerhalb einer eindeutigen Buchungsgruppe zugeordnet.'));
        }
        if (decimal(pause.raw.STUNDEN) === '0') continue;
        if (pause.raw.VON == null && pause.raw.BIS == null) { if (Number(pause.raw.STUNDEN) > 0) booking.breakLocationKnown = false; continue; }
        const x = d.clock(pause.raw.VON), y = d.clock(pause.raw.BIS, true);
        if (x == null || y == null || x === y) throw new Error('Pausenzeile enthält kein eindeutiges Intervall.');
        const start = d.instant(row.date, x < a ? x + 1440 : x), end = d.instant(row.date, y < a ? y + 1440 : y);
        if (start < booking.start || end > booking.end || end <= start || (+new Date(end) - +new Date(start)) / 60000 !== minutes(decimal(pause.raw.STUNDEN))) throw new Error('Pausenintervall und Dauer widersprechen sich.');
        booking.breaks.push({ start, end, paid: null });
      }
      booking.breaks.sort((a, b) => a.start.localeCompare(b.start));
      if (booking.breaks.some((block, i, all) => i > 0 && block.start < all[i - 1].end)) throw new Error('Pausenintervalle überschneiden sich.');
      const duration = (+new Date(booking.end) - +new Date(booking.start)) / 60000;
      if (duration !== booking.productiveMinutes + booking.breakMinutes) throw new Error('Anwesenheit entspricht nicht gebuchten Nettostunden plus Pausendauer.');
      if (!booking.breakLocationKnown) hints.push(issue('BREAK_LOCATION_MISSING', 'Pausendauer bekannt; zeitabhängige Zuschläge benötigen Klärung.'));
      if (r.BEZAHLTE_PAUSE != null) booking.paidBreakMinutes = minutes(decimal(r.BEZAHLTE_PAUSE));
      else if (candidates.length === 1) booking.paidBreakMinutes = minutes(decimal(candidates[0].raw.PAUSEBEZAHLT));
      if (booking.paidBreakMinutes == null && booking.breakMinutes > 0) hints.push(issue('PAID_BREAK_STATUS_UNKNOWN', 'Bezahlte Pausenmenge ist nicht belegt.'));
      // PAUSEnISTBEZAHLT can be set without an interval; it is not proof of a paid pause in STUNDUHR.
      if (booking.paidBreakMinutes === 0) booking.breaks.forEach(block => { block.paid = false; });
    } catch (error) { issues.push(issue('BOOKING_UNRESOLVED', error.message)); }
    bookings.push(booking);
  }
  return { bookings, vortraege, orphanPauses, counts: { vortraege: vortraege.length, stunduhr: uhr.length, workRows: uhr.filter(r => r.fields.PAUSE === '0').length, pauseRows: uhr.filter(r => r.fields.PAUSE !== '0').length,
    bookings: bookings.length, unlocatedBreaks: bookings.filter(b => !b.breakLocationKnown).length, unresolved: bookings.filter(b => b.issues.length).length, orphanRows: orphanPauses.length },
    productiveHours: sumDecimals(bookings.map(b => b.reportedHours)), pauseHours: sumDecimals(uhr.filter(r => r.fields.PAUSE !== '0').map(r => decimal(r.raw.STUNDEN))) };
}
module.exports = { VORTRAG_COLUMNS, UHR_COLUMNS, PROFILES, parse, normalize, rowValues, minutes };
