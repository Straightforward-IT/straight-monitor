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
  assert.deepEqual(card.segments.map(segment => [segment.id, segment.value]), [['worked', 18], ['planned', 7], ['remaining', 45]]);
  assert.match(card.sections[1].rows.find(row => row.label === 'Verwendet').value, /25 \/ 70 Tage/);
});

test('earnings card calculates a monthly estimate from hours times hourly rate', () => {
  const card = buildHoverDataCard({ type: 'earnings', workedHours: 12.5, plannedHours: 26.5, hourlyRate: 13.9 });
  assert.equal(card.type, HOVER_DATA_CARD_TYPES.EARNINGS);
  assert.deepEqual(card.metric, { value: 542.1, limit: 603, unit: '€', currency: true });
  assert.equal(card.segments[0].value, 173.75);
  assert.equal(card.segments[1].value, 368.35);
  assert.equal(card.sections[1].rows.find(row => row.label === 'Erreicht').value, '542,10 € / 603,00 €');
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
