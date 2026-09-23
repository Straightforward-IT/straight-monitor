const { sha256 } = require('../../utils/contentHash');
const fail = (message, code = 'PAYROLL_INVALID', statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
function text(value, name, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${name} fehlt oder ist ungültig.`);
  return value.trim();
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) fail('Ungültiges Datum.');
  return value;
}
function range(month) {
  if (typeof month !== 'string' || !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) fail('Ungültiger Abrechnungsmonat.');
  const next = new Date(`${month}-01T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  return { from: `${month}-01`, till: next.toISOString().slice(0, 10) };
}
function integer(value, signed = false) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 525600 || (!signed && value < 0)) fail('Minuten müssen ganze Zahlen im gültigen Bereich sein.');
  return value;
}
function exactKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Unbekanntes Feld in der Vorbereitung.');
}
function normalizeItems(input, month, types, sources, previous = []) {
  range(month);
  if (!Array.isArray(input) || input.length > 500) fail('Höchstens 500 Vorbereitungseinträge sind möglich.');
  const ids = new Set(), sourceIds = new Set(sources.map(s => s.id));
  const result = input.map(item => {
    exactKeys(item, ['id', 'kind', 'code', 'label', 'sourceLohnart', 'reason', 'startDate', 'endDate', 'daily', 'date', 'minutes', 'source', 'target']);
    const id = text(item.id, 'Eintrags-ID', 80);
    if (!/^[\w-]+$/.test(id) || ids.has(id)) fail('Eintrags-ID ist ungültig oder doppelt.');
    ids.add(id);
    const base = { id, kind: item.kind, reason: text(item.reason, 'Begründung') };
    if (item.kind === 'ABSENCE') {
      const old = previous.find(p => p.id === id && p.kind === 'ABSENCE' && p.code === item.code);
      const type = old || types.find(t => t.code === item.code && ['sick', 'vacation', 'absence'].includes(t.kind));
      if (!type) fail('Unbekannte Fehlzeitart.');
      const startDate = date(item.startDate), endDate = date(item.endDate);
      if (!startDate.startsWith(month) || endDate < startDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 366) fail('Die Fehlzeit muss in diesem Monat beginnen und höchstens 367 Tage umfassen.');
      if (!Array.isArray(item.daily) || item.daily.length > 367) fail('Tägliche Mengen fehlen.');
      const days = new Set();
      const daily = item.daily.map(day => {
        exactKeys(day, ['date', 'minutes']); date(day.date);
        if (day.date < startDate || day.date > endDate || days.has(day.date)) fail('Tagesmenge außerhalb der Fehlzeit oder doppelt.');
        days.add(day.date); integer(day.minutes);
        if (day.minutes > 1440) fail('Höchstens 1440 Minuten pro Fehlzeittag.');
        return { date: day.date, minutes: day.minutes };
      }).sort((a, b) => a.date.localeCompare(b.date));
      return { ...base, code: type.code, label: type.label, sourceLohnart: old?.sourceLohnart || type.lohnartNummer || '', credited: type.credited, startDate, endDate, daily };
    }
    if (!['ADJUSTMENT', 'TRANSFER'].includes(item.kind)) fail('Unbekannte Eintragsart.');
    const day = date(item.date);
    if (!day.startsWith(month)) fail('Eintrag gehört nicht zu diesem Monat.');
    const minutes = integer(item.minutes, item.kind === 'ADJUSTMENT');
    if (!minutes) fail('Die Menge darf nicht null sein.');
    if (item.kind === 'ADJUSTMENT') {
      const source = item.source || '';
      if (source && !sourceIds.has(source)) fail('Die referenzierte freigegebene Zeit fehlt.');
      return { ...base, date: day, minutes, source, code: 'M', label: 'Stundenkorrektur' };
    }
    // AZK is a proposed movement endpoint, never a local balance.
    const allowed = new Set([...sourceIds, 'AZK', 'PAYMENT']);
    if (!allowed.has(item.source) || !allowed.has(item.target) || item.source === item.target || item.source === 'PAYMENT') fail('Ungültige Umbuchungsquelle oder Ziel.');
    if (sourceIds.has(item.target)) fail('Ist-Zeiten sind keine Umbuchungsziele. Bitte Auszahlung oder AZK wählen.');
    if (item.source !== 'AZK' && item.target !== 'AZK') fail('Umbuchungen benötigen ein AZK-Ziel oder eine AZK-Quelle.');
    return { ...base, date: day, minutes, source: item.source, target: item.target, code: item.target === 'AZK' ? 'AZK_DEPOSIT' : 'AZK_WITHDRAWAL', label: item.target === 'AZK' ? 'AZK-Zugang vorgeschlagen' : 'AZK-Abgang vorgeschlagen' };
  });
  for (const source of sources) {
    const deposited = result.filter(i => i.kind === 'TRANSFER' && i.source === source.id).reduce((n, i) => n + i.minutes, 0);
    if (deposited > source.values.netMinutes) fail('Vorgeschlagene AZK-Zugänge überschreiten die referenzierten Ist-Minuten.');
  }
  return result;
}
function projectItems(items, month) {
  const { from, till } = range(month);
  return items.filter(i => i.kind !== 'ABSENCE' || (i.startDate < till && i.endDate >= from)).map(i => i.kind === 'ABSENCE' ? { ...i, daily: i.daily.filter(d => d.date >= from && d.date < till) } : i);
}
function totals(sources, items) {
  return {
    workedMinutes: sources.reduce((n, s) => n + s.values.netMinutes, 0),
    absenceMinutes: items.filter(i => i.kind === 'ABSENCE' && i.credited).reduce((n, i) => n + i.daily.reduce((sum, d) => sum + d.minutes, 0), 0),
    adjustmentMinutes: items.filter(i => i.kind === 'ADJUSTMENT').reduce((n, i) => n + i.minutes, 0),
    proposedDepositMinutes: items.filter(i => i.code === 'AZK_DEPOSIT').reduce((n, i) => n + i.minutes, 0),
    proposedWithdrawalMinutes: items.filter(i => i.code === 'AZK_WITHDRAWAL').reduce((n, i) => n + i.minutes, 0),
  };
}
module.exports = { fail, text, date, range, integer, exactKeys, normalizeItems, projectItems, totals, sha256 };
