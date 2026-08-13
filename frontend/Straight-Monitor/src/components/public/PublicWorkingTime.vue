<template>
  <section class="working-time">
    <div class="intro">
      <div>
        <p class="eyebrow">Lohnrelevante Ist-Zeit</p>
        <h2>Einsatzzeit erfassen</h2>
        <p>
          Beginn, Ende und jede Pause werden minutengenau gespeichert. Erst nach deiner
          Abgabe und der Freigabe durch das Büro fließt die Zeit in die Abrechnung ein.
        </p>
      </div>
      <span class="timezone">{{ timeZone }}</span>
    </div>

    <div v-if="loading" class="state-card">Einsatzzeiten werden geladen …</div>
    <div v-else-if="loadError" class="state-card state-card--error">
      <strong>Daten konnten nicht geladen werden.</strong>
      <span>{{ loadError }}</span>
      <button class="secondary-button" type="button" @click="load">Erneut versuchen</button>
    </div>

    <template v-else>
      <article v-if="openEntry" class="timer-card">
        <div class="timer-card__top">
          <div>
            <span class="status status--open">Läuft</span>
            <h3>{{ assignmentTitle(openEntry.assignmentLedger) }}</h3>
            <p>{{ assignmentSite(openEntry.assignmentLedger) }}</p>
          </div>
          <div class="elapsed" aria-live="polite">{{ elapsedLabel }}</div>
        </div>

        <form class="submission" @submit.prevent="submitOpenEntry">
          <div class="field-grid">
            <label>
              <span>Beginn</span>
              <input v-model="form.actualStart" type="datetime-local" step="60" required />
            </label>
            <label>
              <span>Ende</span>
              <input v-model="form.actualEnd" type="datetime-local" step="60" required />
            </label>
          </div>

          <div class="breaks-heading">
            <div>
              <strong>Pausen</strong>
              <span>Auch bei keiner Pause ausdrücklich leer lassen.</span>
            </div>
            <button class="secondary-button" type="button" @click="addBreak">Pause hinzufügen</button>
          </div>

          <div v-for="(pause, index) in form.breaks" :key="pause.key" class="break-row">
            <label>
              <span>Pausenbeginn</span>
              <input v-model="pause.startedAt" type="datetime-local" step="60" required />
            </label>
            <label>
              <span>Pausenende</span>
              <input v-model="pause.endedAt" type="datetime-local" step="60" required />
            </label>
            <button class="remove-button" type="button" :aria-label="`Pause ${index + 1} entfernen`" @click="removeBreak(index)">
              Entfernen
            </button>
          </div>

          <p v-if="actionError" class="action-error">{{ actionError }}</p>
          <div class="submit-row">
            <span class="evidence-note">Die ursprünglichen Empfangszeiten bleiben als Nachweis erhalten.</span>
            <button class="primary-button" type="submit" :disabled="busy">
              {{ busy ? 'Wird übermittelt …' : 'Zeit prüfen und einreichen' }}
            </button>
          </div>
        </form>
      </article>

      <section v-else class="assignments-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Verfügbare Einsätze</p>
            <h3>Welcher Einsatz beginnt?</h3>
          </div>
          <span>{{ assignments.length }} verfügbar</span>
        </div>

        <div v-if="!assignments.length" class="state-card">
          Für die kommenden 31 Tage ist noch kein abrechnungsfähiger Einsatz freigegeben.
        </div>
        <div v-else class="assignment-list">
          <article v-for="assignment in assignments" :key="assignment._id" class="assignment-card">
            <div>
              <strong>{{ assignmentTitle(assignment) }}</strong>
              <span>{{ assignmentPeriod(assignment) }}</span>
              <span>{{ assignmentSite(assignment) }}</span>
            </div>
            <button class="primary-button" type="button" :disabled="busy" @click="start(assignment._id)">
              Jetzt starten
            </button>
          </article>
        </div>
        <p v-if="actionError" class="action-error">{{ actionError }}</p>
      </section>

      <section class="history-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Nachweis</p>
            <h3>Letzte Buchungen</h3>
          </div>
          <button class="secondary-button" type="button" :disabled="busy" @click="load">Aktualisieren</button>
        </div>
        <div v-if="!closedEntries.length" class="state-card">Noch keine eingereichten Zeitbuchungen.</div>
        <div v-else class="history-list">
          <article v-for="entry in closedEntries" :key="entry._id" class="history-card">
            <div>
              <strong>{{ formatDate(entry.workDate) }}</strong>
              <span>{{ timeRange(entry) }}</span>
              <span>{{ assignmentTitle(entry.assignmentLedger) }}</span>
            </div>
            <div class="history-card__result">
              <strong>{{ workedHours(entry) }}</strong>
              <span class="status" :class="statusClass(entry.status)">{{ statusLabel(entry.status) }}</span>
            </div>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

const props = defineProps({
  api: { type: [Object, Function], required: true },
});

const loading = ref(true);
const busy = ref(false);
const loadError = ref('');
const actionError = ref('');
const assignments = ref([]);
const entries = ref([]);
const now = ref(Date.now());
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
let ticker = null;

const form = reactive({ actualStart: '', actualEnd: '', breaks: [] });
const openEntry = computed(() => entries.value.find((entry) => entry.status === 'OPEN') || null);
const closedEntries = computed(() => entries.value.filter((entry) => entry.status !== 'OPEN'));

const elapsedLabel = computed(() => {
  const startedAt = openEntry.value?.actual?.start;
  if (!startedAt) return '00:00';
  const seconds = Math.max(0, Math.floor((now.value - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
});

watch(openEntry, (entry) => {
  if (!entry) return;
  form.actualStart = toLocalInput(entry.actual?.start);
  if (!form.actualEnd) form.actualEnd = toLocalInput(floorMinute(new Date()));
}, { immediate: true });

function errorMessage(error) {
  return error?.response?.data?.message || error?.response?.data?.msg || error?.message || 'Unbekannter Fehler';
}

function floorMinute(value) {
  const date = new Date(value);
  date.setSeconds(0, 0);
  return date;
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIso(value) {
  const date = new Date(value);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function deviceId() {
  const key = 'straight-monitor:time-device';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(key, value);
  }
  return value;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [assignmentResponse, entryResponse] = await Promise.all([
      props.api.get('/api/public/payroll-time/assignments'),
      props.api.get('/api/public/payroll-time/entries', { params: { limit: 31 } }),
    ]);
    assignments.value = assignmentResponse.data?.assignments || [];
    entries.value = entryResponse.data?.entries || [];
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function start(assignmentLedgerId) {
  busy.value = true;
  actionError.value = '';
  try {
    const response = await props.api.post('/api/public/payroll-time/start', {
      assignmentLedgerId,
      clientTimeZone: timeZone,
      deviceId: deviceId(),
    });
    entries.value = [response.data.entry, ...entries.value.filter((entry) => entry.status !== 'OPEN')];
    form.actualEnd = toLocalInput(floorMinute(new Date()));
    form.breaks = [];
  } catch (error) {
    actionError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

function addBreak() {
  const end = form.actualEnd || toLocalInput(floorMinute(new Date()));
  form.breaks.push({ key: `${Date.now()}-${form.breaks.length}`, startedAt: end, endedAt: end });
}

function removeBreak(index) {
  form.breaks.splice(index, 1);
}

async function submitOpenEntry() {
  if (!openEntry.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const payload = {
      actualStart: toIso(form.actualStart),
      actualEnd: toIso(form.actualEnd),
      breaks: form.breaks.map((entry) => ({
        startedAt: toIso(entry.startedAt),
        endedAt: toIso(entry.endedAt),
        source: 'employee',
      })),
      clientTimeZone: timeZone,
      deviceId: deviceId(),
    };
    const response = await props.api.post(`/api/public/payroll-time/${openEntry.value._id}/submit`, payload);
    entries.value = [response.data.entry, ...entries.value.filter((entry) => entry._id !== openEntry.value?._id)];
    form.actualStart = '';
    form.actualEnd = '';
    form.breaks = [];
    await load();
  } catch (error) {
    actionError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

function assignmentTitle(assignment) {
  return assignment?.auftrag?.eventTitel || assignment?.activityLabel || assignment?.assignmentKey || 'Einsatz';
}

function assignmentSite(assignment) {
  return assignment?.workLocation?.name || assignment?.siteKey || assignment?.kunde?.kundName || 'Einsatzort noch nicht benannt';
}

function assignmentPeriod(assignment) {
  const from = formatDate(assignment?.assignmentFrom);
  const till = assignment?.assignmentTill ? formatDate(assignment.assignmentTill) : 'offen';
  return `${from} – ${till}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}

function timeRange(entry) {
  const pause = Number(entry.actual?.breakMinutes?.$numberDecimal ?? entry.actual?.breakMinutes ?? 0);
  return `${formatTime(entry.actual?.start)} – ${formatTime(entry.actual?.end)} · ${pause} Min. Pause`;
}

function workedHours(entry) {
  const value = Number(entry.actual?.workedHours?.$numberDecimal ?? entry.actual?.workedHours ?? 0);
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Std.`;
}

const labels = {
  SUBMITTED: 'Eingereicht', APPROVED: 'Freigegeben', REJECTED: 'Abgelehnt', LOCKED: 'Abgerechnet', VOIDED: 'Storniert',
};
function statusLabel(status) { return labels[status] || status; }
function statusClass(status) { return `status--${String(status || '').toLowerCase()}`; }

onMounted(() => {
  load();
  ticker = window.setInterval(() => { now.value = Date.now(); }, 1000);
});
onUnmounted(() => { if (ticker) window.clearInterval(ticker); });
</script>

<style scoped>
.working-time { display: grid; gap: 1.5rem; padding-bottom: 2rem; color: var(--text-primary); }
.intro, .timer-card, .assignments-section, .history-section { border: 1px solid var(--border-color); border-radius: 18px; background: var(--bg-card); padding: 1.25rem; }
.intro { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.intro h2, .section-heading h3, .timer-card h3 { margin: .15rem 0 .35rem; }
.intro p:not(.eyebrow), .timer-card p, .assignment-card span, .history-card span, .breaks-heading span, .evidence-note { color: var(--text-secondary); }
.eyebrow { margin: 0; color: var(--primary); font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.timezone { white-space: nowrap; border-radius: 999px; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); padding: .35rem .65rem; font-size: .75rem; font-weight: 700; }
.timer-card { border-color: color-mix(in srgb, #23a36d 45%, var(--border-color)); }
.timer-card__top, .section-heading, .submit-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.elapsed { font-variant-numeric: tabular-nums; font-size: clamp(1.8rem, 7vw, 3rem); font-weight: 800; }
.submission { display: grid; gap: 1rem; margin-top: 1.25rem; }
.field-grid, .break-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
label { display: grid; gap: .35rem; color: var(--text-secondary); font-size: .82rem; font-weight: 700; }
input { width: 100%; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); color: var(--text-primary); padding: .75rem; font: inherit; box-sizing: border-box; }
.breaks-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.breaks-heading > div { display: grid; gap: .15rem; }
.breaks-heading span { font-size: .8rem; }
.break-row { align-items: end; border-left: 3px solid var(--border-color); padding-left: .75rem; }
.break-row .remove-button { grid-column: 1 / -1; justify-self: start; }
.assignment-list, .history-list { display: grid; gap: .75rem; margin-top: 1rem; }
.assignment-card, .history-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; }
.assignment-card > div, .history-card > div { display: grid; gap: .2rem; }
.history-card__result { justify-items: end; }
.primary-button, .secondary-button, .remove-button { min-height: 42px; border-radius: 10px; padding: .65rem .9rem; font: inherit; font-weight: 750; cursor: pointer; }
.primary-button { border: 1px solid var(--primary); background: var(--primary); color: white; }
.secondary-button { border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); }
.remove-button { border: 0; background: transparent; color: #c04444; padding-left: 0; }
button:disabled { cursor: not-allowed; opacity: .55; }
.state-card { display: grid; gap: .75rem; justify-items: start; border: 1px dashed var(--border-color); border-radius: 12px; padding: 1.25rem; color: var(--text-secondary); }
.state-card--error, .action-error { color: #c04444; }
.action-error { margin: 0; font-weight: 650; }
.status { display: inline-flex; width: fit-content; border-radius: 999px; padding: .25rem .55rem; background: var(--bg-secondary); font-size: .72rem; font-weight: 800; }
.status--open, .status--approved { background: #dff6eb; color: #15734b; }
.status--submitted { background: #fff1cf; color: #805c00; }
.status--rejected, .status--voided { background: #fde2e2; color: #a12e2e; }
.status--locked { background: #e5e8ff; color: #3c46a8; }

@media (max-width: 680px) {
  .intro, .timer-card__top, .section-heading, .submit-row, .assignment-card { align-items: stretch; flex-direction: column; }
  .field-grid, .break-row { grid-template-columns: 1fr; }
  .timezone { align-self: flex-start; }
  .primary-button, .secondary-button { width: 100%; }
  .history-card { align-items: flex-start; }
}
</style>
