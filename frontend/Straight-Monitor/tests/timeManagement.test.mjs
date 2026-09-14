import assert from 'node:assert/strict';
import test from 'node:test';
import { addTimeEntry, bucketMinutes, cancelTime, changeTimeEntryType, collectTime, createTimeWorkspace, dropOnDay, dropTime,
  formatMinutes, hasTimeChanges, monthDays, revertTime, saveTime, sourceMinutes, timeTotals, undoTime } from '../src/utils/timeManagement.js';
import { timeManagementFixture } from '../src/components/dev/timeManagementFixture.js';

const create = () => createTimeWorkspace(timeManagementFixture());
const entryMinutes = (w, id) => w.data.entries.find(entry => entry.id === id).minutes;
const total = w => w.data.entries.filter(entry => entry.kind !== 'planned').reduce((sum, entry) => sum + entry.minutes, w.data.bankMinutes + bucketMinutes(w));

test('collects two hours from A and four from B, then parks six in bank with provenance', () => {
  const w = create(); const initial = total(w);
  collectTime(w, 'shift-a', 120); collectTime(w, 'shift-b', 240);
  assert.equal(bucketMinutes(w), 360); assert.equal(w.lots.length, 2);
  assert.equal(entryMinutes(w, 'shift-a'), 360); assert.equal(entryMinutes(w, 'shift-b'), 120);
  dropTime(w, 'bank', 360);
  assert.equal(w.data.bankMinutes, 1800); assert.equal(bucketMinutes(w), 0);
  assert.equal(w.history.length, 1); assert.equal(w.data.journal[0].transfers.length, 2);
  assert.equal(total(w), initial); assert.equal(timeTotals(w.data).forecast, 104 * 60);
});

test('Escape restores all sources and partial destinations in the unfinished gesture', () => {
  const w = create(); const before = structuredClone(w.data);
  collectTime(w, 'shift-a', 120); collectTime(w, 'shift-b', 240); collectTime(w, 'bank', 15);
  dropTime(w, 'bank', 60); dropTime(w, 'shift-01', 37); dropOnDay(w, '2026-09-06', 28);
  assert.ok(cancelTime(w)); assert.deepEqual(w.data, before);
  assert.equal(w.history.length, 0); assert.equal(bucketMinutes(w), 0);
});

test('remaining fractions are moved exactly and sources never become negative', () => {
  const w = create();
  collectTime(w, 'shift-a', 473); dropTime(w, 'bank', 473);
  assert.equal(collectTime(w, 'shift-a', 60), 7);
  assert.equal(collectTime(w, 'shift-a', 60), 0);
  assert.equal(dropTime(w, 'bank', 60), 7);
  assert.equal(w.data.bankMinutes, 1440 + 480);
});

test('newly created and removed minutes balance and are undone/cancelled', () => {
  const w = create(); const initial = total(w);
  collectTime(w, 'new', 480); dropTime(w, 'shift-a', 125); dropTime(w, 'remove', 32);
  cancelTime(w); assert.equal(total(w), initial); assert.equal(w.data.createdMinutes, 0); assert.equal(w.data.removedMinutes, 0);
  collectTime(w, 'new', 125); dropTime(w, 'remove', 25); dropTime(w, 'shift-a', 100);
  assert.equal(total(w), initial + 100); assert.equal(w.data.createdMinutes, 125); assert.equal(w.data.removedMinutes, 25);
  undoTime(w); assert.equal(total(w), initial);
});

test('empty-day drops create a correction and are reversible', () => {
  const w = create();
  collectTime(w, 'bank', 75); dropOnDay(w, '2026-09-06', 75);
  assert.equal(entryMinutes(w, 'correction-2026-09-06'), 75);
  assert.equal(timeTotals(w.data).correction, 75);
  undoTime(w); assert.ok(!w.data.entries.some(entry => entry.id === 'correction-2026-09-06'));
  assert.equal(w.data.bankMinutes, 1440);
});

test('save blocks held time; revert uses saved baseline, undo works after save', () => {
  const w = create();
  collectTime(w, 'shift-a', 60); assert.equal(saveTime(w), null);
  dropTime(w, 'bank', 60);
  const saved = saveTime(w); assert.ok(!hasTimeChanges(w)); assert.equal(w.history.length, 0);
  saved.bankMinutes = 0; assert.equal(w.saved.bankMinutes, 1500);
  collectTime(w, 'shift-b', 120); dropTime(w, 'bank', 120); undoTime(w);
  assert.equal(w.data.bankMinutes, 1500);
  collectTime(w, 'shift-b', 120); dropTime(w, 'bank', 60); revertTime(w);
  assert.equal(w.data.bankMinutes, 1500); assert.equal(bucketMinutes(w), 0); assert.ok(!hasTimeChanges(w));
});

test('planned rows are immutable and invalid targets cannot consume bucket minutes', () => {
  const w = create();
  assert.equal(sourceMinutes(w, 'planned-23'), 0); assert.equal(collectTime(w, 'missing', 60), 0);
  collectTime(w, 'shift-a', 60);
  for (const id of ['planned-23', 'new', 'missing']) assert.equal(dropTime(w, id, 60), 0);
  assert.equal(bucketMinutes(w), 60); assert.equal(dropTime(w, 'bank', -1), 0);
});

test('changing an entry type keeps its minutes and updates crediting and totals', () => {
  const w = create();
  const entry = w.data.entries.find(item => item.id === 'shift-09');
  const before = timeTotals(w.data).forecast;
  assert.ok(changeTimeEntryType(w, 'shift-09', 'UU'));
  assert.deepEqual({ code: entry.code, kind: entry.kind, credited: entry.credited, minutes: entry.minutes }, { code: 'UU', kind: 'vacation', credited: false, minutes: 420 });
  assert.equal(timeTotals(w.data).forecast, before - 420);
  assert.ok(changeTimeEntryType(w, 'shift-09', 'P'));
  assert.equal(w.data.entries.find(item => item.id === 'shift-09').label, 'Deck10 · Service');
  assert.ok(undoTime(w));
  assert.equal(w.data.entries.find(item => item.id === 'shift-09').code, 'UU');
});

test('absence entries honor explicit monthly credit; FA draws from bank', () => {
  const w = create(); const baseline = timeTotals(w.data).forecast;
  assert.ok(addTimeEntry(w, { id: 'leave', date: '2026-09-18', code: 'UU', label: 'Unbezahlter Urlaub', kind: 'vacation', credited: false, minutes: 360 }));
  assert.equal(timeTotals(w.data).forecast, baseline); assert.equal(timeTotals(w.data).uncredited, 360);
  assert.ok(addTimeEntry(w, { id: 'fa', date: '2026-09-19', code: 'FA', label: 'Freizeitausgleich', kind: 'absence', credited: true, minutes: 120 }));
  assert.equal(w.data.bankMinutes, 1320); assert.equal(timeTotals(w.data).forecast, baseline + 120);
  assert.equal(w.data.createdMinutes, 360);
  assert.equal(addTimeEntry(w, { id: 'too-much', code: 'FA', minutes: 9999 }), false);
  collectTime(w, 'bank', 1); assert.equal(addTimeEntry(w, { id: 'while-held', minutes: 60 }), false);
});

test('calendar includes leap-day and correct month bounds; formatting preserves minute precision', () => {
  assert.equal(monthDays('2028-02').length, 29); assert.equal(monthDays('2026-09').length, 30);
  assert.equal(monthDays('2026-09')[0].weekday, 'Di'); assert.equal(monthDays('2026-09')[5].weekend, true);
  assert.equal(formatMinutes(65), '1:05 h'); assert.equal(formatMinutes(-15), '−0:15 h');
});

test('conserves minutes across varied multi-source transfers, cancels, saves and reversions', () => {
  const w = create(); const initial = total(w);
  const sources = ['shift-a', 'shift-b', 'bank', 'new'];
  const targets = ['bank', 'shift-01', 'shift-b', 'remove'];
  for (let index = 1; index <= 150; index++) {
    collectTime(w, sources[index % 4], (index * 17) % 113);
    dropTime(w, targets[(index * 3) % 4], (index * 11) % 97);
    if (index % 7 === 0) cancelTime(w);
    if (index % 11 === 0) { dropTime(w, 'bank', bucketMinutes(w)); saveTime(w); }
    if (index % 17 === 0) revertTime(w);
    assert.equal(total(w), initial + w.data.createdMinutes - w.data.removedMinutes);
    assert.ok(w.data.entries.every(entry => Number.isInteger(entry.minutes) && entry.minutes >= 0));
    assert.ok(w.data.bankMinutes >= 0);
  }
});
