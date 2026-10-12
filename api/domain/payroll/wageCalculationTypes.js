const registry = require('../../../shared/payroll/wageCalculationTypes.json');

// Descriptive metadata only. These source codes do not resolve rates or
// authorize calculation; unknown imported values must remain intact.
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
freeze(registry);
const WageCalculationType = Object.freeze(Object.fromEntries(registry.types.map(type => [type.key, type.code])));
const definitions = new Map(registry.types.map(type => [type.code, type]));
function getWageCalculationType(code) {
  if (typeof code !== 'string' && typeof code !== 'number') return null;
  return definitions.get(String(code).trim()) || null;
}
module.exports = { WageCalculationType, wageCalculationFields: registry.fields, getWageCalculationType };
