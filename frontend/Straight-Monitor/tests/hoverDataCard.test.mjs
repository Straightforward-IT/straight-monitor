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
