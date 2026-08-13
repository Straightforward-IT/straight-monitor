'use strict';

const { ok, unknown } = require('./result');
const { ROUNDING_RULE, roundRational } = require('./rounding');

const ABSENCE_SOURCE = 'DGB/GVP Manteltarifvertrag § 10 and binding protocol example (primary tariff lines 466-528)';

function calculateGvpAbsenceAverage({
  months,
  lastThreeSettledMonthsConfirmed,
  absenceDays = 1,
  absenceDaysHundredths = null,
} = {}) {
  if (!Array.isArray(months) || months.length !== 3 || lastThreeSettledMonthsConfirmed !== true) {
    return unknown('THREE_SETTLED_MONTHS_REQUIRED', 'Exactly the last three settled payroll months must be supplied and explicitly confirmed.', {
      sourceRefs: [ABSENCE_SOURCE],
    });
  }
  const normalizedAbsenceDaysHundredths = absenceDaysHundredths == null
    ? (Number.isInteger(absenceDays) ? absenceDays * 100 : null)
    : absenceDaysHundredths;
  if (!Number.isInteger(normalizedAbsenceDaysHundredths) || normalizedAbsenceDaysHundredths < 0) {
    return unknown('ABSENCE_DAYS_REQUIRED', 'absenceDaysHundredths must be a non-negative integer (or absenceDays must be a whole non-negative day count).', {
      sourceRefs: [ABSENCE_SOURCE],
    });
  }

  const seenPeriods = new Set();
  for (const month of months) {
    const amountsValid = month
      && /^\d{4}-\d{2}$/.test(month.period)
      && month.settled === true
      && month.mehrarbeitPremiumExcluded === true
      && Number.isInteger(month.eligibleBaseEarningsCents)
      && month.eligibleBaseEarningsCents >= 0
      && Number.isInteger(month.eligibleSupplementEarningsCents)
      && month.eligibleSupplementEarningsCents >= 0
      && Number.isInteger(month.eligibleActualMinutes)
      && month.eligibleActualMinutes >= 0
      && Number.isInteger(month.eligibleReferenceDays)
      && month.eligibleReferenceDays >= 0;
    if (!amountsValid) {
      return unknown('ABSENCE_REFERENCE_MONTH_INVALID', 'Each month needs period, settled=true, eligible integer earnings/minutes/days, and mehrarbeitPremiumExcluded=true.', {
        sourceRefs: [ABSENCE_SOURCE],
      });
    }
    if (seenPeriods.has(month.period)) {
      return unknown('ABSENCE_REFERENCE_MONTH_DUPLICATE', 'Reference periods must be unique.', {
        sourceRefs: [ABSENCE_SOURCE],
      });
    }
    seenPeriods.add(month.period);
  }

  const eligibleBaseEarningsCents = months.reduce(
    (sum, month) => sum + month.eligibleBaseEarningsCents,
    0,
  );
  const eligibleSupplementEarningsCents = months.reduce(
    (sum, month) => sum + month.eligibleSupplementEarningsCents,
    0,
  );
  const totalEligibleEarningsCents = eligibleBaseEarningsCents + eligibleSupplementEarningsCents;
  const eligibleActualMinutes = months.reduce(
    (sum, month) => sum + month.eligibleActualMinutes,
    0,
  );
  const eligibleReferenceDays = months.reduce(
    (sum, month) => sum + month.eligibleReferenceDays,
    0,
  );
  if (eligibleReferenceDays <= 0) {
    return unknown('ABSENCE_REFERENCE_DAYS_MISSING', 'The adjusted reference denominator must contain at least one eligible day.', {
      sourceRefs: [ABSENCE_SOURCE],
    });
  }

  const dailyAmountCents = roundRational(totalEligibleEarningsCents, eligibleReferenceDays);
  // The binding example rounds the average daily hours to two decimals (7.54h).
  const creditedHoursHundredthsPerDay = roundRational(
    BigInt(eligibleActualMinutes) * 100n,
    BigInt(eligibleReferenceDays) * 60n,
  );
  const creditedMinutesHundredthsPerDay = creditedHoursHundredthsPerDay * 60;
  const amountCents = roundRational(
    BigInt(dailyAmountCents) * BigInt(normalizedAbsenceDaysHundredths),
    100n,
  );

  return ok({
    referencePeriods: months.map((month) => month.period),
    eligibleBaseEarningsCents,
    eligibleSupplementEarningsCents,
    totalEligibleEarningsCents,
    eligibleActualMinutes,
    eligibleReferenceDays,
    dailyAmountCents,
    creditedHoursHundredthsPerDay,
    creditedMinutesHundredthsPerDay,
    absenceDays: normalizedAbsenceDaysHundredths / 100,
    absenceDaysHundredths: normalizedAbsenceDaysHundredths,
    amountCents,
    expectedAmountCents: amountCents,
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      'Eligible regular earnings plus eligible supplements are divided by eligible reference days; Mehrarbeitszuschläge are expressly excluded.',
      'The caller must remove reductions caused by Kurzarbeit, exhausted sick-pay entitlement, excused absence, and suspended employment from both numerator and denominator.',
      'Daily hours are rounded to hundredths of an hour, matching the binding § 10 example; the rounded daily cents are multiplied by reviewed day hundredths and rounded once.',
    ],
    sourceRefs: [ABSENCE_SOURCE],
    warnings: [{
      code: 'REFERENCE_NORMALIZATION_ASSERTED_BY_CALLER',
      message: 'This pure function cannot prove that earnings and days excluded for tariff reasons were normalized correctly upstream.',
    }],
  });
}

module.exports = { calculateGvpAbsenceAverage };
