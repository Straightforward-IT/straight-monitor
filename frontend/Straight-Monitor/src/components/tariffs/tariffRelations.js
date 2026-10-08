export const orderedPositions = (entries = []) => [...entries].sort((a, b) => Number(a.position) - Number(b.position));
export const periodsForVariant = (periods = [], id) => periods.filter(period => String(period.employeeGroupId) === String(id))
  .sort((a, b) => a.validFrom.localeCompare(b.validFrom) || String(a.legacyId).localeCompare(String(b.legacyId)));
export const periodsOnDate = (periods = [], date) => date ? periods.filter(period => period.validFrom <= date && (!period.validUntil || period.validUntil >= date)) : [];
export const matrixMatches = (period, stage, group) => (period?.rates || []).filter(rate => String(rate.stagePosition) === String(stage) && String(rate.groupPosition) === String(group));
export const availableVariant = (group) => !/inaktiv|nicht benutzen/i.test(group?.statusLabel || '');

export function previousPeriod(periods, current) {
  if (!current) return null;
  const earlier = periods.filter(period => period.validFrom < current.validFrom).sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  if (!earlier.length || earlier.filter(period => period.validFrom === earlier[0].validFrom).length !== 1) return null;
  return earlier[0].validUntil && earlier[0].validUntil < current.validFrom ? earlier[0] : null;
}

// Calculate with scaled integers so imported decimal precision is preserved.
function calculateDecimals(current, previous, operation) {
  if (![current, previous].every(value => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value))) return null;
  const scale = Math.max(...[current, previous].map(value => value.split('.')[1]?.length || 0));
  const integer = value => {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
    return BigInt(whole + fraction.padEnd(scale, '0')) * (negative ? -1n : 1n);
  };
  const result = operation(integer(current), integer(previous));
  const digits = (result < 0n ? -result : result).toString().padStart(scale + 1, '0');
  const value = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '') : digits;
  return `${result < 0n ? '-' : ''}${value}`;
}

export const decimalDifference = (current, previous) => calculateDecimals(current, previous, (left, right) => left - right);
export const decimalSum = (base, allowance) => calculateDecimals(base, allowance, (left, right) => left + right);
