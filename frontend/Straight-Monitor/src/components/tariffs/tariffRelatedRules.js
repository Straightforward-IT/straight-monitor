import { formatTariffDecimal, sourceValue } from './tariffDisplay';

const absent = (value) => value === null || value === undefined || String(value).trim() === '';
const canonicalId = (value) => /^\d+$/.test(String(value ?? '').trim()) ? String(value).trim().replace(/^0+(?=\d)/, '') : null;

// Normalized values contain the exact decimal strings; original columns remain
// accessible separately. Field names in user-assigned exports may vary in case.
export function ruleField(record, field) {
  for (const values of [record?.values, record?.source?.raw, record]) {
    if (!values || typeof values !== 'object') continue;
    const key = Object.keys(values).find((name) => name.trim().toUpperCase() === field);
    if (key !== undefined && values[key] !== undefined) return values[key];
  }
  return null;
}

export function ruleDecimal(record, field) {
  const value = ruleField(record, field);
  if (absent(value)) return '—';
  let text = String(value).trim();
  if (/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  return formatTariffDecimal(text);
}

export function groupWageRules(records = []) {
  const groups = new Map();
  for (const record of records) {
    const value = ruleField(record, 'ILOHNARTNR');
    const key = absent(value) ? 'ohne Nummer' : canonicalId(value) || String(value);
    if (!groups.has(key)) groups.set(key, { key, number: key, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].sort((left, right) => left.number.localeCompare(right.number, 'de', { numeric: true }));
}

export function foreignKeyLabel(record, field, entries = []) {
  const value = ruleField(record, field);
  if (absent(value)) return 'Kein konkreter Verweis im Export';
  const text = String(value).trim();
  if (text === '-1' || canonicalId(value) === '0') return `Quellkennzeichen ${text}`;
  const id = canonicalId(value);
  const matches = id ? entries.filter((entry) => canonicalId(entry.legacyId) === id) : [];
  if (matches.length === 1) return `${matches[0].name || 'Ohne Bezeichnung'} · ID ${id}`;
  return `Verweis ${sourceValue(value)} · ${matches.length > 1 ? 'mehrfach zugeordnet' : 'nicht aufgelöst'}`;
}

// Only the documented IY/IX ranges are resolved to matrix labels. Ecklohn
// IGRUPPE/ISTUFE are independent parameters and must not use this helper.
export function matrixRangeLabel(record, fromField, untilField, entries = [], axis) {
  const fromValue = ruleField(record, fromField), untilValue = ruleField(record, untilField);
  const from = canonicalId(fromValue), until = canonicalId(untilValue);
  if (!from || !until || from === '0' || until === '0') return `Quellbereich ${sourceValue(fromValue)} – ${sourceValue(untilValue)}`;
  const label = (position) => {
    const matches = entries.filter((entry) => canonicalId(entry.position) === position);
    return matches.length === 1 ? matches[0].name || `Position ${position}` : `Position ${position}`;
  };
  return `${from === until ? label(from) : `${label(from)} – ${label(until)}`} · ${axis} ${from === until ? from : `${from}–${until}`}`;
}

export function groupVacationRules(records = []) {
  const groups = new Map();
  for (const record of records) {
    const until = ruleField(record, 'GUELTIGBISJAHR');
    const key = absent(until) ? 'open' : String(until);
    if (!groups.has(key)) groups.set(key, { key, label: key === 'open' ? 'Offener Regelstand · ohne Endjahr' : `Gültig bis einschließlich ${sourceValue(until)}`, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].sort((left, right) => left.key === 'open' ? -1 : right.key === 'open' ? 1 : right.key.localeCompare(left.key, 'de', { numeric: true }));
}

export function ruleMonth(record) {
  const value = ruleField(record, 'IAUSZAHLMONAT');
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const index = Number(value) - 1;
  return !absent(value) && Number.isInteger(index) && index >= 0 && index < 12 ? months[index] : sourceValue(value);
}
