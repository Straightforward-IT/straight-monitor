<template>
  <RouterPageLayout
    :tabs="payrollTabs"
    default-tab="stundenerfassung"
    aria-label="Stundenbereiche"
    width="full"
    content-variant="flush"
    class="payroll-page"
  >
    <div class="payroll-page__body">
      <div class="payroll-page__main">
        <Toolbar
          wrap
          class="payroll-page__toolbar"
        >
          <label class="payroll-page__field payroll-page__field--employee">
            <MitarbeiterSearch
              v-model="selectedEmployeeId"
              include-inactive
              require-personalnr
              prefer-active
              :selected-item="selectedEmployee"
              placeholder="Mitarbeiter suchen …"
            />
          </label>
          <div class="payroll-page__controls">
            <ToolbarGroup>
              <ToolbarButton
                :variant="bucketEnabled ? 'primary' : 'secondary'"
                :aria-pressed="bucketEnabled"
                :disabled="loading || !data || preparation?.state === 'REVIEWED'"
                aria-label="Eimer-Modus"
                :title="bucketEnabled ? 'Eimer ausschalten und laufende Sammlung zurücklegen' : 'Stunden mit dem Eimer sammeln und ablegen'"
                @click="bucketEnabled = !bucketEnabled"
              >
                <FontAwesomeIcon :icon="faBucket" />
                {{ bucketEnabled ? 'Eimer aktiv' : 'Eimer' }}
              </ToolbarButton>
              <ToolbarButton
                variant="secondary"
                aria-label="Hilfe zur Stundenerfassung"
                aria-haspopup="dialog"
                @click="showHelp = true"
              >
                <FontAwesomeIcon :icon="faCircleQuestion" />
                Hilfe
              </ToolbarButton>
              <CustomTooltip text="Stand neu laden">
                <ToolbarButton
                  variant="secondary"
                  class="payroll-page__refresh"
                  :disabled="loading || !employeeId"
                  aria-label="Stand neu laden"
                  @click="reloadMonth"
                >
                  <FontAwesomeIcon
                    :icon="faRotateRight"
                    :spin="loading"
                  />
                </ToolbarButton>
              </CustomTooltip>
            </ToolbarGroup>
          </div>
          <template #bottom-actions>
            <CalendarControls v-model="monthDate" type="month" />
          </template>
        </Toolbar>
        <template v-if="!employeeId">
          <p class="payroll-page__notice">
            Wähle einen Mitarbeiter, um übergebene Schichtstunden, Zeitkonto und Fehlzeiten für den Monat zu verwalten.
          </p>
        </template>
        <template v-else>
          <EmployeeCard
            :key="employeeId"
            :mitarbeiter-id="employeeId"
            :enable-header-context-menu="true"
            class="payroll-page__employee-card"
          />
          <p
            v-if="loading"
            role="status"
          >
            Monatsstunden werden geladen …
          </p>
          <p
            v-else-if="error"
            role="alert"
          >
            {{ error }}
          </p>
          <template v-else-if="data">
            <p v-if="preparationError" role="alert">{{ preparationError }}</p>
            <p v-if="notice" role="status">{{ notice }}</p>
            <template v-if="preparation">
              <div class="payroll-preparation-actions">
                <label>Bearbeitungs- / Prüfvermerk<input v-model="preparationReason" maxlength="1000" :disabled="busy"></label>
                <label v-if="preparation.stale && preparation.state === 'DRAFT'"><input v-model="reconcile" type="checkbox"> Geänderte Quellen geprüft und abgeglichen</label>
                <p v-if="preparation.stale" role="alert">Die gespeicherte Vorbereitung verweist auf ältere Quellen. Bitte Änderungen prüfen.</p>
                <button v-if="preparation.state === 'DRAFT'" type="button" :disabled="busy || formDirty || !preparationReason.trim() || (preparation.stale && !reconcile)" @click="savePreparation">Vorbereitung speichern</button>
                <span v-if="preparationDirty">Ungespeicherte Änderungen</span>
                <span v-if="formDirty">Eintrag zuerst zum Entwurf hinzufügen oder Bearbeiten abbrechen.</span>
              </div>
              <PayrollMonthlyReview
                v-show="reviewTab"
                :state="preparation" :preview="review" :mapping="mapping" :busy="busy" :dirty="preparationDirty" :reason="preparationReason" :codes="mappingCodes"
                @action="act" @preview="loadPreview" @load-mapping="loadMapping" @save-mapping="saveMapping" @mapping-dirty="mappingDirty = $event"
              />
              <PayrollPreparationEditor
                v-show="!reviewTab" :key="`${employeeId}:${month}:${preparation.revision}`" ref="preparationEditor"
                v-model="preparationItems" :sources="preparation.sources" :inherited="preparation.inherited" :types="data.dayEntryTypes" :month="month"
                :readonly="preparation.state === 'REVIEWED'" :busy="busy" :picked="picked" @form-dirty="formDirty = $event"
              />
            </template>
            <p
              v-if="!data.initialData.entries.length"
              class="payroll-page__notice"
            >
              Für diesen Monat wurden noch keine Stunden aus der Schnellerfassung übergeben.
            </p>
            <TimeManagement
              v-if="!reviewTab"
              :key="`${revision}:${calendarKey}`"
              :employee="data.employee"
              :month="month"
              :initial-data="calendarData"
              :day-entry-types="data.dayEntryTypes"
              :save-enabled="false"
              :show-context="false"
              :show-guide="false"
              :bucket-enabled="bucketEnabled"
              preparation-mode
              details-in-side-panel
              :details-target="detailsTarget"
              @select-day="openDayDetails"
              @close-details="detailsOpen = false; focusSelectedDay()"
              @open-capture="openAssignmentCapture"
              @prepare-transfer="pickTransfer"
              @prepare-entry="pickEntry"
            >
              <template #day-documents>
                <OrderDocuments
                  v-for="order in selectedDayOrders"
                  :key="order.auftragNr"
                  :auftrag-nr="order.auftragNr"
                />
                <p v-if="!selectedDayOrders.length" class="payroll-page__day-empty">
                  Diesem Tag ist kein Auftrag zugeordnet.
                </p>
              </template>
            </TimeManagement>
          </template>
        </template>
      </div>
      <SidePanelFrame
        v-model="detailsOpen"
        class="payroll-page__day-panel"
        width="clamp(360px, 32vw, 480px)"
        :title="selectedDayLabel"
        :subtitle="data?.employee?.name || ''"
        :close-on-escape="false"
        @close="focusSelectedDay"
      >
        <template #actions>
          <button
            ref="dayMenuButton"
            type="button"
            class="payroll-page__day-actions"
            aria-label="Aktionen für diesen Tag"
            aria-haspopup="menu"
            :aria-expanded="dayMenuOpen"
            :disabled="!selectedDayOrders.length"
            @click.stop="dayMenuOpen = !dayMenuOpen"
          >
            <FontAwesomeIcon :icon="faEllipsisVertical" />
          </button>
        </template>
        <div
          :ref="setDetailsTarget"
          class="payroll-page__day-content"
        />
      </SidePanelFrame>
      <Teleport to="body">
        <ContextMenu
          v-if="dayMenuOpen && detailsOpen"
          title="Tagesaktionen"
          :x="0"
          :y="0"
          :anchor="dayMenuButton"
          follow-anchor
          focus-on-open
          :width="300"
          :options="dayMenuOptions"
          @select="handleDayAction"
          @close="closeDayMenu"
        />
      </Teleport>
    </div>
    <PayrollHelpModal v-model="showHelp" />
  </RouterPageLayout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBucket, faCircleQuestion, faEllipsisVertical, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import PayrollHelpModal from '@/components/Modals/PayrollHelpModal.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import SidePanelFrame from '@/components/frames/SidePanelFrame.vue';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import CalendarControls from '@/components/ui-elements/CalendarControls.vue';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import EmployeeCard from '@/components/EmployeeCard.vue';
import TimeManagement from '@/components/ui-elements/TimeManagement.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
import { payrollTabs } from '@/components/layout/pageTabDefinitions';
import { useTimeCaptureModals } from '@/composables/useTimeCaptureModals';
import { usePayrollPreparation } from '@/composables/usePayrollPreparation';
import { preparationCalendar } from '@/utils/payrollPreparation';
import PayrollPreparationEditor from '@/components/payroll/PayrollPreparationEditor.vue';
import PayrollMonthlyReview from '@/components/payroll/PayrollMonthlyReview.vue';

const route = useRoute();
const router = useRouter();
const { openTimeCapture } = useTimeCaptureModals();
const PAYROLL_EMPLOYEE_STORAGE_KEY = 'payroll_selected_employee_id';
const data = ref(null);
const loading = ref(false);
const error = ref('');
const revision = ref(0);
const detailsOpen = ref(false);
const showHelp = ref(false);
const bucketEnabled = ref(false);
const selectedDay = ref('');
const detailsTarget = shallowRef(null);
const dayMenuOpen = ref(false);
const dayMenuButton = ref(null);
// Documents and actions belong to orders, not separate actual/planned time rows.
const selectedDayOrders = computed(() => {
  const orders = new Map();
  for (const entry of data.value?.initialData?.entries || []) {
    if (entry.date !== selectedDay.value || !entry.auftragNr) continue;
    const key = String(entry.auftragNr);
    if (!orders.has(key)) orders.set(key, { auftragNr: entry.auftragNr, label: entry.label });
  }
  return [...orders.values()];
});
const dayMenuOptions = computed(() => selectedDayOrders.value.map(order => ({
  label: selectedDayOrders.value.length === 1
    ? 'Stundenschnellerfassung öffnen'
    : `Stundenschnellerfassung · #${order.auftragNr} · ${order.label}`,
  action: `capture:${order.auftragNr}`,
  icon: 'fa-solid fa-clock',
})));
function closeDayMenu() {
  const restoreFocus = dayMenuOpen.value;
  dayMenuOpen.value = false;
  if (restoreFocus) nextTick(() => dayMenuButton.value?.focus({ preventScroll: true }));
}
function handleDayAction(action) {
  const order = selectedDayOrders.value.find(item => action === `capture:${item.auftragNr}`);
  if (!order) return;
  dayMenuOpen.value = false;
  openAssignmentCapture(order);
}
watch([selectedDay, detailsOpen], () => { dayMenuOpen.value = false; });
const selectedDayLabel = computed(() => selectedDay.value
  ? new Date(`${selectedDay.value}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : 'Tagesdetails');
function setDetailsTarget(element) { detailsTarget.value = element; }
function openDayDetails(date) { selectedDay.value = date; detailsOpen.value = true; }
function focusSelectedDay() {
  nextTick(() => document.querySelector(`.payroll-page [data-day="${selectedDay.value}"] .tmx-date`)?.focus({ preventScroll: true }));
}
let request = 0;

function storedEmployeeId() {
  return sessionStorage.getItem(PAYROLL_EMPLOYEE_STORAGE_KEY) || '';
}
function saveEmployeeId(value) {
  if (value) sessionStorage.setItem(PAYROLL_EMPLOYEE_STORAGE_KEY, String(value));
  else sessionStorage.removeItem(PAYROLL_EMPLOYEE_STORAGE_KEY);
}
const employeeId = computed(() => String(route.query.employeeId || storedEmployeeId()));
const month = computed(() => String(route.query.month || new Date().toLocaleDateString('sv-SE').slice(0, 7)));
const { state: preparation, items: preparationItems, busy, error: preparationError, notice, reason: preparationReason, reconcile,
  review, mapping, mappingDirty, formDirty, dirty: preparationDirty, load: loadPreparation, act, loadPreview, loadMapping, saveMapping, confirmDiscard } = usePayrollPreparation(employeeId, month);
const reviewTab = computed(() => route.query.tab === 'monatspruefung');
const preparationEditor = ref(null), picked = ref(null);
const mappingCodes = computed(() => ['P', 'M', 'AZK_DEPOSIT', 'AZK_WITHDRAWAL', ...(data.value?.dayEntryTypes || []).map(t => t.code)]);
const calendarData = computed(() => ({ ...data.value.initialData, bankMinutes: null,
  entries: [...data.value.initialData.entries, ...preparationCalendar(preparationItems.value, preparation.value?.inherited || [], month.value, data.value.dayEntryTypes)] }));
const calendarKey = computed(() => JSON.stringify(preparationItems.value));
function pickTransfer(value) { picked.value = { ...value, nonce: Date.now() }; }
function pickEntry(value) { picked.value = { ...value, kind: 'ABSENCE', nonce: Date.now() }; }
async function savePreparation() { await act('save'); }
function beforeUnload(event) { if (preparationDirty.value || busy.value) { event.preventDefault(); event.returnValue = ''; } }
function releasedChanged() {
  if (preparationDirty.value || busy.value) { notice.value = 'Freigegebene Zeiten geändert. Entwurf bleibt erhalten; vor dem Speichern Quellen neu laden.'; return; }
  loadMonth();
}
function reloadMonth() { if (confirmDiscard()) loadMonth(); }
const monthDate = computed({
  get: () => {
    const [year, monthNumber] = month.value.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1);
  },
  set: value => {
    if (!value) return;
    replaceQuery({ month: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}` });
  },
});
const selectedEmployeeId = computed({
  get: () => employeeId.value || null,
  set: value => {
    replaceQuery({ employeeId: value || null });
  },
});
const selectedEmployee = computed(() => {
  if (!data.value?.employee || String(data.value.employee.id) !== employeeId.value) return null;
  return {
    _id: data.value.employee.id,
    personalnr: data.value.employee.personalNr,
    vorname: data.value.employee.name,
    nachname: '',
  };
});
function replaceQuery(patch) {
  const query = { ...route.query, ...patch };
  Object.keys(query).forEach(key => { if (query[key] == null || query[key] === '') delete query[key]; });
  router.replace({ query });
}
watch(employeeId, saveEmployeeId, { immediate: true });
function openAssignmentCapture(entry) {
  openTimeCapture({ auftragNr: entry.auftragNr, employeeId: employeeId.value });
}
async function loadMonth() {
  bucketEnabled.value = false;
  detailsOpen.value = false;
  const current = ++request;
  if (!employeeId.value) { data.value = null; loading.value = false; return; }
  loading.value = true;
  error.value = '';
  data.value = null;
  try {
    const [response] = await Promise.all([api.get(`/api/working-times/employees/${employeeId.value}/month`, { params: { month: month.value } }), loadPreparation()]);
    if (current !== request) return;
    data.value = response.data;
    revision.value++;
  } catch (failure) {
    if (current === request) error.value = failure?.response?.data?.message || 'Monatsstunden konnten nicht geladen werden.';
  } finally {
    if (current === request) loading.value = false;
  }
}
watch([employeeId, month], loadMonth, { immediate: true });
onMounted(() => {
  window.addEventListener('working-times:released', releasedChanged);
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  request++;
  window.removeEventListener('working-times:released', releasedChanged);
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<style scoped>
.payroll-preparation-actions { padding: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.payroll-preparation-actions label { display: flex; gap: 8px; align-items: center; }
.payroll-preparation-actions input:not([type=checkbox]) { min-width: 240px; }
.payroll-preparation-actions input, .payroll-preparation-actions button { padding: 8px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--text); }
.payroll-page { padding: 16px; min-width: 0; }
.payroll-page__toolbar { margin-bottom: 29px; overflow: visible; }
.payroll-page__field { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--muted); font-size: 12px; }
.payroll-page__field--employee { width: min(360px, 100%); }
.payroll-page__field--employee :deep(.ma-search) { min-width: 0; }
.payroll-page__controls { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.payroll-page__field input { color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
.payroll-page__refresh { width: 28px; height: 28px; justify-content: center; padding: 0; }
.payroll-page__body { display: flex; align-items: flex-start; min-width: 0; }
.payroll-page__main { flex: 1; min-width: 0; container: payroll-main / inline-size; }
.payroll-page :deep(.payroll-page__day-panel) { top: calc(var(--header-h, 56px) + 12px); height: calc(100dvh - var(--header-h, 56px) - 28px); }
.payroll-page__day-content { min-width: 0; }
.payroll-page__day-actions { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
.payroll-page__day-actions:hover:not(:disabled) { background: var(--hover); border-color: var(--border); color: var(--text); }
.payroll-page__day-actions:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.payroll-page__day-actions:disabled { opacity: .45; cursor: default; }
.payroll-page__day-empty { margin: 0 0 12px; color: var(--muted); font-size: 12px; }
.payroll-page :deep(.payroll-page__day-panel .sp-panel__body) { padding: 12px; }
@container payroll-main (max-width: 850px) {
  .payroll-page__controls { margin-left: 0; flex-wrap: wrap; }
  .payroll-page__main :deep(.tm-layout) { grid-template-columns: minmax(0, 1fr); }
}
@container payroll-main (max-width: 560px) {
  .payroll-page__main :deep(.tm-information) { display: block; }
}
@media (min-width: 769px) and (max-width: 1023px) {
  .payroll-page :deep(.payroll-page__day-panel) {
    position: fixed;
    z-index: 100;
    top: calc(var(--header-h, 56px) + 12px);
    right: 16px;
    width: min(480px, calc(100vw - 32px));
    height: calc(100dvh - var(--header-h, 56px) - 28px);
    margin-left: 0;
  }
}
@media (max-width: 768px) {
  .payroll-page :deep(.payroll-page__day-panel) { top: 0; height: 100dvh; }
}
.payroll-page__employee-card { margin-bottom: 16px; }
.payroll-page__notice { padding: 10px 14px; margin: 0 0 12px; color: var(--muted); font-size: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
@media (max-width: 720px) {
  .payroll-page { padding: 10px; }
  .payroll-page__field { width: 100%; justify-content: space-between; }
  .payroll-page__field--employee { width: 100%; }
  .payroll-page__controls { width: 100%; margin-left: 0; flex-wrap: wrap; }
  .payroll-page__field input { flex: 1; min-width: 0; }
}
</style>
