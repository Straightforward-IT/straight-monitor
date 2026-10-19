const XLSX = require('xlsx');
const crypto = require('node:crypto');
const { decimal } = require('./zvooveHours');
const exact = require('../../services/tariffs/tariffMoney');
const INPUT_ROLES = ['STUNDUHR', 'STUNDENVORTRAG', 'AUFTRLOA'];
const REFERENCE_ROLES = ['LOHNPOSITIONEN', 'LOHNARTENSUMMEN', 'FAKTURPOSITIONEN', 'RECHNUNGEN'];
const empty = value => value == null || value === '';
const str = value => empty(value) ? null : String(value).trim();
const fail = (message, code = 'DETAIL_IMPORT_INVALID', statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const problem = (code, message, source) => ({ code, message, ...(source ? { source: typeof source === 'string' ? source : `${source.role}:${source.sheet}:${source.row}` } : {}) });
function flag(value) {
  if (empty(value)) return null;
  if ([1, true, '1', 'J', 'Y', 'TRUE'].includes(value)) return true;
  if ([0, false, '0', 'N', 'FALSE'].includes(value)) return false;
  throw new Error(`Unbekanntes Ja/Nein-Kennzeichen: ${value}.`);
}
function date(value, date1904 = false) {
  if (empty(value)) return null;
  let result;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!parsed) throw new Error('Ungültiges Excel-Datum.');
    result = `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  } else {
    const text = String(value).trim();
    const german = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    result = german ? `${german[3]}-${german[2]}-${german[1]}` : text.match(/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/)?.[0].slice(0, 10);
  }
  if (!result || !/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Datum muss ein Excel-Datum, YYYY-MM-DD oder DD.MM.YYYY sein.');
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== result) throw new Error('Ungültiges Kalenderdatum.');
  return result;
}
function clock(value, allow24 = false) {
  if (empty(value)) return null;
  let minutes;
  if (typeof value === 'number') {
    const raw = value * 1440;
    if (Math.abs(raw - Math.round(raw)) > 1e-7) throw new Error('Sekundengenaue Quellzeit benötigt eine gesonderte Verarbeitung.');
    minutes = Math.round(raw);
  } else {
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::00(?:\.0+)?)?$/);
    if (!match || Number(match[2]) > 59) throw new Error('Ungültige Uhrzeit.');
    minutes = Number(match[1]) * 60 + Number(match[2]);
  }
  if (minutes < 0 || minutes > (allow24 ? 1440 : 1439)) throw new Error('Uhrzeit außerhalb des Tages.');
  return minutes;
}
const berlin = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function instant(day, minutes) {
  if (!day || minutes == null) throw new Error('Datum oder Uhrzeit fehlt.');
  const wall = new Date(`${day}T00:00:00Z`).getTime() + minutes * 60000;
  const expected = new Date(wall).toISOString().slice(0, 16).replace('T', ' ');
  const candidates = [60, 120].map(offset => new Date(wall - offset * 60000)).filter(candidate => berlin.format(candidate) === expected);
  if (candidates.length !== 1) throw new Error('Lokale Uhrzeit ist durch Zeitumstellung mehrdeutig oder nicht vorhanden.');
  return candidates[0].toISOString();
}
function readFiles(files, kind) {
  const roles = kind === 'INPUT' ? INPUT_ROLES : REFERENCE_ROLES;
  if (!files?.length || files.length > roles.length || new Set(files.map(file => file.fieldname)).size !== files.length) fail('Jede Tabellenrolle darf genau einmal geliefert werden.');
  const rows = [], issues = [];
  for (const file of files) {
    const role = file.fieldname;
    if (!roles.includes(role)) fail(`Unzulässige Tabellenrolle ${role}. Eingaben und Referenzen getrennt importieren.`);
    let workbook;
    try { workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false }); } catch { fail('Die Excel-Datei konnte nicht gelesen werden.'); }
    let populated = 0;
    for (const sheet of workbook.SheetNames) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: null, blankrows: true, raw: true });
      const first = data.findIndex(row => row.some(value => !empty(value)));
      if (first < 0) continue;
      populated++;
      const headers = data[first].map(value => String(value ?? '').trim().toUpperCase());
      if (headers.some(header => !header) || new Set(headers).size !== headers.length) fail(`${role}: Spaltenüberschriften müssen befüllt und eindeutig sein.`);
      const required = role === 'STUNDUHR' ? ['PERSONALNR', 'AUFTRAGSNR', 'DATUM', 'VON', 'BIS', 'STUNDEN', 'PAUSE']
        : role === 'STUNDENVORTRAG' ? ['ID', 'PERSONALNR', 'DATUM', 'IDARBEITSSCHICHT', 'ISTZEITENVON', 'ISTZEITENBIS']
          : role === 'AUFTRLOA' ? ['AUFTRAGNR', 'LOHNART', 'VERWENDUNG']
            : role === 'RECHNUNGEN' ? ['AUFTRAGNR', 'BETRAG']
              : ['PERSONALNR', 'LOHNART', 'MENGE', 'EINHEIT', 'BETRAG', ...(role === 'LOHNARTENSUMMEN' ? ['MONAT'] : ['DATUM']), ...(role === 'FAKTURPOSITIONEN' ? ['AUFTRAGNR'] : [])];
      const missing = required.filter(header => !headers.includes(header));
      if (missing.length) fail(`${role}: Pflichtspalten fehlen: ${missing.join(', ')}.`);
      const offset = workbook.Sheets[sheet]['!ref'] ? XLSX.utils.decode_range(workbook.Sheets[sheet]['!ref']).s.r : 0;
      for (let index = first + 1; index < data.length; index++) {
        if (data[index].every(empty)) continue;
        if (data[index].slice(headers.length).some(value => !empty(value))) fail(`${role}: Werte ohne Spaltenüberschrift.`);
        const raw = Object.fromEntries(headers.map((header, col) => [header, data[index][col] ?? null]));
        const source = { role, filename: file.originalname, sheet, row: offset + index + 1, recordId: str(raw.ID ?? raw.LFDNR ?? raw.REPL_ID ?? raw.GUID_ARBEITSZEITEN) };
        rows.push({ role, raw, source, originalHeaders: data[first].map(String), cells: data[index], date1904: !!workbook.Workbook?.WBProps?.date1904 });
      }
    }
    if (populated !== 1) fail(`${role}: Genau ein Tabellenblatt mit Kopfzeile ist erforderlich.`);
  }
  if (rows.length > 15000) fail('Höchstens 15000 Quellzeilen je Detailimport.');
  return { rows, issues, roles: files.map(file => file.fieldname) };
}
function minutes(value, unit) {
  const normalized = decimal(value);
  if (normalized == null) return null;
  if (Number(normalized) === 0) return 0;
  if (!unit) throw new Error('Einheit der Pausensumme ist ungeklärt; HOURS oder MINUTES beim Import angeben.');
  const result = Number(normalized) * (unit === 'HOURS' ? 60 : 1);
  if (result < 0 || result > 1440 || Math.abs(result - Math.round(result)) > 1e-7) throw new Error('Pausensumme ist keine gültige ganze Minutenzahl.');
  return Math.round(result);
}
function normalizeBookings(rows, auftragNr, pauseUnit) {
  const drafts = rows.filter(row => row.role === 'STUNDENVORTRAG'), bookings = [];
  for (const [ordinal, row] of rows.filter(row => row.role === 'STUNDUHR').entries()) {
    const r = row.raw, issues = [];
    const booking = { ordinal, employeeId: null, assignmentId: null, assignmentNumber: str(r.EINSPERSNR), guaranteedMinutes: null, personalNr: str(r.PERSONALNR), auftragNr: Number(r.AUFTRAGSNR), einsortNr: str(r.EINSORT), shiftId: str(r.IDARBEITSSCHICHT), date: null,
      start: null, end: null, timeZone: 'Europe/Berlin', reportedHours: null, reportedBreak: null, reportedPaidBreak: null, breakMinutes: null, paidBreakMinutes: null, productiveMinutes: null, breaks: [], sources: [row.source], issues };
    try {
      if (booking.auftragNr !== auftragNr) throw new Error('Zeitbuchung gehört nicht zum gewählten Auftrag.');
      if (!/^\d+$/.test(booking.personalNr || '')) throw new Error('Personalnummer fehlt oder ist ungültig.');
      booking.date = date(r.DATUM, row.date1904);
      const from = clock(r.VON), till = clock(r.BIS, true);
      if (from == null || till == null || from === till) throw new Error('Eindeutiger Beginn und Ende fehlen.');
      booking.start = instant(booking.date, from); booking.end = instant(booking.date, till < from ? till + 1440 : till);
      booking.reportedHours = decimal(r.STUNDEN); booking.reportedBreak = decimal(r.PAUSE); booking.reportedPaidBreak = decimal(r.BEZAHLTE_PAUSE);
      booking.breakMinutes = minutes(r.PAUSE, pauseUnit); booking.paidBreakMinutes = minutes(r.BEZAHLTE_PAUSE, pauseUnit);
      const candidates = drafts.filter(item => {
        try { return str(item.raw.PERSONALNR) === booking.personalNr && booking.shiftId != null && str(item.raw.IDARBEITSSCHICHT) === booking.shiftId && date(item.raw.DATUM, item.date1904) === booking.date; } catch { return false; }
      });
      if (candidates.length > 1) throw new Error('Mehrere Stundenvorträge passen zur Buchung; Pausen nicht eindeutig zuordenbar.');
      if (candidates.length === 1) {
        const draft = candidates[0], d = draft.raw;
        booking.sources.push(draft.source);
        if (clock(d.ISTZEITENVON) !== from || clock(d.ISTZEITENBIS, true) !== till) throw new Error('Stundenvortrag und Zeitbuchung enthalten unterschiedliche Arbeitszeiten.');
        if (!empty(d.ISTUEBETRAGEN) && flag(d.ISTUEBETRAGEN) !== true) throw new Error('Stundenvortrag wurde nicht übertragen.');
        if (!empty(d.BEARBEITUNGABGESCHLOSSEN) && flag(d.BEARBEITUNGABGESCHLOSSEN) !== true) throw new Error('Bearbeitung des Stundenvortrags ist nicht abgeschlossen.');
        for (let index = 1; index <= 3; index++) {
          if (empty(d[`PAUSE${index}VON`]) && empty(d[`PAUSE${index}BIS`])) continue;
          const a = clock(d[`PAUSE${index}VON`]), b = clock(d[`PAUSE${index}BIS`], true);
          const start = instant(booking.date, a == null ? null : a < from ? a + 1440 : a);
          const end = instant(booking.date, b == null ? null : b < from ? b + 1440 : b);
          const paid = flag(d[`PAUSE${index}ISTBEZAHLT`]);
          if (paid == null) throw new Error('Bezahlstatus eines Pausenintervalls fehlt.');
          if (start < booking.start || end > booking.end || end <= start) throw new Error('Pause liegt außerhalb der Arbeitszeit.');
          booking.breaks.push({ start, end, paid });
        }
        booking.breaks.sort((a, b) => a.start.localeCompare(b.start));
        if (booking.breaks.some((item, i, list) => i > 0 && item.start < list[i - 1].end)) throw new Error('Pausen überschneiden sich.');
        const total = booking.breaks.reduce((sum, block) => sum + (new Date(block.end) - new Date(block.start)) / 60000, 0);
        const paid = booking.breaks.reduce((sum, block) => sum + (block.paid ? (new Date(block.end) - new Date(block.start)) / 60000 : 0), 0);
        const draftMinutes = minutes(d.PAUSE, pauseUnit);
        if (booking.breaks.length && (booking.breakMinutes != null && total !== booking.breakMinutes || draftMinutes != null && total !== draftMinutes || booking.paidBreakMinutes != null && paid !== booking.paidBreakMinutes)) throw new Error('Pausenintervalle und Pausensummen widersprechen sich.');
        if (booking.breaks.length) { booking.breakMinutes = total; booking.paidBreakMinutes = paid; }
        else if (draftMinutes != null && booking.breakMinutes != null && draftMinutes !== booking.breakMinutes) throw new Error('Pausensummen widersprechen sich.');
        else if (booking.breakMinutes == null) booking.breakMinutes = draftMinutes;
      }
      const duration = (new Date(booking.end) - new Date(booking.start)) / 60000;
      if (booking.breakMinutes == null) throw new Error('Pausendauer ist nicht bekannt.');
      if (booking.breakMinutes > duration || duration <= 0 || duration > 1500) throw new Error('Ungültige Dauer der Arbeitszeit oder Pause.');
      if (booking.breakMinutes > 0 && !booking.breaks.length) throw new Error('Pausensumme vorhanden, genaue Pausenlage fehlt.');
      if (booking.paidBreakMinutes > booking.breakMinutes) throw new Error('Bezahlte Pause überschreitet Gesamtpause.');
      booking.productiveMinutes = duration - booking.breakMinutes;
      if (booking.reportedHours == null || Number(booking.reportedHours) < 0) throw new Error('Gebuchte Quellstunden fehlen oder sind negativ.');
      const reported = exact.decimalParts(booking.reportedHours);
      if (!booking.paidBreakMinutes && reported.numerator * 60n !== BigInt(booking.productiveMinutes) * reported.denominator) issues.push(problem('REPORTED_HOURS_DIFFERENCE', 'Gebuchte Stunden weichen von Arbeitsintervallen abzüglich Pausen ab; Bewertung vor Ausweisung klären.', row.source));
    } catch (error) { issues.push(problem('BOOKING_UNRESOLVED', error.message, row.source)); }
    bookings.push(booking);
  }
  for (const booking of bookings) {
    if (bookings.some(other => other !== booking && other.personalNr === booking.personalNr && other.start && booking.start && other.start < booking.end && booking.start < other.end)) booking.issues.push(problem('BOOKING_OVERLAP', 'Arbeitszeit überschneidet sich mit einer weiteren Buchung.'));
  }
  return bookings;
}
function normalizeRules(rows, auftragNr, ruleTimeUnit = 'CLOCK') {
  function ruleClock(value, allow24 = false) {
    if (ruleTimeUnit === 'CLOCK' || empty(value)) return clock(value, allow24);
    const fraction = exact.decimalParts(value);
    const numerator = fraction.numerator * 60n;
    if (numerator % fraction.denominator !== 0n) throw new Error('Regelzeit in Dezimalstunden ist nicht minutengenau.');
    const result = Number(numerator / fraction.denominator);
    if (result < 0 || result > (allow24 ? 1440 : 1439)) throw new Error('Regelzeit liegt außerhalb des Tages.');
    return result;
  }
  return rows.filter(row => row.role === 'AUFTRLOA').map((row, ordinal) => {
    const r = row.raw, issues = [];
    const rule = { ordinal, auftragNr: Number(r.AUFTRAGNR), personalNr: str(r.PERSONALNR) === '0' ? null : str(r.PERSONALNR), assignmentNumber: str(r.EINSPERSNR), einsortNr: str(r.EINSORTNR), serviceNumber: str(r.LFDLEISTNR), side: str(r.VERWENDUNG), wageType: str(r.LOHNART),
      fromDate: null, untilDate: null, windowStart: null, windowEnd: null, weekdays: [], holiday: null,
      rate: null, percent: null, priceNumber: str(r.PREISNR), priority: str(r.PRIORITAET), followingWageType: str(r.FOLGELOA), automatic: null,
      hourLimit: str(r.STUNDENGRENZE), afterHourLimit: str(r.ABSTUNDENGRENZE), hourLimitType: str(r.ART_STDGRENZE), intervalCode: str(r.TAKTUNG), ignoreBreak: str(r.IGNPAUSE), paidBreak: str(r.BEZAHLTE_PAUSE), deductPaidBreak: str(r.ABZUG_BEZAHLTE_PAUSE), calculationSelection: str(r.AUSWAHLDERBERECHNUNG), wageKind: str(r.ART_LOHNART), source: row.source, issues };
    try {
      if (rule.auftragNr !== auftragNr || !['L', 'F'].includes(rule.side) || !/^\d+$/.test(rule.wageType || '')) throw new Error('Auftrag, Verwendung oder Lohnart ist ungültig.');
      if (rule.personalNr != null && !/^\d+$/.test(rule.personalNr)) throw new Error('Personalnummer der Auftragsregel ist ungültig.');
      rule.fromDate = date(r.VONDATUM, row.date1904); rule.untilDate = date(r.BISDATUM, row.date1904);
      rule.windowStart = ruleClock(r.AB); rule.windowEnd = ruleClock(r.BIS, true);
      if (rule.windowStart == null || rule.windowEnd == null) throw new Error('Regelzeitfenster fehlt.');
      if (rule.windowStart === rule.windowEnd) throw new Error('Zeitfenster mit gleichem Beginn und Ende ist ungeklärt.');
      rule.rate = decimal(r.PREIS); rule.percent = decimal(r.PROZENT);
      if (rule.rate != null && Number(rule.rate) < 0 || rule.percent != null && Number(rule.percent) < 0) throw new Error('Negative Sätze oder Prozente werden noch nicht unterstützt.');
      rule.automatic = empty(r.NICHTAUTOM) ? null : !flag(r.NICHTAUTOM);
      for (const [index, name] of ['SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG'].entries()) {
        const enabled = flag(r[name]);
        if (enabled == null) throw new Error('Wochentagskennzeichen sind unvollständig.');
        if (enabled) rule.weekdays.push(index);
      }
      rule.holiday = flag(r.FEIERTAG);
      if (rule.holiday == null) throw new Error('Feiertagskennzeichen fehlt.');
      if (rule.automatic == null) throw new Error('Kennzeichen für automatische Ausweisung fehlt.');
      if (rule.fromDate && rule.untilDate && rule.fromDate > rule.untilDate) throw new Error('Regelgültigkeit ist umgekehrt.');
      const supported = new Set(['AUFTRAGNR', 'PERSONALNR', 'EINSPERSNR', 'EINSORTNR', 'LFDLEISTNR', 'VERWENDUNG', 'LOHNART', 'VONDATUM', 'BISDATUM', 'AB', 'BIS', 'PREIS', 'PROZENT', 'PREISNR', 'NICHTAUTOM', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG', 'SONNTAG', 'FEIERTAG', 'ID', 'LFDNR', 'REPL_ID']);
      for (const [field, value] of Object.entries(r)) if (!supported.has(field) && !empty(value) && !['0', 'N', 'FALSE'].includes(String(value).toUpperCase())) issues.push(problem('RULE_CODE_UNSUPPORTED', `${field}=${value} benötigt eine bestätigte Regelsemantik.`, row.source));
    } catch (error) { issues.push(problem('RULE_UNRESOLVED', error.message, row.source)); }
    return rule;
  });
}
function normalizeReferences(rows) {
  return rows.map(row => {
    const r = row.raw, kind = row.role;
    const day = date(r.DATUM, row.date1904), month = str(r.MONAT) || day?.slice(0, 7) || null;
    if (month != null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('Referenzmonat im Format YYYY-MM angeben.');
    if (kind === 'LOHNARTENSUMMEN' && !month || ['LOHNPOSITIONEN', 'FAKTURPOSITIONEN'].includes(kind) && !day) fail('Referenz benötigt Leistungsdatum bzw. Monat.');
    const amount = decimal(r.BETRAG), quantity = decimal(r.MENGE), rate = decimal(r.SATZ);
    if (amount == null) fail('Referenzbetrag darf nicht leer sein.');
    if (kind !== 'RECHNUNGEN' && (quantity == null || !str(r.EINHEIT) || !/^\d+$/.test(str(r.LOHNART) || '') || !/^\d+$/.test(str(r.PERSONALNR) || ''))) fail('Referenzposition benötigt Personalnummer, Lohnart, Menge und Einheit.');
    const order = empty(r.AUFTRAGNR) ? null : Number(r.AUFTRAGNR);
    if (order != null && (!Number.isSafeInteger(order) || order <= 0)) fail('Ungültiger Referenzauftrag.');
    return { kind, side: ['FAKTURPOSITIONEN', 'RECHNUNGEN'].includes(kind) ? 'F' : 'L', personalNr: str(r.PERSONALNR), auftragNr: order, date: day, month, wageType: str(r.LOHNART), unit: str(r.EINHEIT), quantity, rate, amount, percent: decimal(r.PROZENT), invoiceNumber: str(r.RECHNUNGNR), source: row.source };
  });
}
module.exports = { INPUT_ROLES, REFERENCE_ROLES, readFiles, normalizeBookings, normalizeRules, normalizeReferences, date, clock, instant, flag, hash, fail, problem, str, empty };
