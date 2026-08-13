'use strict';

const { ok, unknown } = require('./result');
const { ROUNDING_RULE, hourlyRateTimesMinutesAndBps } = require('./rounding');

const PREMIUM_SOURCE = 'DGB/GVP Manteltarifvertrag §§ 3.6, 6.2-6.4 (primary tariff lines 207-210, 339-355)';
const DEFAULT_TIE_BREAK_ORDER = Object.freeze([
  'HOLIDAY',
  'HOLIDAY_SPECIAL',
  'SUNDAY',
  'NIGHT',
  'OVERTIME',
]);

function validateBasisPoints(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

function selectHighestPremium({ candidates, tieBreakOrder = DEFAULT_TIE_BREAK_ORDER } = {}) {
  if (!Array.isArray(candidates) || candidates.some((candidate) => (
    !candidate || !candidate.code || !Number.isInteger(candidate.bps) || candidate.bps < 0
  ))) {
    return unknown('PREMIUM_CANDIDATES_REQUIRED', 'candidates must contain code and non-negative integer bps.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  if (!Array.isArray(tieBreakOrder)) {
    return unknown('PREMIUM_TIE_POLICY_REQUIRED', 'tieBreakOrder must be an array.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  const positive = candidates.filter((candidate) => candidate.bps > 0);
  if (positive.length === 0) {
    return ok({ selected: null, rejected: [], tied: false }, {
      explanations: ['No positive premium applies to this interval.'],
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  const maximum = Math.max(...positive.map((candidate) => candidate.bps));
  const highest = positive.filter((candidate) => candidate.bps === maximum);
  highest.sort((left, right) => {
    const leftIndex = tieBreakOrder.indexOf(left.code);
    const rightIndex = tieBreakOrder.indexOf(right.code);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight || left.code.localeCompare(right.code);
  });
  const selected = highest[0];
  return ok({
    selected,
    rejected: positive.filter((candidate) => candidate !== selected),
    tied: highest.length > 1,
  }, {
    explanations: [`Selected only ${selected.code} at ${selected.bps} basis points because MTV § 6.4 permits only the highest concurrent § 6 premium.`],
    sourceRefs: [PREMIUM_SOURCE],
    warnings: highest.length > 1 ? [{
      code: 'EQUAL_PREMIUM_TIE_CLASSIFIED_BY_POLICY',
      message: `Equal monetary premiums were classified using tie order ${tieBreakOrder.join(' > ')}; the tariff specifies the amount but not the wage-type label for a tie.`,
    }] : [],
  });
}

function localMinuteParts(date, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

function intervalContains(interval, instantMs) {
  return interval.startMs <= instantMs && instantMs < interval.endMs;
}

function normalizeExtraPremiums(extraPremiums, startMs, endMs) {
  if (extraPremiums == null) return { intervals: [] };
  if (!Array.isArray(extraPremiums)) return { error: 'extraPremiums must be an array' };
  const intervals = [];
  for (const premium of extraPremiums) {
    const premiumStart = Date.parse(premium.start);
    const premiumEnd = Date.parse(premium.end);
    if (!premium.code || !Number.isInteger(premium.bps) || premium.bps < 0
      || (premium.sourceRefs != null && !Array.isArray(premium.sourceRefs))
      || !Number.isFinite(premiumStart) || !Number.isFinite(premiumEnd)
      || premiumStart % 60000 !== 0 || premiumEnd % 60000 !== 0
      || premiumEnd <= premiumStart) {
      return { error: 'extra premium intervals require code, non-negative integer bps, and whole-minute ISO start/end timestamps' };
    }
    if (premiumEnd <= startMs || premiumStart >= endMs) continue;
    intervals.push({
      code: premium.code,
      bps: premium.bps,
      startMs: premiumStart,
      endMs: premiumEnd,
      sourceRefs: [...new Set((premium.sourceRefs || []).filter(Boolean).map(String))],
    });
  }
  return { intervals };
}

function segmentPremiumTime({
  start,
  end,
  timeZone,
  holidayDates,
  holidayCalendarId,
  customerPremiums,
  premiumBaseHourlyCents,
  extraPremiums,
  tieBreakOrder = DEFAULT_TIE_BREAK_ORDER,
} = {}) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs
    || startMs % 60000 !== 0 || endMs % 60000 !== 0) {
    return unknown('WHOLE_MINUTE_TIMESTAMPS_REQUIRED', 'start/end must be valid ISO timestamps on whole-minute boundaries with end after start.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  if (!timeZone) {
    return unknown('TIME_ZONE_REQUIRED', 'An IANA assignment-site timeZone is required.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    formatter.format(new Date(startMs));
  } catch (error) {
    return unknown('TIME_ZONE_INVALID', 'timeZone must be a supported IANA time zone.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  if (!Array.isArray(holidayDates) || holidayDates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return unknown('HOLIDAY_CALENDAR_REQUIRED', 'Pass an explicit array of assignment-site holiday dates, including an empty verified array.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  if (!customerPremiums
    || !validateBasisPoints(customerPremiums.nightBps, 2500)
    || !validateBasisPoints(customerPremiums.sundayBps, 5000)
    || !validateBasisPoints(customerPremiums.holidayBps, 10000)) {
    return unknown('CUSTOMER_PREMIUM_RULES_REQUIRED', 'Customer night/Sunday/holiday rates must be explicit integer basis points within GVP caps (2500/5000/10000). Use zero for a verified no-premium declaration.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  if (!Number.isInteger(premiumBaseHourlyCents) || premiumBaseHourlyCents < 0) {
    return unknown('PREMIUM_BASE_RATE_REQUIRED', 'premiumBaseHourlyCents must be a non-negative integer amount.', {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }
  const normalizedExtra = normalizeExtraPremiums(extraPremiums, startMs, endMs);
  if (normalizedExtra.error) {
    return unknown('EXTRA_PREMIUM_INTERVAL_INVALID', normalizedExtra.error, {
      sourceRefs: [PREMIUM_SOURCE],
    });
  }

  const holidaySet = new Set(holidayDates);
  const minuteRows = [];
  const warnings = [];
  let tieDetected = false;

  for (let instantMs = startMs; instantMs < endMs; instantMs += 60000) {
    const local = localMinuteParts(new Date(instantMs), formatter);
    const isNight = local.hour >= 23 || local.hour < 6;
    const isSunday = local.weekday === 'Sun';
    const isHoliday = holidaySet.has(local.date);
    const isSpecialHoliday = (local.date.endsWith('-12-24') || local.date.endsWith('-12-31'))
      && (local.hour > 14 || (local.hour === 14 && local.minute >= 0));
    const candidates = [];
    if (isNight) candidates.push({ code: 'NIGHT', bps: customerPremiums.nightBps, sourceRefs: [PREMIUM_SOURCE] });
    if (isSunday) candidates.push({ code: 'SUNDAY', bps: customerPremiums.sundayBps, sourceRefs: [PREMIUM_SOURCE] });
    if (isHoliday) candidates.push({ code: 'HOLIDAY', bps: customerPremiums.holidayBps, sourceRefs: [PREMIUM_SOURCE] });
    if (isSpecialHoliday) candidates.push({ code: 'HOLIDAY_SPECIAL', bps: customerPremiums.holidayBps, sourceRefs: [PREMIUM_SOURCE] });
    for (const interval of normalizedExtra.intervals) {
      if (intervalContains(interval, instantMs)) {
        candidates.push({ code: interval.code, bps: interval.bps, sourceRefs: interval.sourceRefs });
      }
    }
    const selection = selectHighestPremium({ candidates, tieBreakOrder });
    if (selection.status !== 'OK') return selection;
    if (selection.data.tied) tieDetected = true;
    minuteRows.push({
      startMs: instantMs,
      endMs: instantMs + 60000,
      localDate: local.date,
      candidates: candidates.filter((candidate) => candidate.bps > 0),
      selected: selection.data.selected,
      rejected: selection.data.rejected,
    });
  }

  const segments = [];
  for (const minute of minuteRows) {
    const signature = JSON.stringify({
      candidates: minute.candidates,
      selected: minute.selected,
      rejected: minute.rejected,
      localDate: minute.localDate,
    });
    const previous = segments[segments.length - 1];
    if (previous && previous.signature === signature && previous.endMs === minute.startMs) {
      previous.endMs = minute.endMs;
      previous.minutes += 1;
    } else {
      segments.push({
        signature,
        startMs: minute.startMs,
        endMs: minute.endMs,
        localDate: minute.localDate,
        candidates: minute.candidates,
        selected: minute.selected,
        rejected: minute.rejected,
        minutes: 1,
      });
    }
  }

  const summaryMap = new Map();
  const overlapDecisionMap = new Map();
  for (const segment of segments) {
    if (!segment.selected) continue;
    const key = `${segment.selected.code}:${segment.selected.bps}`;
    const summary = summaryMap.get(key) || {
      code: segment.selected.code,
      bps: segment.selected.bps,
      minutes: 0,
      sourceRefs: new Set(),
    };
    summary.minutes += segment.minutes;
    for (const candidate of segment.candidates) {
      for (const sourceRef of candidate.sourceRefs || []) summary.sourceRefs.add(sourceRef);
    }
    summaryMap.set(key, summary);

    for (const rejected of segment.rejected || []) {
      const decisionKey = `${segment.selected.code}:${segment.selected.bps}>${rejected.code}:${rejected.bps}`;
      const decision = overlapDecisionMap.get(decisionKey) || {
        selectedCode: segment.selected.code,
        selectedBps: segment.selected.bps,
        rejectedCode: rejected.code,
        rejectedBps: rejected.bps,
        minutes: 0,
        sourceRefs: new Set(),
        reason: 'GVP_HIGHEST_ONLY',
      };
      decision.minutes += segment.minutes;
      for (const candidate of [segment.selected, rejected]) {
        for (const sourceRef of candidate.sourceRefs || []) decision.sourceRefs.add(sourceRef);
      }
      overlapDecisionMap.set(decisionKey, decision);
    }
  }
  const overlapDecisions = [...overlapDecisionMap.values()].map((decision) => ({
    ...decision,
    sourceRefs: [...decision.sourceRefs],
  }));
  const wageLines = [...summaryMap.values()].map((summary) => {
    const amountCents = hourlyRateTimesMinutesAndBps(
      premiumBaseHourlyCents,
      summary.minutes,
      summary.bps,
    );
    return {
      code: summary.code,
      bps: summary.bps,
      minutes: summary.minutes,
      premiumBaseHourlyCents,
      amountCents,
      expectedAmountCents: amountCents,
      roundingRule: ROUNDING_RULE,
      sourceRefs: [...summary.sourceRefs],
      overlapDecisions: overlapDecisions.filter((decision) => decision.selectedCode === summary.code
        && decision.selectedBps === summary.bps),
    };
  });
  const expectedAmountCents = wageLines.reduce(
    (sum, wageLine) => sum + wageLine.expectedAmountCents,
    0,
  );

  if (!holidayCalendarId) {
    warnings.push({
      code: 'HOLIDAY_CALENDAR_NOT_VERSIONED',
      message: 'Holiday dates were explicit, but no holidayCalendarId was supplied for audit traceability.',
    });
  }
  if (tieDetected) {
    warnings.push({
      code: 'EQUAL_PREMIUM_TIE_CLASSIFIED_BY_POLICY',
      message: `At least one equal-rate overlap was classified using ${tieBreakOrder.join(' > ')}.`,
    });
  }

  return ok({
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    timeZone,
    holidayCalendarId: holidayCalendarId || null,
    premiumBaseHourlyCents,
    segments: segments.map(({ signature, startMs: segmentStart, endMs: segmentEnd, ...segment }) => ({
      ...segment,
      start: new Date(segmentStart).toISOString(),
      end: new Date(segmentEnd).toISOString(),
    })),
    wageLines,
    overlapDecisions,
    expectedAmountCents,
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [
      'Each elapsed minute was classified in the assignment-site time zone; this remains deterministic across midnight and daylight-saving changes.',
      'Night is 23:00-06:00, Sunday/holiday is local 00:00-24:00, and 24/31 December becomes a holiday-premium interval from 14:00.',
      'Only the highest concurrent positive premium was retained, then cents were rounded once per aggregated wage line.',
    ],
    sourceRefs: [PREMIUM_SOURCE],
    warnings,
  });
}

module.exports = {
  DEFAULT_TIE_BREAK_ORDER,
  selectHighestPremium,
  segmentPremiumTime,
};
