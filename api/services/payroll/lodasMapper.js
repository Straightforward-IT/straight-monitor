const contract = require('../../../Documentation/Payroll/hr_exchange-1.0.28.json');
const { fail, text, exactKeys } = require('./preparationDomain');

// Small, explicit validator for the scalar wire objects used by this adapter.
// DATEV puts several constraints in vendor extensions rather than JSON Schema.
function validateWire(name, value) {
  const schema = contract.components.schemas[name], errors = [];
  for (const key of Object.keys(value)) {
    const rule = schema.properties[key], actual = value[key];
    if (!rule) { errors.push(`${name}.${key}: unknown field`); continue; }
    if ((rule.type === 'integer' && !Number.isSafeInteger(actual)) || (rule.type === 'number' && (typeof actual !== 'number' || !Number.isFinite(actual))) || (rule.type === 'string' && typeof actual !== 'string')) { errors.push(`${name}.${key}: invalid type`); continue; }
    const allowed = rule.enum || rule['x-allowed-values-enum']?.split(',').map(v => rule.type === 'integer' ? Number(v) : v);
    if (allowed && !allowed.includes(actual)) errors.push(`${name}.${key}: invalid code`);
    const low = rule.minimum ?? rule['x-allowed-values-lower-bound'];
    const high = rule.maximum ?? rule['x-allowed-values-upper-bound'];
    const comparable = rule.type === 'string' ? actual : Number(actual);
    if ((low !== undefined && comparable < (rule.type === 'string' ? low : Number(low))) || (high !== undefined && comparable > (rule.type === 'string' ? high : Number(high)))) errors.push(`${name}.${key}: out of range`);
    const max = rule.maxLength ?? rule['x-allowed-values-max-length'];
    if (max !== undefined && actual.length > Number(max)) errors.push(`${name}.${key}: too long`);
    const regex = rule.pattern || rule['x-allowed-values-regex'];
    if (regex && !new RegExp(regex).test(actual)) errors.push(`${name}.${key}: invalid format`);
    if (rule.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(actual) || !Number.isFinite(Date.parse(actual)) || new Date(actual).toISOString().slice(0, 10) !== actual)) errors.push(`${name}.${key}: invalid date`);
    if (key === 'month_of_emergence' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(actual)) errors.push(`${name}.${key}: invalid month`);
  }
  for (const key of schema.required || []) if (value[key] === undefined) errors.push(`${name}.${key}: required`);
  return errors;
}
function normalizeConfig(value) {
  exactKeys(value, ['clientId', 'personnelNumber', 'rules']);
  const clientId = value.clientId || '';
  if (typeof clientId !== 'string' || (clientId && !/^\d{1,7}-\d{1,5}$/.test(clientId))) fail('DATEV-Mandant: Beraternummer-Mandantennummer erwartet.');
  const personnelNumber = value.personnelNumber ?? null;
  if (personnelNumber !== null && validateWire('MonthRecord', { personnel_number: personnelNumber }).length) fail('LODAS-Personalnummer muss zwischen 1 und 99999 liegen.');
  if (!Array.isArray(value.rules) || value.rules.length > 100) fail('Ungültige LODAS-Zuordnungen.');
  const keys = new Set();
  const rules = value.rules.map(rule => {
    exactKeys(rule, ['code', 'mode', 'salaryTypeId', 'processingCode', 'unit', 'sign', 'costCenterId', 'absenceReason', 'reason']);
    const code = text(rule.code, 'Quellcode', 40);
    if (keys.has(code)) fail('Quellcode mehrfach zugeordnet.'); keys.add(code);
    if (!['QUANTITY', 'ABSENCE', 'BOTH', 'EXCLUDE'].includes(rule.mode)) fail('Ungültige Zuordnungsart.');
    const result = { code, mode: rule.mode };
    if (rule.mode === 'EXCLUDE') return { ...result, reason: text(rule.reason, 'Ausschlussbegründung') };
    if (['QUANTITY', 'BOTH'].includes(rule.mode)) {
      if (!['HOURS', 'MINUTES'].includes(rule.unit) || ![1, -1].includes(rule.sign)) fail('Mengeneinheit und Vorzeichen fehlen.');
      const wire = { salary_type_id: rule.salaryTypeId, processing_code: rule.processingCode, ...(rule.costCenterId ? { cost_center_id: rule.costCenterId } : {}) };
      const errors = validateWire('MonthRecord', wire);
      if (errors.length) fail(errors.join('; '));
      Object.assign(result, { salaryTypeId: rule.salaryTypeId, processingCode: rule.processingCode, unit: rule.unit, sign: rule.sign, costCenterId: rule.costCenterId || '' });
    }
    if (['ABSENCE', 'BOTH'].includes(rule.mode)) {
      if (validateWire('AbsenceLodas', { reason_for_absence: rule.absenceReason }).length) fail('Ungültiger LODAS-Fehlzeitgrund.');
      result.absenceReason = rule.absenceReason;
    }
    return result;
  });
  return { clientId, personnelNumber, rules };
}
function preview(snapshot, mapping) {
  const data = snapshot.payload || snapshot;
  const config = mapping?.config || { clientId: '', personnelNumber: null, rules: [] };
  const issues = [], exclusions = [], groups = new Map(), absences = [], seenAbsences = new Set();
  const issue = (code, sourceId, message) => issues.push({ code, sourceId, message });
  if (!config.clientId) issue('CLIENT_MAPPING_MISSING', null, 'DATEV-Mandant fehlt.');
  if (!config.personnelNumber) issue('EMPLOYEE_MAPPING_MISSING', null, 'LODAS-Personalnummer fehlt.');
  const facts = [
    ...data.sources.map(s => ({ id: `time:${s.id}`, code: 'P', minutes: s.values.netMinutes, kind: 'WORK' })),
    ...data.items.map(i => ({ ...i, minutes: i.kind === 'ABSENCE' ? i.daily.reduce((n, d) => n + d.minutes, 0) : i.minutes })),
  ];
  const factIds = new Set();
  for (const fact of facts) {
    if (factIds.has(fact.id)) { issue('DUPLICATE_SOURCE', fact.id, 'Quelle ist mehrfach enthalten.'); continue; } factIds.add(fact.id);
    const rule = config.rules.find(r => r.code === fact.code);
    if (!rule) { issue('RULE_MISSING', fact.id, `Zuordnung für ${fact.code} fehlt.`); continue; }
    if (rule.mode === 'EXCLUDE') { exclusions.push({ sourceId: fact.id, reason: rule.reason }); continue; }
    if (['ABSENCE', 'BOTH'].includes(rule.mode)) {
      if (fact.kind !== 'ABSENCE') issue('INVALID_ABSENCE_MAPPING', fact.id, 'Diese Quelle ist keine Fehlzeit.');
      else {
        const key = `${fact.startDate}:${rule.absenceReason}`;
        if (seenAbsences.has(key)) issue('DUPLICATE_ABSENCE', fact.id, 'LODAS-Fehlzeitidentität ist mehrfach enthalten.');
        else {
          seenAbsences.add(key);
          const body = { personnel_number: config.personnelNumber, absence_start_date: fact.startDate, absence_end_date: fact.endDate, reason_for_absence: rule.absenceReason };
          validateWire('AbsenceLodas', body).forEach(e => issue('CONTRACT_INVALID', fact.id, e));
          absences.push({ body, sourceIds: [fact.id], externalIdentity: key, continuation: fact.startDate.slice(0, 7) !== data.month });
        }
      }
    }
    if (['QUANTITY', 'BOTH'].includes(rule.mode)) {
      const identity = { salary_type_id: rule.salaryTypeId, processing_code: rule.processingCode, ...(rule.costCenterId ? { cost_center_id: rule.costCenterId } : {}) };
      const key = JSON.stringify([identity, rule.unit, rule.sign]);
      const group = groups.get(key) || { identity, unit: rule.unit, sign: rule.sign, minutes: 0, sourceIds: [] };
      group.minutes += fact.minutes; group.sourceIds.push(fact.id); groups.set(key, group);
    }
  }
  const quantities = [...groups.values()].map(g => {
    const signedMinutes = g.minutes * g.sign;
    const value = g.unit === 'HOURS' ? Math.sign(signedMinutes) * Math.round(Math.abs(signedMinutes) * 100 / 60) / 100 : signedMinutes;
    const body = { ...g.identity, personnel_number: config.personnelNumber, month_of_emergence: data.month, value };
    validateWire('MonthRecord', body).forEach(e => issue('CONTRACT_INVALID', g.sourceIds.join(','), e));
    return { body, sourceIds: g.sourceIds, conversion: { minutes: g.minutes, unit: g.unit, sign: g.sign, value, rounding: 'aggregate-then-half-away-from-zero-2dp' } };
  });
  return {
    offline: true, contractVersion: contract.info.version, mappingVersion: mapping?.version || 0,
    mappingComplete: issues.length === 0, issues, exclusions, quantities, absences,
    timeAccountBalanceChecked: false,
    requests: issues.length ? [] : [
      ...(quantities.length ? [{ method: 'POST', path: `/clients/${config.clientId}/month-records`, query: { 'reference-date': data.month }, headers: { 'Target-System': 'lodas' }, body: quantities.map(q => q.body) }] : []),
      ...(absences.length ? [{ method: 'POST', path: `/clients/${config.clientId}/employees/${config.personnelNumber}/absences/lodas`, query: { 'reference-date': data.month }, body: absences.map(a => a.body) }] : []),
    ],
  };
}
module.exports = { preview, normalizeConfig, validateWire };
