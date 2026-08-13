'use strict';

const { ok, unknown } = require('./result');
const { ROUNDING_RULE, floorRational, roundRational } = require('./rounding');

const OVERTIME_SOURCE = 'DGB/GVP Manteltarifvertrag § 6.1 and iGZ transition (primary tariff lines 313-338, 1100-1120)';

function calculateOvertimePremium({
  policy,
  targetHoursHundredths,
  workdays,
  partTimeNumerator = 1,
  partTimeDenominator = 1,
  workedMinutes,
  vacationMinutes = 0,
  premiumBaseHourlyCents,
} = {}) {
  if (!Number.isInteger(workedMinutes) || workedMinutes < 0
    || !Number.isInteger(vacationMinutes) || vacationMinutes < 0) {
    return unknown('OVERTIME_TIME_INPUT_REQUIRED', 'workedMinutes and vacationMinutes must be non-negative whole minutes.', {
      sourceRefs: [OVERTIME_SOURCE],
    });
  }
  if (!Number.isInteger(premiumBaseHourlyCents) || premiumBaseHourlyCents < 0) {
    return unknown('OVERTIME_PREMIUM_BASE_REQUIRED', 'premiumBaseHourlyCents must be the verified tariff hourly basis under ETV §§ 2-4.', {
      sourceRefs: [OVERTIME_SOURCE],
    });
  }
  const creditedMinutes = workedMinutes + vacationMinutes;
  let thresholdMinutesHundredths;
  const warnings = [{
    code: 'PREMIUM_BASE_MUST_IMPLEMENT_ETV_2_TO_4',
    message: 'The caller must construct premiumBaseHourlyCents from the applicable ETV §§ 2-4 components; the tariff wording does not permit using an arbitrary contractual gross rate.',
  }];

  if (policy === 'GVP_STANDARD') {
    if (!Number.isInteger(targetHoursHundredths) || targetHoursHundredths < 0) {
      return unknown('MONTHLY_TARGET_REQUIRED', 'Standard overtime needs targetHoursHundredths.', {
        sourceRefs: [OVERTIME_SOURCE],
      });
    }
    // target hours / 100 × 60 × 115% = target × 69 hundredths of a minute.
    thresholdMinutesHundredths = targetHoursHundredths * 69;
  } else if (policy === 'LEGACY_IGZ_VARIABLE') {
    const fullTimeThresholdHours = { 20: 160, 21: 168, 22: 176, 23: 184 }[workdays];
    if (!fullTimeThresholdHours) {
      return unknown('LEGACY_WORKDAY_COUNT_REQUIRED', 'Legacy overtime requires 20, 21, 22, or 23 workdays.', {
        sourceRefs: [OVERTIME_SOURCE],
      });
    }
    if (!Number.isInteger(partTimeNumerator) || !Number.isInteger(partTimeDenominator)
      || partTimeNumerator <= 0 || partTimeDenominator <= 0
      || partTimeNumerator > partTimeDenominator) {
      return unknown('PART_TIME_RATIO_REQUIRED', 'Legacy overtime needs a valid part-time ratio.', {
        sourceRefs: [OVERTIME_SOURCE],
      });
    }
    thresholdMinutesHundredths = roundRational(
      BigInt(fullTimeThresholdHours * 60 * 100) * BigInt(partTimeNumerator),
      BigInt(partTimeDenominator),
    );
    warnings.push({
      code: 'LEGACY_IGZ_ELIGIBILITY_REQUIRES_EVIDENCE',
      message: 'Use this threshold only for a qualifying iGZ-bound employer retaining the variable model through 31.12.2029.',
    });
  } else {
    return unknown('OVERTIME_POLICY_REQUIRED', 'policy must be GVP_STANDARD or LEGACY_IGZ_VARIABLE.', {
      sourceRefs: [OVERTIME_SOURCE],
    });
  }

  const creditedMinutesHundredths = creditedMinutes * 100;
  const excessMinutesHundredths = Math.max(0, creditedMinutesHundredths - thresholdMinutesHundredths);
  // Vacation is relevant to reaching the threshold, but the premium itself can
  // only attach to full hours that were actually worked. Capping here prevents
  // an absence-heavy month from creating overtime premium without worked time.
  const creditedExcessFullHours = floorRational(excessMinutesHundredths, 6000);
  const workedFullHours = Math.floor(workedMinutes / 60);
  const premiumFullHours = Math.min(creditedExcessFullHours, workedFullHours);
  const premiumMinutes = premiumFullHours * 60;
  const amountCents = roundRational(
    BigInt(premiumBaseHourlyCents) * BigInt(premiumFullHours) * 2500n,
    10000n,
  );

  if (premiumFullHours < creditedExcessFullHours) {
    warnings.push({
      code: 'OVERTIME_CAPPED_TO_ACTUALLY_WORKED_FULL_HOURS',
      message: 'Vacation helped reach the threshold, but premium-bearing hours were capped to full hours actually worked.',
    });
  }

  return ok({
    policy,
    workedMinutes,
    vacationMinutes,
    creditedMinutes,
    thresholdMinutesHundredths,
    excessMinutesHundredths,
    creditedExcessFullHours,
    workedFullHours,
    premiumFullHours,
    premiumMinutes,
    premiumBps: 2500,
    premiumBaseHourlyCents,
    amountCents,
    expectedAmountCents: amountCents,
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      'Vacation minutes are included only for reaching the monthly overtime threshold, as expressly required by MTV § 6.1.',
      `Only ${premiumFullHours} full hour(s) beyond the threshold are premium-bearing at 25%.`,
    ],
    sourceRefs: [OVERTIME_SOURCE],
    warnings,
  });
}

function normalizeWorkedIntervals(workedIntervals) {
  if (!Array.isArray(workedIntervals)) {
    return { error: 'workedIntervals must be an array' };
  }

  const intervals = workedIntervals.map((interval, index) => {
    const startMs = Date.parse(interval?.start);
    const endMs = Date.parse(interval?.end);
    return {
      startMs,
      endMs,
      sourceRefs: [...new Set((interval?.sourceRefs || []).filter(Boolean).map(String))],
      inputIndex: index,
    };
  });

  if (intervals.some((interval) => (
    !Number.isFinite(interval.startMs)
    || !Number.isFinite(interval.endMs)
    || interval.endMs <= interval.startMs
    || interval.startMs % 60000 !== 0
    || interval.endMs % 60000 !== 0
  ))) {
    return { error: 'worked intervals require whole-minute ISO start/end timestamps with end after start' };
  }

  intervals.sort((left, right) => (
    left.startMs - right.startMs
    || left.endMs - right.endMs
    || left.inputIndex - right.inputIndex
  ));
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].startMs < intervals[index - 1].endMs) {
      return { error: 'worked intervals must not overlap' };
    }
  }
  return { intervals };
}

/**
 * Deterministically attaches the monthly overtime entitlement to the final
 * actually-worked minutes. The returned intervals can be supplied to
 * segmentPremiumTime as extraPremiums, putting overtime into the same
 * highest-only decision as night, Sunday and holiday premiums.
 */
function allocateOvertimePremiumIntervals({ workedIntervals, premiumMinutes, premiumBps = 2500 } = {}) {
  if (!Number.isInteger(premiumMinutes) || premiumMinutes < 0) {
    return unknown('OVERTIME_PREMIUM_MINUTES_REQUIRED', 'premiumMinutes must be a non-negative whole-minute integer.', {
      sourceRefs: [OVERTIME_SOURCE],
    });
  }
  if (!Number.isInteger(premiumBps) || premiumBps < 0) {
    return unknown('OVERTIME_PREMIUM_RATE_REQUIRED', 'premiumBps must be a non-negative integer.', {
      sourceRefs: [OVERTIME_SOURCE],
    });
  }
  const normalized = normalizeWorkedIntervals(workedIntervals);
  if (normalized.error) {
    return unknown('OVERTIME_WORK_INTERVALS_INVALID', normalized.error, {
      sourceRefs: [OVERTIME_SOURCE],
    });
  }

  const availableMinutes = normalized.intervals.reduce(
    (sum, interval) => sum + ((interval.endMs - interval.startMs) / 60000),
    0,
  );
  if (premiumMinutes > availableMinutes) {
    return unknown('OVERTIME_WORK_INTERVALS_INCOMPLETE', 'The premium-bearing minutes exceed the supplied actually-worked intervals.', {
      partial: { premiumMinutes, availableMinutes },
      sourceRefs: [OVERTIME_SOURCE],
    });
  }

  let remaining = premiumMinutes;
  const allocated = [];
  for (let index = normalized.intervals.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const interval = normalized.intervals[index];
    const intervalMinutes = (interval.endMs - interval.startMs) / 60000;
    const selectedMinutes = Math.min(intervalMinutes, remaining);
    allocated.push({
      code: 'OVERTIME',
      bps: premiumBps,
      start: new Date(interval.endMs - selectedMinutes * 60000).toISOString(),
      end: new Date(interval.endMs).toISOString(),
      sourceRefs: [...new Set([...interval.sourceRefs, OVERTIME_SOURCE])],
    });
    remaining -= selectedMinutes;
  }
  allocated.reverse();

  return ok({
    strategy: 'LAST_ACTUALLY_WORKED_MINUTES',
    premiumMinutes,
    premiumBps,
    availableMinutes,
    intervals: allocated,
  }, {
    explanations: [
      `Allocated ${premiumMinutes} premium-bearing minute(s) to the final actually-worked intervals in chronological order.`,
      'These intervals must still pass through highest-only premium overlap selection; allocation does not itself guarantee an overtime wage line.',
    ],
    sourceRefs: [OVERTIME_SOURCE],
  });
}

module.exports = {
  allocateOvertimePremiumIntervals,
  calculateOvertimePremium,
};
