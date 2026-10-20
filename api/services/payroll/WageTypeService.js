const Lohnart = require('../../models/Payroll/Lohnart');
const { isDeepStrictEqual } = require('node:util');
const KundenKondition = require('../../models/Customer/KundenKondition');
const { getWageCalculationType } = require('../../domain/payroll/wageCalculationTypes');
const { getAverageStorageType } = require('../../domain/payroll/averageStorageTypes');
const { getCodeMetadaten, getConditionUsage } = require('../../domain/payroll/wageTypeSettings');
const { parseWageTypeWorkbook } = require('../../domain/payroll/wageTypeImport');

const text = value => value == null ? '' : String(value).trim();
const customerFields = 'kundenNr kundName kuerzel kundStatus geschSt';

function enrich(row) {
  return {
    ...row,
    berechnungsart: getWageCalculationType(row.berechnungsartCode),
    durchschnittsspeicherung: getAverageStorageType(row.durchschnittsspeicherCode),
    codeMetadaten: getCodeMetadaten(row),
  };
}

function customersFor(conditions) {
  const customers = new Map();
  for (const condition of conditions) {
    if (condition.kunde) customers.set(String(condition.kunde._id), condition.kunde);
  }
  return [...customers.values()].sort((left, right) => text(left.kundName).localeCompare(text(right.kundName), 'de'));
}

function offsetReference(row, target) {
  const targetNumber = text(row.verrechnungslohnartNummer);
  return {
    code: text(row.verrechnungCode),
    priority: text(row.verrechnungsPrioritaet),
    targetNumber,
    target: target ? { _id: target._id, lohnartNummer: target.lohnartNummer, lohnartBezeichnung: target.lohnartBezeichnung } : null,
    status: !targetNumber ? 'none' : target ? 'matched' : 'missing',
  };
}

function createWageTypeService(models = {}) {
  const WageType = models.Lohnart || Lohnart;
  const Condition = models.KundenKondition || KundenKondition;
  const parse = models.parseWorkbook || parseWageTypeWorkbook;

  async function conditionsFor(filter) {
    const rows = await Condition.find(filter)
      .populate({ path: 'kunde', select: customerFields, match: { kundStatus: 2 } })
      .sort({ tabellenNr: 1, laufendeNummer: 1 }).lean();
    return rows.filter(row => row.kunde).map(row => ({ ...row, verwendungMetadaten: getConditionUsage(row.verwendung) }));
  }

  async function list() {
    const [rows, conditions] = await Promise.all([
      WageType.find({}).select('-source -sourceHistory').sort({ lohnartNummer: 1 }).lean(),
      conditionsFor({}),
    ]);
    const byWageType = new Map();
    for (const condition of conditions) {
      const key = String(condition.lohnart);
      if (!byWageType.has(key)) byWageType.set(key, []);
      byWageType.get(key).push(condition);
    }
    return rows.map(row => ({ ...enrich(row), kunden: customersFor(byWageType.get(String(row._id)) || []) }));
  }

  async function enrichDetail(row) {
    if (!row) return null;
    const targetNumber = text(row.verrechnungslohnartNummer);
    const [conditions, target] = await Promise.all([
      conditionsFor({ lohnart: row._id }),
      targetNumber ? WageType.findOne({ lohnartNummer: targetNumber }).select('lohnartNummer lohnartBezeichnung').lean() : null,
    ]);
    const reference = offsetReference(row, target);
    const issues = [];
    if (reference.status === 'missing') issues.push({ severity: 'warning', code: 'OFFSET_TARGET_MISSING', message: `Verrechnungslohnart ${targetNumber} ist im Stamm noch nicht vorhanden.` });
    for (const [field, metadata] of Object.entries(getCodeMetadaten(row))) {
      if (metadata.status === 'unknown') issues.push({ severity: 'warning', code: 'UNKNOWN_CODE', field, message: `Für ${field} ist der Quellcode ${metadata.code} noch nicht dokumentiert.` });
    }
    return { ...enrich(row), kunden: customersFor(conditions), kundenkonditionen: conditions, verrechnungsbezug: reference, issues };
  }

  async function detail(id) {
    return enrichDetail(await WageType.findById(id).lean());
  }

  async function detailByNumber(number) {
    return enrichDetail(await WageType.findOne({ lohnartNummer: text(number) }).lean());
  }

  async function importWorkbook(buffer, options) {
    // Every row and code/text pair is checked before any database write.
    const parsed = parse(buffer, options);
    const existing = await WageType.find({}).lean();
    const byNumber = new Map(existing.map(row => [text(row.lohnartNummer), row]));
    const available = new Set([...byNumber.keys(), ...parsed.records.map(row => row.lohnartNummer)]);
    const issues = [...parsed.issues];
    const operations = [];
    let inserted = 0, updated = 0, unchanged = 0;
    for (const record of parsed.records) {
      const previous = byNumber.get(record.lohnartNummer);
      const merged = { ...previous, ...record.fields };
      const targetNumber = text(merged.verrechnungslohnartNummer);
      if (targetNumber && !available.has(targetNumber)) issues.push({ severity: 'warning', code: 'OFFSET_TARGET_MISSING', source: record.source, message: `Lohnart ${record.lohnartNummer}: Verrechnungslohnart ${targetNumber} ist im Stamm noch nicht vorhanden.` });
      const sameFields = previous && Object.entries(record.fields).every(([key, value]) => text(previous[key]) === text(value));
      const sameSource = previous && isDeepStrictEqual(previous.source || null, record.source);
      if (sameFields && sameSource) { unchanged++; continue; }
      const update = { $set: { ...record.fields, source: record.source } };
      // Preserve the origin of fields retained from a previous, wider export.
      if (previous?.source?.columns?.length && !sameSource) update.$push = { sourceHistory: previous.source };
      operations.push({ updateOne: { filter: { lohnartNummer: record.lohnartNummer }, update, upsert: true } });
      if (previous) updated++; else inserted++;
    }
    if (operations.length) await WageType.bulkWrite(operations, { ordered: true });
    return { format: parsed.format, total: parsed.records.length, inserted, updated, unchanged, issues };
  }

  return { list, detail, detailByNumber, importWorkbook };
}

module.exports = { createWageTypeService, offsetReference, ...createWageTypeService() };
