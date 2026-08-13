<template>
  <section class="time-approval">
    <header>
      <div>
        <p class="eyebrow">Approval & Lock</p>
        <h2>Ist-Zeiten freigeben</h2>
        <p>Nur freigegebene, detaillierte Zeitbuchungen können in einen Payroll-Snapshot einfließen.</p>
      </div>
      <div class="filters">
        <label>Monat<input v-model="selectedMonth" type="month" /></label>
        <label>
          Status
          <select v-model="selectedStatus">
            <option value="SUBMITTED">Eingereicht</option>
            <option value="APPROVED">Freigegeben</option>
            <option value="LOCKED">Abgerechnet / gesperrt</option>
            <option value="REJECTED">Abgelehnt</option>
            <option value="">Alle</option>
          </select>
        </label>
        <button class="button" type="button" :disabled="loading" @click="load">Aktualisieren</button>
      </div>
    </header>

    <div v-if="error" class="notice notice--error">{{ error }}</div>
    <div v-if="loading" class="empty">Zeitbuchungen werden geladen …</div>
    <div v-else-if="!entries.length" class="empty">Für diese Auswahl liegen keine Zeitbuchungen vor.</div>
    <div v-else class="entry-list">
      <article v-for="entry in entries" :key="entry._id" class="entry-card">
        <div class="entry-date"><strong>{{ day(entry.workDate) }}</strong><span>{{ monthLabel(entry.workDate) }}</span></div>
        <div class="entry-person">
          <strong>{{ employeeName(entry) }}</strong>
          <span>{{ entry.mitarbeiter?.personalnr || entry.personalNrSnapshot }}</span>
          <small>{{ assignmentLabel(entry) }}</small>
        </div>
        <div class="entry-time">
          <strong>{{ time(entry.actual?.start) }} – {{ time(entry.actual?.end) }}</strong>
          <span>{{ decimal(entry.actual?.workedHours).toFixed(2) }} Std. · {{ decimal(entry.actual?.breakMinutes) }} Min. Pause</span>
        </div>
        <span class="status" :class="statusClass(entry.status)">{{ statusLabel(entry.status) }}</span>
        <div v-if="entry.status === 'SUBMITTED'" class="entry-actions">
          <button class="button button--approve" type="button" :disabled="Boolean(action)" @click="approve(entry)">
            {{ action === `approve:${entry._id}` ? 'Freigabe …' : 'Freigeben' }}
          </button>
          <button class="button" type="button" :disabled="Boolean(action)" @click="beginReject(entry)">Ablehnen</button>
        </div>
        <div v-if="rejectingId === entry._id" class="reject-form">
          <label>Ablehnungsgrund<textarea v-model.trim="rejectionReason" maxlength="2000" rows="2" placeholder="Konkrete Korrektur nennen" /></label>
          <div>
            <button class="button" type="button" @click="cancelReject">Abbrechen</button>
            <button class="button button--danger" type="button" :disabled="!rejectionReason || Boolean(action)" @click="reject(entry)">
              {{ action === `reject:${entry._id}` ? 'Ablehnung …' : 'Ablehnung bestätigen' }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import api from '@/utils/api';

const props = defineProps({ month: { type: String, default: '' } });
const selectedMonth = ref(props.month || new Date().toISOString().slice(0, 7));
const selectedStatus = ref('SUBMITTED');
const entries = ref([]);
const loading = ref(false);
const action = ref('');
const error = ref('');
const rejectingId = ref(null);
const rejectionReason = ref('');

const message = (caught) => caught?.response?.data?.message || caught?.message || 'Aktion fehlgeschlagen.';
const decimal = (value) => Number(value?.$numberDecimal ?? value ?? 0);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const params = { month: selectedMonth.value };
    if (selectedStatus.value) params.status = selectedStatus.value;
    const { data } = await api.get('/api/payroll/working-times', { params });
    entries.value = data.entries || [];
  } catch (caught) {
    error.value = message(caught);
  } finally {
    loading.value = false;
  }
}

async function approve(entry) {
  action.value = `approve:${entry._id}`;
  error.value = '';
  try {
    await api.post(`/api/payroll/working-times/${entry._id}/approve`);
    await load();
  } catch (caught) {
    error.value = message(caught);
  } finally {
    action.value = '';
  }
}

function beginReject(entry) { rejectingId.value = entry._id; rejectionReason.value = ''; }
function cancelReject() { rejectingId.value = null; rejectionReason.value = ''; }

async function reject(entry) {
  action.value = `reject:${entry._id}`;
  error.value = '';
  try {
    await api.post(`/api/payroll/working-times/${entry._id}/reject`, { reason: rejectionReason.value });
    cancelReject();
    await load();
  } catch (caught) {
    error.value = message(caught);
  } finally {
    action.value = '';
  }
}

const dateParts = (value) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', timeZone: 'Europe/Berlin' }).formatToParts(new Date(value));
const day = (value) => dateParts(value).find((part) => part.type === 'day')?.value || '—';
const monthLabel = (value) => dateParts(value).find((part) => part.type === 'month')?.value || '';
const time = (value) => value ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(value)) : '—';
const employeeName = (entry) => [entry.mitarbeiter?.vorname, entry.mitarbeiter?.nachname || entry.mitarbeiter?.name].filter(Boolean).join(' ') || 'Unbekannter Mitarbeiter';
const assignmentLabel = (entry) => entry.assignmentLedger?.activityLabel || entry.assignmentLedger?.workLocation?.name || 'Einsatz';
const statusLabel = (status) => ({ SUBMITTED: 'Eingereicht', APPROVED: 'Freigegeben', LOCKED: 'Gesperrt', REJECTED: 'Abgelehnt' }[status] || status);
const statusClass = (status) => `status--${String(status).toLowerCase()}`;

watch(() => props.month, (value) => { if (value) selectedMonth.value = value; });
watch([selectedMonth, selectedStatus], load);
onMounted(load);
</script>

<style scoped>
.time-approval { display: grid; gap: 14px; border: 1px solid var(--border, #dce4e7); border-radius: 15px; background: var(--panel, #fff); padding: 18px; color: var(--text, #152026); }
.time-approval > header { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
h2 { margin: 2px 0; }
p { margin: 4px 0 0; color: var(--text-muted, #64747c); }
.eyebrow { color: #237a5b; font-size: .7rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.filters { display: flex; align-items: end; gap: 8px; }
label { display: grid; gap: 4px; color: var(--text-muted, #64747c); font-size: .72rem; font-weight: 750; }
input, select, textarea { min-height: 38px; border: 1px solid var(--border, #ccd7db); border-radius: 9px; background: var(--bg, #fff); color: var(--text, #152026); padding: 8px 10px; font: inherit; box-sizing: border-box; }
.button { min-height: 38px; border: 1px solid var(--border, #cbd6da); border-radius: 9px; background: var(--panel, #fff); color: var(--text, #152026); padding: 8px 12px; font-weight: 750; cursor: pointer; }
.button:disabled { opacity: .48; cursor: not-allowed; }
.button--approve { border-color: #176447; background: #176447; color: white; }
.button--danger { border-color: #9b2c25; background: #9b2c25; color: white; }
.notice--error { border: 1px solid #e8b9b5; border-radius: 10px; background: #fff2f1; color: #8f2922; padding: 12px; }
.empty { border: 1px dashed var(--border, #dce4e7); border-radius: 10px; padding: 28px; color: var(--text-muted, #64747c); text-align: center; }
.entry-list { display: grid; gap: 8px; }
.entry-card { display: grid; grid-template-columns: 58px minmax(150px, 1.2fr) minmax(170px, 1fr) auto auto; align-items: center; gap: 14px; border: 1px solid var(--border, #dce4e7); border-radius: 11px; padding: 11px; }
.entry-date { display: grid; justify-items: center; border-radius: 9px; background: var(--bg, #f5f8f8); padding: 7px; text-transform: uppercase; }
.entry-date strong { font-size: 1.2rem; }
.entry-date span { color: var(--text-muted, #64747c); font-size: .65rem; font-weight: 800; }
.entry-person, .entry-time { display: grid; gap: 2px; }
.entry-person span, .entry-time span, .entry-person small { color: var(--text-muted, #64747c); font-size: .74rem; }
.entry-actions { display: flex; gap: 6px; }
.status { border-radius: 99px; background: #edf1f2; padding: 5px 8px; font-size: .68rem; font-weight: 850; white-space: nowrap; }
.status--submitted { background: #fff4d4; color: #785b00; }
.status--approved, .status--locked { background: #e7f7ef; color: #176447; }
.status--rejected { background: #fff0ef; color: #9b2c25; }
.reject-form { grid-column: 2 / -1; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px; border-top: 1px solid var(--border, #dce4e7); padding-top: 10px; }
.reject-form > div { display: flex; gap: 6px; }
@media (max-width: 950px) {
  .time-approval > header { align-items: stretch; flex-direction: column; }
  .entry-card { grid-template-columns: 52px minmax(0, 1fr) auto; }
  .entry-time { grid-column: 2; }
  .entry-actions { grid-column: 2 / -1; }
  .reject-form { grid-column: 1 / -1; }
}
@media (max-width: 620px) {
  .filters { align-items: stretch; flex-direction: column; }
  .filters .button { width: 100%; }
  .entry-card { grid-template-columns: 48px minmax(0, 1fr); }
  .entry-card > .status { grid-column: 2; }
  .entry-actions { grid-column: 1 / -1; }
  .entry-actions .button { flex: 1; }
  .reject-form { grid-template-columns: 1fr; }
  .reject-form > div { display: grid; }
}
</style>
