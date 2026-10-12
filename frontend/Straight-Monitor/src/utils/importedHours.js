/** Display and sum validated decimal hour strings without minute rounding. */
export function formatImportedHours(value, fractionDigits = null) {
  if (value == null || value === '') return '—';
  if (fractionDigits != null) {
    const [whole, fraction = ''] = String(value).replace(/^[+-]/, '').split('.');
    const scale = 10n ** BigInt(fractionDigits);
    let rounded = BigInt(whole) * scale + BigInt(fraction.slice(0, fractionDigits).padEnd(fractionDigits, '0') || '0');
    if (Number(fraction[fractionDigits] || '0') >= 5) rounded++;
    const digits = String(rounded).padStart(fractionDigits + 1, '0');
    return `${String(value).startsWith('-') && rounded ? '-' : ''}${fractionDigits ? `${digits.slice(0, -fractionDigits)},${digits.slice(-fractionDigits)}` : digits}`;
  }
  return String(value).replace('.', ',');
}

export function sumImportedHours(values) {
  const decimals = values.filter(value => value != null && value !== '').map(value => String(value));
  if (!decimals.length) return '0';
  const scale = Math.max(...decimals.map(value => (value.split('.')[1] || '').length));
  const total = decimals.reduce((sum, value) => {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace(/^[+-]/, '').split('.');
    return sum + BigInt(`${whole}${fraction.padEnd(scale, '0')}`) * (negative ? -1n : 1n);
  }, 0n);
  const sign = total < 0n ? '-' : '';
  const digits = String(total < 0n ? -total : total).padStart(scale + 1, '0');
  if (!scale) return `${sign}${digits}`;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return `${sign}${digits.slice(0, -scale)}${fraction ? `.${fraction}` : ''}`;
}

export function importedEntryCode(entry) {
  return entry.kb || (entry.kind === 'productive' ? 'P' : '—');
}
