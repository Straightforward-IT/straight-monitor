import registry from '../../../../api/shared/payroll/averageStorageTypes.json';

export const AverageStorageType = Object.freeze(Object.fromEntries(registry.types.map(type => [type.key, type.code])));
const definitions = new Map(registry.types.map(type => [type.code, type]));
export function getAverageStorageType(code) {
  if (typeof code !== 'string' && typeof code !== 'number') return null;
  return definitions.get(String(code).trim()) || null;
}
export function formatAverageStorageType(code) {
  const definition = getAverageStorageType(code);
  if (definition) return `${definition.code} · ${definition.label}`;
  const raw = code == null ? '' : String(code).trim();
  return raw ? `${raw} · Unbekannte Durchschnittsart` : '-';
}
export function averageStorageTypeHint(code) {
  return getAverageStorageType(code)?.note || 'Für diesen Quellcode ist noch keine Bedeutung hinterlegt.';
}
