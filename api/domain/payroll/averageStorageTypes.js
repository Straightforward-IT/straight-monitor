const registry = require('../../shared/payroll/averageStorageTypes.json');

// Contribution metadata only. averageCalculation owns period, quantities,
// calendar-day counting and the final ratios.
const definitions = new Map(registry.types.map(type => {
  Object.freeze(type.contributions);
  Object.freeze(type);
  return [type.code, type];
}));
const AverageStorageType = Object.freeze(Object.fromEntries(registry.types.map(type => [type.key, type.code])));
function getAverageStorageType(code) {
  if (typeof code !== 'string' && typeof code !== 'number') return null;
  return definitions.get(String(code).trim()) || null;
}
module.exports = { AverageStorageType, getAverageStorageType };
