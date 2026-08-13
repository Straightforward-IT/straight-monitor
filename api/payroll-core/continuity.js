'use strict';

const {
  parseDateOnly,
  addDays,
  daysBetween,
  addCalendarMonths,
} = require('./dates');

function normalizePeriods({ periods, customerId, asOfDate }) {
  if (!Array.isArray(periods)) {
    return { error: 'assignmentPeriods must be an array' };
  }
  const evaluationEndExclusive = addDays(asOfDate, 1);
  const normalized = [];

  for (const period of periods) {
    if (!period || period.customerId !== customerId) continue;
    const start = parseDateOnly(period.startDate);
    const suppliedEnd = period.endDateExclusive == null
      ? null
      : parseDateOnly(period.endDateExclusive);
    if (!start || (period.endDateExclusive != null && !suppliedEnd)) {
      return { error: 'assignment periods require valid YYYY-MM-DD boundaries' };
    }
    const startDate = period.startDate;
    const rawEnd = period.endDateExclusive || evaluationEndExclusive;
    const endDateExclusive = rawEnd > evaluationEndExclusive ? evaluationEndExclusive : rawEnd;
    if (endDateExclusive <= startDate) continue;
    normalized.push({ startDate, endDateExclusive });
  }

  normalized.sort((left, right) => left.startDate.localeCompare(right.startDate));

  const merged = [];
  for (const period of normalized) {
    const previous = merged[merged.length - 1];
    if (previous && period.startDate <= previous.endDateExclusive) {
      if (period.endDateExclusive > previous.endDateExclusive) {
        previous.endDateExclusive = period.endDateExclusive;
      }
    } else {
      merged.push({ ...period });
    }
  }
  return { periods: merged };
}

/**
 * Date ranges are [startDate, endDateExclusive). A new period beginning exactly
 * interruptionMonths calendar months after the previous exclusive end still
 * carries prior service; one day later starts a new continuity group.
 */
function buildContinuityGroups({
  periods,
  customerId,
  asOfDate,
  interruptionMonths,
}) {
  if (!parseDateOnly(asOfDate)) return { error: 'asOfDate must be YYYY-MM-DD' };
  if (!customerId) return { error: 'customerId is required' };
  if (!Number.isInteger(interruptionMonths) || interruptionMonths < 0) {
    return { error: 'interruptionMonths must be a non-negative integer' };
  }

  const normalized = normalizePeriods({ periods, customerId, asOfDate });
  if (normalized.error) return normalized;

  const groups = [];
  for (const period of normalized.periods) {
    const group = groups[groups.length - 1];
    if (!group) {
      groups.push({
        startDate: period.startDate,
        endDateExclusive: period.endDateExclusive,
        periods: [{ ...period }],
        gapDays: 0,
      });
      continue;
    }

    const carryThrough = addCalendarMonths(group.endDateExclusive, interruptionMonths);
    if (period.startDate <= carryThrough) {
      group.gapDays += daysBetween(group.endDateExclusive, period.startDate);
      group.endDateExclusive = period.endDateExclusive;
      group.periods.push({ ...period });
    } else {
      groups.push({
        startDate: period.startDate,
        endDateExclusive: period.endDateExclusive,
        periods: [{ ...period }],
        gapDays: 0,
      });
    }
  }

  for (const group of groups) {
    group.assignmentDays = group.periods.reduce(
      (sum, period) => sum + daysBetween(period.startDate, period.endDateExclusive),
      0,
    );
  }

  return { groups };
}

function findActiveGroup(groups, asOfDate) {
  return groups.find((group) => group.periods.some(
    (period) => period.startDate <= asOfDate && asOfDate < period.endDateExclusive,
  )) || null;
}

function thresholdDateForGroup(group, thresholdMonths) {
  if (!group) return null;
  return addDays(addCalendarMonths(group.startDate, thresholdMonths), group.gapDays);
}

module.exports = {
  buildContinuityGroups,
  findActiveGroup,
  thresholdDateForGroup,
};
