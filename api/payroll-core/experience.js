'use strict';

const { ok, unknown } = require('./result');
const { parseDateOnly, addCalendarMonths, addDays } = require('./dates');
const {
  buildContinuityGroups,
  findActiveGroup,
  thresholdDateForGroup,
} = require('./continuity');
const { selectTariffRate } = require('./tariff');
const { ROUNDING_RULE, hourlyRateTimesMinutes } = require('./rounding');

const EXPERIENCE_SOURCE = 'DGB/GVP Entgelttarifvertrag § 3 and official tables (primary tariff lines 856-888, 915-961)';
const LEGACY_SOURCE = 'DGB/GVP ETV transition for employers iGZ-bound on 31.12.2025 (primary tariff lines 1158-1177)';
const TIER_RANK = Object.freeze({ BASE: 0, P1_5: 1, P3_0: 2 });

function missingStandardPolicy(policy) {
  return !policy
    || policy.mode !== 'GVP_STANDARD'
    || !Object.prototype.hasOwnProperty.call(policy, 'generalTier')
    || !Array.isArray(policy.sameCustomerTiers)
    || !Number.isInteger(policy.interruptionMonths)
    || policy.interruptionMonths < 0
    || !policy.policyId;
}

function employmentThresholdDate(employment, months) {
  if (!employment || !parseDateOnly(employment.startDate)
    || !Number.isInteger(employment.nonCreditedDays)
    || employment.nonCreditedDays < 0) return null;
  return addDays(addCalendarMonths(employment.startDate, months), employment.nonCreditedDays);
}

function validateTierRule(rule, fieldName) {
  if (rule == null) return null;
  if (!Number.isInteger(rule.afterMonths) || rule.afterMonths < 0 || !(rule.tier in TIER_RANK)) {
    return `${fieldName} entries require non-negative afterMonths and tier BASE, P1_5, or P3_0`;
  }
  return null;
}

function calculateStandardExperience(input, policy) {
  if (missingStandardPolicy(policy)) {
    return unknown('EXPERIENCE_POLICY_REQUIRED', 'Standard experience calculation requires an explicit policyId, generalTier (rule or null), sameCustomerTiers, and interruptionMonths.', {
      sourceRefs: [EXPERIENCE_SOURCE],
      warnings: [{
        code: 'PRIMARY_WORDING_REQUIRES_CONFIGURED_INTERPRETATION',
        message: 'ETV § 3 combines a general 12-employment-month sentence with 9/12-month same-customer tiers. The engine deliberately does not choose the relationship between those rules.',
      }],
    });
  }
  const generalError = validateTierRule(policy.generalTier, 'generalTier');
  const customerError = policy.sameCustomerTiers
    .map((rule) => validateTierRule(rule, 'sameCustomerTiers'))
    .find(Boolean);
  if (generalError || customerError) {
    return unknown('EXPERIENCE_POLICY_INVALID', generalError || customerError, {
      sourceRefs: [EXPERIENCE_SOURCE],
    });
  }
  if (!input.employment || !parseDateOnly(input.employment.startDate)
    || !Number.isInteger(input.employment.nonCreditedDays)
    || input.employment.nonCreditedDays < 0) {
    return unknown('EMPLOYMENT_HISTORY_REQUIRED', 'Employment start and explicitly calculated nonCreditedDays are required.', {
      sourceRefs: [EXPERIENCE_SOURCE],
    });
  }
  if (policy.sameCustomerTiers.length > 0 && input.assignmentHistoryComplete !== true) {
    return unknown('ASSIGNMENT_HISTORY_INCOMPLETE', 'Complete same-customer assignment history must be asserted before an experience tier can be selected.', {
      sourceRefs: [EXPERIENCE_SOURCE],
    });
  }

  let selectedTier = 'BASE';
  const eligibility = {
    policyId: policy.policyId,
    mode: policy.mode,
    general: null,
    sameCustomer: [],
  };

  if (policy.generalTier) {
    const thresholdDate = employmentThresholdDate(input.employment, policy.generalTier.afterMonths);
    const eligible = input.asOfDate >= thresholdDate;
    eligibility.general = { ...policy.generalTier, thresholdDate, eligible };
    if (eligible && TIER_RANK[policy.generalTier.tier] > TIER_RANK[selectedTier]) {
      selectedTier = policy.generalTier.tier;
    }
  }

  let activeGroup = null;
  if (policy.sameCustomerTiers.length > 0) {
    if (!input.currentCustomerId) {
      return unknown('CURRENT_CUSTOMER_REQUIRED', 'currentCustomerId is required for configured same-customer experience tiers.', {
        sourceRefs: [EXPERIENCE_SOURCE],
      });
    }
    const continuity = buildContinuityGroups({
      periods: input.assignmentPeriods,
      customerId: input.currentCustomerId,
      asOfDate: input.asOfDate,
      interruptionMonths: policy.interruptionMonths,
    });
    if (continuity.error) {
      return unknown('ASSIGNMENT_HISTORY_INVALID', continuity.error, { sourceRefs: [EXPERIENCE_SOURCE] });
    }
    activeGroup = findActiveGroup(continuity.groups, input.asOfDate);
    for (const rule of policy.sameCustomerTiers) {
      const thresholdDate = thresholdDateForGroup(activeGroup, rule.afterMonths);
      const eligible = Boolean(thresholdDate && input.asOfDate >= thresholdDate);
      eligibility.sameCustomer.push({ ...rule, thresholdDate, eligible });
      if (eligible && TIER_RANK[rule.tier] > TIER_RANK[selectedTier]) {
        selectedTier = rule.tier;
      }
    }
    eligibility.sameCustomerContinuity = activeGroup ? {
      startDate: activeGroup.startDate,
      gapDays: activeGroup.gapDays,
      assignmentDays: activeGroup.assignmentDays,
    } : null;
  }

  const rate = selectTariffRate({
    date: input.asOfDate,
    entgeltgruppe: input.entgeltgruppe,
    tier: selectedTier,
  });
  if (rate.status !== 'OK') return rate;
  const amountCents = hourlyRateTimesMinutes(rate.data.hourlySupplementCents, input.eligibleMinutes);

  return ok({
    policyId: policy.policyId,
    policyMode: policy.mode,
    selectedTier,
    entgeltgruppe: String(input.entgeltgruppe),
    eligibleMinutes: input.eligibleMinutes,
    baseHourlyCents: rate.data.baseHourlyCents,
    totalHourlyCents: rate.data.hourlyRateCents,
    supplementHourlyCents: rate.data.hourlySupplementCents,
    amountCents,
    expectedAmountCents: amountCents,
    eligibility,
    ratePeriod: rate.data.ratePeriod,
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      `Policy ${policy.policyId} selected ${selectedTier}; the official table difference, not a recomputed floating percentage, is used.`,
      `${input.eligibleMinutes} eligible actual minutes × ${rate.data.hourlySupplementCents} cents/hour, rounded once to the wage line.`,
    ],
    sourceRefs: [EXPERIENCE_SOURCE],
    warnings: rate.warnings,
  });
}

function calculateLegacyExperience(input, policy) {
  const required = policy
    && policy.mode === 'IGZ_TRANSITION'
    && policy.policyId
    && policy.employerWasIgzBoundOn2025_12_31 === true
    && Object.prototype.hasOwnProperty.call(policy, 'standardAdoptionDate')
    && parseDateOnly(policy.transitionEndDate)
    && Number.isInteger(policy.employmentMonths)
    && Number.isInteger(policy.assignmentMonths)
    && Number.isInteger(policy.interruptionMonths);
  if (!required) {
    return unknown('LEGACY_EXPERIENCE_POLICY_REQUIRED', 'Legacy mode requires explicit iGZ eligibility, transition end, early-adoption date (or null), thresholds, and policyId.', {
      sourceRefs: [LEGACY_SOURCE],
    });
  }

  const standardApplies = input.asOfDate > policy.transitionEndDate
    || (policy.standardAdoptionDate && input.asOfDate >= policy.standardAdoptionDate);
  if (standardApplies) {
    if (!policy.standardPolicyAfterTransition) {
      return unknown('POST_TRANSITION_POLICY_REQUIRED', 'A complete standardPolicyAfterTransition is required after transition expiry or early adoption.', {
        sourceRefs: [LEGACY_SOURCE, EXPERIENCE_SOURCE],
      });
    }
    const standard = calculateStandardExperience(input, policy.standardPolicyAfterTransition);
    if (standard.status === 'OK') {
      standard.explanations.unshift(`Legacy policy ${policy.policyId} delegated to standard policy because the transition no longer applies on ${input.asOfDate}.`);
      standard.sourceRefs = [...new Set([LEGACY_SOURCE, ...standard.sourceRefs])];
    }
    return standard;
  }

  if (input.assignmentHistoryComplete !== true || !input.currentCustomerId) {
    return unknown('ASSIGNMENT_HISTORY_INCOMPLETE', 'Complete current-customer assignment history is required for the legacy nine-month gate.', {
      sourceRefs: [LEGACY_SOURCE],
    });
  }
  const employmentDate = employmentThresholdDate(input.employment, policy.employmentMonths);
  if (!employmentDate) {
    return unknown('EMPLOYMENT_HISTORY_REQUIRED', 'Employment start and explicitly calculated nonCreditedDays are required.', {
      sourceRefs: [LEGACY_SOURCE],
    });
  }
  const continuity = buildContinuityGroups({
    periods: input.assignmentPeriods,
    customerId: input.currentCustomerId,
    asOfDate: input.asOfDate,
    interruptionMonths: policy.interruptionMonths,
  });
  if (continuity.error) {
    return unknown('ASSIGNMENT_HISTORY_INVALID', continuity.error, { sourceRefs: [LEGACY_SOURCE] });
  }
  const activeGroup = findActiveGroup(continuity.groups, input.asOfDate);
  const assignmentDate = thresholdDateForGroup(activeGroup, policy.assignmentMonths);
  const eligible = input.asOfDate >= employmentDate
    && Boolean(assignmentDate && input.asOfDate >= assignmentDate);
  const egNumber = ['1', '2a', '2b', '3', '4'].includes(String(input.entgeltgruppe)) ? 20 : 35;
  const supplementHourlyCents = eligible ? egNumber : 0;
  const base = selectTariffRate({ date: input.asOfDate, entgeltgruppe: input.entgeltgruppe });
  if (base.status !== 'OK') return base;
  const amountCents = hourlyRateTimesMinutes(supplementHourlyCents, input.eligibleMinutes);

  return ok({
    policyId: policy.policyId,
    policyMode: policy.mode,
    selectedTier: eligible ? 'LEGACY_FIXED' : 'BASE',
    entgeltgruppe: String(input.entgeltgruppe),
    eligibleMinutes: input.eligibleMinutes,
    baseHourlyCents: base.data.baseHourlyCents,
    totalHourlyCents: base.data.baseHourlyCents + supplementHourlyCents,
    supplementHourlyCents,
    amountCents,
    expectedAmountCents: amountCents,
    eligibility: {
      employmentThresholdDate: employmentDate,
      assignmentThresholdDate: assignmentDate,
      eligible,
      sameCustomerContinuity: activeGroup ? {
        startDate: activeGroup.startDate,
        gapDays: activeGroup.gapDays,
        assignmentDays: activeGroup.assignmentDays,
      } : null,
    },
    ratePeriod: base.data.ratePeriod,
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      `Legacy policy ${policy.policyId} requires both ${policy.assignmentMonths} same-customer months and ${policy.employmentMonths} employment months.`,
      `The primary transition fixes the supplement at ${egNumber} cents/hour for EG ${input.entgeltgruppe}.`,
    ],
    sourceRefs: [LEGACY_SOURCE],
    warnings: [{
      code: 'LEGACY_INDUSTRY_REDUCTION_NOT_AUTOMATIC',
      message: 'The transition permits a reduction in lower-paying industries; no reduction is made without a separately verified amount.',
    }, ...base.warnings],
  });
}

function calculateExperienceSupplement(input = {}) {
  if (!parseDateOnly(input.asOfDate)) {
    return unknown('PAYROLL_DATE_REQUIRED', 'asOfDate must be YYYY-MM-DD.', {
      sourceRefs: [EXPERIENCE_SOURCE],
    });
  }
  if (!Number.isInteger(input.eligibleMinutes) || input.eligibleMinutes < 0) {
    return unknown('ELIGIBLE_MINUTES_REQUIRED', 'eligibleMinutes must be a non-negative whole-minute quantity.', {
      sourceRefs: [EXPERIENCE_SOURCE],
    });
  }
  if (!input.policy || !input.policy.mode) {
    return unknown('EXPERIENCE_POLICY_REQUIRED', 'An explicit experience policy is required.', {
      sourceRefs: [EXPERIENCE_SOURCE, LEGACY_SOURCE],
    });
  }
  if (input.policy.mode === 'GVP_STANDARD') {
    return calculateStandardExperience(input, input.policy);
  }
  if (input.policy.mode === 'IGZ_TRANSITION') {
    return calculateLegacyExperience(input, input.policy);
  }
  return unknown('EXPERIENCE_POLICY_UNKNOWN', 'policy.mode must be GVP_STANDARD or IGZ_TRANSITION.', {
    sourceRefs: [EXPERIENCE_SOURCE, LEGACY_SOURCE],
  });
}

module.exports = { calculateExperienceSupplement };
