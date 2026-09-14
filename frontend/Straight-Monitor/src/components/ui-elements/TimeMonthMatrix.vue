<template>
  <section
    class="time-month-matrix"
    aria-label="Monatsübersicht nach Kalenderwochen"
  >
    <header class="tmx-heading">
      <h2>Stundenerfassung</h2><span>{{ monthLabel }} · h:mm</span>
    </header>
    <div
      class="tmx-scroll"
      tabindex="0"
      aria-label="Kalenderwochen, horizontal scrollbar"
    >
      <table class="tmx-table">
        <thead>
          <tr>
            <th
              scope="col"
              class="tmx-weekday-heading"
            >
              Wochentag
            </th>
            <th
              v-for="week in weeks"
              :key="week.key"
              scope="col"
            >
              <button
                type="button"
                class="tmx-week"
                :aria-label="`Kalenderwoche ${week.number} anzeigen`"
                @click="emit('selectWeek', week.days.find(day => day.inMonth).date)"
              >
                <strong>KW {{ week.number }}</strong><span>Ist {{ formatMinutes(weekTotal(week)).replace(' h', '') }}</span>
              </button>
              <div class="tmx-column-labels">
                <span>Tag</span><span>KB</span><span>Std.</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(weekday, weekdayIndex) in weekdays"
            :key="weekday"
            :class="{ 'tmx-weekend': weekdayIndex > 4 }"
          >
            <th scope="row">
              {{ weekday }}
            </th>
            <td
              v-for="week in weeks"
              :key="week.key"
              :data-day="week.days[weekdayIndex].inMonth ? week.days[weekdayIndex].date : undefined"
              :class="{ 'tmx-outside': !week.days[weekdayIndex].inMonth, 'tmx-selected': week.days[weekdayIndex].date === selectedDate }"
            >
              <template v-if="week.days[weekdayIndex].inMonth">
                <div class="tmx-day">
                  <button
                    class="tmx-date"
                    type="button"
                    :aria-pressed="week.days[weekdayIndex].date === selectedDate"
                    :aria-label="`${week.days[weekdayIndex].day}. ${monthLabel} anzeigen`"
                    @click="emit('selectDay', week.days[weekdayIndex].date)"
                  >
                    {{ week.days[weekdayIndex].day }}
                  </button>
                  <div class="tmx-values">
                    <button
                      v-for="entry in entriesByDate[week.days[weekdayIndex].date] || []"
                      :key="entry.id"
                      type="button"
                      class="tm-entry"
                      :class="[`tm-entry--${entry.kind}`, { 'tm-entry--changed': entry.minutes !== entry.originalMinutes }]"
                      :data-time-target="entry.id"
                      :disabled="entry.kind === 'planned'"
                      :aria-label="`${week.days[weekdayIndex].day}. ${monthLabel} · ${entry.label} · ${formatMinutes(entry.minutes)}${entry.kind === 'planned' ? ' · geplant' : ''}`"
                      :title="`${entry.label} · ${formatMinutes(entry.minutes)}${entry.minutes !== entry.originalMinutes ? ` · vorher ${formatMinutes(entry.originalMinutes)}` : ''}`"
                    >
                      <span>{{ entry.code || (entry.kind === 'planned' ? 'PL' : 'P') }}</span><strong>{{ formatMinutes(entry.minutes).replace(' h', '') }}</strong><i aria-hidden="true" />
                    </button>
                    <button
                      v-if="!entriesByDate[week.days[weekdayIndex].date]?.length"
                      type="button"
                      class="tmx-empty"
                      :data-time-target="`day:${week.days[weekdayIndex].date}`"
                      :aria-label="`Stunden am ${week.days[weekdayIndex].day}. ${monthLabel} ablegen`"
                    >
                      {{ held ? '＋ ablegen' : '—' }}
                    </button>
                  </div>
                </div>
              </template>
              <span
                v-else
                class="tmx-adjacent-day"
              >{{ week.days[weekdayIndex].day }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer class="tmx-legend">
      <span><i class="tmx-color--productive" />P Produktiv</span><span><i class="tmx-color--vacation" />U Urlaub</span><span><i class="tmx-color--sick" />K Krank</span><span><i class="tmx-color--correction" />M Korrektur</span><span><i class="tmx-color--planned" />PL Geplant</span><span class="tmx-hint">Tagesnummer = Details</span>
    </footer>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { formatMinutes, monthWeeks } from '@/utils/timeManagement';
const props = defineProps({ month: { type: String, required: true }, entries: { type: Array, required: true }, selectedDate: { type: String, default: '' }, held: { type: Number, default: 0 } });
const emit = defineEmits(['selectDay', 'selectWeek']);
const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const weeks = computed(() => monthWeeks(props.month));
const monthLabel = computed(() => new Date(`${props.month}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
const entriesByDate = computed(() => {
  const grouped = {};
  for (const entry of props.entries) (grouped[entry.date] ||= []).push(entry);
  return grouped;
});
function weekTotal(week) {
  return week.days.filter(day => day.inMonth).reduce((total, day) => total + (entriesByDate.value[day.date] || []).filter(entry => entry.kind !== 'planned').reduce((sum, entry) => sum + entry.minutes, 0), 0);
}
</script>

<style scoped>
.time-month-matrix { min-width: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: var(--surface); }
.tmx-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 12px; background: var(--hover); border-bottom: 1px solid var(--border); }
.tmx-heading h2 { margin: 0; font-size: 12px; font-weight: 600; }
.tmx-heading > span { font-size: 10px; color: var(--muted); }
.tmx-scroll { overflow-x: auto; scrollbar-width: thin; }
.tmx-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-variant-numeric: tabular-nums; }
.tmx-table th, .tmx-table td { text-align: left; border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.tmx-table th { padding: 0; font-weight: 500; }
.tmx-table .tmx-weekday-heading { width: 82px; vertical-align: bottom; padding: 0 10px 7px; font-size: 10px; color: var(--muted); }
.tmx-table thead th:not(:first-child) { width: 124px; border-left: 1px solid var(--border); }
.tmx-week { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 5px; padding: 9px 7px; color: var(--text); border: 0; background: transparent; cursor: pointer; }
.tmx-week strong { font-size: 11px; font-weight: 600; }
.tmx-week > span { font-size: 10px; color: var(--muted); }
.tmx-week:hover { background: var(--hover); }
.tmx-column-labels { display: grid; grid-template-columns: 26px 24px 1fr; gap: 3px; padding: 3px 7px 6px; font-size: 9px; color: var(--muted); }
.tmx-column-labels > :last-child { text-align: right; padding-right: 8px; }
.tmx-table tbody th { padding: 0 10px; font-size: 11px; }
.tmx-table td { border-left: 1px solid var(--border); padding: 4px; }
.tmx-day { display: flex; align-items: stretch; min-height: 29px; gap: 3px; }
.tmx-date { width: 25px; flex: 0 0 25px; padding: 0; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--text); font-size: 11px; cursor: pointer; align-self: stretch; }
.tmx-date:hover { background: var(--hover); border-color: var(--border); }
.tmx-values { flex: 1; min-width: 0; display: grid; gap: 3px; }
.tm-entry { --entry-color: #7f98b0; display: grid; grid-template-columns: 24px minmax(0, 1fr) 4px; gap: 3px; align-items: center; min-height: 26px; border: 1px solid color-mix(in srgb, var(--entry-color) 45%, var(--border)); border-radius: 3px; padding: 0 3px; background: color-mix(in srgb, var(--entry-color) 15%, var(--surface)); color: var(--text); cursor: pointer; }
.tm-entry > span { font-size: 10px; border-right: 1px solid color-mix(in srgb, var(--entry-color) 35%, transparent); }
.tm-entry > strong { font-size: 11px; font-weight: 500; text-align: right; white-space: nowrap; }
.tm-entry > i { align-self: stretch; width: 3px; background: var(--entry-color); margin: 3px 0; border-radius: 1px; }
.tm-entry:hover:not(:disabled) { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
.tm-entry--vacation { --entry-color: #62b58f; }
.tm-entry--sick, .tm-entry--absence { --entry-color: #a997d0; }
.tm-entry--correction { --entry-color: #70b4af; }
.tm-entry--planned { --entry-color: var(--primary); border-style: dashed; opacity: .75; cursor: default; }
.tm-entry--changed > strong { font-weight: 700; }
.tm-entry--changed { border-color: var(--primary); }
.tmx-empty { width: 100%; border: 1px dashed color-mix(in srgb, var(--border) 70%, transparent); border-radius: 3px; background: transparent; color: var(--muted); font-size: 10px; cursor: pointer; min-height: 26px; }
.tmx-empty:hover { border-color: var(--primary); }
.tmx-weekend { background: var(--hover); }
.tmx-weekend > th { color: var(--muted); }
.tmx-selected { background: color-mix(in srgb, var(--primary) 15%, var(--surface)); }
.tmx-selected .tmx-date { background: var(--primary); color: #292117; font-weight: 600; }
.tmx-outside { background: color-mix(in srgb, var(--hover) 50%, var(--surface)); }
.tmx-adjacent-day { padding: 0 7px; color: var(--muted); opacity: .45; font-size: 10px; }
.tmx-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; padding: 8px 10px; color: var(--muted); font-size: 9px; }
.tmx-legend > span { display: flex; align-items: center; gap: 4px; }
.tmx-legend i { width: 6px; height: 6px; border-radius: 1px; }
.tmx-color--productive { background: #7f98b0; }.tmx-color--vacation { background: #62b58f; }.tmx-color--sick { background: #a997d0; }.tmx-color--correction { background: #70b4af; }.tmx-color--planned { background: var(--primary); }
.tmx-hint { margin-left: auto; }
button:focus-visible, .tmx-scroll:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
@media (max-width: 650px) { .tmx-table .tmx-weekday-heading { width: 72px; } .tmx-table tbody th { font-size: 10px; padding-inline: 6px; } .tmx-table thead th:not(:first-child) { width: 120px; } }
</style>
