'use strict';

const { ok, unknown } = require('./result');
const {
  ROUNDING_RULE,
  roundRational,
  hourlyRateTimesMinutesHundredths,
} = require('./rounding');

const AZK_SOURCE = 'DGB/GVP Manteltarifvertrag §§ 4.1-4.7 (primary tariff lines 211-304)';

function prorate(fullTimeMinutesHundredths, numerator, denominator) {
  return roundRational(
    BigInt(fullTimeMinutesHundredths) * BigInt(numerator),
    BigInt(denominator),
  );
}

function calculateAzk({
  openingBalanceMinutesHundredths,
  targetHoursHundredths,
  actualCreditedMinutes,
  partTimeNumerator = 1,
  partTimeDenominator = 1,
  seasonalCapAuthorized = false,
  applicableCapMinutesHundredths,
  insolvencyProtectionConfirmed = false,
  payout = { kind: 'NONE' },
  payoutHourlyRateCents,
} = {}) {
  if (!Number.isInteger(openingBalanceMinutesHundredths)
    || !Number.isInteger(targetHoursHundredths) || targetHoursHundredths < 0
    || !Number.isInteger(actualCreditedMinutes) || actualCreditedMinutes < 0) {
    return unknown('AZK_BALANCE_INPUT_REQUIRED', 'Opening balance (minute hundredths), target (hour hundredths), and actual credited whole minutes are required integers.', {
      sourceRefs: [AZK_SOURCE],
    });
  }
  if (!Number.isInteger(partTimeNumerator) || !Number.isInteger(partTimeDenominator)
    || partTimeNumerator <= 0 || partTimeDenominator <= 0
    || partTimeNumerator > partTimeDenominator) {
    return unknown('PART_TIME_RATIO_REQUIRED', 'Provide a positive part-time ratio no greater than 1.', {
      sourceRefs: [AZK_SOURCE],
    });
  }
  if (!payout || !payout.kind) {
    return unknown('AZK_PAYOUT_POLICY_REQUIRED', 'payout.kind must explicitly describe the monthly disposition, including NONE.', {
      sourceRefs: [AZK_SOURCE],
    });
  }

  const targetMinutesHundredths = targetHoursHundredths * 60;
  const actualMinutesHundredths = actualCreditedMinutes * 100;
  const deltaMinutesHundredths = actualMinutesHundredths - targetMinutesHundredths;
  const prePayoutBalanceMinutesHundredths = openingBalanceMinutesHundredths + deltaMinutesHundredths;
  const fullTimeCapHours = seasonalCapAuthorized ? 230 : 200;
  const maximumBalanceMinutesHundredths = prorate(
    fullTimeCapHours * 60 * 100,
    partTimeNumerator,
    partTimeDenominator,
  );
  if (applicableCapMinutesHundredths != null
      && (!Number.isInteger(applicableCapMinutesHundredths) || applicableCapMinutesHundredths < 0)) {
    return unknown('AZK_APPLICABLE_CAP_REQUIRED', 'applicableCapMinutesHundredths must be a non-negative integer when supplied.', {
      sourceRefs: [AZK_SOURCE],
    });
  }
  if (applicableCapMinutesHundredths != null
      && applicableCapMinutesHundredths !== maximumBalanceMinutesHundredths) {
    return unknown('AZK_APPLICABLE_CAP_MISMATCH', 'The approved applicable cap does not match the tariff cap derived from part-time ratio and seasonal authorization.', {
      partial: {
        approvedApplicableCapMinutesHundredths: applicableCapMinutesHundredths,
        derivedMaximumBalanceMinutesHundredths: maximumBalanceMinutesHundredths,
      },
      sourceRefs: [AZK_SOURCE],
    });
  }
  const insolvencyThresholdMinutesHundredths = 150 * 60 * 100;
  const demandThresholdMinutesHundredths = prorate(
    91 * 60 * 100,
    partTimeNumerator,
    partTimeDenominator,
  );
  const carryLimitMinutesHundredths = prorate(
    150 * 60 * 100,
    partTimeNumerator,
    partTimeDenominator,
  );

  let payoutMinutesHundredths = 0;
  const positiveBalance = Math.max(0, prePayoutBalanceMinutesHundredths);
  switch (payout.kind) {
    case 'NONE':
      break;
    case 'EMPLOYEE_OVER_91': {
      const available = Math.max(0, positiveBalance - demandThresholdMinutesHundredths);
      payoutMinutesHundredths = payout.requestedMinutesHundredths == null
        ? available
        : payout.requestedMinutesHundredths;
      if (!Number.isInteger(payoutMinutesHundredths) || payoutMinutesHundredths < 0
        || payoutMinutesHundredths > available) {
        return unknown('AZK_DEMAND_PAYOUT_INVALID', 'Employee-demand payout may not exceed the positive balance over the prorated 91-hour threshold.', {
          partial: { prePayoutBalanceMinutesHundredths, availableMinutesHundredths: available },
          sourceRefs: [AZK_SOURCE],
        });
      }
      break;
    }
    case 'MONTHLY_AGREEMENT':
      payoutMinutesHundredths = payout.requestedMinutesHundredths;
      if (!Number.isInteger(payoutMinutesHundredths) || payoutMinutesHundredths < 0
        || payoutMinutesHundredths > 20 * 60 * 100) {
        return unknown('AZK_MONTHLY_PAYOUT_INVALID', 'A mutually agreed monthly payout is limited to 20 hours.', {
          partial: { prePayoutBalanceMinutesHundredths },
          sourceRefs: [AZK_SOURCE],
        });
      }
      break;
    case 'CYCLE_AGREEMENT':
      payoutMinutesHundredths = payout.requestedMinutesHundredths;
      if (!Number.isInteger(payoutMinutesHundredths) || payoutMinutesHundredths < 0
        || payoutMinutesHundredths > 70 * 60 * 100) {
        return unknown('AZK_CYCLE_PAYOUT_INVALID', 'A mutually agreed payout in the reconciliation period is limited to 70 hours.', {
          partial: { prePayoutBalanceMinutesHundredths },
          sourceRefs: [AZK_SOURCE],
        });
      }
      break;
    case 'CYCLE_OVERFLOW':
      if (payout.reconciliationDue !== true) {
        return unknown('AZK_RECONCILIATION_EVIDENCE_REQUIRED', 'Cycle overflow may be calculated only after the 12-month period and three-month arrangement phase are documented as due.', {
          partial: { prePayoutBalanceMinutesHundredths },
          sourceRefs: [AZK_SOURCE],
        });
      }
      payoutMinutesHundredths = Math.max(
        0,
        positiveBalance - carryLimitMinutesHundredths,
      );
      break;
    case 'TERMINATION':
      payoutMinutesHundredths = positiveBalance;
      break;
    default:
      return unknown('AZK_PAYOUT_POLICY_UNKNOWN', 'Unsupported payout.kind.', {
        sourceRefs: [AZK_SOURCE],
      });
  }

  if (payoutMinutesHundredths > positiveBalance) {
    return unknown('AZK_PAYOUT_EXCEEDS_BALANCE', 'Payout cannot exceed the positive pre-payout balance.', {
      partial: { prePayoutBalanceMinutesHundredths, payoutMinutesHundredths },
      sourceRefs: [AZK_SOURCE],
    });
  }
  const closingBalanceMinutesHundredths = prePayoutBalanceMinutesHundredths - payoutMinutesHundredths;
  const partial = {
    openingBalanceMinutesHundredths,
    targetHoursHundredths,
    targetMinutesHundredths,
    actualCreditedMinutes,
    deltaMinutesHundredths,
    prePayoutBalanceMinutesHundredths,
    payoutMinutesHundredths,
    closingBalanceMinutesHundredths,
    maximumBalanceMinutesHundredths,
    approvedApplicableCapMinutesHundredths: applicableCapMinutesHundredths ?? null,
    partTimeNumerator,
    partTimeDenominator,
    seasonalCapAuthorized,
    insolvencyThresholdMinutesHundredths,
    demandThresholdMinutesHundredths,
    carryLimitMinutesHundredths,
  };

  if (closingBalanceMinutesHundredths > maximumBalanceMinutesHundredths) {
    return unknown('AZK_CAP_EXCEEDED', 'The post-disposition AZK balance exceeds the applicable 200/230-hour cap prorated for part-time; a lawful disposition is required.', {
      partial,
      sourceRefs: [AZK_SOURCE],
    });
  }
  if (closingBalanceMinutesHundredths > insolvencyThresholdMinutesHundredths
    && insolvencyProtectionConfirmed !== true) {
    return unknown('AZK_INSOLVENCY_PROTECTION_REQUIRED', 'A balance above 150 hours may not remain without documented insolvency protection.', {
      partial,
      sourceRefs: [AZK_SOURCE],
    });
  }
  if (payoutMinutesHundredths > 0
    && (!Number.isInteger(payoutHourlyRateCents) || payoutHourlyRateCents < 0)) {
    return unknown('AZK_PAYOUT_RATE_REQUIRED', 'Positive AZK payout requires the applicable tariff hourly rate in cents.', {
      partial,
      sourceRefs: [AZK_SOURCE],
    });
  }

  const amountCents = payoutMinutesHundredths > 0
    ? hourlyRateTimesMinutesHundredths(payoutHourlyRateCents, payoutMinutesHundredths)
    : 0;
  const warnings = [];
  if (closingBalanceMinutesHundredths < 0) {
    warnings.push({
      code: 'NEGATIVE_AZK_REQUIRES_EMPLOYMENT_CONTEXT',
      message: 'The tariff permits minus hours but states no general lower balance cap; employment/termination rules must be checked outside this function.',
    });
  }

  return ok({
    ...partial,
    payoutKind: payout.kind,
    payoutHourlyRateCents: payoutMinutesHundredths > 0 ? payoutHourlyRateCents : null,
    amountCents,
    expectedAmountCents: amountCents,
    quantityUnit: 'MINUTE_HUNDREDTH',
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      'AZK delta equals actual credited minutes minus the contractual monthly target; holiday and other credited absence minutes must already be included by the caller.',
      'Supplements are excluded from AZK and a cash payout uses only the tariff hourly rate.',
      `${payoutMinutesHundredths}/100 minutes were paid under disposition ${payout.kind}.`,
    ],
    sourceRefs: [AZK_SOURCE],
    warnings,
  });
}

module.exports = { calculateAzk };
