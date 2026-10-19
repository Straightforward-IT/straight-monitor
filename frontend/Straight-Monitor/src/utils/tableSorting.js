const collator = new Intl.Collator('de-DE', { numeric: true, sensitivity: 'base' });

function numericValue(value) {
  if (value == null || value === '') return null;
  const match = String(value).match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  return { numerator: BigInt(match[2] + (match[3] || '')) * (match[1] === '-' ? -1n : 1n), denominator: 10n ** BigInt((match[3] || '').length) };
}

/** Stable display sorting. Missing values stay last in both directions. */
export function sortTableRows(rows, column, direction = 'asc') {
  if (!column) return rows;
  const value = row => {
    const raw = column.value ? column.value(row) : row[column.key];
    return column.numeric ? numericValue(raw) : raw == null || raw === '' ? null : String(raw);
  };
  return rows.map((row, index) => ({ row, index, value: value(row) })).sort((a, b) => {
    if (a.value == null || b.value == null) return a.value == null && b.value == null ? a.index - b.index : a.value == null ? 1 : -1;
    let result;
    if (column.numeric) {
      const delta = a.value.numerator * b.value.denominator - b.value.numerator * a.value.denominator;
      result = delta < 0n ? -1 : delta > 0n ? 1 : 0;
    } else result = collator.compare(a.value, b.value);
    return (direction === 'desc' ? -result : result) || a.index - b.index;
  }).map(item => item.row);
}
