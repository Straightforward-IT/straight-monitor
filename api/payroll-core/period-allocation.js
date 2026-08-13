'use strict';

const { ok, unknown } = require('./result');

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const OPERATIONAL_SOURCE = 'StraightMonitor canonical working-time and absence ledgers';
const PAYROLL_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):(\d{2}))$/;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] || 0;
}

function parsePayrollMonth(value) {
  const match = typeof value === 'string' && value.match(PAYROLL_MONTH_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return null;
  return { year, month };
}

function parseDateOnly(value) {
  const match = typeof value === 'string' && value.match(DATE_ONLY_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12
      || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day, value };
}

function formatDateOnly(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nextDate(value) {
  const parsed = parseDateOnly(value);
  let { year, month, day } = parsed;
  day += 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return formatDateOnly(year, month, day);
}

function nextMonth({ year, month }) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function exactInstant(value) {
  if (value instanceof Date) {
    const instantMs = value.getTime();
    if (!Number.isFinite(instantMs)) {
      return { error: 'Timestamp Date values must be valid.' };
    }
    if (instantMs % MINUTE_MS !== 0) {
      return { error: 'Timestamps must lie exactly on whole-minute boundaries.', wholeMinute: false };
    }
    return { instantMs };
  }

  const match = typeof value === 'string' && value.match(ISO_INSTANT_PATTERN);
  if (!match) {
    return { error: 'Timestamps must be ISO date-times with an explicit Z or numeric UTC offset.' };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] == null ? 0 : Number(match[6]);
  const fraction = match[7] || '';
  const offsetHour = match[10] == null ? 0 : Number(match[10]);
  const offsetMinute = match[11] == null ? 0 : Number(match[11]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12
      || day < 1 || day > daysInMonth(year, month)
      || hour < 0 || hour > 23 || minute < 0 || minute > 59
      || second < 0 || second > 59
      || offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
    return { error: 'Timestamp contains an invalid calendar date, time, or UTC offset.' };
  }
  if (second !== 0 || (fraction && !/^0+$/.test(fraction))) {
    return { error: 'Timestamps must lie exactly on whole-minute boundaries.', wholeMinute: false };
  }
  const instantMs = Date.parse(value);
  if (!Number.isFinite(instantMs)) {
    return { error: 'Timestamp could not be parsed as an ISO instant.' };
  }
  if (instantMs % MINUTE_MS !== 0) {
    return { error: 'Timestamps must lie exactly on whole-minute boundaries.', wholeMinute: false };
  }
  return { instantMs };
}

function formatterForTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    return { error: 'An IANA timeZone is required.', code: 'TIME_ZONE_REQUIRED' };
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatter.format(new Date());
    const canonicalTimeZone = formatter.resolvedOptions().timeZone;
    return { formatter, canonicalTimeZone };
  } catch (error) {
    return { error: 'timeZone must be a supported IANA time-zone identifier.', code: 'TIME_ZONE_INVALID' };
  }
}

function localParts(formatter, instantMs) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instantMs))
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function sameLocalMinute(parts, target) {
  return parts.year === target.year
    && parts.month === target.month
    && parts.day === 1
    && parts.hour === 0
    && parts.minute === 0
    && parts.second === 0;
}

/**
 * Resolve local first-of-month midnight without assuming that the zone offset
 * at UTC midnight is also the offset at local midnight. Multiple candidates
 * are retained so an ambiguous midnight deterministically uses its first
 * occurrence. The bounded fallback handles zones whose civil clock skips
 * midnight; it never rounds a historical second-based offset to a minute.
 */
function resolveMonthBoundary(target, formatter) {
  const nominalUtcMs = Date.UTC(target.year, target.month - 1, 1, 0, 0, 0, 0);
  const candidates = new Set();
  for (let deltaHours = -48; deltaHours <= 48; deltaHours += 6) {
    const sampleMs = nominalUtcMs + deltaHours * HOUR_MS;
    const parts = localParts(formatter, sampleMs);
    const representedLocalMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const candidateMs = nominalUtcMs - (representedLocalMs - sampleMs);
    if (sameLocalMinute(localParts(formatter, candidateMs), target)) candidates.add(candidateMs);
  }
  if (candidates.size > 0) return Math.min(...candidates);

  let firstMinuteInMonth = null;
  for (let candidateMs = nominalUtcMs - 48 * HOUR_MS;
    candidateMs <= nominalUtcMs + 48 * HOUR_MS;
    candidateMs += MINUTE_MS) {
    const parts = localParts(formatter, candidateMs);
    if (parts.year === target.year && parts.month === target.month) {
      firstMinuteInMonth = { candidateMs, parts };
      break;
    }
  }
  if (!firstMinuteInMonth || firstMinuteInMonth.parts.second !== 0) return null;
  return firstMinuteInMonth.candidateMs;
}

function normalizeWorkInterval(interval, sourceIntervalIndex) {
  if (!interval || typeof interval !== 'object' || Array.isArray(interval)) {
    return { error: unknown('WORK_INTERVAL_INVALID', `intervals[${sourceIntervalIndex}] must be an object.`, {
      sourceRefs: [OPERATIONAL_SOURCE],
    }) };
  }
  const normalizedStart = exactInstant(interval.start);
  const normalizedEnd = exactInstant(interval.end);
  if (normalizedStart.error || normalizedEnd.error) {
    const wholeMinute = normalizedStart.wholeMinute === false || normalizedEnd.wholeMinute === false;
    return { error: unknown(
      wholeMinute ? 'WHOLE_MINUTE_TIMESTAMPS_REQUIRED' : 'WORK_INTERVAL_TIMESTAMP_INVALID',
      `intervals[${sourceIntervalIndex}] start/end: ${normalizedStart.error || normalizedEnd.error}`,
      { sourceRefs: [OPERATIONAL_SOURCE] },
    ) };
  }
  if (normalizedEnd.instantMs <= normalizedStart.instantMs) {
    return { error: unknown('WORK_INTERVAL_INVALID', `intervals[${sourceIntervalIndex}] end must be after start.`, {
      sourceRefs: [OPERATIONAL_SOURCE],
    }) };
  }
  if (!Array.isArray(interval.breaks)) {
    return { error: unknown('DETAILED_BREAKS_REQUIRED', `intervals[${sourceIntervalIndex}].breaks must be an explicit array, including [] when no break occurred.`, {
      sourceRefs: [OPERATIONAL_SOURCE],
    }) };
  }

  const breaks = [];
  for (let breakIndex = 0; breakIndex < interval.breaks.length; breakIndex += 1) {
    const detailedBreak = interval.breaks[breakIndex];
    if (!detailedBreak || typeof detailedBreak !== 'object' || Array.isArray(detailedBreak)) {
      return { error: unknown('WORK_BREAK_INVALID', `intervals[${sourceIntervalIndex}].breaks[${breakIndex}] must be an object.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      }) };
    }
    const breakStart = exactInstant(detailedBreak.start);
    const breakEnd = exactInstant(detailedBreak.end);
    if (breakStart.error || breakEnd.error) {
      const wholeMinute = breakStart.wholeMinute === false || breakEnd.wholeMinute === false;
      return { error: unknown(
        wholeMinute ? 'WHOLE_MINUTE_TIMESTAMPS_REQUIRED' : 'WORK_BREAK_TIMESTAMP_INVALID',
        `intervals[${sourceIntervalIndex}].breaks[${breakIndex}] start/end: ${breakStart.error || breakEnd.error}`,
        { sourceRefs: [OPERATIONAL_SOURCE] },
      ) };
    }
    if (breakEnd.instantMs <= breakStart.instantMs) {
      return { error: unknown('WORK_BREAK_INVALID', `intervals[${sourceIntervalIndex}].breaks[${breakIndex}] end must be after start.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      }) };
    }
    if (breakStart.instantMs < normalizedStart.instantMs || breakEnd.instantMs > normalizedEnd.instantMs) {
      return { error: unknown('WORK_BREAK_OUTSIDE_INTERVAL', `intervals[${sourceIntervalIndex}].breaks[${breakIndex}] must be fully contained in its work interval.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      }) };
    }
    breaks.push({ startMs: breakStart.instantMs, endMs: breakEnd.instantMs, breakIndex });
  }
  breaks.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  for (let breakIndex = 1; breakIndex < breaks.length; breakIndex += 1) {
    if (breaks[breakIndex].startMs < breaks[breakIndex - 1].endMs) {
      return { error: unknown('WORK_BREAK_OVERLAP', `intervals[${sourceIntervalIndex}] contains overlapping detailed breaks.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      }) };
    }
  }
  return {
    interval: {
      startMs: normalizedStart.instantMs,
      endMs: normalizedEnd.instantMs,
      breaks,
      sourceIntervalIndex,
      sourceRef: typeof interval.sourceRef === 'string' && interval.sourceRef.trim()
        ? interval.sourceRef.trim()
        : null,
    },
  };
}

function payableSegments(interval) {
  const segments = [];
  let cursorMs = interval.startMs;
  for (const detailedBreak of interval.breaks) {
    if (cursorMs < detailedBreak.startMs) {
      segments.push({ startMs: cursorMs, endMs: detailedBreak.startMs });
    }
    cursorMs = detailedBreak.endMs;
  }
  if (cursorMs < interval.endMs) segments.push({ startMs: cursorMs, endMs: interval.endMs });
  return segments;
}

function allocateWorkingTimeToPayrollMonth({ payrollMonth, timeZone, intervals } = {}) {
  const parsedMonth = parsePayrollMonth(payrollMonth);
  if (!parsedMonth) {
    return unknown('PAYROLL_MONTH_REQUIRED', 'payrollMonth must be a valid YYYY-MM value (1900-01 through 9999-12).', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  const zone = formatterForTimeZone(timeZone);
  if (zone.error) {
    return unknown(zone.code, zone.error, { sourceRefs: [OPERATIONAL_SOURCE] });
  }
  if (!Array.isArray(intervals)) {
    return unknown('WORK_INTERVALS_REQUIRED', 'intervals must be an explicit array.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }

  const periodStartMs = resolveMonthBoundary(parsedMonth, zone.formatter);
  const periodEndMs = resolveMonthBoundary(nextMonth(parsedMonth), zone.formatter);
  if (!Number.isFinite(periodStartMs) || !Number.isFinite(periodEndMs) || periodEndMs <= periodStartMs) {
    return unknown('PAYROLL_MONTH_BOUNDARY_UNRESOLVED', 'The local payroll-month boundaries could not be resolved exactly in this time zone.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (periodStartMs % MINUTE_MS !== 0 || periodEndMs % MINUTE_MS !== 0) {
    return unknown('PAYROLL_MONTH_BOUNDARY_NOT_WHOLE_MINUTE', 'The time-zone history places a payroll-month boundary off the whole minute; allocation would require silent rounding.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }

  const normalizedIntervals = [];
  for (let index = 0; index < intervals.length; index += 1) {
    const normalized = normalizeWorkInterval(intervals[index], index);
    if (normalized.error) return normalized.error;
    normalizedIntervals.push(normalized.interval);
  }
  normalizedIntervals.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  for (let index = 1; index < normalizedIntervals.length; index += 1) {
    if (normalizedIntervals[index].startMs < normalizedIntervals[index - 1].endMs) {
      return unknown('WORK_INTERVAL_OVERLAP', `intervals[${normalizedIntervals[index - 1].sourceIntervalIndex}] and intervals[${normalizedIntervals[index].sourceIntervalIndex}] overlap.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
  }

  const allocatedIntervals = [];
  let inputActualMinutes = 0;
  let inputBreakMinutes = 0;
  for (const interval of normalizedIntervals) {
    inputActualMinutes += (interval.endMs - interval.startMs) / MINUTE_MS;
    inputBreakMinutes += interval.breaks.reduce(
      (sum, detailedBreak) => sum + ((detailedBreak.endMs - detailedBreak.startMs) / MINUTE_MS),
      0,
    );
    for (const segment of payableSegments(interval)) {
      const allocatedStartMs = Math.max(segment.startMs, periodStartMs);
      const allocatedEndMs = Math.min(segment.endMs, periodEndMs);
      if (allocatedEndMs <= allocatedStartMs) continue;
      allocatedIntervals.push({
        start: new Date(allocatedStartMs).toISOString(),
        end: new Date(allocatedEndMs).toISOString(),
        minutes: (allocatedEndMs - allocatedStartMs) / MINUTE_MS,
        sourceIntervalIndex: interval.sourceIntervalIndex,
        sourceRef: interval.sourceRef,
      });
    }
  }
  const totalMinutes = allocatedIntervals.reduce((sum, interval) => sum + interval.minutes, 0);

  return ok({
    payrollMonth,
    timeZone,
    canonicalTimeZone: zone.canonicalTimeZone,
    periodStart: new Date(periodStartMs).toISOString(),
    periodEnd: new Date(periodEndMs).toISOString(),
    intervals: allocatedIntervals,
    totalMinutes,
    inputActualMinutes,
    inputBreakMinutes,
    inputPayableMinutes: inputActualMinutes - inputBreakMinutes,
  }, {
    explanations: [
      'Actual intervals and every detailed break were validated at exact whole-minute instants before allocation.',
      'Break-free payable intervals were intersected with local first-of-month boundaries resolved from the IANA time zone; elapsed minutes remain exact across midnight and daylight-saving transitions.',
    ],
    sourceRefs: [OPERATIONAL_SOURCE],
  });
}

function zeroAbsenceAllocation({
  payrollMonth,
  status,
  dateFrom,
  dateTill,
  totalCreditedMinutes,
  totalQuantityHundredths,
  totalAmountCents,
}) {
  return ok({
    payrollMonth,
    approvalStatus: status,
    dateFrom,
    dateTill,
    allocationMethod: 'NO_OVERLAP',
    dayAllocations: [],
    allocatedCreditedMinutes: 0,
    allocatedQuantityHundredths: totalQuantityHundredths == null ? null : 0,
    allocatedAmountCents: totalAmountCents == null ? null : 0,
    totalCreditedMinutes,
    totalQuantityHundredths,
    totalAmountCents,
  }, {
    explanations: ['The approved absence does not overlap the requested payroll month.'],
    sourceRefs: [OPERATIONAL_SOURCE],
  });
}

function allocateApprovedAbsenceToPayrollMonth({
  payrollMonth,
  status,
  dateFrom,
  dateTill,
  totalCreditedMinutes,
  totalQuantityHundredths = null,
  totalAmountCents = null,
  dayAllocations,
} = {}) {
  const parsedMonth = parsePayrollMonth(payrollMonth);
  if (!parsedMonth) {
    return unknown('PAYROLL_MONTH_REQUIRED', 'payrollMonth must be a valid YYYY-MM value (1900-01 through 9999-12).', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (!['APPROVED', 'LOCKED'].includes(status)) {
    return unknown('APPROVED_ABSENCE_REQUIRED', 'Only an APPROVED or LOCKED absence can be allocated to payroll.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  const parsedFrom = parseDateOnly(dateFrom);
  const parsedTill = parseDateOnly(dateTill);
  if (!parsedFrom || !parsedTill || dateTill < dateFrom) {
    return unknown('ABSENCE_DATE_RANGE_INVALID', 'dateFrom/dateTill must be valid inclusive YYYY-MM-DD values with dateTill on or after dateFrom.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (!Number.isSafeInteger(totalCreditedMinutes) || totalCreditedMinutes < 0) {
    return unknown('ABSENCE_TOTAL_MINUTES_REQUIRED', 'totalCreditedMinutes must be a non-negative safe integer.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (totalQuantityHundredths != null
      && (!Number.isSafeInteger(totalQuantityHundredths) || totalQuantityHundredths < 0)) {
    return unknown('ABSENCE_TOTAL_QUANTITY_INVALID', 'totalQuantityHundredths must be null or a non-negative safe integer.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (totalAmountCents != null && (!Number.isSafeInteger(totalAmountCents) || totalAmountCents < 0)) {
    return unknown('ABSENCE_TOTAL_AMOUNT_INVALID', 'totalAmountCents must be null or a non-negative safe integer.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }

  const requestedMonthIndex = parsedMonth.year * 12 + parsedMonth.month;
  const fromMonthIndex = parsedFrom.year * 12 + parsedFrom.month;
  const tillMonthIndex = parsedTill.year * 12 + parsedTill.month;
  if (requestedMonthIndex < fromMonthIndex || requestedMonthIndex > tillMonthIndex) {
    return zeroAbsenceAllocation({
      payrollMonth, status, dateFrom, dateTill, totalCreditedMinutes, totalQuantityHundredths, totalAmountCents,
    });
  }

  const crossesMonth = dateFrom.slice(0, 7) !== dateTill.slice(0, 7);
  if (dayAllocations == null || (Array.isArray(dayAllocations) && dayAllocations.length === 0)) {
    if (crossesMonth) {
      return unknown('ABSENCE_DAY_ALLOCATIONS_REQUIRED', 'A multi-month absence cannot be prorated without an explicit allocation for every calendar date, including zero-minute non-working days.', {
        partial: {
          payrollMonth,
          dateFrom,
          dateTill,
          totalCreditedMinutes,
          totalQuantityHundredths,
          totalAmountCents,
        },
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
    return ok({
      payrollMonth,
      approvalStatus: status,
      dateFrom,
      dateTill,
      allocationMethod: 'WHOLE_ABSENCE_SINGLE_MONTH',
      dayAllocations: [],
      allocatedCreditedMinutes: totalCreditedMinutes,
      allocatedQuantityHundredths: totalQuantityHundredths,
      allocatedAmountCents: totalAmountCents,
      totalCreditedMinutes,
      totalQuantityHundredths,
      totalAmountCents,
    }, {
      explanations: ['The complete approved absence falls within one payroll month, so no cross-month proration was inferred.'],
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (!Array.isArray(dayAllocations)) {
    return unknown('ABSENCE_DAY_ALLOCATIONS_INVALID', 'dayAllocations must be an array when supplied.', {
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }

  const normalizedAllocations = [];
  const seenDates = new Set();
  for (let index = 0; index < dayAllocations.length; index += 1) {
    const allocation = dayAllocations[index];
    if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)
        || !parseDateOnly(allocation.date)
        || allocation.date < dateFrom || allocation.date > dateTill
        || !Number.isSafeInteger(allocation.creditedMinutes) || allocation.creditedMinutes < 0) {
      return unknown('ABSENCE_DAY_ALLOCATION_INVALID', `dayAllocations[${index}] needs an in-range YYYY-MM-DD date and non-negative integer creditedMinutes.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
    if (seenDates.has(allocation.date)) {
      return unknown('ABSENCE_DAY_ALLOCATION_DUPLICATE', `dayAllocations contains duplicate date ${allocation.date}.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
    seenDates.add(allocation.date);
    if (totalAmountCents == null && allocation.amountCents != null) {
      return unknown('ABSENCE_TOTAL_AMOUNT_REQUIRED', 'totalAmountCents is required when daily amountCents are supplied.', {
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
    if (totalAmountCents != null
        && (!Number.isSafeInteger(allocation.amountCents) || allocation.amountCents < 0)) {
      return unknown('ABSENCE_DAY_AMOUNT_INVALID', `dayAllocations[${index}].amountCents must be a non-negative integer because totalAmountCents was supplied.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
    if (totalQuantityHundredths != null
        && (!Number.isSafeInteger(allocation.quantityHundredths) || allocation.quantityHundredths < 0)) {
      return unknown('ABSENCE_DAY_QUANTITY_INVALID', `dayAllocations[${index}].quantityHundredths must be a non-negative safe integer because totalQuantityHundredths was supplied.`, {
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
    const normalizedAllocation = {
      date: allocation.date,
      creditedMinutes: allocation.creditedMinutes,
      amountCents: totalAmountCents == null ? null : allocation.amountCents,
    };
    if (totalQuantityHundredths != null) normalizedAllocation.quantityHundredths = allocation.quantityHundredths;
    normalizedAllocations.push(normalizedAllocation);
  }
  normalizedAllocations.sort((left, right) => left.date.localeCompare(right.date));
  const missingDates = [];
  let expectedDate = dateFrom;
  for (const allocation of normalizedAllocations) {
    if (allocation.date !== expectedDate) {
      missingDates.push(expectedDate);
      break;
    }
    expectedDate = allocation.date === dateTill ? null : nextDate(allocation.date);
  }
  if (missingDates.length === 0 && expectedDate != null) missingDates.push(expectedDate);
  if (missingDates.length > 0) {
    return unknown('ABSENCE_DAY_ALLOCATIONS_INCOMPLETE', 'Supply exactly one allocation for every calendar date of the absence; zero-minute days must be explicit.', {
      partial: { missingDates },
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  const allocatedTotalMinutes = normalizedAllocations.reduce(
    (sum, allocation) => sum + allocation.creditedMinutes,
    0,
  );
  if (allocatedTotalMinutes !== totalCreditedMinutes) {
    return unknown('ABSENCE_DAY_MINUTES_MISMATCH', 'The sum of daily creditedMinutes must equal totalCreditedMinutes.', {
      partial: { allocatedTotalMinutes, totalCreditedMinutes },
      sourceRefs: [OPERATIONAL_SOURCE],
    });
  }
  if (totalQuantityHundredths != null) {
    const allocatedTotalQuantityHundredths = normalizedAllocations.reduce(
      (sum, allocation) => sum + allocation.quantityHundredths,
      0,
    );
    if (allocatedTotalQuantityHundredths !== totalQuantityHundredths) {
      return unknown('ABSENCE_DAY_QUANTITY_MISMATCH', 'The sum of daily quantityHundredths must equal totalQuantityHundredths.', {
        partial: { allocatedTotalQuantityHundredths, totalQuantityHundredths },
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
  }
  if (totalAmountCents != null) {
    const allocatedTotalAmountCents = normalizedAllocations.reduce(
      (sum, allocation) => sum + allocation.amountCents,
      0,
    );
    if (allocatedTotalAmountCents !== totalAmountCents) {
      return unknown('ABSENCE_DAY_AMOUNT_MISMATCH', 'The sum of daily amountCents must equal totalAmountCents.', {
        partial: { allocatedTotalAmountCents, totalAmountCents },
        sourceRefs: [OPERATIONAL_SOURCE],
      });
    }
  }

  const monthAllocations = normalizedAllocations.filter(
    (allocation) => allocation.date.slice(0, 7) === payrollMonth,
  );
  const allocatedCreditedMinutes = monthAllocations.reduce(
    (sum, allocation) => sum + allocation.creditedMinutes,
    0,
  );
  const allocatedAmountCents = totalAmountCents == null ? null : monthAllocations.reduce(
    (sum, allocation) => sum + allocation.amountCents,
    0,
  );
  const allocatedQuantityHundredths = totalQuantityHundredths == null ? null : monthAllocations.reduce(
    (sum, allocation) => sum + allocation.quantityHundredths,
    0,
  );

  return ok({
    payrollMonth,
    approvalStatus: status,
    dateFrom,
    dateTill,
    allocationMethod: 'EXPLICIT_DAILY',
    dayAllocations: monthAllocations,
    allocatedCreditedMinutes,
    allocatedQuantityHundredths,
    allocatedAmountCents,
    totalCreditedMinutes,
    totalQuantityHundredths,
    totalAmountCents,
  }, {
    explanations: [
      'The month receives only the reviewed integer minutes and cents explicitly assigned to its calendar dates.',
      'No workday pattern, daily hours, or monetary rounding was inferred by the allocation helper.',
    ],
    sourceRefs: [OPERATIONAL_SOURCE],
  });
}

module.exports = {
  allocateWorkingTimeToPayrollMonth,
  allocateApprovedAbsenceToPayrollMonth,
};
