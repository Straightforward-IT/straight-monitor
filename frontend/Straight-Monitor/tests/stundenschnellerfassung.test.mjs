import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeQuickEntry, buildQuickEntryRows, createQuickEntry, formatHours, minimumRestBreakMinutes, plannedTimes } from '../src/utils/stundenschnellerfassung.js';
import { createStundenschnellerfassungDemo } from '../src/components/dev/stundenschnellerfassungDemo.js';

const analyze = values => analyzeQuickEntry(createQuickEntry({ _id: 'assignment' }, values));

test('dated office preview accounts for Berlin clock changes and rejects ambiguous clocks', () => {
  const row = createQuickEntry({ _id: 'a' }, { start: '00:00', end: '04:00', breakMinutes: 30 });
  assert.equal(analyzeQuickEntry(row, '2020-10-25').netMinutes, 270);
  assert.equal(analyzeQuickEntry(row, '2020-03-29').netMinutes, 150);
  row.start = '02:30';
  assert.equal(analyzeQuickEntry(row, '2020-10-25').complete, false);
});

test('reference fixture projects one row per assignment and starts at 24 hours', () => {
  const fixture = createStundenschnellerfassungDemo();
  const rows = buildQuickEntryRows(fixture.auftrag, fixture.einsaetze);
  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map(row => row._id)).size, 6);
  const minutes = fixture.zeiten.reduce((sum, entry) => sum + analyze(entry).netMinutes, 0);
  assert.equal(minutes, 1440);
  assert.equal(formatHours(minutes), '24,00');
});

test('row projection filters by order without requiring shift details', () => {
  const assignments = [
    { _id: 'later', auftragNr: 1, detailDatumVon: '2026-09-09', uhrzeitVon: '10:00' },
    { _id: 'other', auftragNr: 2, detailDatumVon: '2026-09-08' },
    { _id: 'early', auftragNr: 1, detailDatumVon: '2026-09-08', uhrzeitVon: '12:00' },
  ];
  assert.deepEqual(buildQuickEntryRows({ auftragNr: 1 }, assignments).map(row => row._id), ['early', 'later']);
});

test('night shift subtracts only unpaid break minutes', () => {
  const result = analyze({ start: '17:00', end: '04:00', breakMinutes: 60, paidBreakMinutes: 15 });
  assert.equal(result.complete, true);
  assert.equal(result.overnight, true);
  assert.equal(result.grossMinutes, 660);
  assert.equal(result.netMinutes, 615);
  assert.equal(formatHours(result.netMinutes), '10,25');
});

test('insufficient statutory rest breaks warn without blocking a valid capture', () => {
  const insufficient = analyze({ start: '10:00', end: '18:00', breakMinutes: 0 });
  assert.equal(insufficient.complete, true);
  assert.equal(insufficient.minimumRestBreakMinutes, 30);
  assert.equal(insufficient.warnings.length, 1);
  assert.match(insufficient.warnings[0], /mindestens 30 Minuten Ruhepause/);
  assert.deepEqual(analyze({ start: '10:00', end: '18:30', breakMinutes: 30 }).warnings, []);
  assert.equal(minimumRestBreakMinutes(9 * 60 + 1), 45);
  assert.equal(analyze({ start: '08:00', end: '19:00', breakMinutes: 45 }).warnings.length, 1);
});

test('three timed breaks work across midnight without double-counting manual totals', () => {
  const result = analyze({ start: '17:00', end: '04:00', breakMinutes: 999, paidBreakMinutes: 999, breaks: [
    { start: '20:00', end: '20:15', paid: false },
    { start: '23:45', end: '00:15', paid: true },
    { start: '02:00', end: '02:15', paid: false },
  ] });
  assert.equal(result.complete, true);
  assert.equal(result.breakMinutes, 60);
  assert.equal(result.paidBreakMinutes, 30);
  assert.equal(result.netMinutes, 630);
});

test('incomplete, overlapping, reversed and out-of-shift breaks cannot produce accepted hours', () => {
  for (const breaks of [
    [{ start: '18:00', end: '' }],
    [{ start: '18:00', end: '19:00' }, { start: '18:30', end: '19:30' }],
    [{ start: '18:30', end: '18:00' }],
    [{ start: '03:30', end: '04:30' }],
    [{ start: '18:00', end: '18:00' }],
  ]) {
    const result = analyze({ start: '17:00', end: '04:00', breaks });
    assert.equal(result.complete, false);
    assert.ok(result.errors.length > 0);
    assert.equal(result.netMinutes, 0);
  }
});

test('adjacent breaks do not overlap and midnight end is handled correctly', () => {
  const result = analyze({ start: '17:00', end: '00:00', breaks: [{ start: '22:00', end: '22:15' }, { start: '22:15', end: '22:30' }] });
  assert.equal(result.complete, true);
  assert.equal(result.netMinutes, 390);
});

test('invalid minutes and paid totals block submission', () => {
  for (const values of [
    { breakMinutes: -1 }, { breakMinutes: 1.5 }, { breakMinutes: 400 },
    { breakMinutes: 30, paidBreakMinutes: 31 }, { paidBreakMinutes: -2 }, { breakMinutes: 'abc' },
  ]) {
    assert.equal(analyze({ start: '10:00', end: '16:00', ...values }).complete, false);
  }
});

test('blank rows stay open; incomplete and equal times are invalid', () => {
  assert.equal(analyze({}).empty, true);
  assert.deepEqual(analyze({}).errors, []);
  for (const values of [{ start: '10:00' }, { start: '24:00', end: '16:00' }, { start: '10:00', end: '10:00' }, { breakMinutes: 30 }]) {
    const result = analyze(values);
    assert.equal(result.empty, false);
    assert.equal(result.complete, false);
    assert.ok(result.errors.length > 0);
  }
});

test('drafts clone their source and planned values use imported assignment times', () => {
  const source = { start: '10:00', breaks: [{ start: '12:00', end: '12:15', paid: true }] };
  const draft = createQuickEntry({ _id: 'a' }, source);
  draft.breaks[0].start = '13:00';
  assert.equal(source.breaks[0].start, '12:00');
  assert.equal(draft.breaks.length, 3);
  assert.deepEqual(plannedTimes({ uhrzeitVon: '18:00', uhrzeitBis: '04:00' }), { start: '18:00', end: '04:00' });
  assert.deepEqual(plannedTimes({}), { start: '', end: '' });
});
