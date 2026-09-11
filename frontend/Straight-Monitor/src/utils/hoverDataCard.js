const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = value => Math.max(0, finite(value));

export const HOVER_DATA_CARD_TYPES = Object.freeze({
  HOURS: 'hours',
  DAYS: 'days',
  EARNINGS: 'earnings',
});

export function formatHoverNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatEuro(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function values(data) {
  return {
    workedHours: nonNegative(data.workedHours ?? data.eingesetzteStunden),
    plannedHours: nonNegative(data.plannedHours ?? data.geplanteStunden),
    monthlyHours: nonNegative(data.monthlyHours ?? data.monatsstunden),
    workedDays: nonNegative(data.workedDays ?? data.eingesetzteTage),
    plannedDays: nonNegative(data.plannedDays ?? data.geplanteTage),
    dayLimit: nonNegative(data.dayLimit ?? data.jahresarbeitstage ?? 70),
    hourlyRate: nonNegative(data.hourlyRate ?? data.stundenlohn),
    earningsLimit: nonNegative(data.earningsLimit ?? data.verdienstgrenze ?? 603),
  };
}

function capacitySegments({ worked, planned, limit, unit, remainingLabel = 'Frei' }) {
  const used = worked + planned;
  const remaining = Math.max(0, limit - used);
  const overLimit = Math.max(0, used - limit);
  const segments = [
    { id: 'worked', label: 'Eingesetzt', value: worked, color: '#94a3b8' },
    { id: 'planned', label: 'Geplant', value: planned, color: 'var(--primary)' },
    { id: 'remaining', label: remainingLabel, value: remaining, color: '#62b58f' },
  ];
  if (overLimit > 0) segments.push({ id: 'over-limit', label: 'Über der Grenze', value: overLimit, color: '#dc665e' });
  return { used, remaining, overLimit, segments, unit };
}

function common(data, title) {
  return {
    eyebrow: data.eyebrow || '',
    employeeName: data.employeeName || '',
    title: data.title || title,
  };
}

function hoursView(data) {
  const { workedHours, plannedHours, monthlyHours } = values(data);
  const result = capacitySegments({ worked: workedHours, planned: plannedHours, limit: monthlyHours, unit: 'Std.' });
  return {
    type: HOVER_DATA_CARD_TYPES.HOURS,
    ...common(data, 'Stundenbezogen beschäftigt'),
    metric: { value: result.used, limit: monthlyHours, unit: 'Std.' },
    metadata: data.hourlyRate ?? data.stundenlohn ? [{ label: 'Stundenlohn', value: formatEuro(values(data).hourlyRate) }] : [],
    segments: result.segments,
    sections: [{ label: 'Arbeitszeiten', rows: [
      { label: 'Monatsstunden', value: `${formatHoverNumber(monthlyHours)} Std.` },
      { label: 'Eingesetzt', value: `${formatHoverNumber(workedHours)} Std.`, segment: 'worked' },
      { label: 'Geplant', value: `${formatHoverNumber(plannedHours)} Std.`, segment: 'planned' },
    ] }, { rows: [
      { label: 'Belegt', value: `${formatHoverNumber(result.used)} Std.`, emphasis: true },
      { label: 'Frei', value: `${formatHoverNumber(result.remaining)} Std.`, segment: 'remaining' },
      ...(result.overLimit ? [{ label: 'Über Monatsstunden', value: `${formatHoverNumber(result.overLimit)} Std.`, segment: 'over-limit', emphasis: true }] : []),
    ] }],
  };
}

function daysView(data) {
  const { workedDays, plannedDays, dayLimit } = values(data);
  const result = capacitySegments({ worked: workedDays, planned: plannedDays, limit: dayLimit, unit: 'Tage', remainingLabel: 'Verbleibend' });
  return {
    type: HOVER_DATA_CARD_TYPES.DAYS,
    ...common(data, 'Kurzfristig beschäftigt'),
    metric: { value: result.used, limit: dayLimit, unit: 'Tage' },
    metadata: [{ label: 'Jahresgrenze', value: `${formatHoverNumber(dayLimit, 0)} Arbeitstage` }],
    segments: result.segments,
    sections: [{ label: 'Arbeitstage im Kalenderjahr', rows: [
      { label: 'Eingesetzt', value: `${formatHoverNumber(workedDays, 0)} Tage`, segment: 'worked' },
      { label: 'Geplant', value: `${formatHoverNumber(plannedDays, 0)} Tage`, segment: 'planned' },
    ] }, { rows: [
      { label: 'Verwendet', value: `${formatHoverNumber(result.used, 0)} / ${formatHoverNumber(dayLimit, 0)} Tage`, emphasis: true },
      { label: 'Verbleibend', value: `${formatHoverNumber(result.remaining, 0)} Tage`, segment: 'remaining' },
      ...(result.overLimit ? [{ label: 'Über Jahresgrenze', value: `${formatHoverNumber(result.overLimit, 0)} Tage`, segment: 'over-limit', emphasis: true }] : []),
    ] }],
  };
}

function earningsView(data) {
  const { workedHours, plannedHours, hourlyRate, earningsLimit } = values(data);
  const workedEarnings = workedHours * hourlyRate;
  const plannedEarnings = plannedHours * hourlyRate;
  const result = capacitySegments({ worked: workedEarnings, planned: plannedEarnings, limit: earningsLimit, unit: '€', remainingLabel: 'Verbleibend' });
  return {
    type: HOVER_DATA_CARD_TYPES.EARNINGS,
    ...common(data, 'Geringfügig beschäftigt'),
    metric: { value: result.used, limit: earningsLimit, unit: '€', currency: true },
    metadata: [{ label: 'Stundenlohn', value: formatEuro(hourlyRate) }, { label: 'Verdienstgrenze', value: formatEuro(earningsLimit) }],
    segments: result.segments,
    sections: [{ label: 'Monatsstunden', rows: [
      { label: 'Eingesetzt', value: `${formatHoverNumber(workedHours)} Std.` },
      { label: 'Geplant', value: `${formatHoverNumber(plannedHours)} Std.` },
    ] }, { label: 'Voraussichtlicher Monatsverdienst', rows: [
      { label: 'Eingesetzt', value: formatEuro(workedEarnings), segment: 'worked' },
      { label: 'Geplant', value: formatEuro(plannedEarnings), segment: 'planned' },
      { label: 'Erreicht', value: `${formatEuro(result.used)} / ${formatEuro(earningsLimit)}`, emphasis: true },
      { label: 'Verbleibend', value: formatEuro(result.remaining), segment: 'remaining' },
      ...(result.overLimit ? [{ label: 'Über Verdienstgrenze', value: formatEuro(result.overLimit), segment: 'over-limit', emphasis: true }] : []),
    ] }],
  };
}

/**
 * Turns monthly time facts into one of the three card views. Legacy presentation
 * objects with `segments` remain usable while downstream callers migrate.
 */
export function buildHoverDataCard(data = {}) {
  if (Array.isArray(data.segments) && !data.type) {
    const total = data.segments.reduce((sum, segment) => sum + nonNegative(segment.value), 0);
    return {
      ...data,
      type: HOVER_DATA_CARD_TYPES.HOURS,
      metric: data.metric || { value: total, limit: total, unit: data.unit || 'Std.' },
    };
  }
  switch (data.type || HOVER_DATA_CARD_TYPES.HOURS) {
    case HOVER_DATA_CARD_TYPES.DAYS: return daysView(data);
    case HOVER_DATA_CARD_TYPES.EARNINGS: return earningsView(data);
    case HOVER_DATA_CARD_TYPES.HOURS:
    default: return hoursView(data);
  }
}
