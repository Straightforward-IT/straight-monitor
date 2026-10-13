const registry = require('../../shared/payroll/wageTypeSettings.json');
const calculationRegistry = require('../../shared/payroll/wageCalculationTypes.json');
const averageRegistry = require('../../shared/payroll/averageStorageTypes.json');
const { getWageCalculationType } = require('./wageCalculationTypes');
const { getAverageStorageType } = require('./averageStorageTypes');

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const fields = freeze(registry.fields);
const families = freeze(Object.fromEntries(Object.entries(registry.families).map(([family, definition]) => [
  family,
  {
    ...definition,
    types: definition.registry === 'wageCalculationTypes' ? calculationRegistry.types
      : definition.registry === 'averageStorageTypes' ? averageRegistry.types : definition.types,
  },
])));

function normalizedCode(code) {
  if (code == null || (typeof code === 'string' && !code.trim())) return null;
  if (typeof code !== 'string' && typeof code !== 'number') return String(code);
  return String(code).trim();
}

const definitionMaps = new Map(Object.entries(families).map(([family, definition]) => [
  family,
  new Map(definition.types.map(type => [type.code, type])),
]));

function getSettingDefinition(family, code) {
  const definition = families[family];
  const normalized = normalizedCode(code);
  if (!definition || normalized == null || (typeof code !== 'string' && typeof code !== 'number')) return null;
  const type = family === 'calculation' ? getWageCalculationType(code)
    : family === 'averageStorage' ? getAverageStorageType(code)
      : definitionMaps.get(family).get(normalized);
  if (!type) return null;
  return freeze({
    ...type,
    family,
    note: [definition.definitionNotes?.[normalized] || type.note, definition.note].filter(Boolean).join(' '),
    source: type.source || definition.source,
  });
}

function getCodeMetadaten(row = {}) {
  return Object.fromEntries(Object.entries(fields).map(([field, binding]) => {
    const code = normalizedCode(row?.[field]);
    const definition = getSettingDefinition(binding.family, row?.[field]);
    return [field, {
      code,
      key: definition?.key || null,
      label: definition?.label || (code == null ? 'Nicht geliefert' : 'Unbekannter Code'),
      note: definition?.note || (code == null ? `Für ${binding.label} wurde kein Quellwert geliefert.`
        : `Für den Quellcode ${code} in ${binding.label} ist noch keine Bedeutung belegt.`),
      status: definition ? 'known' : code == null ? 'missing' : 'unknown',
      family: binding.family,
      source: definition?.source || families[binding.family]?.source || [],
    }];
  }));
}

function getConditionUsage(code) {
  return getSettingDefinition('conditionUsage', code);
}

module.exports = { fields, families, getSettingDefinition, getCodeMetadaten, getConditionUsage };
