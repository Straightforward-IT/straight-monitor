import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse, compileScript } from '@vue/compiler-sfc';
import { effectScope, reactive, nextTick } from 'vue';

const filename = new URL('../src/components/ui-elements/AssignmentCalendar.vue', import.meta.url);
const { descriptor } = parse(await readFile(filename, 'utf8'));
const compiled = compileScript(descriptor, { id: 'calendar-test' }).content
  .replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  .replaceAll("from '@fortawesome/vue-fontawesome'", `from '${import.meta.resolve('@fortawesome/vue-fontawesome')}'`);
const { default: Calendar } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function setup(values) {
  const props = reactive({ calendarYear: 2026, calendarMonth: 8, calendarEinsaetze: [], ...values });
  const scope = effectScope();
  const calendar = scope.run(() => Calendar.setup(props, { expose() {} }));
  return { props, calendar, scope };
}

test('two-month calendar includes year rollover, leap day and Monday-first padding', () => {
  const { props, calendar, scope } = setup({ calendarMonth: 11 });
  try {
    assert.equal(calendar.calendarDays.value.length, 35);
    assert.equal(calendar.calendarDays.value[0].date.getDay(), 1);
    assert.equal(calendar.calendarDaysNext.value.find(d => d.isCurrentMonth).date.getFullYear(), 2027);
    props.calendarYear = 2028;
    props.calendarMonth = 1;
    assert.equal(calendar.calendarDays.value.filter(d => d.isCurrentMonth).length, 29);
  } finally { scope.stop(); }
});

test('only renders weeks containing days of the displayed month', () => {
  const { props, calendar, scope } = setup();
  try {
    assert.equal(calendar.calendarDays.value.length, 35); // September 2026
    assert.equal(calendar.calendarDaysNext.value.length, 35); // October 2026
    props.calendarMonth = 7; // August 2026 needs six weeks, including August 31.
    assert.equal(calendar.calendarDays.value.length, 42);
    assert.equal(calendar.calendarDays.value[35].number, 31);
    assert.equal(calendar.calendarDays.value[35].isCurrentMonth, true);
    props.calendarYear = 2027;
    props.calendarMonth = 1; // February starts on Monday and needs only four weeks.
    assert.equal(calendar.calendarDays.value.length, 28);
    assert.ok(calendar.calendarDays.value.every(day => day.isCurrentMonth));
  } finally { scope.stop(); }
});

test('multi-day orders cover both months and selected details refresh after loading', async () => {
  const { props, calendar, scope } = setup();
  try {
    calendar.onCalDayClick(calendar.calendarDays.value.find(d => d.isCurrentMonth && d.number === 30));
    assert.equal(calendar.calendarSelectedDay.value.einsaetze.length, 0);
    props.calendarEinsaetze = [
      { _id: 'range', datumVon: '2026-09-30T10:00:00', datumBis: '2026-10-02T18:00:00' },
      { _id: 'single', datumVon: '2026-09-30T18:00:00' },
    ];
    assert.equal(calendar.calendarSelectedDay.value.einsaetze.length, 2);
    for (const day of [1, 2]) assert.equal(calendar.calendarDaysNext.value.find(d => d.isCurrentMonth && d.number === day).einsaetze.length, 1);
    assert.equal(calendar.calendarDaysNext.value.find(d => d.isCurrentMonth && d.number === 3).einsaetze.length, 0);
    props.calendarMonth++;
    await nextTick();
    assert.equal(calendar.calendarSelectedDay.value, undefined);
  } finally { scope.stop(); }
});
