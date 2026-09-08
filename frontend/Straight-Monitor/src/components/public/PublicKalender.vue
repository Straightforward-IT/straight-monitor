<template>
  <div class="kalender-view">

    <!-- Calendar Navigation -->
    <div class="calendar-controls">
      <button @click="previousMonth" class="nav-btn nav-btn--previous">
        <font-awesome-icon icon="fa-solid fa-chevron-left" />
      </button>
      <span class="current-month">{{ currentMonthName }} {{ currentYear }}</span>
      <div v-if="canManageAvailability" class="availability-control">
        <span class="availability-label">Verfügbarkeit</span>
        <div class="availability-menu-wrap">
          <button
            type="button"
            class="availability-menu-btn"
            :class="{ active: availabilityMode }"
            aria-label="Verfügbarkeit auswählen"
            title="Verfügbarkeit auswählen"
            @click="availabilityMenuOpen = !availabilityMenuOpen"
          >
            <font-awesome-icon icon="fa-solid fa-brush" />
          </button>
          <div v-if="availabilityMenuOpen" class="availability-menu">
            <button
              v-for="option in availabilityOptions"
              :key="option.value"
              type="button"
              :class="{ active: availabilityMode?.value === option.value }"
              @click="selectAvailabilityMode(option)"
            >
              <font-awesome-icon :icon="option.icon" />
              {{ option.label }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="comment-mode-btn"
          :class="{ active: commentMode }"
          aria-label="Tageskommentar hinzufügen"
          title="Tageskommentar hinzufügen"
          @click="toggleCommentMode"
        >
          <font-awesome-icon icon="fa-solid fa-comment" />
        </button>
      </div>
      <button @click="nextMonth" class="nav-btn nav-btn--next">
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
          'has-einsatz': day.einsaetze.length > 0,
          [`availability-${day.availability?.verfuegbarkeit}`]: day.availability
        }"
        @click="onDayClick(day)"
      >
        <font-awesome-icon
          v-if="day.availability"
          :icon="availabilityIcon(day.availability.verfuegbarkeit)"
          class="availability-status-icon"
        />
        <font-awesome-icon
          v-if="commentDates.has(toIsoDate(day.date))"
          icon="fa-solid fa-comment"
          class="comment-status-icon"
        />
        <div class="day-number">{{ day.number }}</div>
        <div v-if="day.availability?.verfuegbarkeit === 'partially'" class="availability-time">
          {{ formatAvailabilityTime(day.availability) }}
        </div>
        <div v-if="day.einsaetze.length > 0" class="day-dots">
          <span
            v-for="(_, i) in Math.min(day.einsaetze.length, 3)"
            :key="i"
            class="dot"
          ></span>
        </div>
      </div>
    </div>

    <div v-if="partialTimeDialog.open" class="partial-time-overlay" @click.self="closePartialTimeDialog">
      <section class="partial-time-dialog" role="dialog" aria-modal="true" aria-labelledby="partial-time-title">
        <div class="partial-time-header">
          <div>
            <h3 id="partial-time-title">Teilweise verfügbar</h3>
            <p>{{ formatDateFull(partialTimeDialog.day?.date) }}</p>
          </div>
        </div>
        <div class="partial-time-fields">
          <div class="partial-time-field">
            <span>Von</span>
            <select v-model="partialTimeDialog.vonHour" aria-label="Startstunde">
              <option v-for="hour in hours" :key="`von-${hour}`" :value="hour">{{ hour }}</option>
            </select>
            <div class="minute-options" aria-label="Startminute">
              <button v-for="minute in minutes" :key="`von-${minute}`" type="button" :class="{ active: partialTimeDialog.vonMinute === minute }" @click="partialTimeDialog.vonMinute = minute">{{ minute }}</button>
            </div>
          </div>
          <div class="partial-time-field">
            <span>Bis</span>
            <select v-model="partialTimeDialog.bisHour" aria-label="Endstunde">
              <option v-for="hour in hours" :key="`bis-${hour}`" :value="hour">{{ hour }}</option>
            </select>
            <div class="minute-options" aria-label="Endminute">
              <button v-for="minute in minutes" :key="`bis-${minute}`" type="button" :class="{ active: partialTimeDialog.bisMinute === minute }" @click="partialTimeDialog.bisMinute = minute">{{ minute }}</button>
            </div>
          </div>
        </div>
        <p v-if="availabilityError" class="partial-time-error">{{ availabilityError }}</p>
        <div class="partial-time-actions">
          <button type="button" class="partial-time-save" :disabled="availabilitySaving" @click="confirmPartialAvailability">
            {{ availabilitySaving ? 'Wird gespeichert...' : 'Speichern' }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="commentDialog.open" class="partial-time-overlay" @click.self="closeCommentDialog">
      <section class="comment-dialog" role="dialog" aria-modal="true" aria-labelledby="comment-title">
        <h3 id="comment-title">Kommentar</h3>
        <p>{{ formatDateFull(commentDialog.day?.date) }}</p>
        <textarea v-model="commentDialog.text" maxlength="5000" placeholder="Kommentar eingeben" autofocus />
        <p v-if="commentDialog.error" class="partial-time-error">{{ commentDialog.error }}</p>
        <div class="partial-time-actions">
          <button v-if="commentDialog.id" type="button" class="comment-delete" :disabled="commentDialog.saving" @click="deleteComment">
            Löschen
          </button>
          <button type="button" class="partial-time-save" :disabled="commentDialog.saving || !commentDialog.text.trim()" @click="saveComment">
            {{ commentDialog.saving ? 'Wird gespeichert...' : 'Speichern' }}
          </button>
        </div>
      </section>
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
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  einsaetze: { type: Array, default: () => [] },
  isTeamleiter: { type: Boolean, default: false },
  api: { type: [Object, Function], default: null },
  email: { type: String, default: '' },
});

defineEmits(['back', 'open-job']);

const currentMonth = ref(new Date().getMonth());
const currentYear = ref(new Date().getFullYear());
const selectedDay = ref(null);
const availabilityEntries = ref([]);
const commentEntries = ref([]);
const availabilitySaving = ref(false);
const availabilityError = ref('');
const availabilityMenuOpen = ref(false);
const availabilityMode = ref(null);
const commentMode = ref(false);
const commentDialog = ref({ open: false, id: null, day: null, text: '', saving: false, error: '' });
const partialTimeDialog = ref({ open: false, day: null, vonHour: '09', vonMinute: '00', bisHour: '17', bisMinute: '00' });

const availabilityOptions = [
  { value: 'available', label: 'Verfügbar', icon: 'fa-solid fa-check' },
  { value: 'blocked', label: 'Nicht verfügbar', icon: 'fa-solid fa-xmark' },
  { value: 'partially', label: 'Teilweise verfügbar', icon: 'fa-solid fa-circle-half-stroke' },
  { value: 'clear', label: 'Status löschen', icon: 'fa-solid fa-eraser' },
];

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];

const currentMonthName = computed(() => {
  return new Date(currentYear.value, currentMonth.value)
    .toLocaleDateString('de-DE', { month: 'long', timeZone: 'Europe/Berlin' });
});

function formatDateFull(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return 'Heute';
  return dt.toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin'
  });
}

function formatTime(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
    return val.substring(0, 5);
  }
  // Full JS .toString() date string — extract HH:MM directly
  if (typeof val === 'string') {
    const m = val.match(/\d{4} (\d{2}:\d{2}):\d{2}/);
    if (m) return m[1];
  }
  return '';
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

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const canManageAvailability = computed(() => Boolean(props.api && props.email));
const availabilityByDate = computed(() => new Map(
  availabilityEntries.value.map((entry) => [toIsoDate(new Date(entry.datumVon)), entry])
));
const commentDates = computed(() => new Set(
  commentEntries.value.map((entry) => entry.context?.datum).filter(Boolean)
));
const commentByDate = computed(() => new Map(
  commentEntries.value.map((entry) => [entry.context?.datum, entry])
));

function selectAvailabilityMode(option) {
  availabilityMode.value = availabilityMode.value?.value === option.value ? null : option;
  commentMode.value = false;
  availabilityMenuOpen.value = false;
  availabilityError.value = '';
}

function toggleCommentMode() {
  commentMode.value = !commentMode.value;
  availabilityMode.value = null;
  availabilityMenuOpen.value = false;
}

function openCommentDialog(day) {
  const existingComment = commentByDate.value.get(toIsoDate(day.date));
  commentDialog.value = {
    open: true,
    id: existingComment?._id || null,
    day,
    text: existingComment?.text || '',
    saving: false,
    error: '',
  };
}

function closeCommentDialog() {
  commentDialog.value = { open: false, id: null, day: null, text: '', saving: false, error: '' };
}

async function saveComment() {
  const { day, text } = commentDialog.value;
  if (!day || !text.trim()) return;
  commentDialog.value.saving = true;
  commentDialog.value.error = '';
  try {
    const { data } = commentDialog.value.id
      ? await props.api.put(`/api/public/dispo-kommentare/${commentDialog.value.id}`, { email: props.email, text: text.trim() })
      : await props.api.post('/api/public/dispo-kommentare', { email: props.email, datum: toIsoDate(day.date), text: text.trim() });
    commentEntries.value = [...commentEntries.value.filter((entry) => entry._id !== data._id), data];
    closeCommentDialog();
  } catch (error) {
    commentDialog.value.error = error.response?.data?.msg || 'Kommentar konnte nicht gespeichert werden.';
  } finally {
    commentDialog.value.saving = false;
  }
}

async function deleteComment() {
  const { id } = commentDialog.value;
  if (!id) return;
  commentDialog.value.saving = true;
  commentDialog.value.error = '';
  try {
    await props.api.delete(`/api/public/dispo-kommentare/${id}`, { data: { email: props.email } });
    commentEntries.value = commentEntries.value.filter((entry) => entry._id !== id);
    closeCommentDialog();
  } catch (error) {
    commentDialog.value.error = error.response?.data?.msg || 'Kommentar konnte nicht gelöscht werden.';
  } finally {
    commentDialog.value.saving = false;
  }
}

function formatAvailabilityTime(entry) {
  const from = entry.zeitVon || '';
  const to = entry.zeitBis || '';
  return from && to ? `${from}-${to}` : from || to;
}

function availabilityIcon(status) {
  return {
    available: 'fa-solid fa-check',
    partially: 'fa-solid fa-circle-half-stroke',
    blocked: 'fa-solid fa-xmark',
  }[status];
}

function openPartialTimeDialog(day) {
  const [vonHour = '09', vonMinute = '00'] = (day.availability?.zeitVon || '09:00').split(':');
  const [bisHour = '17', bisMinute = '00'] = (day.availability?.zeitBis || '17:00').split(':');
  partialTimeDialog.value = {
    open: true,
    day,
    vonHour,
    vonMinute,
    bisHour,
    bisMinute,
  };
  availabilityError.value = '';
}

function closePartialTimeDialog() {
  partialTimeDialog.value = { open: false, day: null, vonHour: '09', vonMinute: '00', bisHour: '17', bisMinute: '00' };
  availabilityError.value = '';
}

async function loadAvailability() {
  if (!canManageAvailability.value) return;
  const from = new Date(currentYear.value, currentMonth.value, 1);
  const to = new Date(currentYear.value, currentMonth.value + 1, 0);
  try {
    const { data } = await props.api.get('/api/public/verfuegbarkeit', {
      params: { email: props.email, von: toIsoDate(from), bis: toIsoDate(to) }
    });
    availabilityEntries.value = data;
  } catch {
    availabilityError.value = 'Verfügbarkeit konnte nicht geladen werden.';
  }
}

async function loadComments() {
  if (!canManageAvailability.value) return;
  const from = new Date(currentYear.value, currentMonth.value, 1);
  const to = new Date(currentYear.value, currentMonth.value + 1, 0);
  try {
    const { data } = await props.api.get('/api/public/dispo-kommentare', {
      params: { email: props.email, von: toIsoDate(from), bis: toIsoDate(to) }
    });
    commentEntries.value = data;
  } catch {
    commentEntries.value = [];
  }
}

async function saveAvailability(day, zeitVon, zeitBis) {
  availabilitySaving.value = true;
  availabilityError.value = '';
  try {
    const { data } = await props.api.post('/api/public/verfuegbarkeit', {
      email: props.email,
      datum: toIsoDate(day.date),
      verfuegbarkeit: availabilityMode.value.value,
      ...(zeitVon ? { zeitVon } : {}),
      ...(zeitBis ? { zeitBis } : {}),
    });
    availabilityEntries.value = [
      ...availabilityEntries.value.filter((entry) => toIsoDate(new Date(entry.datumVon)) !== toIsoDate(day.date)),
      data,
    ];
    selectedDay.value = { ...day, availability: data };
  } catch (error) {
    availabilityError.value = error.response?.data?.msg || 'Speichern fehlgeschlagen.';
  } finally {
    availabilitySaving.value = false;
  }
}

async function confirmPartialAvailability() {
  const { day, vonHour, vonMinute, bisHour, bisMinute } = partialTimeDialog.value;
  const zeitVon = `${vonHour}:${vonMinute}`;
  const zeitBis = `${bisHour}:${bisMinute}`;
  if (zeitVon >= zeitBis) {
    availabilityError.value = 'Die Endzeit muss nach der Startzeit liegen.';
    return;
  }

  await saveAvailability(day, zeitVon, zeitBis);
  if (!availabilityError.value) closePartialTimeDialog();
}

async function clearAvailability(day) {
  availabilitySaving.value = true;
  availabilityError.value = '';
  try {
    await props.api.delete('/api/public/verfuegbarkeit', {
      data: { email: props.email, datum: toIsoDate(day.date) }
    });
    availabilityEntries.value = availabilityEntries.value.filter(
      (entry) => toIsoDate(new Date(entry.datumVon)) !== toIsoDate(day.date)
    );
    selectedDay.value = { ...day, availability: null };
  } catch (error) {
    availabilityError.value = error.response?.data?.msg || 'Zurücksetzen fehlgeschlagen.';
  } finally {
    availabilitySaving.value = false;
  }
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
      einsaetze: props.einsaetze.filter(e => isEinsatzOnDay(e, date)),
      availability: availabilityByDate.value.get(toIsoDate(date)) || null,
    });
  }

  // Fill only the final calendar week; do not force an empty sixth row.
  const remaining = (7 - (days.length % 7)) % 7;
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
  if (commentMode.value) {
    openCommentDialog(day);
    return;
  }
  if (day.einsaetze.length > 0 || !canManageAvailability.value || availabilitySaving.value) {
    selectedDay.value = day;
    return;
  }
  if (!availabilityMode.value) {
    selectedDay.value = day;
    return;
  }

  if (availabilityMode.value.value === 'clear'
    || day.availability?.verfuegbarkeit === availabilityMode.value.value) {
    clearAvailability(day);
  } else if (availabilityMode.value.value === 'partially') {
    openPartialTimeDialog(day);
  } else {
    saveAvailability(day);
  }
}

onMounted(loadAvailability);
onMounted(loadComments);
watch([currentMonth, currentYear], () => {
  loadAvailability();
  loadComments();
});

</script>

<style scoped>
.kalender-view {
  padding: 0 0 2rem;
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
  justify-content: flex-start;
  padding-top: calc(50% - 0.5rem);
  box-sizing: border-box;
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

.calendar-day.availability-available:not(.today) { background: rgba(33, 150, 83, 0.12); }
.calendar-day.availability-partially:not(.today) { background: rgba(255, 179, 0, 0.16); }
.calendar-day.availability-blocked:not(.today) { background: rgba(220, 53, 69, 0.12); }

.availability-status-icon {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  font-size: 0.65rem;
}
.comment-status-icon {
  position: absolute;
  top: 0.45rem;
  left: 0.45rem;
  color: var(--primary);
  font-size: 0.65rem;
}
.availability-available .availability-status-icon { color: #219653; }
.availability-partially .availability-status-icon { color: #c58a00; }
.availability-blocked .availability-status-icon { color: #dc3545; }

.day-number {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
  line-height: 1;
}

.availability-time {
  height: 0.7rem;
  max-width: 100%;
  overflow: hidden;
  color: var(--primary);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  text-overflow: clip;
  white-space: nowrap;
}

.partial-time-overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.35);
}

.partial-time-dialog {
  width: min(100%, 390px);
  padding: 1rem;
  border-radius: 8px;
  background: var(--tile-bg);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.2);
}

.partial-time-header, .partial-time-actions, .partial-time-fields {
  display: flex;
  align-items: center;
}
.partial-time-header { justify-content: space-between; }
.partial-time-header h3 { margin: 0; color: var(--text); font-size: 1rem; }
.partial-time-header p { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.78rem; }
.partial-time-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: flex-start; gap: 1.25rem; margin: 1rem 0 1.25rem; }
.partial-time-field { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.45rem; color: var(--muted); font-size: 0.8rem; }
.partial-time-field select { width: 100%; min-width: 0; border: 1px solid var(--border); border-radius: 5px; background: var(--bg); color: var(--text); font-size: 0.9rem; padding: 0.35rem; }
.minute-options { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; }
.minute-options button { border: 1px solid var(--border); border-radius: 5px; background: var(--bg); color: var(--text); cursor: pointer; font-size: 0.75rem; font-weight: 600; padding: 0.35rem 0.25rem; }
.minute-options button.active { border-color: var(--primary); background: transparent; color: var(--primary); }
.partial-time-error { margin: 0 0 0.75rem; color: #dc3545; font-size: 0.78rem; }
.partial-time-actions { justify-content: center; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.85rem; }
.partial-time-actions button { border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.65rem; }
.partial-time-save { border-color: var(--primary) !important; background: transparent; color: var(--primary); }
.partial-time-save:disabled { cursor: not-allowed; opacity: 0.6; }
.comment-delete { border-color: #dc3545 !important; background: transparent; color: #dc3545; }

.comment-dialog {
  width: min(100%, 390px);
  padding: 1rem;
  border-radius: 8px;
  background: var(--tile-bg);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.2);
}
.comment-dialog h3 { margin: 0; color: var(--text); font-size: 1rem; }
.comment-dialog > p:not(.partial-time-error) { margin: 0.2rem 0 1rem; color: var(--muted); font-size: 0.78rem; }
.comment-dialog textarea { box-sizing: border-box; width: 100%; min-height: 100px; resize: vertical; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font: inherit; padding: 0.65rem; }
.comment-dialog .partial-time-actions { border-top: 0; padding-top: 0.75rem; }
.comment-dialog .partial-time-save { background: transparent; color: var(--primary); }

@media (max-width: 420px) {
  .partial-time-fields { gap: 0.75rem; }
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

.availability-control { display: flex; align-items: center; gap: 0.45rem; }
.availability-label { color: var(--muted); font-size: 0.78rem; font-weight: 600; }
.availability-menu-wrap { position: relative; }
.availability-menu-btn, .availability-menu button {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
}
.availability-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
}
.availability-menu-btn.active { border-color: var(--primary); color: var(--primary); }
.comment-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
}
.comment-mode-btn.active { border-color: var(--primary); color: var(--primary); }
.availability-menu {
  position: absolute;
  z-index: 5;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 190px;
  padding: 0.3rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

@media (max-width: 560px) {
  .calendar-controls {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    row-gap: 0.65rem;
    margin-bottom: 1rem;
  }
  .nav-btn--previous { grid-column: 1; grid-row: 1; }
  .current-month { grid-column: 2; grid-row: 1; justify-self: center; }
  .nav-btn--next { grid-column: 3; grid-row: 1; }
  .availability-control {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: center;
  }
}
.availability-menu button {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  border: 0;
  border-radius: 5px;
  padding: 0.55rem;
  text-align: left;
}
.availability-menu button:hover, .availability-menu button.active { background: var(--hover); color: var(--primary); }

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
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
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
  flex-wrap: wrap;
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

.kalender-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.cal-export-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.cal-export-btn:active {
  background: var(--hover);
  color: var(--primary);
  border-color: var(--primary);
}
</style>
