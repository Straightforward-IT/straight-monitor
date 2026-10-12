import registry from '../../../../shared/payroll/wageCalculationTypes.json';

export const WageCalculationType = Object.freeze(Object.fromEntries(registry.types.map(type => [type.key, type.code])));
export const wageCalculationFields = registry.fields;
const definitions = new Map(registry.types.map(type => [type.code, type]));

export function getWageCalculationType(code) {
  if (typeof code !== 'string' && typeof code !== 'number') return null;
  return definitions.get(String(code).trim()) || null;
}
export function formatWageCalculationType(code) {
  const definition = getWageCalculationType(code);
  if (definition) return `${definition.code} · ${definition.label}`;
  const raw = code == null ? '' : String(code).trim();
  return raw ? `${raw} · Unbekannte Berechnungsart` : '-';
}
export function wageCalculationTypeHint(code) {
  const definition = getWageCalculationType(code);
  if (!definition) return 'Für diesen Quellcode ist noch keine Bedeutung hinterlegt.';
  const fields = definition.inputs.map(key => wageCalculationFields[key].label).join(', ');
  return `Benötigte Werte: ${fields}. ${definition.note}`;
}
