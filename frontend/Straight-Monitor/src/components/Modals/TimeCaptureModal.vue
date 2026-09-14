<template>
  <ModalFrame
    :model-value="modelValue"
    title="Stundenschnellerfassung"
    subtitle="Mitarbeitereingabe → interne Prüfung → Zeitverwaltung"
    size="xl"
    minimizable
    :minimize-id="minimizeId"
    :close-on-backdrop="false"
    :close-on-escape="false"
    :show-close="!busy"
    style="--mf-max-width: min(1580px, 97vw); --mf-body-padding: 0; --mf-body-overflow: hidden; --mf-max-height: 94dvh"
    @close="close"
  >
    <div class="time-capture">
      <div class="time-capture__controls">
        <template v-if="employeeId && !auftragNr">
          <label>Monat <input
            v-model="month"
            type="month"
            :disabled="busy || loading || dirty"
            @change="loadOrders"
          ></label>
          <label>Auftrag <select
            v-model="selectedOrder"
            :disabled="busy || loading || dirty"
            @change="loadReview"
          >
            <option value="">Auftrag auswählen</option>
            <option
              v-for="order in orders"
              :key="order.auftragNr"
              :value="order.auftragNr"
            >{{ orderOptionLabel(order) }}</option>
          </select></label>
        </template>
        <span v-else>Auftrag #{{ selectedOrder }}</span>
        <button
          type="button"
          :disabled="busy || loading"
          @click="reload"
        >
          Neu laden
        </button>
        <label v-if="employees.length">Zeitverwaltung
          <select
            v-model="monthEmployee"
            :disabled="busy || loading"
          ><option
            v-for="employee in employees"
            :key="employee.id"
            :value="employee.id"
          >{{ employee.name }}</option></select>
        </label>
        <label v-if="auftragNr">Monat <input
          v-model="month"
          type="month"
        ></label>
        <button
          v-if="monthEmployee"
          type="button"
          :disabled="busy || loading"
          @click="openMonth"
        >
          Monat öffnen
        </button>
      </div>
      <OrderDocuments
        v-if="selectedOrder"
        :auftrag-nr="selectedOrder"
      />
      <p
        v-if="error"
        class="time-capture__notice time-capture__notice--error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="notice"
        class="time-capture__notice"
        role="status"
      >
        {{ notice }}
      </p>
      <p
        v-if="loading"
        class="time-capture__notice"
        role="status"
      >
        Stunden werden geladen …
      </p>
      <template v-if="review && !loading">
        <label class="time-capture__reason">Bearbeitungsvermerk <span>(optional)</span>
          <input
            v-model="reason"
            maxlength="1000"
            :disabled="busy || loading"
            placeholder="z. B. Pause mit Mitarbeiter abgestimmt"
          >
        </label>
        <Stundenschnellerfassung
          :key="generation"
          contained
          connected
          :busy="busy"
          :auftrag="review.auftrag"
          :schichten="review.schichten"
          :einsaetze="assignments"
          :zeiten="times"
          @submit="save"
          @cancel="close"
          @dirty-change="dirty = $event"
        />
        <details class="time-capture__history">
          <summary>Bearbeitungsverlauf · {{ history.length }} Einträge</summary>
          <div
            v-for="(item, index) in history"
            :key="index"
          >
            {{ item.employee }} · {{ dateTime(item.at) }} · {{ statusLabel(item.action) }} · {{ item.values.start }}–{{ item.values.end }} · {{ item.values.netMinutes }} Min. · {{ item.by?.name || 'Mitarbeiter' }} · {{ item.reason || 'Eigene Einreichung' }}
          </div>
        </details>
      </template>
      <p
        v-else-if="!loading && !error"
        class="time-capture__notice"
      >
        {{ orders.length ? 'Bitte einen Auftrag auswählen.' : 'Keine verfügbaren Aufträge für diesen Monat.' }}
      </p>
      <div
        v-if="confirmAction"
        class="time-capture__confirm"
        role="alert"
      >
        <span>Ungespeicherte Änderungen verwerfen?</span>
        <button
          type="button"
          @click="runConfirmed"
        >
          Verwerfen und fortfahren
        </button>
        <button
          type="button"
          @click="confirmAction = null"
        >
          Weiter bearbeiten
        </button>
      </div>
    </div>
  </ModalFrame>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import Stundenschnellerfassung from '@/components/ui-elements/Stundenschnellerfassung.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
const props = defineProps({ modelValue: { type: Boolean, default: true }, auftragNr: { type: [String, Number], default: null }, employeeId: { type: String, default: null }, minimizeId: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const router = useRouter();
const month = ref(new Date().toLocaleDateString('sv-SE').slice(0, 7));
const selectedOrder = ref(props.auftragNr || '');
const orders = ref([]), review = ref(null), generation = ref(0), loading = ref(false), busy = ref(false);
const dirty = ref(false), error = ref(''), notice = ref(''), reason = ref(''), confirmAction = ref(null), monthEmployee = ref(props.employeeId || '');
const statusLabel = status => ({ SUBMITTED: 'Vom Mitarbeiter eingereicht', DRAFT: 'Interner Entwurf', RELEASED: 'An Zeitverwaltung übergeben' }[status] || 'Offen');
function orderOptionLabel(order) {
  const date = String(order.vonDatum || '').slice(0, 10);
  const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Datum offen';
  return `${dateLabel} · #${order.auftragNr} · ${order.eventTitel}`;
}
const assignments = computed(() => (review.value?.einsaetze || []).map(einsatz => {
  const entry = review.value.entries.find(row => row._id === einsatz._id);
  return { ...einsatz, timeStatus: statusLabel(entry?.status), timeSubmission: entry?.employeeSubmission };
}));
const times = computed(() => (review.value?.entries || []).map(entry => ({ einsatzId: entry._id, ...entry.current })));
const employees = computed(() => [...new Map(assignments.value.filter(item => item.mitarbeiterData?._id).map(item => [item.mitarbeiterData._id, { id: item.mitarbeiterData._id, name: [item.mitarbeiterData.vorname, item.mitarbeiterData.nachname].filter(Boolean).join(' ') }])).values()]);
const history = computed(() => (review.value?.entries || []).flatMap(entry => (entry.history || []).map(item => ({ ...item, employee: assignments.value.find(value => value._id === entry._id)?.mitarbeiterData?.nachname || entry.personalNr }))).sort((a, b) => new Date(b.at) - new Date(a.at)));
const dateTime = date => new Date(date).toLocaleString('de-DE');
const messageOf = error => error?.response?.data?.message || 'Die Anfrage konnte nicht abgeschlossen werden. Eingaben bleiben erhalten.';
function guard(action) { if (dirty.value) confirmAction.value = action; else action(); }
function runConfirmed() { const action = confirmAction.value; confirmAction.value = null; dirty.value = false; action?.(); }
function close() { if (!busy.value) guard(() => emit('update:modelValue', false)); }
function reload() { if (!busy.value) guard(() => selectedOrder.value ? loadReview() : loadOrders()); }
function openMonth() { router.push({ name: 'Zeitverwaltung', params: { employeeId: monthEmployee.value }, query: { month: month.value } }); }
async function loadOrders() {
  loading.value = true; error.value = ''; review.value = null; selectedOrder.value = '';
  try {
    const { data } = await api.get(`/api/working-times/employees/${props.employeeId}/orders`, { params: { month: month.value } });
    orders.value = data.orders;
    selectedOrder.value = data.orders[0]?.auftragNr || '';
    if (selectedOrder.value) await loadReview();
  } catch (failure) { error.value = messageOf(failure); }
  finally { loading.value = false; }
}
async function loadReview() {
  if (!selectedOrder.value) { review.value = null; return; }
  loading.value = true; error.value = '';
  review.value = null;
  try {
    const { data } = await api.get(`/api/working-times/orders/${selectedOrder.value}`, { params: { employeeId: props.employeeId || undefined } });
    review.value = data; generation.value++; dirty.value = false;
    if (!monthEmployee.value) monthEmployee.value = employees.value[0]?.id || '';
  } catch (failure) { error.value = messageOf(failure); }
  finally { loading.value = false; }
}
async function save(payload) {
  if (busy.value) return;
  error.value = ''; notice.value = '';
  if (payload.clearedEinsatzIds.length) { error.value = 'Gespeicherte Zeiten können nicht gelöscht werden. Bitte gültige korrigierte Zeiten eintragen oder die Zeile zurücksetzen.'; return; }
  const entries = payload.entries.filter(row => row.dirty || (payload.action === 'release' && review.value.entries.find(entry => entry._id === row.einsatzId)?.status !== 'RELEASED'))
    .map(row => ({ ...row, revision: review.value.entries.find(entry => entry._id === row.einsatzId)?.revision || 0 }));
  if (!entries.length) { notice.value = 'Keine neuen Änderungen zur Übernahme.'; return; }
  busy.value = true;
  try {
    await api.post(`/api/working-times/orders/${selectedOrder.value}`, { action: payload.action, reason: reason.value.trim(), entries });
    if (payload.action === 'release') window.dispatchEvent(new CustomEvent('working-times:released'));
    notice.value = payload.action === 'release' ? `${entries.length} Einsätze an die Zeitverwaltung übergeben.` : 'Entwurf gespeichert. Die Zeitverwaltung bleibt bis zur Übergabe auf dem bisherigen Stand.';
    dirty.value = false; reason.value = '';
    await loadReview();
  } catch (failure) { error.value = messageOf(failure); }
  finally { busy.value = false; }
}
onMounted(() => props.auftragNr ? loadReview() : loadOrders());
</script>

<style scoped>
.time-capture { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; color: var(--text); }
.time-capture > :not(.quick-time) { flex-shrink: 0; }
.time-capture__controls { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 12px; }
.time-capture label { display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--muted); }
.time-capture input, .time-capture select, .time-capture button { padding: 8px 10px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font: inherit; }
.time-capture button { cursor: pointer; }
.time-capture :disabled { opacity: .55; cursor: default; }
.time-capture :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.time-capture__reason { padding: 10px 20px; }
.time-capture__reason span { font-weight: 400; }
.time-capture__notice { padding: 10px 20px; margin: 0; font-size: 12px; background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.time-capture__notice--error { color: #c75048; }
.time-capture__history { flex-shrink: 0; padding: 10px 20px; border-top: 1px solid var(--border); font-size: 11px; max-height: 160px; overflow: auto; }
.time-capture__history div { padding: 5px 0; }
.time-capture__history summary { cursor: pointer; }
.time-capture__confirm { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--border); }
</style>
