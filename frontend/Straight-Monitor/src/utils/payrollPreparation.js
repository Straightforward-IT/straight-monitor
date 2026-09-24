// An allowlist is intentional: a UI balance can never enter a saved payload.
export function preparationInput(item) {
  const base = { id: item.id, kind: item.kind, reason: item.reason };
  if (item.kind === 'ABSENCE') return { ...base, code: item.code, startDate: item.startDate, endDate: item.endDate, daily: item.daily.map(d => ({ date: d.date, minutes: d.minutes })) };
  if (item.kind === 'TRANSFER') return { ...base, date: item.date, minutes: item.minutes, source: item.source, target: item.target };
  return { ...base, date: item.date, minutes: item.minutes, source: item.source || '' };
}
export function absenceDays(start, end, previous = []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return [];
  const result = [], cursor = new Date(`${start}T12:00:00Z`);
  while (Number.isFinite(+cursor) && cursor.toISOString().slice(0, 10) <= end && result.length < 367) {
    const date = cursor.toISOString().slice(0, 10);
    result.push({ date, minutes: previous.find(d => d.date === date)?.minutes ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
export function preparationCalendar(items, inherited, month, types) {
  return [...items, ...inherited].flatMap(item => {
    if (item.kind !== 'ABSENCE') return [];
    const type = types.find(t => t.code === item.code);
    return item.daily.filter(d => d.date.startsWith(month)).map(day => ({
      id: `${item.id}:${day.date}`, date: day.date, code: item.code, kind: type?.kind || 'absence',
      minutes: day.minutes, originalMinutes: day.minutes, credited: item.credited ?? type?.credited ?? false,
      label: item.label || type?.label || item.code, source: item.originMonth ? `Fehlzeit ab ${item.originMonth}` : 'Monatsvorbereitung',
    }));
  });
}
export function sourceLabel(source) {
  return `${source.values.date} · Auftrag ${source.auftragNr} · ${source.values.netMinutes} Min.`;
}
