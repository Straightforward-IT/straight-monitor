<template>
  <div class="dispo-mini-cal" :aria-busy="calendarLoading">
    <div class="dispo-cal-nav">
      <button type="button" class="dispo-cal-nav-btn" aria-label="Vorheriger Monat" @click.stop="$emit('previous')">
        <font-awesome-icon icon="fa-solid fa-chevron-left" />
      </button>
      <span class="dispo-cal-month-label">{{ calendarMonthName }}</span>
      <span class="dispo-cal-month-sep">–</span>
      <span class="dispo-cal-month-label">{{ calendarMonthNameNext }}</span>
      <button type="button" class="dispo-cal-nav-btn" aria-label="Nächster Monat" @click.stop="$emit('next')">
        <font-awesome-icon icon="fa-solid fa-chevron-right" />
      </button>
    </div>
    <div class="dispo-two-months">
      <div v-for="(days, monthIndex) in [calendarDays, calendarDaysNext]" :key="monthIndex" class="dispo-cal-grid dispo-cal-grid--sm">
        <div v-for="wd in ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']" :key="wd" class="dispo-cal-wd">{{ wd }}</div>
        <button
          v-for="day in days" :key="day.date.getTime()" type="button" class="dispo-cal-day"
          :class="{
            'dispo-cal-day--other': !day.isCurrentMonth,
            'dispo-cal-day--today': day.isToday,
            'dispo-cal-day--has-einsatz': day.einsaetze.length > 0,
            'dispo-cal-day--selected': selectedDate === day.date.getTime(),
          }"
          :disabled="!day.isCurrentMonth"
          :aria-current="day.isToday && day.isCurrentMonth ? 'date' : undefined"
          :title="day.isToday && day.isCurrentMonth ? 'Heute' : undefined"
          :aria-pressed="selectedDate === day.date.getTime()"
          :aria-label="day.date.toLocaleDateString('de-DE') + ': ' + day.einsaetze.length + (day.einsaetze.length === 1 ? ' Eintrag' : ' Einträge')"
          @click.stop="onCalDayClick(day)"
        >
          <span class="dispo-cal-day-num">{{ day.number }}</span>
          <span v-if="day.einsaetze.length" class="dispo-cal-dots">
            <span v-for="dot in Math.min(day.einsaetze.length, 3)" :key="dot" class="dispo-cal-dot" />
          </span>
        </button>
      </div>
    </div>
    <div v-if="calendarLoading" class="dispo-cal-loading" role="status" aria-label="Kalender wird geladen">
      <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
    </div>
    <div v-if="calendarSelectedDay && !calendarLoading" class="dispo-cal-detail">
      <div class="dispo-cal-detail-header">
        <div class="dispo-cal-detail-date">
          <font-awesome-icon icon="fa-solid fa-calendar-days" />
          {{ formatCalSelectedDate }}
        </div>
        <span class="dispo-cal-detail-count">
          {{ calendarSelectedDay.einsaetze.length }} {{ calendarSelectedDay.einsaetze.length === 1 ? 'Eintrag' : 'Einträge' }}
        </span>
      </div>
      <button
        v-for="entry in calendarSelectedDay.einsaetze" :key="entry._id" type="button"
        class="dispo-cal-detail-item dispo-cal-detail-item--link" @click.stop="$emit('open', entry)"
      >
        <span v-if="entry.uhrzeitVon" class="dispo-cal-detail-time">
          {{ formatCalTime(entry.uhrzeitVon) }}{{ entry.uhrzeitBis ? '–' + formatCalTime(entry.uhrzeitBis) : '' }}
        </span>
        <span class="dispo-cal-detail-content">
          <span class="dispo-cal-detail-name">{{ entry.auftrag?.eventTitel || entry.bezeichnung || `#${entry.auftragNr}` }}</span>
          <span v-if="entry.auftragNr || entry.eventOrt || entry.auftrag?.eventOrt" class="dispo-cal-detail-meta">
            <span v-if="entry.auftragNr">Auftrag {{ entry.auftragNr }}</span>
            <span v-if="entry.eventOrt || entry.auftrag?.eventOrt">{{ entry.eventOrt || entry.auftrag?.eventOrt }}</span>
          </span>
        </span>
        <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" class="dispo-cal-detail-arrow" />
      </button>
      <p v-if="!calendarSelectedDay.einsaetze.length" class="dispo-cal-detail-empty">{{ emptyLabel }}</p>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
const props = defineProps({
  calendarYear: { type: Number, required: true },
  calendarMonth: { type: Number, required: true },
  calendarEinsaetze: { type: Array, default: () => [] },
  calendarLoading: Boolean,
  emptyLabel: { type: String, default: 'Keine Einsätze' },
});
defineEmits(['previous', 'next', 'open']);
const selectedDate = ref(null);
watch(() => [props.calendarYear, props.calendarMonth], () => { selectedDate.value = null; });
const monthName = offset => new Date(props.calendarYear, props.calendarMonth + offset).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
const calendarMonthName = computed(() => monthName(0));
const calendarMonthNameNext = computed(() => monthName(1));
function buildMonth(offset) {
  const first = new Date(props.calendarYear, props.calendarMonth + offset, 1);
  const start = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const visibleDays = Math.ceil((start + daysInMonth) / 7) * 7;
  return Array.from({ length: visibleDays }, (_, i) => {
    const date = new Date(first.getFullYear(), first.getMonth(), i - start + 1);
    const isCurrentMonth = date.getMonth() === first.getMonth();
    const einsaetze = isCurrentMonth ? props.calendarEinsaetze.filter(e => {
      const from = new Date(e.datumVon); from.setHours(0, 0, 0, 0);
      const to = new Date(e.datumBis || e.datumVon); to.setHours(23, 59, 59, 999);
      return date >= from && date <= to;
    }) : [];
    return { number: date.getDate(), date, isCurrentMonth, isToday: date.toDateString() === new Date().toDateString(), einsaetze };
  });
}
const calendarDays = computed(() => buildMonth(0));
const calendarDaysNext = computed(() => buildMonth(1));
const calendarSelectedDay = computed(() => [...calendarDays.value, ...calendarDaysNext.value].find(day => day.isCurrentMonth && day.date.getTime() === selectedDate.value));
const formatCalSelectedDate = computed(() => {
  const day = calendarSelectedDay.value;
  return day?.isToday ? 'Heute' : day?.date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
});
function onCalDayClick(day) {
  if (day.isCurrentMonth) selectedDate.value = selectedDate.value === day.date.getTime() ? null : day.date.getTime();
}
function formatCalTime(value) { return typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : ''; }
</script>

<style scoped lang="scss">
.dispo-mini-cal {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dispo-cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 4px;
}

.dispo-cal-month-sep {
  font-size: 10px;
  color: var(--muted);
  flex-shrink: 0;
}

.dispo-two-months {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: 10px;
}

.dispo-cal-month-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-transform: capitalize;
}

.dispo-cal-nav-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: color 0.15s, background 0.15s;
  &:hover { color: var(--text); background: var(--hover); }
}

.dispo-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.dispo-cal-grid--sm {
  .dispo-cal-wd  { font-size: 7px; }
  .dispo-cal-day-num { font-size: 8px; }
  .dispo-cal-dot { width: 2px; height: 2px; }
}

.dispo-cal-wd {
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  padding: 2px 0 4px;
}

.dispo-cal-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover:not(.dispo-cal-day--other) { background: var(--hover); }

  &--other { opacity: 0.2; cursor: default; pointer-events: none; }

  &--today .dispo-cal-day-num { color: var(--primary); font-weight: 700; }

  &--has-einsatz { background: color-mix(in srgb, var(--primary) 10%, transparent); }

  &--selected {
    background: var(--primary) !important;
    .dispo-cal-day-num { color: #fff !important; font-weight: 700; }
    .dispo-cal-dot { background: rgba(255,255,255,0.8); }
  }
}

.dispo-cal-day-num {
  font-size: 10px;
  line-height: 1;
  color: var(--text);
}

.dispo-cal-dots {
  display: flex;
  gap: 2px;
}

.dispo-cal-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--primary);
}

.dispo-cal-loading {
  font-size: 11px;
  color: var(--muted);
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.dispo-cal-detail {
  border-top: 1px solid var(--border);
  margin-top: 6px;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.dispo-cal-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 3px;
}

.dispo-cal-detail-date {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);

  svg { color: var(--primary); }
}

.dispo-cal-detail-count {
  border-radius: 999px;
  padding: 3px 8px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
}

.dispo-cal-detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-family: inherit;
  text-align: left;
  font-size: 12px;

  &--link {
    cursor: pointer;
    border-radius: 8px;
    padding: 10px 12px;
    transition: background 0.12s, border-color 0.12s;

    &:hover {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, var(--surface));
      .dispo-cal-detail-arrow { color: var(--primary); }
    }
  }
}

.dispo-cal-detail-arrow {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--muted);
  transition: color 0.12s;
}

.dispo-cal-detail-time {
  font-weight: 600;
  color: var(--primary);
  flex-shrink: 0;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.dispo-cal-detail-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 4px;
}

.dispo-cal-detail-name {
  color: var(--text);
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.dispo-cal-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.4;
}

.dispo-cal-detail-empty {
  font-size: 11px;
  color: var(--muted);
  margin: 0;
  padding: 16px 12px;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 8px;
}


.dispo-mini-cal { min-width: 0; }
.dispo-cal-day { border: 0; background-color: transparent; font-family: inherit; text-align: left; }
.dispo-cal-day { padding: 0; }
.dispo-cal-day--has-einsatz { background: color-mix(in srgb, var(--primary) 10%, transparent); }
.dispo-cal-day--today:not(.dispo-cal-day--other) {
  box-shadow: inset 0 0 0 2px var(--primary);
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}
.dispo-cal-day--today.dispo-cal-day--selected {
  box-shadow: inset 0 0 0 2px var(--primary), inset 0 0 0 4px var(--surface, #fff);
}
.dispo-cal-day:focus-visible, .dispo-cal-detail-item:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
</style>
