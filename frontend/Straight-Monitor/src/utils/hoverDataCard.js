import { formatImportedHours, sumImportedHours } from './importedHours.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = value => Math.max(0, finite(value));

export const HOVER_DATA_CARD_TYPES = Object.freeze({
  HOURS: 'hours',
  DAYS: 'days',
  EARNINGS: 'earnings',
  DAYS_EARNINGS: 'days-earnings',
  DAYS_HOURS: 'days-hours',
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
    priorEmployerDays: nonNegative(data.priorEmployerDays ?? data.vorarbeitgebertage),
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
    issues: data.issues || [],
  };
}

function importedHoursView(data) {
  const imported = data.importedHours;
  const total = String(imported.total ?? '0');
  const limit = imported.limit != null && imported.limit !== '' && Number.isFinite(Number(imported.limit)) && Number(imported.limit) >= 0
    ? String(imported.limit) : null;
  const breakdown = imported.byCode || [];
  const segments = breakdown.map(row => {
    const prefix = `${row.kb || 'P'} · `;
    const label = row.label || (row.kb ? 'Kennzeichen' : 'Produktive Stunden');
    return {
      id: `kb-${row.kb || 'productive'}`,
      label: label.startsWith(prefix) ? label : `${prefix}${label}`,
      value: finite(row.hours),
      valueDisplay: formatImportedHours(row.hours, 2),
      color: row.kind === 'unresolved' ? '#d9a441' : row.kb === 'FS' ? '#69b4b2' : row.kb ? '#a694cf' : '#94a3b8',
    };
  });
  const sections = [{ rows: [{ label: 'Erfasste Stunden', value: `${formatImportedHours(total, 2)} Std.`, emphasis: true }] }, {
    label: 'Erfasste Stunden nach Kennzeichen', rows: breakdown.map((row, index) => ({
      label: segments[index].label,
      value: `${formatImportedHours(row.hours, 2)} Std. · ${row.days ?? 0} ${(row.days ?? 0) === 1 ? 'Tag' : 'Tage'}`,
      segment: segments[index].id,
    })),
  }];
  if (limit !== null) {
    const difference = sumImportedHours([limit, total.startsWith('-') ? total.slice(1) : `-${total.replace(/^\+/, '')}`]);
    const exceedsLimit = difference.startsWith('-');
    const remaining = exceedsLimit ? '0' : difference;
    const overLimit = exceedsLimit ? difference.slice(1) : '0';
    segments.push({ id: 'remaining', label: 'Verbleibend', value: finite(remaining), valueDisplay: formatImportedHours(remaining, 2), color: '#62b58f' });
    if (exceedsLimit) segments.push({ id: 'over-limit', label: 'Überschreitung', value: finite(overLimit), valueDisplay: formatImportedHours(overLimit, 2), color: '#dc665e' });
    sections.push({ rows: [
      { label: 'Monats-Sollstunden', value: `${formatImportedHours(limit, 2)} Std.` },
      { label: 'Verbleibend', value: `${formatImportedHours(remaining, 2)} Std.`, segment: 'remaining' },
      ...(exceedsLimit ? [{ label: 'Überschreitung', value: `${formatImportedHours(overLimit, 2)} Std.`, segment: 'over-limit', emphasis: true }] : []),
    ] });
  }
  // Signed corrections remain visible in the breakdown. A separate net segment
  // prevents a positive-only chart from overstating the imported total.
  const hasCorrections = segments.some(segment => segment.value < 0) || finite(total) < 0;
  return {
    type: HOVER_DATA_CARD_TYPES.HOURS, ...common(data, 'Erfasste Stunden'),
    metric: { value: finite(total), limit: limit === null ? null : finite(limit), unit: 'Std.', valueDisplay: formatImportedHours(total, 2), limitDisplay: limit === null ? null : formatImportedHours(limit, 2) },
    metadata: [], segments, sections,
    ...(hasCorrections ? {
      diagramSegments: [{ id: 'net-hours', label: 'Saldo der erfassten Stunden', value: Math.max(0, finite(total)), valueDisplay: formatImportedHours(total, 2), color: '#94a3b8' }, ...segments.filter(segment => ['remaining', 'over-limit'].includes(segment.id))],
      note: 'Das Diagramm zeigt den Saldo. Negative Stundenkorrekturen stehen in der Aufschlüsselung.',
    } : {}),
  };
}

function hoursView(data) {
  if (data.importedHours) return importedHoursView(data);
  if (data.hoursStatus === 'UNRESOLVED') return {
    type: 'notice', ...common(data, 'Monatsstunden'),
    note: 'Klärung erforderlich. Das Stundenkontingent kann nicht vollständig berechnet werden.',
    metadata: [], segments: [], sections: [],
  };
  const { workedHours, plannedHours, monthlyHours } = values(data);
  const result = capacitySegments({ worked: workedHours, planned: plannedHours, limit: monthlyHours, unit: 'Std.' });
  return {
    type: HOVER_DATA_CARD_TYPES.HOURS,
    ...common(data, 'Stundenbezogen beschäftigt'),
    note: 'Berechnung mit Soll-Stunden, produktive Stunden werden hier noch nicht erfasst.',
    metric: { value: result.used, limit: monthlyHours, unit: 'Std.' },
    metadata: data.hourlyRate ?? data.stundenlohn ? [{ label: 'Stundenlohn', value: formatEuro(values(data).hourlyRate) }] : [],
    segments: result.segments,
    sections: [{ label: 'Arbeitszeiten', rows: [
      { label: 'Monatsstunden', value: `${formatHoverNumber(monthlyHours)} Std.` },
      { label: 'Eingesetzt', value: `~${formatHoverNumber(workedHours)} Std.`, segment: 'worked' },
      { label: 'Geplant', value: `${formatHoverNumber(plannedHours)} Std.`, segment: 'planned' },
    ] }, { rows: [
      { label: 'Belegt', value: `${formatHoverNumber(result.used)} Std.`, emphasis: true },
      { label: 'Frei', value: `${formatHoverNumber(result.remaining)} Std.`, segment: 'remaining' },
      ...(result.overLimit ? [{ label: 'Über Monatsstunden', value: `${formatHoverNumber(result.overLimit)} Std.`, segment: 'over-limit', emphasis: true }] : []),
    ] }],
  };
}

function daysView(data) {
  const { priorEmployerDays, workedDays, plannedDays, dayLimit } = values(data);
  const result = capacitySegments({ worked: priorEmployerDays + workedDays, planned: plannedDays, limit: dayLimit, unit: 'Tage', remainingLabel: 'Verbleibend' });
  result.segments.splice(0, 1, { id: 'prior-employer', label: 'Vorarbeitgeber', value: priorEmployerDays, color: '#c58a29' }, { id: 'worked', label: 'Eingesetzt', value: workedDays, color: '#94a3b8' });
  return {
    type: HOVER_DATA_CARD_TYPES.DAYS,
    ...common(data, 'Kurzfristig beschäftigt'),
    metric: { value: result.used, limit: dayLimit, unit: 'Tage' },
    metadata: [{ label: 'Jahresgrenze', value: `${formatHoverNumber(dayLimit, 0)} Arbeitstage` }],
    segments: result.segments,
    sections: [{ label: data.periodLabel ? `Arbeitstage ${data.periodLabel}` : 'Arbeitstage im Kalenderjahr', rows: [
      { label: 'Vorarbeitgeber', value: `${formatHoverNumber(priorEmployerDays, 0)} Tage`, segment: 'prior-employer' },
      { label: 'Eingesetzt', value: `${formatHoverNumber(workedDays, 0)} Tage`, segment: 'worked' },
      { label: 'Geplant', value: `${formatHoverNumber(plannedDays, 0)} Tage`, segment: 'planned' },
    ] }, { rows: [
      { label: 'Verbleibend', value: `${formatHoverNumber(result.remaining, 0)} Tage`, segment: 'remaining' },
      { label: 'Verwendet', value: `${formatHoverNumber(result.used, 0)} / ${formatHoverNumber(dayLimit, 0)} Tage`, emphasis: true },
      ...(result.overLimit ? [{ label: 'Über Jahresgrenze', value: `${formatHoverNumber(result.overLimit, 0)} Tage`, segment: 'over-limit', emphasis: true }] : []),
    ] }],
  };
}

function earningsView(data) {
  const { workedHours, plannedHours, hourlyRate, earningsLimit } = values(data);
  if (data.earningsStatus === 'UNRESOLVED') return {
    type: 'notice', ...common(data, 'Verdienstprognose'),
    note: 'Klärung erforderlich. Die Verdienstprognose kann nicht vollständig berechnet werden.',
    metadata: [{ label: 'Verdienstgrenze pro Monat', value: formatEuro(earningsLimit) }],
    segments: [], sections: [],
  };
  const workedEarnings = data.workedEarnings !== undefined ? nonNegative(data.workedEarnings) : workedHours * hourlyRate;
  const plannedEarnings = data.plannedEarnings !== undefined ? nonNegative(data.plannedEarnings) : plannedHours * hourlyRate;
  const result = capacitySegments({ worked: workedEarnings, planned: plannedEarnings, limit: earningsLimit, unit: '€', remainingLabel: 'Verbleibend' });
  if (data.totalEarnings !== undefined) {
    result.used = nonNegative(data.totalEarnings);
    result.remaining = Math.max(0, earningsLimit - result.used);
    result.overLimit = Math.max(0, result.used - earningsLimit);
    result.segments = result.segments.filter(segment => segment.id !== 'over-limit').map(segment => segment.id === 'remaining' ? { ...segment, value: result.remaining } : segment);
    if (result.overLimit) result.segments.push({ id: 'over-limit', label: 'Über der Grenze', value: result.overLimit, color: '#dc665e' });
  }
  return {
    type: HOVER_DATA_CARD_TYPES.EARNINGS,
    ...common(data, 'Geringfügig beschäftigt'),
    metric: { value: result.used, limit: earningsLimit, unit: '€', currency: true },
    metadata: [...(data.workedEarnings === undefined ? [{ label: 'Stundenlohn', value: formatEuro(hourlyRate) }] : []), { label: 'Verdienstgrenze', value: formatEuro(earningsLimit) }],
    note: data.workedEarnings !== undefined ? 'Prognose aus Einsatz-Sollstunden × (Tariflohn + ÜTZ) am jeweiligen Einsatzdatum. Keine Ist-Stunden.' : undefined,
    segments: result.segments,
    sections: [{ label: 'Voraussichtlicher Monatsverdienst', rows: [
      { label: 'Eingesetzt', value: formatEuro(workedEarnings), segment: 'worked' },
      { label: 'Geplant', value: formatEuro(plannedEarnings), segment: 'planned' },
      { label: 'Erreicht', value: `${formatEuro(result.used)} / ${formatEuro(earningsLimit)}`, emphasis: true },
      { label: 'Verbleibend', value: formatEuro(result.remaining), segment: 'remaining' },
      ...(result.overLimit ? [{ label: 'Über Verdienstgrenze', value: formatEuro(result.overLimit), segment: 'over-limit', emphasis: true }] : []),
    ] }, { label: 'Monatsstunden', rows: [
      { label: 'Eingesetzt', value: `${formatHoverNumber(workedHours)} Std.` },
      { label: 'Geplant', value: `${formatHoverNumber(plannedHours)} Std.` },
    ] }],
  };
}

// `used` segments fill the ring, `remaining` is drawn faint, `over` is already part of the
// total and only drives the outer overage arc plus its legend row.
const SEGMENT_ROLES = { remaining: 'remaining', over: 'over', 'over-limit': 'over' };

function withSegmentRoles(view) {
  return {
    ...view,
    segments: (view.segments || []).map(segment => ({ ...segment, role: segment.role || SEGMENT_ROLES[segment.id] || 'used' })),
    ...(view.diagramSegments ? { diagramSegments: view.diagramSegments.map(segment => ({ ...segment, role: segment.role || SEGMENT_ROLES[segment.id] || 'used' })) } : {}),
  };
}

function resolveView(data) {
  if (Array.isArray(data.segments) && !data.type) {
    const total = data.segments.reduce((sum, segment) => sum + nonNegative(segment.value), 0);
    return {
      ...data,
      type: HOVER_DATA_CARD_TYPES.HOURS,
      metric: data.metric || { value: total, limit: total, unit: data.unit || 'Std.' },
    };
  }
  switch (data.type || HOVER_DATA_CARD_TYPES.HOURS) {
    case 'notice': return { ...common(data, 'Tarifkontingent'), type: 'notice', note: data.note, metadata: data.metadata || [], segments: [], sections: [] };
    case HOVER_DATA_CARD_TYPES.DAYS_EARNINGS: return {
      ...common(data, 'Tages- und Verdienstkontingent'), type: HOVER_DATA_CARD_TYPES.DAYS_EARNINGS,
      panels: [
        { ...data, type: 'days', title: 'Arbeitstage', employeeName: '', eyebrow: '', group: null, issues: [] },
        { ...data, type: 'earnings', title: 'Verdienstprognose', employeeName: '', eyebrow: '', group: null },
      ], segments: [], sections: [],
    };
    case HOVER_DATA_CARD_TYPES.DAYS_HOURS: return {
      ...common(data, 'Tages- und Stundenkontingent'), type: HOVER_DATA_CARD_TYPES.DAYS_HOURS,
      panels: [
        { ...data, type: 'days', title: 'Arbeitstage', employeeName: '', eyebrow: '', group: null, fallbackReason: null, issues: [] },
        { ...data, type: 'hours', title: data.importedHours ? 'Erfasste Stunden' : 'Monatsstunden', employeeName: '', eyebrow: '', group: null, fallbackReason: null, issues: data.hoursIssues || [] },
      ], segments: [], sections: [],
    };
    case HOVER_DATA_CARD_TYPES.DAYS: return daysView(data);
    case HOVER_DATA_CARD_TYPES.EARNINGS: return earningsView(data);
    case HOVER_DATA_CARD_TYPES.HOURS:
    default: return hoursView(data);
  }
}

/**
 * Turns time facts into single or combined quota views. Legacy presentation
 * objects with `segments` remain usable while downstream callers migrate.
 */
export function buildHoverDataCard(data = {}) {
  return withSegmentRoles(resolveView(data));
}
