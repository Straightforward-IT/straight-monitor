<template>
  <div class="kalender-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <h2 class="view-title">Kalender</h2>

    <!-- Calendar Navigation -->
    <div class="calendar-controls">
      <button @click="previousMonth" class="nav-btn">
        <font-awesome-icon icon="fa-solid fa-chevron-left" />
      </button>
      <span class="current-month">{{ currentMonthName }} {{ currentYear }}</span>
      <button @click="nextMonth" class="nav-btn">
        <font-awesome-icon icon="fa-solid fa-chevron-right" />
      </button>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar">
      <div v-for="day in weekdays" :key="day" class="calendar-header">{{ day }}</div>

      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="calendar-day"
        :class="{
          'other-month': !day.isCurrentMonth,
          'today': day.isToday,
          'has-einsatz': day.einsaetze.length > 0
        }"
        @click="onDayClick(day)"
      >
        <div class="day-number">{{ day.number }}</div>
        <div v-if="day.einsaetze.length > 0" class="day-dots">
          <span
            v-for="(_, i) in Math.min(day.einsaetze.length, 3)"
            :key="i"
            class="dot"
          ></span>
        </div>
      </div>
    </div>

    <!-- Selected Day Detail -->
    <div v-if="selectedDay && selectedDay.einsaetze.length > 0" class="day-detail">
      <h3 class="day-detail-title">
        {{ formatDateFull(selectedDay.date) }}
        <span class="badge">{{ selectedDay.einsaetze.length }}</span>
      </h3>
      <div
        v-for="einsatz in selectedDay.einsaetze"
        :key="einsatz._id"
        class="day-einsatz-card"
        @click="$emit('open-job', einsatz)"
      >
        <div class="einsatz-time" v-if="einsatz.uhrzeitVon">
          {{ formatTime(einsatz.uhrzeitVon) }}{{ einsatz.uhrzeitBis ? ' – ' + formatTime(einsatz.uhrzeitBis) : '' }}
        </div>
        <div class="einsatz-info">
          <span class="einsatz-title">
            {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `#${einsatz.auftragNr}` }}
          </span>
          <span class="einsatz-location" v-if="einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt">
            <font-awesome-icon icon="fa-solid fa-location-dot" />
            {{ einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt }}
          </span>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="einsatz-arrow" />
      </div>
    </div>

    <!-- Empty month hint -->
    <div v-else-if="!selectedDay" class="hint">
      Tippe auf einen Tag, um Einsätze zu sehen.
    </div>
    <div v-else class="hint">
      Keine Einsätze an diesem Tag.
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  einsaetze: { type: Array, default: () => [] }
});

defineEmits(['back', 'open-job']);

const currentMonth = ref(new Date().getMonth());
const currentYear = ref(new Date().getFullYear());
const selectedDay = ref(null);

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const currentMonthName = computed(() => {
  return new Date(currentYear.value, currentMonth.value)
    .toLocaleDateString('de-DE', { month: 'long' });
});

function formatDateFull(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function formatTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isEinsatzOnDay(einsatz, day) {
  const dayDate = new Date(day);
  const von = new Date(einsatz.datumVon);
  const bis = new Date(einsatz.datumBis);
  dayDate.setHours(0, 0, 0, 0);
  von.setHours(0, 0, 0, 0);
  bis.setHours(23, 59, 59, 999);
  return dayDate >= von && dayDate <= bis;
}

const calendarDays = computed(() => {
  const days = [];
  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startingDayOfWeek = firstDay.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  // Previous month
  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0);
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(currentYear.value, currentMonth.value - 1, prevMonthLastDay.getDate() - i);
    days.push({ number: date.getDate(), date, isCurrentMonth: false, isToday: false, einsaetze: [] });
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentYear.value, currentMonth.value, day);
    const dayDate = new Date(date);
    dayDate.setHours(0, 0, 0, 0);
    days.push({
      number: day,
      date,
      isCurrentMonth: true,
      isToday: dayDate.getTime() === today.getTime(),
      einsaetze: props.einsaetze.filter(e => isEinsatzOnDay(e, date))
    });
  }

  // Fill to 42
  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(currentYear.value, currentMonth.value + 1, day);
    days.push({ number: day, date, isCurrentMonth: false, isToday: false, einsaetze: [] });
  }

  return days;
});

function previousMonth() {
  selectedDay.value = null;
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value--; }
  else currentMonth.value--;
}

function nextMonth() {
  selectedDay.value = null;
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++; }
  else currentMonth.value++;
}

function onDayClick(day) {
  if (!day.isCurrentMonth) return;
  selectedDay.value = day;
}
</script>

<style scoped>
.kalender-view {
  padding: 0 0 2rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  -webkit-tap-highlight-color: transparent;
}

.view-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1rem;
}

/* Calendar Controls */
.calendar-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.current-month {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  text-transform: capitalize;
}

.nav-btn {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text);
  -webkit-tap-highlight-color: transparent;
}

.nav-btn:active {
  background: var(--hover);
}

/* Calendar Grid */
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 1.25rem;
}

.calendar-header {
  text-align: center;
  font-weight: 700;
  font-size: 0.7rem;
  color: var(--muted);
  padding: 0.4rem 0;
  text-transform: uppercase;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  gap: 2px;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.calendar-day:active {
  background: var(--hover);
}

.calendar-day.other-month {
  opacity: 0.25;
  pointer-events: none;
}

.calendar-day.today {
  background: var(--primary);
}

.calendar-day.today .day-number {
  color: white;
  font-weight: 700;
}

.calendar-day.today .dot {
  background: white;
}

.calendar-day.has-einsatz:not(.today) {
  background: rgba(255, 117, 24, 0.08);
}

.day-number {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
  line-height: 1;
}

.day-dots {
  display: flex;
  gap: 3px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
}

/* Day Detail */
.day-detail {
  margin-top: 0.5rem;
}

.day-detail-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  background: var(--primary);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.day-einsatz-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.day-einsatz-card:active {
  transform: scale(0.98);
  background: var(--hover);
}

.einsatz-time {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary);
  min-width: 50px;
  flex-shrink: 0;
}

.einsatz-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.einsatz-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.einsatz-location {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.einsatz-arrow {
  color: var(--muted);
  font-size: 0.7rem;
  flex-shrink: 0;
}

.hint {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.5rem 1rem;
  background: var(--tile-bg);
  border-radius: 10px;
}
</style>
