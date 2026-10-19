<template>
  <RouterPageLayout :tabs="payrollTabs" default-tab="stundenerfassung" aria-label="Stundenbereiche" width="full" content-variant="flush" class="payroll-page">
    <div class="payroll-page__body">
      <div class="payroll-page__main">
        <Toolbar wrap class="payroll-page__toolbar">
          <label class="payroll-page__field payroll-page__field--employee">
            <MitarbeiterSearch v-model="selectedEmployeeId" include-inactive require-personalnr prefer-active simple :selected-item="selectedEmployee" placeholder="Name oder Personalnummer suchen …" />
          </label>
          <ToolbarGroup class="payroll-page__controls">
            <ToolbarButton variant="secondary" aria-label="Hilfe zur Stundenerfassung" aria-haspopup="dialog" @click="showHelp = true"><FontAwesomeIcon :icon="faCircleQuestion" /> Hilfe</ToolbarButton>
            <CustomTooltip text="Stand neu laden"><ToolbarButton variant="secondary" class="payroll-page__refresh" :disabled="loading || !employeeId" aria-label="Stand neu laden" @click="loadMonth"><FontAwesomeIcon :icon="faRotateRight" :spin="loading" /></ToolbarButton></CustomTooltip>
          </ToolbarGroup>
          <template #bottom-actions><CalendarControls v-model="monthDate" type="month" /></template>
        </Toolbar>
        <p v-if="!employeeId" class="payroll-page__notice">Wähle einen Mitarbeiter, um seine importierten Zvoove-Stunden für den Monat anzuzeigen.</p>
        <template v-else>
          <EmployeeCard :key="employeeId" :mitarbeiter-id="employeeId" :enable-header-context-menu="true" class="payroll-page__employee-card" />
          <p v-if="error" role="alert">{{ error }}</p>
          <template v-if="data">
            <p class="payroll-page__notice">{{ data.sourceMode === 'TIME_BOOKINGS' ? 'Zvoove-Zeitbuchungen · Arbeits- und Pausenzeiten' : 'Zvoove-Import · Schreibgeschützte Monatsstunden' }}</p>
            <ul v-if="data.issues?.length" class="payroll-page__issues" aria-label="Hinweise zum importierten Datenstand"><li v-for="(issue, index) in data.issues" :key="`${issue.code}:${index}`">{{ issue.message }}</li></ul>
            <p v-if="!data.entries.length" class="payroll-page__notice">Für diesen Mitarbeiter und Monat liegen noch keine importierten Zvoove-Stunden vor.</p>
          </template>
          <ZvooveTimeWorkspace v-show="!error" :key="employeeId" :employee="workspaceEmployee" :month="month" :entries="data?.entries || []" :totals="data?.totals" :loading="loading" :selected-date="selectedDay" :contingent-data="contingentData" :contingent-loading="contingentLoading" :positions="positionData" :positions-loading="positionsLoading" :positions-error="positionsError" :positions-access="canViewPositions" @select-day="openDayDetails" @clear-day="clearDay" />
        </template>
      </div>
      <SidePanelFrame v-model="detailsOpen" class="payroll-page__day-panel" width="clamp(360px, 32vw, 480px)" :title="selectedDayLabel" :subtitle="data?.employee?.name || ''" :close-on-escape="false" @close="focusSelectedDay">
        <ZvooveDayDetails :entries="selectedDayEntries" />
      </SidePanelFrame>
    </div>
    <PayrollHelpModal v-model="showHelp" />
  </RouterPageLayout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCircleQuestion, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import PayrollHelpModal from '@/components/Modals/PayrollHelpModal.vue';
import SidePanelFrame from '@/components/frames/SidePanelFrame.vue';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import CalendarControls from '@/components/ui-elements/CalendarControls.vue';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import EmployeeCard from '@/components/EmployeeCard.vue';
import ZvooveTimeWorkspace from '@/components/payroll/ZvooveTimeWorkspace.vue';
import ZvooveDayDetails from '@/components/payroll/ZvooveDayDetails.vue';
import { payrollTabs } from '@/components/layout/pageTabDefinitions';
import { useEmployeeContingents } from '@/composables/useEmployeeContingents';
import { usePayrollPositions } from '@/composables/usePayrollPositions';
import { useAuth } from '@/stores/auth';

const route = useRoute(), router = useRouter();
const storageKey = 'payroll_selected_employee_id';
const data = ref(null), loading = ref(false), error = ref('');
const auth = useAuth();
const positionsAccessKey = computed(() => [auth.user?.role, ...(auth.user?.roles || [])].filter(Boolean).map(role => String(role).toUpperCase()).sort().join(','));
const canViewPositions = computed(() => [auth.user?.role, ...(auth.user?.roles || [])].some(role => ['ADMIN', 'PAYROLL'].includes(String(role).toUpperCase())));
const positionsState = usePayrollPositions(canViewPositions);
const { data: positionData, loading: positionsLoading, error: positionsError } = positionsState;
const detailsOpen = ref(false), showHelp = ref(false), selectedDay = ref('');
let request = 0;
const employeeId = computed(() => String(route.query.employeeId ?? sessionStorage.getItem(storageKey) ?? ''));
const month = computed(() => {
  const value = String(route.query.month || '');
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 7);
});
const monthDate = computed({ get: () => { const [year, number] = month.value.split('-').map(Number); return new Date(year, number - 1, 1); },
  set: value => { if (value) replaceQuery({ month: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}` }); } });
const selectedEmployeeId = computed({ get: () => employeeId.value || null, set: value => replaceQuery({ employeeId: value || '' }) });
const selectedEmployee = computed(() => data.value?.employee && String(data.value.employee.id) === employeeId.value
  ? { _id: data.value.employee.id, personalnr: data.value.employee.personalNr, vorname: data.value.employee.name, nachname: '' } : null);
const workspaceEmployee = computed(() => data.value?.employee || { id: employeeId.value });
const selectedDayEntries = computed(() => (data.value?.entries || []).filter(entry => entry.date === selectedDay.value));
const selectedDayLabel = computed(() => selectedDay.value
  ? new Date(`${selectedDay.value}T12:00:00`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Tagesdetails');
function openDayDetails(date) { if (!loading.value && !error.value) { selectedDay.value = date; detailsOpen.value = true; } }
function clearDay() { selectedDay.value = ''; detailsOpen.value = false; }
function focusSelectedDay() { nextTick(() => document.querySelector(`.payroll-page [data-day="${selectedDay.value}"] .tmx-date`)?.focus({ preventScroll: true })); }
function replaceQuery(patch) {
  const query = { ...route.query, ...patch };
  Object.keys(query).forEach(key => { if (query[key] == null || (query[key] === '' && key !== 'employeeId')) delete query[key]; });
  router.replace({ query });
}
// Links and bookmarks to the retired review tab return to the monthly view.
watch(() => route.query.tab, tab => { if (tab && tab !== 'stundenerfassung') replaceQuery({ tab: null }); }, { immediate: true });
watch(employeeId, value => { if (value) sessionStorage.setItem(storageKey, value); else sessionStorage.removeItem(storageKey); }, { immediate: true });
const contingents = useEmployeeContingents();
const contingentPeriod = computed(() => { const [year, monthNumber] = month.value.split('-').map(Number); return { year, month: monthNumber }; });
const contingentEmployee = computed(() => ({ _id: employeeId.value }));
const contingentData = computed(() => ({ ...contingents.dataFor(contingentEmployee.value, contingentPeriod.value), employeeName: data.value?.employee?.name || '' }));
const contingentLoading = computed(() => contingents.isLoading(contingentEmployee.value, contingentPeriod.value));
async function loadMonth() {
  const current = ++request;
  detailsOpen.value = false; selectedDay.value = ''; data.value = null; error.value = '';
  contingents.clear();
  positionsState.load(employeeId.value, month.value);
  if (!employeeId.value) { loading.value = false; return; }
  const id = employeeId.value, period = month.value;
  contingents.load(id, contingentPeriod.value);
  loading.value = true;
  try {
    const response = await api.get(`/api/payroll/employees/${id}/month`, { params: { month: period } });
    if (current !== request) return;
    data.value = response.data;
  } catch (failure) {
    if (current === request) error.value = failure?.response?.data?.message || 'Monatsstunden konnten nicht geladen werden.';
  } finally { if (current === request) loading.value = false; }
}
watch([employeeId, month, positionsAccessKey], loadMonth, { immediate: true });
onBeforeUnmount(() => { request++; });
</script>

<style scoped>
.payroll-page { padding: 16px; min-width: 0; }
.payroll-page__toolbar { margin-bottom: 29px; overflow: visible; }
.payroll-page__field { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--muted); font-size: 12px; }
.payroll-page__field--employee { width: min(360px, 100%); }
.payroll-page__field--employee :deep(.ma-search) { min-width: 0; }
.payroll-page__controls { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.payroll-page__refresh { width: 28px; height: 28px; justify-content: center; padding: 0; }
.payroll-page__body { display: flex; align-items: flex-start; min-width: 0; }
.payroll-page__main { flex: 1; min-width: 0; container: payroll-main / inline-size; }
.payroll-page :deep(.payroll-page__day-panel) { top: calc(var(--header-h, 56px) + 12px); height: calc(100dvh - var(--header-h, 56px) - 28px); }
.payroll-page :deep(.payroll-page__day-panel .sp-panel__body) { padding: 12px; }
.payroll-page__employee-card { margin-bottom: 16px; }
.payroll-page__notice, .payroll-page__issues { padding: 10px 14px; margin: 0 0 12px; color: var(--muted); font-size: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.payroll-page__issues { padding-left: 28px; }
@container payroll-main (max-width: 850px) { .payroll-page__controls { margin-left: 0; flex-wrap: wrap; } }
@media (min-width: 769px) and (max-width: 1023px) {
  .payroll-page :deep(.payroll-page__day-panel) { position: fixed; z-index: 100; top: calc(var(--header-h, 56px) + 12px); right: 16px; width: min(480px, calc(100vw - 32px)); height: calc(100dvh - var(--header-h, 56px) - 28px); margin-left: 0; }
}
@media (max-width: 768px) { .payroll-page :deep(.payroll-page__day-panel) { top: 0; height: 100dvh; } }
@media (max-width: 720px) { .payroll-page { padding: 10px; }.payroll-page__field--employee { width: 100%; }.payroll-page__controls { width: 100%; margin-left: 0; flex-wrap: wrap; } }
</style>
