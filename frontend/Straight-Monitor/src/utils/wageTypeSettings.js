import registry from '../../../../api/shared/payroll/wageTypeSettings.json';
import calculationRegistry from '../../../../api/shared/payroll/wageCalculationTypes.json';
import averageRegistry from '../../../../api/shared/payroll/averageStorageTypes.json';
import { getWageCalculationType } from './wageCalculationTypes';
import { getAverageStorageType } from './averageStorageTypes';

export const fields = registry.fields;
export const families = Object.fromEntries(Object.entries(registry.families).map(([family, definition]) => [
  family,
  {
    ...definition,
    types: definition.registry === 'wageCalculationTypes' ? calculationRegistry.types
      : definition.registry === 'averageStorageTypes' ? averageRegistry.types : definition.types,
  },
]));

function normalizedCode(code) {
  if (code == null || (typeof code === 'string' && !code.trim())) return null;
  return String(code).trim();
}

const definitionMaps = new Map(Object.entries(families).map(([family, definition]) => [
  family, new Map(definition.types.map(type => [type.code, type])),
]));

export function getSettingDefinition(family, code) {
  const definition = families[family];
  const normalized = normalizedCode(code);
  if (!definition || normalized == null || (typeof code !== 'string' && typeof code !== 'number')) return null;
  const type = family === 'calculation' ? getWageCalculationType(code)
    : family === 'averageStorage' ? getAverageStorageType(code)
      : definitionMaps.get(family).get(normalized);
  if (!type) return null;
  return {
    ...type,
    family,
    note: [definition.definitionNotes?.[normalized] || type.note, definition.note].filter(Boolean).join(' '),
    source: type.source || definition.source,
  };
}

export function getCodeMetadaten(row = {}) {
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

export function getConditionUsage(code) {
  return getSettingDefinition('conditionUsage', code);
}

export function formatSetting(row, field) {
  const metadata = row?.codeMetadaten?.[field] || getCodeMetadaten(row)[field];
  if (!metadata || metadata.status === 'missing') return 'Nicht geliefert';
  return `${metadata.code} · ${metadata.label}`;
}

export function getSettingHint(row, field) {
  return (row?.codeMetadaten?.[field] || getCodeMetadaten(row)[field])?.note || 'Für dieses Feld ist noch keine Bedeutung belegt.';
}
