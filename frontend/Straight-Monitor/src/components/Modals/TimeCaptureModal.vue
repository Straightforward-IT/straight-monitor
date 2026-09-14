<template>
  <ModalFrame
    :model-value="modelValue"
    title="Stundenschnellerfassung"
    size="xl"
    minimizable
    :minimize-id="minimizeId"
    :close-on-backdrop="false"
    :close-on-escape="false"
    :show-close="!busy"
    style="--mf-max-width: min(1580px, 97vw); --mf-body-padding: 0; --mf-body-overflow: hidden; --mf-max-height: 94dvh"
    @close="close"
  >
    <template #actions>
      <CustomTooltip text="Neu laden">
        <button
          type="button"
          class="time-capture__header-action"
          aria-label="Neu laden"
          :disabled="busy || loading"
          @click="reload"
        >
          <FontAwesomeIcon :icon="faRotateRight" />
        </button>
      </CustomTooltip>
      <CustomTooltip
        v-if="monthEmployee"
        text="Monat in Stunden öffnen"
      >
        <button
          type="button"
          class="time-capture__header-action"
          aria-label="Monat in Stunden öffnen"
          :disabled="busy || loading"
          @click="openMonth"
        >
          <FontAwesomeIcon :icon="faArrowUpRightFromSquare" />
        </button>
      </CustomTooltip>
    </template>
    <div class="time-capture">
      <Toolbar class="time-capture__toolbar">
        <template v-if="employeeId && !auftragNr">
          <label
            class="time-capture__control time-capture__control--month"
            title="Monat"
          >
            <FontAwesomeIcon :icon="faCalendarDays" />
            <span class="time-capture__sr-only">Monat</span>
            <input
              v-model="month"
              type="month"
              aria-label="Monat"
              :disabled="busy || loading || dirty"
              @change="loadOrders"
            >
          </label>
          <label
            class="time-capture__control time-capture__control--order"
            title="Auftrag"
          >
            <FontAwesomeIcon :icon="faBriefcase" />
            <span class="time-capture__sr-only">Auftrag</span>
            <select
              v-model="selectedOrder"
              aria-label="Auftrag"
              :disabled="busy || loading || dirty"
              @change="loadReview"
            >
              <option value="">Auftrag auswählen</option>
              <option
                v-for="order in orders"
                :key="order.auftragNr"
                :value="order.auftragNr"
              >{{ orderOptionLabel(order) }}</option>
            </select>
          </label>
        </template>
        <span
          v-else
          class="time-capture__order-reference"
          :title="review?.auftrag?.eventTitel || `Auftrag #${selectedOrder}`"
        >{{ review?.auftrag?.eventTitel || 'Auftrag' }} <small>#{{ selectedOrder }}</small></span>
        <label
          v-if="employees.length"
          class="time-capture__control time-capture__control--employee"
          title="Zeitverwaltung"
        >
          <FontAwesomeIcon :icon="faUser" />
          <span class="time-capture__sr-only">Zeitverwaltung</span>
          <select
            v-model="monthEmployee"
            aria-label="Zeitverwaltung"
            :disabled="busy || loading"
          ><option
            v-for="employee in employees"
            :key="employee.id"
            :value="employee.id"
          >{{ employee.name }}</option></select>
        </label>
        <label
          v-if="auftragNr"
          class="time-capture__control time-capture__control--month"
          title="Monat"
        >
          <FontAwesomeIcon :icon="faCalendarDays" />
          <span class="time-capture__sr-only">Monat</span>
          <input
            v-model="month"
            type="month"
            aria-label="Monat"
          >
        </label>
        <OrderDocuments
          v-if="selectedOrder"
          compact
          :auftrag-nr="selectedOrder"
        />
        <label
          v-if="review && !loading"
          class="time-capture__control time-capture__control--reason"
          title="Bearbeitungsvermerk (optional)"
        >
          <FontAwesomeIcon :icon="faPen" />
          <span class="time-capture__sr-only">Bearbeitungsvermerk (optional)</span>
          <input
            v-model="reason"
            maxlength="1000"
            :disabled="busy || loading"
            aria-label="Bearbeitungsvermerk (optional)"
            placeholder="Bearbeitungsvermerk (optional)"
          >
        </label>
      </Toolbar>
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
        <Stundenschnellerfassung
          :key="generation"
          contained
          connected
          :show-context="false"
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
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowUpRightFromSquare, faBriefcase, faCalendarDays, faPen, faRotateRight, faUser } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import CustomTooltip from '@/components/CustomTooltip.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import Stundenschnellerfassung from '@/components/ui-elements/Stundenschnellerfassung.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
const props = defineProps({ modelValue: { type: Boolean, default: true }, auftragNr: { type: [String, Number], default: null }, employeeId: { type: String, default: null }, minimizeId: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const router = useRouter();
const month = ref(new Date().toLocaleDateString('sv-SE').slice(0, 7));
const selectedOrder = ref(props.auftragNr || '');
const orders = ref([]), review = ref(null), generation = ref(0), loading = ref(false), busy = ref(false);
const dirty = ref(false), error = ref(''), notice = ref(''), reason = ref(''), confirmAction = ref(null), monthEmployee = ref(props.employeeId || '');
const statusLabel = status => ({ SUBMITTED: 'Vom Mitarbeiter eingereicht', DRAFT: 'Interner Entwurf', RELEASED: 'An Zeitverwaltung übergeben', WITHDRAWN: 'Aus Zeitverwaltung zurückgenommen' }[status] || 'Offen');
function orderOptionLabel(order) {
  const date = String(order.vonDatum || '').slice(0, 10);
  const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Datum offen';
  return `${dateLabel} · #${order.auftragNr} · ${order.eventTitel}`;
}
const assignments = computed(() => (review.value?.einsaetze || []).map(einsatz => {
  const entry = review.value.entries.find(row => row._id === einsatz._id);
  return { ...einsatz, timeStatus: statusLabel(entry?.status), timeSubmission: entry?.employeeSubmission, timeReleased: !!entry?.released };
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
function openMonth() { router.push({ name: 'Payroll', query: { employeeId: monthEmployee.value, month: month.value } }); }
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
  const entries = payload.entries.filter(row => {
    const entry = review.value.entries.find(value => value._id === row.einsatzId);
    if (payload.action === 'release') return !entry?.released;
    if (payload.action === 'withdraw') return !!entry?.released;
    return row.dirty;
  }).map(row => ({ ...row, revision: review.value.entries.find(entry => entry._id === row.einsatzId)?.revision || 0 }));
  if (!entries.length) { notice.value = 'Keine neuen Änderungen zur Übernahme.'; return; }
  busy.value = true;
  try {
    await api.post(`/api/working-times/orders/${selectedOrder.value}`, { action: payload.action, reason: reason.value.trim(), entries });
    if (['release', 'withdraw'].includes(payload.action)) window.dispatchEvent(new CustomEvent('working-times:released'));
    notice.value = payload.action === 'release'
      ? `${entries.length} ${entries.length === 1 ? 'Einsatz' : 'Einsätze'} an die Zeitverwaltung übergeben.`
      : payload.action === 'withdraw'
        ? `${entries.length} ${entries.length === 1 ? 'Einsatz' : 'Einsätze'} aus der Zeitverwaltung zurückgenommen.`
        : 'Entwurf gespeichert. Die Zeitverwaltung bleibt bis zur Übergabe auf dem bisherigen Stand.';
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
.time-capture__toolbar { align-items: center; gap: 7px; min-height: 44px; padding: 5px 16px; margin: 0; border-inline: 0; border-radius: 0; box-shadow: none; overflow: visible; z-index: 2; }
.time-capture__toolbar :deep(.order-documents--compact summary) { min-height: 32px; padding: 5px 9px; font-size: 11px; background: var(--surface); }
.time-capture__order-reference { max-width: 250px; overflow: hidden; color: var(--text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.time-capture__order-reference small { margin-left: 4px; color: var(--muted); font-size: 10px; font-weight: 400; }
.time-capture__control { display: inline-flex; align-items: center; gap: 6px; height: 32px; min-width: 0; padding-left: 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--muted); }
.time-capture__control > svg { flex: 0 0 auto; width: 12px; font-size: 11px; }
.time-capture__control :is(input, select) { min-width: 0; height: 30px; padding: 4px 8px 4px 0; color: var(--text); background: transparent; border: 0; outline: 0; font: inherit; font-size: 11px; }
.time-capture__control--employee { flex: 0 1 190px; }
.time-capture__control--employee select { width: 100%; }
.time-capture__control--month { flex: 0 0 150px; }
.time-capture__control--month input { width: 122px; }
.time-capture__control--order { flex: 1 1 360px; max-width: 520px; }
.time-capture__control--order select { width: 100%; }
.time-capture__control--reason { flex: 1 1 240px; }
.time-capture__control--reason input { width: 100%; }
.time-capture__control:focus-within { border-color: var(--primary); outline: 2px solid color-mix(in srgb, var(--primary) 24%, transparent); outline-offset: 0; }
.time-capture__header-action { display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
.time-capture__header-action:hover:not(:disabled), .time-capture__header-action:focus-visible { border-color: color-mix(in srgb, var(--primary) 30%, transparent); background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
.time-capture__header-action:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.time-capture__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.time-capture :disabled { opacity: .55; cursor: default; }
.time-capture__notice { padding: 10px 20px; margin: 0; font-size: 12px; background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.time-capture__notice--error { color: #c75048; }
.time-capture__history { flex-shrink: 0; padding: 10px 20px; border-top: 1px solid var(--border); font-size: 11px; max-height: 160px; overflow: auto; }
.time-capture__history div { padding: 5px 0; }
.time-capture__history summary { cursor: pointer; }
.time-capture__confirm { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--border); }
.time-capture__confirm button { min-height: 30px; padding: 5px 9px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font: inherit; }
@media (max-width: 860px) {
  .time-capture__toolbar { align-items: stretch; overflow-x: auto; }
  .time-capture__toolbar :deep(.toolbar-main-content) { flex: 0 0 auto; }
  .time-capture__order-reference { max-width: 180px; align-self: center; }
  .time-capture__control--order { flex-basis: 320px; }
  .time-capture__control--reason { flex-basis: 220px; }
}
</style>
