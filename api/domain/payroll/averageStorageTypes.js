const registry = require('../../../shared/payroll/averageStorageTypes.json');

// Contribution metadata only. The future average tool must resolve the
// reference period, quantities and denominator before calculating a rate.
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
