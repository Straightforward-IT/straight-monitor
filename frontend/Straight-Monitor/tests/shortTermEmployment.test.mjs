import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shortTermEmploymentWindow } from '../src/utils/shortTermEmployment.js';

function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
}

test('short-term employment includes the full calendar year after a re-entry', () => {
  const window = shortTermEmploymentWindow('2026-08-15T00:00:00.000Z', 2026);
  assert.equal(dateKey(window.from), '2026-01-01');
  assert.equal(dateKey(window.through), '2026-12-31');
  assert.equal(window.label, 'im Kalenderjahr 2026');
});

test('short-term employment retains assignments from an entry in the previous year', () => {
  const window = shortTermEmploymentWindow('2025-11-15T00:00:00.000Z', 2026);
  assert.equal(dateKey(window.from), '2025-11-15');
  assert.equal(dateKey(window.through), '2026-12-31');
  assert.equal(window.label, 'seit Eintritt am 15.11.2025');
});

test('short-term employment includes assignments before a re-entry in the same year', () => {
  const window = shortTermEmploymentWindow('2026-05-01T00:00:00.000Z', 2026);
  assert.equal(dateKey(window.from), '2026-01-01');
  assert.equal(window.label, 'im Kalenderjahr 2026');
});

test('missing entry date falls back to the displayed calendar year', () => {
  const window = shortTermEmploymentWindow(null, 2026);
  assert.equal(dateKey(window.from), '2026-01-01');
  assert.equal(window.label, 'im Kalenderjahr 2026');
});

test('employment beginning after the displayed year has no reporting window', () => {
  assert.equal(shortTermEmploymentWindow('2027-01-01T00:00:00.000Z', 2026), null);
});