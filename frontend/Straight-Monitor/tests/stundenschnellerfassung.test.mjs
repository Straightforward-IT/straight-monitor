import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeQuickEntry, buildQuickEntryGroups, createQuickEntry, formatHours, plannedTimes } from '../src/utils/stundenschnellerfassung.js';
import { createStundenschnellerfassungDemo } from '../src/components/dev/stundenschnellerfassungDemo.js';

const analyze = values => analyzeQuickEntry(createQuickEntry({ _id: 'assignment' }, values));

test('reference fixture groups six assignments in two shifts and starts at 24 hours', () => {
  const fixture = createStundenschnellerfassungDemo();
  const groups = buildQuickEntryGroups(fixture.auftrag, fixture.schichten, fixture.einsaetze);
  assert.deepEqual(groups.map(group => group.einsaetze.length), [4, 2]);
  const minutes = fixture.zeiten.reduce((sum, entry) => sum + analyze(entry).netMinutes, 0);
  assert.equal(minutes, 1440);
  assert.equal(formatHours(minutes), '24,00');
});

test('direct shift references keep monitor shifts with null legacy IDs separate', () => {
  const shifts = [{ _id: 'a', auftragNr: 1 }, { _id: 'b', auftragNr: 1 }, { _id: 'foreign', auftragNr: 2 }];
  const assignments = [
    { _id: 'one', auftragNr: 1, schicht: 'a' },
    { _id: 'two', auftragNr: 1, schicht: { _id: 'b' } },
    { _id: 'other', auftragNr: 2, schicht: 'a' },
    { _id: 'unknown', auftragNr: 1, schicht: 'missing' },
  ];
  const groups = buildQuickEntryGroups({ auftragNr: 1 }, shifts, assignments);
  assert.deepEqual(groups.map(group => group.einsaetze.map(assignment => assignment._id)), [['one'], ['two'], ['unknown']]);
  assert.equal(groups[2].key, 'unassigned');
});

test('legacy shift IDs are matched by date and mismatches remain visible as unassigned', () => {
  const shifts = [
    { _id: 'day1', auftragNr: 1, idAuftragArbeitsschichten: 50, datumVon: '2026-09-08' },
    { _id: 'day2', auftragNr: 1, idAuftragArbeitsschichten: 50, datumVon: '2026-09-09' },
  ];
  const entries = [
    { _id: 'e1', auftragNr: 1, idAuftragArbeitsschichten: 50, datumVon: '2026-09-08' },
    { _id: 'e2', auftragNr: 1, idAuftragArbeitsschichten: 50, datumVon: '2026-09-09' },
    { _id: 'e3', auftragNr: 1, idAuftragArbeitsschichten: 50, datumVon: '2026-09-10' },
  ];
  assert.deepEqual(buildQuickEntryGroups({ auftragNr: 1 }, shifts, entries).map(group => group.einsaetze.map(entry => entry._id)), [['e1'], ['e2'], ['e3']]);
  assert.equal(buildQuickEntryGroups({ auftragNr: 1 }, shifts.slice(0, 1), entries.slice(2))[1].key, 'unassigned');
});

test('night shift subtracts only unpaid break minutes', () => {
  const result = analyze({ start: '17:00', end: '04:00', breakMinutes: 60, paidBreakMinutes: 15 });
  assert.equal(result.complete, true);
  assert.equal(result.overnight, true);
  assert.equal(result.grossMinutes, 660);
  assert.equal(result.netMinutes, 615);
  assert.equal(formatHours(result.netMinutes), '10,25');
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

test('drafts clone their source and planned values prefer assignment overrides', () => {
  const source = { start: '10:00', breaks: [{ start: '12:00', end: '12:15', paid: true }] };
  const draft = createQuickEntry({ _id: 'a' }, source);
  draft.breaks[0].start = '13:00';
  assert.equal(source.breaks[0].start, '12:00');
  assert.equal(draft.breaks.length, 3);
  assert.deepEqual(plannedTimes({ uhrzeitVon: '18:00' }, { uhrzeitVon: '17:00', uhrzeitBis: '04:00' }), { start: '18:00', end: '04:00' });
});
