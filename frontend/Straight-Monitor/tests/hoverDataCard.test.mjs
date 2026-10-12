import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHoverDataCard, formatEuro, HOVER_DATA_CARD_TYPES } from '../src/utils/hoverDataCard.js';

test('hours card derives worked, planned and remaining monthly hours', () => {
  const card = buildHoverDataCard({ type: 'hours', monthlyHours: 108.25, workedHours: 11.25, plannedHours: 94, hourlyRate: 16 });
  assert.equal(card.type, HOVER_DATA_CARD_TYPES.HOURS);
  assert.deepEqual(card.metric, { value: 105.25, limit: 108.25, unit: 'Std.' });
  assert.deepEqual(card.segments.map(segment => [segment.id, segment.value]), [['worked', 11.25], ['planned', 94], ['remaining', 3]]);
  assert.equal(card.metadata[0].value, '16,00 €');
});

test('short-term card compares worked and planned calendar-year days with 70 days', () => {
  const card = buildHoverDataCard({ type: 'days', workedDays: 18, plannedDays: 7 });
  assert.equal(card.type, HOVER_DATA_CARD_TYPES.DAYS);
  assert.deepEqual(card.metric, { value: 25, limit: 70, unit: 'Tage' });
  assert.deepEqual(card.segments.map(segment => [segment.id, segment.value]), [['prior-employer', 0], ['worked', 18], ['planned', 7], ['remaining', 45]]);
  assert.deepEqual(card.sections[1].rows.map(row => row.label), ['Verbleibend', 'Verwendet']);
  assert.match(card.sections[1].rows.find(row => row.label === 'Verwendet').value, /25 \/ 70 Tage/);
});

test('prior-employer days consume the same annual allowance as current assignments', () => {
  const card = buildHoverDataCard({ type: 'days', priorEmployerDays: 10, workedDays: 18, plannedDays: 7 });
  assert.equal(card.metric.value, 35);
  assert.equal(card.segments.find(segment => segment.id === 'remaining').value, 35);
  assert.equal(card.segments.find(segment => segment.id === 'prior-employer').color, '#c58a29');
  assert.notEqual(card.segments.find(segment => segment.id === 'prior-employer').color, card.segments.find(segment => segment.id === 'worked').color);
  assert.equal(card.sections[0].rows.find(row => row.label === 'Vorarbeitgeber').value, '10 Tage');
});

test('short-term card identifies an entry-based reporting period', () => {
  const card = buildHoverDataCard({ type: 'days', periodLabel: 'seit Eintritt am 15.11.2025' });
  assert.equal(card.sections[0].label, 'Arbeitstage seit Eintritt am 15.11.2025');
});

test('earnings card calculates a monthly estimate from hours times hourly rate', () => {
  const card = buildHoverDataCard({ type: 'earnings', workedHours: 12.5, plannedHours: 26.5, hourlyRate: 13.9 });
  assert.equal(card.type, HOVER_DATA_CARD_TYPES.EARNINGS);
  assert.deepEqual(card.metric, { value: 542.1, limit: 603, unit: '€', currency: true });
  assert.equal(card.segments[0].value, 173.75);
  assert.equal(card.segments[1].value, 368.35);
  assert.deepEqual(card.sections.map(section => section.label), ['Voraussichtlicher Monatsverdienst', 'Monatsstunden']);
  assert.equal(card.sections[0].rows.find(row => row.label === 'Erreicht').value, '542,10 € / 603,00 €');
});

test('overages are marked separately for every type', () => {
  for (const data of [
    { type: 'hours', monthlyHours: 10, workedHours: 6, plannedHours: 6 },
    { type: 'days', dayLimit: 70, workedDays: 69, plannedDays: 2 },
    { type: 'earnings', earningsLimit: 603, hourlyRate: 20, workedHours: 20, plannedHours: 20 },
  ]) {
    const card = buildHoverDataCard(data);
    assert.ok(card.segments.find(segment => segment.id === 'over-limit')?.value > 0);
  }
});

test('bad values become zero and legacy presentation data remains usable', () => {
  const card = buildHoverDataCard({ type: 'earnings', workedHours: -4, plannedHours: 'nope', hourlyRate: null, earningsLimit: -1 });
  assert.deepEqual(card.metric, { value: 0, limit: 0, unit: '€', currency: true });
  const legacy = buildHoverDataCard({ unit: 'Std.', segments: [{ id: 'x', value: 4, color: '#000' }] });
  assert.equal(legacy.metric.value, 4);
  assert.equal(legacy.metric.limit, 4);
  assert.equal(formatEuro(603), '603,00 €');
});

test('combined card preserves independently priced money and a separate day view', () => {
  const card = buildHoverDataCard({ type: 'days-earnings', workedDays: 69, plannedDays: 2, workedHours: 1, plannedHours: 2,
    workedEarnings: '400.00', plannedEarnings: '250.00', totalEarnings: '650.00', earningsStatus: 'RESOLVED' });
  assert.deepEqual(card.panels.map(panel => panel.type), ['days', 'earnings']);
  const days = buildHoverDataCard(card.panels[0]), earnings = buildHoverDataCard(card.panels[1]);
  assert.equal(days.metric.value, 71);
  assert.equal(days.segments.find(segment => segment.id === 'over-limit').value, 1);
  assert.equal(earnings.metric.value, 650);
  assert.equal(earnings.segments.find(segment => segment.id === 'over-limit').value, 47);
  assert.ok(!earnings.metadata.some(row => row.label === 'Stundenlohn'));
});

test('incomplete money is never normalized to a zero forecast', () => {
  const card = buildHoverDataCard({ type: 'earnings', earningsStatus: 'UNRESOLVED', workedEarnings: null, plannedEarnings: null,
    issues: [{ message: '2026-10-01: ÜTZ ist mehrdeutig.' }] });
  assert.equal(card.type, 'notice');
  assert.equal(card.metric, undefined);
  assert.equal(card.issues.length, 1);
});

test('authoritative month total retains final rounding across worked and planned subtotals', () => {
  const card = buildHoverDataCard({ type: 'earnings', earningsStatus: 'RESOLVED', workedEarnings: '0.34', plannedEarnings: '0.34', totalEarnings: '0.67' });
  assert.equal(card.metric.value, 0.67);
});

test('days-hours card keeps independent day and monthly hour allowances', () => {
  const card = buildHoverDataCard({ type: 'days-hours', workedDays: 69, plannedDays: 2, monthlyHours: 100, workedHours: 60, plannedHours: 30, hoursStatus: 'RESOLVED' });
  assert.deepEqual(card.panels.map(panel => panel.type), ['days', 'hours']);
  const days = buildHoverDataCard(card.panels[0]), hours = buildHoverDataCard(card.panels[1]);
  assert.equal(days.metric.value, 71);
  assert.equal(hours.metric.value, 90);
  assert.equal(hours.segments.find(segment => segment.id === 'remaining').value, 10);
});

test('missing monthly hours remain unknown while the day panel stays available', () => {
  const card = buildHoverDataCard({ type: 'days-hours', workedDays: 12, monthlyHours: null, hoursStatus: 'UNRESOLVED',
    hoursIssues: [{ message: 'Monatsstunden fehlen.' }] });
  assert.equal(buildHoverDataCard(card.panels[0]).metric.value, 12);
  assert.equal(buildHoverDataCard(card.panels[1]).type, 'notice');
  assert.equal(buildHoverDataCard(card.panels[1]).metric, undefined);
});

test('imported monthly hours replace assignment forecasts and include every recorded code', () => {
  const card = buildHoverDataCard({ type: 'hours', title: 'Festangestellt', workedHours: 131.5, plannedHours: 20,
    importedHours: { total: '129', limit: '129.9', byCode: [
      { kb: '', label: 'Produktive Stunden', hours: '123', days: 19 },
      { kb: 'FS', label: 'FS · Tageskennzeichnung', hours: '0', days: 11 },
      { kb: 'FA', label: 'Freizeitausgleich', hours: '6', days: 1 },
    ] } });
  assert.equal(card.metric.value, 129);
  assert.equal(card.metric.valueDisplay, '129,00');
  assert.equal(card.metric.limitDisplay, '129,90');
  assert.equal(card.segments.find(segment => segment.id === 'remaining').value, 0.9);
  assert.equal(card.segments.find(segment => segment.id === 'over-limit'), undefined);
  assert.match(card.sections[1].rows[1].value, /0,00 Std\. · 11 Tage/);
  assert.equal(card.sections[1].rows[1].label, 'FS · Tageskennzeichnung');
  assert.match(card.sections[1].rows[2].value, /6,00 Std\. · 1 Tag/);
  assert.equal(card.note, undefined);
  assert.ok(!card.sections.flatMap(section => section.rows).some(row => ['Eingesetzt', 'Geplant', 'Belegt'].includes(row.label)));
});

test('unlimited imported overview stays available without monthly quota or resolved payroll wages', () => {
  const card = buildHoverDataCard({ type: 'hours', hoursStatus: 'UNRESOLVED', importedHours: { total: '1.004999999999999999', limit: null,
    byCode: [{ kb: '', label: 'Produktive Stunden', hours: '1.004999999999999999', days: 1 },
      { kb: 'FS', label: 'Tageskennzeichnung', hours: null, days: 2 },
      { kb: 'ZZ', label: 'Zuordnung offen', hours: '0', days: 1, kind: 'unresolved' }] } });
  assert.equal(card.type, 'hours');
  assert.equal(card.metric.limit, null);
  assert.equal(card.metric.valueDisplay, '1,00');
  assert.equal(card.metric.limitDisplay, null);
  assert.equal(card.segments.find(segment => segment.id === 'remaining'), undefined);
  assert.equal(card.segments.find(segment => segment.id === 'over-limit'), undefined);
  assert.equal(card.segments.find(segment => segment.id === 'kb-ZZ').color, '#d9a441');
  assert.match(card.sections[1].rows[1].value, /— Std\. · 2 Tage/);
  assert.ok(!card.sections.flatMap(section => section.rows).some(row => row.label === 'Monats-Sollstunden'));
});

test('signed imported corrections preserve the exact net balance and all original breakdown values', () => {
  const card = buildHoverDataCard({ type: 'hours', importedHours: { total: '8', limit: '10', byCode: [
    { kb: '', label: 'Produktive Stunden', hours: '10', days: 2 }, { kb: 'FA', label: 'Korrektur', hours: '-2', days: 1 },
  ] } });
  assert.equal(card.metric.value, 8);
  assert.equal(card.segments.find(segment => segment.id === 'kb-FA').value, -2);
  assert.equal(card.diagramSegments[0].value, 8);
  assert.equal(card.diagramSegments[0].label, 'Saldo der erfassten Stunden');
  assert.match(card.sections[1].rows[1].value, /-2,00 Std\./);
  assert.equal(card.diagramSegments.find(segment => segment.id === 'remaining').role, 'remaining');
  const negative = buildHoverDataCard({ type: 'hours', importedHours: { total: '-2', limit: null, byCode: [{ kb: '', label: 'Korrektur', hours: '-2', days: 1 }] } });
  assert.equal(negative.metric.valueDisplay, '-2,00');
  assert.equal(negative.diagramSegments[0].value, 0);
});

test('combined day and imported-hour cards keep the day allowance and replace only the hourly panel', () => {
  const card = buildHoverDataCard({ type: 'days-hours', workedDays: 12, importedHours: { total: '20', limit: '15', byCode: [] } });
  assert.equal(card.panels[1].title, 'Erfasste Stunden');
  assert.equal(buildHoverDataCard(card.panels[0]).metric.value, 12);
  const hours = buildHoverDataCard(card.panels[1]);
  assert.equal(hours.metric.value, 20);
  assert.equal(hours.sections.at(-1).rows.find(row => row.label === 'Überschreitung').value, '5,00 Std.');
});

test('corrections above the monthly allowance mark overage without adding it to consumption again', () => {
  const card = buildHoverDataCard({ type: 'hours', importedHours: { total: '12', limit: '10', byCode: [
    { kb: '', label: 'Produktive Stunden', hours: '15', days: 2 }, { kb: 'FA', label: 'Korrektur', hours: '-3', days: 1 },
  ] } });
  const overage = card.diagramSegments.find(segment => segment.id === 'over-limit');
  assert.equal(overage.value, 2);
  assert.equal(overage.role, 'over');
  assert.equal(card.diagramSegments.find(segment => segment.id === 'remaining').role, 'remaining');
  assert.equal(card.diagramSegments.filter(segment => segment.role !== 'over').reduce((sum, segment) => sum + segment.value, 0), 12);
});
