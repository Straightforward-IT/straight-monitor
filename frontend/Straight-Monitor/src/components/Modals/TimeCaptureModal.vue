<template>
  <ModalFrame
    :model-value="modelValue"
    title="Stundenschnellerfassung"
    size="xl"
    minimizable
    :minimize-id="minimizeId"
    :minimize-title="modalTitle"
    :close-on-backdrop="false"
    :close-on-escape="false"
    :show-close="!busy"
    style="--mf-max-width: min(1420px, 96vw); --mf-body-padding: 0; --mf-body-overflow: hidden; --mf-max-height: 92dvh; --mf-header-padding: 7px 10px; --mf-title-size: .9rem; --mf-radius: 8px"
    @close="close"
  >
    <template #header="{ titleId }">
      <div class="time-capture__header-titles">
        <h3
          :id="titleId"
          class="time-capture__header-title"
        >
          Stundenschnellerfassung
        </h3>
        <p
          v-if="modalDetails"
          class="time-capture__header-details"
        >
          {{ modalDetails }}
        </p>
      </div>
    </template>
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
    </template>
    <div class="time-capture">
      <Toolbar class="time-capture__toolbar">
        <template #filter>
          <ToolbarFilter
            v-model="filterExpanded"
            :active-count="activeFilterCount"
            :active-filter-labels="activeFilterLabels"
            @reset="resetFilters"
          >
            <FilterGroup label="Einreichung">
              <FilterChip :active="submissionFilter === 'submitted'" @click="submissionFilter = submissionFilter === 'submitted' ? 'all' : 'submitted'">Eingereicht</FilterChip>
              <FilterChip :active="submissionFilter === 'not-submitted'" @click="submissionFilter = submissionFilter === 'not-submitted' ? 'all' : 'not-submitted'">Nicht eingereicht</FilterChip>
            </FilterGroup>
          </ToolbarFilter>
        </template>
        <SearchBar
          v-model="employeeSearch"
          class="toolbar-search"
          placeholder="Mitarbeiter suchen..."
          aria-label="Mitarbeiter suchen"
        />
        <template v-if="employeeId && !auftragNr">
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
        <OrderDocuments
          v-if="selectedOrder"
          compact
          :auftrag-nr="selectedOrder"
        />
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
          :einsaetze="assignments"
          :zeiten="times"
          :employee-search="employeeSearch"
          :submission-filter="submissionFilter"
          show-payroll-link
          @submit="save"
          @cancel="close"
          @dirty-change="dirty = $event"
          @open-payroll="openPayroll"
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
        <span class="time-capture__confirm-message">Ungespeicherte Änderungen verwerfen?</span>
        <button
          type="button"
          class="time-capture__confirm-discard"
          @click="runConfirmed"
        >
          Verwerfen
        </button>
        <button
          type="button"
          class="time-capture__confirm-continue"
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
import { faBriefcase, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import CustomTooltip from '@/components/CustomTooltip.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import SearchBar from '@/components/SearchBar.vue';
import Stundenschnellerfassung from '@/components/ui-elements/Stundenschnellerfassung.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
const props = defineProps({ modelValue: { type: Boolean, default: true }, auftragNr: { type: [String, Number], default: null }, employeeId: { type: String, default: null }, minimizeId: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const router = useRouter();
const month = ref(new Date().toLocaleDateString('sv-SE').slice(0, 7));
const selectedOrder = ref(props.auftragNr || '');
const orders = ref([]), review = ref(null), generation = ref(0), loading = ref(false), busy = ref(false);
const dirty = ref(false), error = ref(''), notice = ref(''), confirmAction = ref(null);
const filterExpanded = ref(false);
const employeeSearch = ref('');
const submissionFilter = ref('all');
const statusLabel = status => ({ SUBMITTED: 'Vom Mitarbeiter eingereicht', DRAFT: 'Entwurf', RELEASED: 'An Zeitverwaltung übergeben', WITHDRAWN: 'Aus Zeitverwaltung zurückgenommen' }[status] || 'Offen');
const modalDetails = computed(() => {
  const auftrag = review.value?.auftrag;
  const parts = [];
  if (auftrag?.vonDatum) {
    parts.push(new Date(`${String(auftrag.vonDatum).slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
  if (auftrag?.eventTitel) parts.push(auftrag.eventTitel);
  if (review.value?.kunde?.kuerzel) parts.push(review.value.kunde.kuerzel);
  return parts.join(' · ');
});
const modalTitle = computed(() => ['Stundenschnellerfassung', modalDetails.value].filter(Boolean).join(' · '));
function orderOptionLabel(order) {
  const date = String(order.vonDatum || '').slice(0, 10);
  const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Datum offen';
  return `${dateLabel} · #${order.auftragNr} · ${order.eventTitel}`;
}
const assignments = computed(() => (review.value?.einsaetze || []).map(einsatz => {
  const entry = review.value.entries.find(row => row._id === einsatz._id);
  return { ...einsatz, timeStatus: statusLabel(entry?.status), timeSubmission: entry?.employeeSubmission, timeReleased: !!entry?.released, timeSubmitted: entry?.status === 'SUBMITTED' || !!entry?.employeeSubmission };
}));
const times = computed(() => (review.value?.entries || []).map(entry => ({ einsatzId: entry._id, ...entry.current })));
const activeFilterCount = computed(() => Number(submissionFilter.value !== 'all'));
const activeFilterLabels = computed(() => [
  submissionFilter.value === 'submitted' ? 'Eingereicht' : submissionFilter.value === 'not-submitted' ? 'Nicht eingereicht' : null,
].filter(Boolean));
const history = computed(() => (review.value?.entries || []).flatMap(entry => (entry.history || []).map(item => ({ ...item, employee: assignments.value.find(value => value._id === entry._id)?.mitarbeiterData?.nachname || entry.personalNr }))).sort((a, b) => new Date(b.at) - new Date(a.at)));
const dateTime = date => new Date(date).toLocaleString('de-DE');
const messageOf = error => error?.response?.data?.message || 'Die Anfrage konnte nicht abgeschlossen werden. Eingaben bleiben erhalten.';
function guard(action) { if (dirty.value) confirmAction.value = action; else action(); }
function runConfirmed() { const action = confirmAction.value; confirmAction.value = null; dirty.value = false; action?.(); }
function resetFilters() { submissionFilter.value = 'all'; }
function close() { if (!busy.value) guard(() => emit('update:modelValue', false)); }
function reload() { if (!busy.value) guard(() => selectedOrder.value ? loadReview() : loadOrders()); }
function openPayroll(employeeId) { router.push({ name: 'Payroll', query: { employeeId, month: month.value } }); }
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
    if (props.employeeId) {
      const employee = assignments.value.find(item => String(item.mitarbeiterData?._id) === String(props.employeeId))?.mitarbeiterData;
      employeeSearch.value = [employee?.vorname, employee?.nachname].filter(Boolean).join(' ');
    }
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
    await api.post(`/api/working-times/orders/${selectedOrder.value}`, { action: payload.action, entries });
    if (['release', 'withdraw'].includes(payload.action)) window.dispatchEvent(new CustomEvent('working-times:released'));
    notice.value = payload.action === 'release'
      ? `${entries.length} ${entries.length === 1 ? 'Einsatz' : 'Einsätze'} an die Zeitverwaltung übergeben.`
      : payload.action === 'withdraw'
        ? `${entries.length} ${entries.length === 1 ? 'Einsatz' : 'Einsätze'} aus der Zeitverwaltung zurückgenommen.`
        : 'Entwurf gespeichert. Die Zeitverwaltung bleibt bis zur Übergabe auf dem bisherigen Stand.';
    dirty.value = false;
    await loadReview();
  } catch (failure) { error.value = messageOf(failure); }
  finally { busy.value = false; }
}
onMounted(() => props.auftragNr ? loadReview() : loadOrders());
</script>

<style scoped>
.time-capture { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 6px; padding: 8px; overflow: hidden; color: var(--text); }
.time-capture > :not(.quick-time) { flex-shrink: 0; }
.time-capture__toolbar { gap: 6px; margin: 0; padding: 4px 7px; border-radius: 7px; overflow: visible; z-index: 2; box-shadow: none; }
.time-capture__toolbar :deep(.search-bar-root) { gap: 6px; min-height: 28px; padding: 4px 8px; border-radius: 5px; box-shadow: none; }
.time-capture__toolbar :deep(.search-bar-root input) { font-size: 11px; }
.time-capture__toolbar :deep(.order-documents--compact summary) { box-sizing: border-box; height: 28px; min-height: 28px; padding: 3px 7px; font-size: 10px; background: var(--surface); }
.time-capture__control { display: inline-flex; align-items: center; gap: 5px; height: 28px; min-width: 0; padding-left: 7px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--muted); }
.time-capture__control > svg { flex: 0 0 auto; width: 12px; font-size: 11px; }
.time-capture__control :is(input, select) { min-width: 0; height: 26px; padding: 2px 6px 2px 0; color: var(--text); background: transparent; border: 0; outline: 0; font: inherit; font-size: 10px; }
.time-capture__control--order { flex: 1 1 360px; max-width: 520px; }
.time-capture__control--order select { width: 100%; }
.time-capture__control:focus-within { border-color: var(--primary); outline: 2px solid color-mix(in srgb, var(--primary) 24%, transparent); outline-offset: 0; }
.time-capture__header-action { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; font-size: 11px; }
.time-capture__header-action:hover:not(:disabled), .time-capture__header-action:focus-visible { border-color: color-mix(in srgb, var(--primary) 30%, transparent); background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
.time-capture__header-action:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.time-capture__header-titles { min-width: 0; }
.time-capture__header-title { margin: 0; color: var(--text); font-size: .9rem; font-weight: 600; line-height: 1.2; }
.time-capture__header-details { margin: 2px 0 0; overflow: hidden; color: var(--muted); font-size: 10px; font-weight: 400; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.time-capture__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.time-capture :disabled { opacity: .55; cursor: default; }
.time-capture__notice { padding: 6px 10px; margin: 0; font-size: 10px; background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.time-capture__notice--error { color: #c75048; }
.time-capture__history { flex-shrink: 0; padding: 6px 8px; border-top: 1px solid var(--border); font-size: 10px; max-height: 120px; overflow: auto; }
.time-capture__history div { padding: 3px 0; }
.time-capture__history summary { cursor: pointer; }
.time-capture__confirm { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 9px 10px; border: 1px solid color-mix(in srgb, #c75048 38%, var(--border)); border-radius: 6px; background: color-mix(in srgb, #c75048 6%, var(--surface)); box-shadow: 0 2px 8px color-mix(in srgb, #c75048 10%, transparent); }
.time-capture__confirm-message { flex: 1 1 240px; color: var(--text); font-size: 11px; font-weight: 600; }
.time-capture__confirm button { min-height: 30px; padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font: inherit; font-size: 10px; font-weight: 600; transition: border-color .15s, background-color .15s, color .15s; }
.time-capture__confirm button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.time-capture__confirm-discard { border-color: color-mix(in srgb, #c75048 60%, var(--border)) !important; background: var(--surface); color: #b7443d; }
.time-capture__confirm-discard:hover { border-color: #c75048 !important; background: color-mix(in srgb, #c75048 9%, var(--surface)); }
.time-capture__confirm-continue { border-color: var(--primary) !important; background: var(--primary); color: #27221c; }
.time-capture__confirm-continue:hover { background: color-mix(in srgb, var(--primary) 88%, #fff); }
@media (max-width: 860px) {
  .time-capture { gap: 4px; padding: 6px; }
  .time-capture__toolbar { align-items: stretch; flex-wrap: wrap; gap: 5px; padding: 4px 6px; overflow: visible; }
  .time-capture__toolbar :deep(.toolbar-filter) { margin: -4px 0 -4px -6px; }
  .time-capture__toolbar :deep(.toolbar-main-content) { display: grid; grid-template-columns: minmax(0, 1fr) auto; flex: 1 1 0; min-width: 0; gap: 5px; align-items: center; }
  .time-capture__toolbar :deep(.toolbar-search) { width: 100%; min-width: 0; max-width: none; box-sizing: border-box; }
  .time-capture__toolbar :deep(.order-documents--compact) { min-width: 0; justify-self: end; }
  .time-capture__control--order { grid-column: 1 / -1; width: 100%; max-width: none; flex-basis: auto; }
  .time-capture__confirm { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .time-capture__confirm-message { grid-column: 1 / -1; }
  .time-capture__confirm button { width: 100%; min-height: 40px; }
}
</style>
