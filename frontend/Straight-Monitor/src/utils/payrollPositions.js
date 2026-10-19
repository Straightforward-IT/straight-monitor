import { formatImportedHours, sumImportedHours } from '@/utils/importedHours';

const gcd = (a, b) => b ? gcd(b, a % b) : a;
function fraction(row) {
  if (row.quantityNumerator != null && row.quantityDenominator != null) return [BigInt(row.quantityNumerator), BigInt(row.quantityDenominator)];
  if (row.hours == null) return null;
  const [whole, decimals = ''] = String(row.hours).split('.');
  return [BigInt(whole + decimals), 10n ** BigInt(decimals.length)];
}
function add(a, b) {
  const common = gcd(a[1], b[1]), denominator = a[1] / common * b[1];
  return [a[0] * (denominator / a[1]) + b[0] * (denominator / b[1]), denominator];
}
function formatFraction([numerator, denominator], digits = 2) {
  const negative = numerator < 0n, scaled = (negative ? -numerator : numerator) * 10n ** BigInt(digits);
  const rounded = scaled / denominator + (scaled % denominator * 2n >= denominator ? 1n : 0n);
  const text = String(rounded).padStart(digits + 1, '0');
  return `${negative && rounded ? '-' : ''}${text.slice(0, -digits)},${text.slice(-digits)}`;
}
export function formatPositionHours(row) { const value = fraction(row); return value ? formatFraction(value) : '—'; }
export const formatPositionValue = value => formatImportedHours(value, 2);
export function aggregatePositions(rows, byOrder = false) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.side, row.wageType, row.kb || '', row.kind, row.rate, row.percent, ...(byOrder ? [row.auftragNr, row.einsortNr] : [])]);
    if (!groups.has(key)) groups.set(key, { ...row, id: key, date: '', serviceDate: '', auftragNr: byOrder ? row.auftragNr : null, einsortNr: byOrder ? row.einsortNr : null, site: byOrder ? row.site : null, project: null, activity: null, _quantity: [0n, 1n], _hasQuantity: false, _amounts: [], _dates: new Set(), issues: [], status: 'CALCULATED' });
    const group = groups.get(key), amount = fraction(row);
    if (amount) { group._quantity = add(group._quantity, amount); group._hasQuantity = true; }
    group._amounts.push(row.amount); group._dates.add(row.date);
    group.issues.push(...row.issues);
    if (row.status !== 'CALCULATED') group.status = 'PARTIAL';
    if (group.countForTotalHours !== row.countForTotalHours) group.countForTotalHours = null;
  }
  return [...groups.values()].map(({ _quantity, _hasQuantity, _amounts, _dates, ...row }) => ({ ...row, days: _dates.size,
    quantityNumerator: _hasQuantity ? String(_quantity[0]) : null, quantityDenominator: _hasQuantity ? String(_quantity[1]) : null, hours: null,
    amount: _amounts.some(value => value == null) ? null : sumImportedHours(_amounts),
    issues: [...new Map(row.issues.map(issue => [JSON.stringify(issue), issue])).values()] }));
}
export function selectPositions(data, tab, selectedDate) {
  const rows = (data?.rows || []).filter(row => !selectedDate || row.date === selectedDate);
  if (tab === 'lohn-faktur') return rows;
  if (tab === 'summe-lohn') return aggregatePositions(rows.filter(row => row.side === 'L'));
  if (tab === 'summe-faktur') return aggregatePositions(rows.filter(row => row.side === 'F'));
  if (tab === 'summe-ae-faktur-lohn') return aggregatePositions(rows, true);
  if (['summe-faktur-lohn', 'zusammenfassung'].includes(tab)) return aggregatePositions(rows);
  if (tab === 'fehlzeiten') return rows.filter(row => row.kind !== 'productive');
  return [];
}
export function summarizePositions(rows) {
  return ['L', 'F'].map(side => {
    const selected = rows.filter(row => row.side === side), counted = selected.filter(row => row.countForTotalHours === true);
    const quantity = counted.reduce((total, row) => fraction(row) ? add(total, fraction(row)) : total, [0n, 1n]);
    const quantityConflict = counted.some(row => !fraction(row) || row.issues.some(issue => ['BOOKING_OVERLAP', 'BOOKING_UNRESOLVED', 'DETAIL_COVERAGE_UNRESOLVED'].includes(issue.code)));
    return { side, rows: selected.length, hours: !quantityConflict && (counted.length || selected.every(row => row.countForTotalHours != null)) ? formatFraction(quantity) : '—', hoursComplete: !quantityConflict && selected.every(row => row.countForTotalHours != null),
      amount: selected.some(row => row.amount == null || row.status !== 'CALCULATED') ? null : sumImportedHours(selected.map(row => row.amount)),
      partialAmount: selected.some(row => row.amount != null) ? sumImportedHours(selected.map(row => row.amount)) : null,
      pending: selected.filter(row => row.status !== 'CALCULATED').length };
  }).filter(summary => summary.rows);
}
