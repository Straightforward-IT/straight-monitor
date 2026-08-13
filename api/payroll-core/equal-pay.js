'use strict';

const { ok, unknown } = require('./result');
const { parseDateOnly } = require('./dates');
const {
  buildContinuityGroups,
  findActiveGroup,
  thresholdDateForGroup,
} = require('./continuity');
const { ROUNDING_RULE, hourlyRateTimesMinutes } = require('./rounding');

const EQUAL_PAY_SOURCE = 'AÜG § 8 equal-treatment/equal-pay rule and § 1(1b) same-hirer continuity; threshold policy must be versioned against current primary law and any applicable sector tariff';

function evaluateEqualPayContinuity({
  asOfDate,
  customerId,
  assignmentPeriods,
  assignmentHistoryComplete,
  policy,
  comparisonHourlyCents,
  currentRelevantHourlyCents,
  eligibleMinutes,
} = {}) {
  if (!parseDateOnly(asOfDate)) {
    return unknown('PAYROLL_DATE_REQUIRED', 'asOfDate must be YYYY-MM-DD.', {
      sourceRefs: [EQUAL_PAY_SOURCE],
    });
  }
  if (!customerId || assignmentHistoryComplete !== true) {
    return unknown('EQUAL_PAY_HISTORY_INCOMPLETE', 'customerId and an explicit complete assignment-history assertion are required.', {
      sourceRefs: [EQUAL_PAY_SOURCE],
    });
  }
  if (!policy || !policy.policyId || !policy.sourceRef
    || !Number.isInteger(policy.thresholdMonths) || policy.thresholdMonths <= 0
    || !Number.isInteger(policy.interruptionMonths) || policy.interruptionMonths < 0) {
    return unknown('EQUAL_PAY_POLICY_REQUIRED', 'Provide a versioned policyId/sourceRef plus positive thresholdMonths and non-negative interruptionMonths.', {
      sourceRefs: [EQUAL_PAY_SOURCE],
      warnings: [{
        code: 'NO_LEGAL_THRESHOLD_ASSUMED',
        message: 'The core does not silently assume nine or fifteen months because tariff-deviation eligibility changes the relevant threshold.',
      }],
    });
  }

  const continuity = buildContinuityGroups({
    periods: assignmentPeriods,
    customerId,
    asOfDate,
    interruptionMonths: policy.interruptionMonths,
  });
  if (continuity.error) {
    return unknown('ASSIGNMENT_HISTORY_INVALID', continuity.error, {
      sourceRefs: [EQUAL_PAY_SOURCE, policy.sourceRef],
    });
  }
  const activeGroup = findActiveGroup(continuity.groups, asOfDate);
  const thresholdDate = thresholdDateForGroup(activeGroup, policy.thresholdMonths);
  const due = Boolean(activeGroup && thresholdDate && asOfDate >= thresholdDate);
  const continuityData = activeGroup ? {
    startDate: activeGroup.startDate,
    endDateExclusive: activeGroup.endDateExclusive,
    gapDays: activeGroup.gapDays,
    assignmentDays: activeGroup.assignmentDays,
    periods: activeGroup.periods,
  } : null;

  const partial = {
    policyId: policy.policyId,
    asOfDate,
    customerId,
    activeAssignment: Boolean(activeGroup),
    thresholdMonths: policy.thresholdMonths,
    interruptionMonths: policy.interruptionMonths,
    thresholdDate,
    due,
    continuity: continuityData,
  };

  if (due && (!Number.isInteger(comparisonHourlyCents) || comparisonHourlyCents < 0)) {
    return unknown('EQUAL_PAY_COMPARATOR_REQUIRED', 'Equal Pay is due, but the customer comparable remuneration is missing or unverified.', {
      partial,
      sourceRefs: [EQUAL_PAY_SOURCE, policy.sourceRef],
      warnings: [{
        code: 'COMPARATOR_MUST_INCLUDE_ALL_RELEVANT_COMPONENTS',
        message: 'A bare base rate is insufficient unless the customer has verified that it represents the complete comparable remuneration required by the configured policy.',
      }],
    });
  }
  if (due && (!Number.isInteger(currentRelevantHourlyCents) || currentRelevantHourlyCents < 0
    || !Number.isInteger(eligibleMinutes) || eligibleMinutes < 0)) {
    return unknown('EQUAL_PAY_CURRENT_PAY_REQUIRED', 'Equal Pay is due; currentRelevantHourlyCents and non-negative eligibleMinutes are required to calculate the top-up.', {
      partial,
      sourceRefs: [EQUAL_PAY_SOURCE, policy.sourceRef],
    });
  }

  const topUpHourlyCents = due
    ? Math.max(0, comparisonHourlyCents - currentRelevantHourlyCents)
    : 0;
  const amountCents = due ? hourlyRateTimesMinutes(topUpHourlyCents, eligibleMinutes) : 0;

  return ok({
    ...partial,
    comparisonHourlyCents: due ? comparisonHourlyCents : null,
    currentRelevantHourlyCents: due ? currentRelevantHourlyCents : null,
    topUpHourlyCents,
    eligibleMinutes: due ? eligibleMinutes : 0,
    amountCents,
    expectedAmountCents: amountCents,
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      activeGroup
        ? `Assignments separated by no more than ${policy.interruptionMonths} calendar months were grouped; gaps do not add assignment service and shift the threshold date.`
        : 'No active assignment at this customer exists on the evaluation date.',
      due
        ? `Configured Equal-Pay threshold ${thresholdDate} has been reached; the positive comparator difference is calculated for eligible minutes.`
        : `Configured Equal-Pay threshold has not been reached on ${asOfDate}.`,
    ],
    sourceRefs: [EQUAL_PAY_SOURCE, policy.sourceRef],
    warnings: [{
      code: 'POLICY_AND_COMPARATOR_REQUIRE_EXTERNAL_LEGAL_VALIDATION',
      message: 'The pure core evaluates the supplied versioned policy and comparator; it cannot prove tariff-deviation eligibility or comparator completeness.',
    }],
  });
}

module.exports = { evaluateEqualPayContinuity };
