'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value) {
  const match = typeof value === 'string' && value.match(DATE_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = typeof value === 'string' ? parseDateOnly(value) : value;
  return formatDateOnly(new Date(date.getTime() + days * DAY_MS));
}

function daysBetween(start, endExclusive) {
  const startDate = typeof start === 'string' ? parseDateOnly(start) : start;
  const endDate = typeof endExclusive === 'string' ? parseDateOnly(endExclusive) : endExclusive;
  return Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
}

function addCalendarMonths(value, months) {
  const date = typeof value === 'string' ? parseDateOnly(value) : value;
  if (!date || !Number.isInteger(months)) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, lastDay));
  return formatDateOnly(firstOfTarget);
}

function compareDateOnly(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

module.exports = {
  DAY_MS,
  parseDateOnly,
  formatDateOnly,
  addDays,
  daysBetween,
  addCalendarMonths,
  compareDateOnly,
};
