const XLSX = require('xlsx');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');

const REQUIRED_HEADERS = ['ID', 'LGJAHR', 'LGMONAT', 'PERSONALNR', 'PERSGR', 'STKLASSE', 'STFAKTOR', 'WOARBZEIT'];
const PERSON_GROUPS = [101, 110, 109, 106];
const TAX_CLASSES = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
function fail(message) { const error = new Error(message); error.status = 400; throw error; }
function text(value) { return value == null ? '' : String(value).trim(); }
function number(value, field, row, { nullable = false, integer = false, min = 0, max = Infinity } = {}) {
  if (!text(value) && nullable) return null;
  const result = text(value) ? Number(text(value).replace(',', '.')) : NaN;
  if (!Number.isFinite(result) || (integer && !Number.isInteger(result)) || result < min || result > max) {
    fail(`Zeile ${row}: ${field} enthält keinen gültigen Wert.`);
  }
  return result;
}
function parseRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) fail('Die Datei enthält kein Tabellenblatt.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headers = (rows[0] || []).map(value => text(value).toUpperCase());
  for (const field of REQUIRED_HEADERS) {
    if (headers.filter(header => header === field).length !== 1) fail(`Die Spalte ${field} muss genau einmal vorhanden sein.`);
  }
  const parsed = [];
  let skippedBefore2026 = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.every(value => !text(value))) continue;
    const value = field => row[headers.indexOf(field)];
    const rowNumber = index + 1;
    const year = number(value('LGJAHR'), 'LGJAHR', rowNumber, { integer: true, min: 1000, max: 9999 });
    if (year < 2026) { skippedBefore2026 += 1; continue; }
    const month = number(value('LGMONAT'), 'LGMONAT', rowNumber, { integer: true, min: 1, max: 12 });
    const personalnr = text(value('PERSONALNR'));
    const sourceId = text(value('ID'));
    if (!personalnr || !sourceId) fail(`Zeile ${rowNumber}: ID und PERSONALNR dürfen nicht leer sein.`);
    if ([value('ID'), value('PERSONALNR')].some(item => typeof item === 'number' && !Number.isSafeInteger(item))) {
      fail(`Zeile ${rowNumber}: ID und PERSONALNR müssen verlustfrei als Text oder ganze Zahl vorliegen.`);
    }
    const persgruppe = number(value('PERSGR'), 'PERSGR', rowNumber, { nullable: true, integer: true });
    if (persgruppe != null && !PERSON_GROUPS.includes(persgruppe)) fail(`Zeile ${rowNumber}: Unbekannte Personengruppe ${persgruppe}.`);
    const rawClass = text(value('STKLASSE')).toUpperCase();
    const klasse = TAX_CLASSES[rawClass] ?? number(value('STKLASSE'), 'STKLASSE', rowNumber, { nullable: true, integer: true, max: 6 });
    parsed.push({
      row: rowNumber, personalnr,
      snapshot: {
        month: `${year}-${String(month).padStart(2, '0')}`,
        sourceId, persgruppe,
        arbeitszeit: { woche: number(value('WOARBZEIT'), 'WOARBZEIT', rowNumber, { nullable: true }) },
        steuer: { klasse: klasse === 0 ? null : klasse, faktor: number(value('STFAKTOR'), 'STFAKTOR', rowNumber, { nullable: true, max: 1 }) },
      },
    });
  }
  return { parsed, skippedBefore2026 };
}

async function importFile(buffer) {
  const { parsed, skippedBefore2026 } = parseRows(buffer);
  const numbers = [...new Set(parsed.map(row => row.personalnr))];
  const employees = numbers.length ? await Mitarbeiter.find({
    $or: [{ personalnr: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } }],
  }).select('personalnr personalnrHistory arbeitszeit lohnStammdaten persgruppe persgruppe_set_explicitly').lean() : [];
  const byNumber = new Map();
  for (const employee of employees) {
    for (const personalnr of new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry.value)])) {
      const key = text(personalnr);
      if (!byNumber.has(key)) byNumber.set(key, []);
      byNumber.get(key).push(employee);
    }
  }
  const pending = new Map();
  const uniqueRows = new Map();
  const stats = { total: parsed.length + skippedBefore2026, matched: 0, updated: 0, unchanged: 0, skippedBefore2026, duplicates: 0, unmatched: 0, notFoundEntries: [] };
  for (const row of parsed) {
    const candidates = byNumber.get(row.personalnr) || [];
    if (candidates.length > 1) fail(`Zeile ${row.row}: Personalnummer ${row.personalnr} ist mehreren Mitarbeitern zugeordnet.`);
    if (!candidates.length) {
      stats.unmatched += 1;
      stats.notFoundEntries.push({ personalnr: row.personalnr, month: row.snapshot.month });
      continue;
    }
    const employee = candidates[0];
    const id = String(employee._id);
    const key = `${id}:${row.snapshot.month}`;
    const hash = JSON.stringify(row.snapshot);
    if (uniqueRows.has(key)) {
      if (uniqueRows.get(key) !== hash) fail(`Zeile ${row.row}: Widersprüchliche Lohndaten für Personalnummer ${row.personalnr}, Monat ${row.snapshot.month}.`);
      stats.duplicates += 1;
      continue;
    }
    uniqueRows.set(key, hash);
    stats.matched += 1;
    const entries = pending.get(id)?.entries || Mitarbeiter.collectLohnStammdaten(employee);
    const current = entries.find(entry => entry.month === row.snapshot.month) || {};
    const snapshot = {
      ...current, ...row.snapshot,
      arbeitszeit: { ...current.arbeitszeit, ...row.snapshot.arbeitszeit },
      steuer: { ...current.steuer, ...row.snapshot.steuer },
    };
    if (current.persgruppe_set_explicitly) snapshot.persgruppe = current.persgruppe;
    pending.set(id, { employee, entries: Mitarbeiter.mergeLohnStammdatenSnapshot(entries, snapshot) });
  }
  // All rows and identity conflicts are checked before the first write.
  for (const { employee, entries } of pending.values()) {
    if (JSON.stringify(entries) === JSON.stringify(employee.lohnStammdaten || []) && employee.persgruppe === undefined && employee.persgruppe_set_explicitly === undefined && employee.arbeitszeit === undefined) {
      stats.unchanged += 1;
      continue;
    }
    const validated = new Mitarbeiter({ lohnStammdaten: entries });
    const validationError = validated.validateSync('lohnStammdaten');
    if (validationError) fail(validationError.message);
    // Raw comparison prevents Mongoose adding defaults/IDs to the old array
    // used for optimistic locking. The new array has been schema-validated.
    const result = await Mitarbeiter.collection.updateOne(
      { _id: employee._id, lohnStammdaten: employee.lohnStammdaten ?? { $exists: false } },
      { $set: { lohnStammdaten: validated.lohnStammdaten.toObject(), updatedAt: new Date() }, $unset: { arbeitszeit: '', persgruppe: '', persgruppe_set_explicitly: '' } },
    );
    if (!result.matchedCount) {
      const error = new Error('Lohnstammdaten wurden parallel geändert. Bitte die Datei erneut importieren.');
      error.status = 409;
      throw error;
    }
    if (result.modifiedCount) stats.updated += 1; else stats.unchanged += 1;
  }
  return stats;
}

module.exports = { importFile, parseRows };
