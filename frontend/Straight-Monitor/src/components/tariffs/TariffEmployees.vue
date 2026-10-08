<template>
  <section class="tariff-employees-layout">
    <div class="tariff-stack tariff-employees-list">
    <Toolbar class="tariff-employees-toolbar" wrap>
      <ToolbarFilter v-model="filtersExpanded" :active-count="activeFilterCount" @reset="resetFilters">
        <FilterGroup label="Standort">
          <LocationFilter v-model="locationId" :locations="list?.locations || []" />
        </FilterGroup>
        <FilterGroup label="Tarifzuordnung">
          <FilterChip :active="tariffFilter === 'missing'" @click="tariffFilter = tariffFilter === 'missing' ? 'all' : 'missing'">Ohne Tarifzuordnung</FilterChip>
        </FilterGroup>
      </ToolbarFilter>
      <AppTextInput v-model="search" class="tariff-employees-search" type="search" aria-label="Mitarbeiter oder Personalnummer" placeholder="Name, aktuelle oder historische Personalnummer …" />
      <AppButton variant="secondary" :loading="listLoading" @click="loadEmployees">Neu laden</AppButton>
      <template #bottom-actions>
        <ToolbarPageControls
          v-if="list"
          :page="page"
          :items-per-page="itemsPerPage"
          :total-items="list.total || 0"
          :page-options="pageOptions"
          items-per-page-label="Mitarbeiter pro Seite"
          @update:page="page = $event"
          @update:items-per-page="setItemsPerPage"
        />
      </template>
    </Toolbar>
    <p v-if="listError" class="tariff-alert" role="alert">{{ listError }}</p>
    <p v-if="listLoading" role="status">Mitarbeiterzuordnungen werden geladen …</p>
    <template v-if="list">
      <div class="tariff-scroll"><table aria-label="Mitarbeiter-Tarifzuordnungen"><thead><tr><th>Mitarbeiter</th><th>Standort</th><th>Personalnummer</th><th>Zuordnung</th><th>Tarif / ÜTZ</th><th>Details</th></tr></thead><tbody>
        <tr v-for="employee in list.data || []" :key="employee.key" :class="{ 'tariff-selected': selectedKey === employee.key }" @click="selectEmployee(employee)"><td>{{ employee.employeeName }}</td><td>{{ employee.location?.shortName || 'Kein Standort' }}</td><td>{{ employee.personalNr }}</td><td>{{ employee.hasTariffAssignment ? 'Tarifzuordnung vorhanden' : 'Keine Tarifzuordnung' }}</td><td>{{ employee.assignmentCount }} / {{ employee.allowanceCount }}</td><td><AppButton size="sm" variant="secondary" :aria-pressed="selectedKey === employee.key" @click.stop="selectEmployee(employee)">Anzeigen</AppButton></td></tr>
      </tbody></table></div>
      <p v-if="!list.data?.length" class="tariff-notice">Keine aktiven Mitarbeiter für diese Filter.</p>
    </template>
    </div>
    <TariffEmployeeDetailsPanel
      :employee="selectedEmployee"
      :history="history"
      :history-loading="historyLoading"
      :history-error="historyError"
      :rate="rate"
      :rate-loading="rateLoading"
      :rate-error="rateError"
      v-model:date="date"
      @resolve="resolveRate"
      @select-date="selectDate"
      @close="selectedKey = ''"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import api from '@/utils/api';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import LocationFilter from '@/components/ui-elements/LocationFilter.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import ToolbarPageControls from '@/components/ui-elements/ToolbarPageControls.vue';
import TariffEmployeeDetailsPanel from './TariffEmployeeDetailsPanel.vue';
import { todayInBerlin } from './tariffDisplay';
import { useTariffRequest } from './useTariffRequest';
const props = defineProps({ revision: { type: Number, default: 0 } });
const search = ref('');
const page = ref(1);
const itemsPerPage = ref(50);
const pageOptions = [25, 50, 100];
const locationId = ref(null);
const tariffFilter = ref('all');
const filtersExpanded = ref(false);
const selectedKey = ref('');
const selectedEmployee = ref(null);
const date = ref(todayInBerlin());
const { data: list, loading: listLoading, error: listError, run: readList, clear: clearList } = useTariffRequest();
const { data: history, loading: historyLoading, error: historyError, run: readHistory, clear: clearHistory } = useTariffRequest();
const { data: rate, loading: rateLoading, error: rateError, run: readRate, clear: clearRate } = useTariffRequest();
let searchTimer;
const activeFilterCount = computed(() => Number(Boolean(locationId.value)) + Number(tariffFilter.value === 'missing'));
function loadEmployees() { return readList((signal) => api.get('/api/tariffs/employees', { signal, params: { search: search.value.trim(), page: page.value, pageSize: itemsPerPage.value, locationId: locationId.value || undefined, tariff: tariffFilter.value } })); }
function resetFilters() { locationId.value = null; tariffFilter.value = 'all'; }
function selectEmployee(employee) { selectedEmployee.value = employee; selectedKey.value = employee.key; }
async function selectDate(value) { date.value = value; await nextTick(); resolveRate(); }
function setItemsPerPage(value) {
  itemsPerPage.value = value;
  if (page.value !== 1) page.value = 1;
  else loadEmployees();
}
function refreshFromFirstPage() {
  clearList();
  selectedKey.value = '';
  if (page.value !== 1) page.value = 1;
  else loadEmployees();
}
function resolveRate() {
  const id = history.value?.employee?.employeeId;
  if (!id || !date.value) return;
  return readRate((signal) => api.get(`/api/tariffs/employees/${encodeURIComponent(id)}/base-rate`, { signal, params: { date: date.value } }));
}
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refreshFromFirstPage, 250);
});
watch([locationId, tariffFilter], refreshFromFirstPage);
watch(page, loadEmployees);
watch(selectedKey, async (key) => {
  clearRate();
  clearHistory();
  if (!key) { selectedEmployee.value = null; return; }
  date.value = todayInBerlin();
  const result = await readHistory((signal) => api.get('/api/tariffs/employee-history', { signal, params: { key } }));
  if (result && key === selectedKey.value) resolveRate();
});
watch(date, clearRate);
watch(() => props.revision, () => { selectedKey.value = ''; clearHistory(); clearRate(); loadEmployees(); }, { immediate: true });
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<style scoped lang="scss">
.tariff-employees-toolbar {
  // ToolbarPageControls are deliberately docked just below the toolbar.
  // The base toolbar scrolls horizontally, which would otherwise clip them.
  margin-bottom: 29px;
  overflow: visible;
}
.tariff-employees-layout { display: flex; align-items: flex-start; min-width: 0; }
.tariff-employees-list { flex: 1; min-width: 0; }
.tariff-employees-list table { min-width: 680px; }
.tariff-employees-search { flex: 1 1 220px; width: auto; }
.tariff-employees-list tbody tr { cursor: pointer; }
.tariff-employees-list tbody tr:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
</style>
