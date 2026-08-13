'use strict';

const { ok, unknown } = require('./result');
const { calculateTargetBaseWage, calculateBaseWage } = require('./tariff');
const { calculateExperienceSupplement } = require('./experience');
const { segmentPremiumTime } = require('./premiums');
const { calculateOvertimePremium } = require('./overtime');
const { evaluateEqualPayContinuity } = require('./equal-pay');
const { calculateAzk } = require('./azk');
const { calculateGvpAbsenceAverage } = require('./absence-average');

const COMPONENTS = Object.freeze({
  baseWage: {
    ruleId: 'GVP_BASE_WAGE',
    calculate: (input) => input.target
      ? calculateTargetBaseWage(input)
      : calculateBaseWage(input),
    amount: (result) => result.data.wage
      ? result.data.wage.expectedAmountCents
      : result.data.expectedAmountCents,
  },
  experience: {
    ruleId: 'GVP_EXPERIENCE_SUPPLEMENT',
    calculate: calculateExperienceSupplement,
    amount: (result) => result.data.expectedAmountCents,
  },
  premiums: {
    ruleId: 'GVP_TIME_PREMIUMS',
    calculate: segmentPremiumTime,
    amount: (result) => result.data.wageLines.reduce(
      (sum, line) => sum + line.expectedAmountCents,
      0,
    ),
  },
  overtime: {
    ruleId: 'GVP_OVERTIME_PREMIUM',
    calculate: calculateOvertimePremium,
    amount: (result) => result.data.expectedAmountCents,
  },
  equalPay: {
    ruleId: 'EQUAL_PAY_TOP_UP',
    calculate: evaluateEqualPayContinuity,
    amount: (result) => result.data.expectedAmountCents,
  },
  azk: {
    ruleId: 'GVP_AZK',
    calculate: calculateAzk,
    amount: (result) => result.data.expectedAmountCents,
  },
  absenceAverage: {
    ruleId: 'GVP_ABSENCE_AVERAGE',
    calculate: calculateGvpAbsenceAverage,
    amount: (result) => result.data.expectedAmountCents,
  },
});

/**
 * Composes only the component inputs supplied by the caller. An omitted
 * component is out of scope; a supplied component that cannot be calculated
 * blocks the context. Summation is opt-in because absence replacement and
 * monthly base components can overlap depending on the payroll design.
 */
function calculatePayrollContext({
  components,
  aggregationPolicy = 'NO_TOTAL',
  contextId = null,
} = {}) {
  if (!components || typeof components !== 'object' || Array.isArray(components)) {
    return unknown('PAYROLL_COMPONENTS_REQUIRED', 'components must be an object keyed by supported component names.', {
      sourceRefs: [],
    });
  }
  if (!['NO_TOTAL', 'SUM_COMPONENTS'].includes(aggregationPolicy)) {
    return unknown('AGGREGATION_POLICY_REQUIRED', 'aggregationPolicy must be NO_TOTAL or SUM_COMPONENTS.', {
      sourceRefs: [],
    });
  }

  const results = {};
  const blockers = [];
  const sourceRefs = [];
  const warnings = [];
  let knownComponentTotalCents = 0;

  for (const [name, input] of Object.entries(components)) {
    const definition = COMPONENTS[name];
    if (!definition) {
      blockers.push({ component: name, code: 'UNSUPPORTED_PAYROLL_COMPONENT' });
      results[name] = unknown('UNSUPPORTED_PAYROLL_COMPONENT', `Unsupported component ${name}.`);
      continue;
    }
    const result = definition.calculate(input);
    const expectedAmountCents = result.status === 'OK' ? definition.amount(result) : null;
    results[name] = {
      ruleId: definition.ruleId,
      expectedAmountCents,
      ...result,
    };
    sourceRefs.push(...result.sourceRefs);
    warnings.push(...result.warnings.map((warning) => ({ component: name, ...warning })));
    if (result.status === 'OK') {
      knownComponentTotalCents += expectedAmountCents;
    } else {
      blockers.push({ component: name, code: result.code, message: result.message });
    }
  }

  const partial = {
    contextId,
    aggregationPolicy,
    components: results,
    knownComponentTotalCents,
    expectedAmountCents: aggregationPolicy === 'SUM_COMPONENTS' && blockers.length === 0
      ? knownComponentTotalCents
      : null,
  };
  const uniqueSources = [...new Set(sourceRefs)];

  if (blockers.length > 0) {
    return unknown('PAYROLL_CONTEXT_BLOCKED', 'At least one supplied payroll component is UNKNOWN.', {
      partial: { ...partial, blockers },
      explanations: ['No aggregate expected amount is emitted while any supplied component is blocking.'],
      sourceRefs: uniqueSources,
      warnings,
    });
  }

  if (aggregationPolicy === 'NO_TOTAL') {
    warnings.push({
      code: 'COMPONENT_TOTAL_NOT_PAYROLL_GROSS',
      message: 'knownComponentTotalCents is informational only; expectedAmountCents remains null until the caller explicitly confirms SUM_COMPONENTS without overlapping wage bases.',
    });
  }

  return ok(partial, {
    explanations: [
      `Calculated ${Object.keys(results).length} supplied component(s) independently.`,
      aggregationPolicy === 'SUM_COMPONENTS'
        ? 'Caller explicitly authorized arithmetic summation of these non-overlapping components.'
        : 'No payroll total was inferred from potentially overlapping components.',
    ],
    sourceRefs: uniqueSources,
    warnings,
  });
}

module.exports = { calculatePayrollContext };
