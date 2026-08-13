'use strict';

const ROUNDING_RULE = 'HALF_AWAY_FROM_ZERO_AT_FINAL_WAGE_LINE';

function asBigInt(value, name) {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} must be a safe integer`);
  }
  return BigInt(value);
}

function toSafeNumber(value, name = 'result') {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new RangeError(`${name} exceeds the JavaScript safe-integer range`);
  }
  return number;
}

/**
 * Commercial rounding without floating point. Ties are rounded away from zero.
 */
function roundRational(numerator, denominator) {
  let n = asBigInt(numerator, 'numerator');
  let d = asBigInt(denominator, 'denominator');
  if (d === 0n) throw new RangeError('denominator must not be zero');
  if (d < 0n) {
    n = -n;
    d = -d;
  }

  const sign = n < 0n ? -1n : 1n;
  const absolute = n < 0n ? -n : n;
  const quotient = absolute / d;
  const remainder = absolute % d;
  const rounded = remainder * 2n >= d ? quotient + 1n : quotient;
  return toSafeNumber(sign * rounded);
}

function floorRational(numerator, denominator) {
  const n = asBigInt(numerator, 'numerator');
  const d = asBigInt(denominator, 'denominator');
  if (n < 0n || d <= 0n) {
    throw new RangeError('floorRational expects a non-negative numerator and positive denominator');
  }
  return toSafeNumber(n / d);
}

function hourlyRateTimesHoursHundredths(hourlyRateCents, hoursHundredths) {
  return roundRational(
    asBigInt(hourlyRateCents, 'hourlyRateCents') * asBigInt(hoursHundredths, 'hoursHundredths'),
    100n,
  );
}

function hourlyRateTimesMinutes(hourlyRateCents, minutes) {
  return roundRational(
    asBigInt(hourlyRateCents, 'hourlyRateCents') * asBigInt(minutes, 'minutes'),
    60n,
  );
}

function hourlyRateTimesMinutesHundredths(hourlyRateCents, minutesHundredths) {
  return roundRational(
    asBigInt(hourlyRateCents, 'hourlyRateCents') * asBigInt(minutesHundredths, 'minutesHundredths'),
    6000n,
  );
}

function hourlyRateTimesMinutesAndBps(hourlyRateCents, minutes, basisPoints) {
  return roundRational(
    asBigInt(hourlyRateCents, 'hourlyRateCents')
      * asBigInt(minutes, 'minutes')
      * asBigInt(basisPoints, 'basisPoints'),
    600000n,
  );
}

module.exports = {
  ROUNDING_RULE,
  roundRational,
  floorRational,
  hourlyRateTimesHoursHundredths,
  hourlyRateTimesMinutes,
  hourlyRateTimesMinutesHundredths,
  hourlyRateTimesMinutesAndBps,
};
