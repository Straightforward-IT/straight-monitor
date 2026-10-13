<template>
  <section class="lohn wage-types">
    <Toolbar>
      <ToolbarFilter v-model="filtersOpen" :active-count="activeFilterCount" :active-filter-labels="activeFilterLabels" @reset="resetFilters">
        <FilterGroup label="Berechnungsart">
          <AppSelect v-model="filters.calculation" aria-label="Berechnungsart filtern">
            <option value="">Alle</option>
            <option v-for="type in calculationOptions" :key="type.code" :value="type.code">{{ type.code }} · {{ type.label }}</option>
          </AppSelect>
        </FilterGroup>
        <FilterGroup label="Bereitstellung">
          <AppSelect v-model="filters.provision" aria-label="Konditionsbereitstellung filtern">
            <option value="">Alle</option>
            <option v-for="code in ['0', '1', '2', '3']" :key="code" :value="code">{{ formatSetting({ fakturierungCode: code }, 'fakturierungCode') }}</option>
          </AppSelect>
        </FilterGroup>
        <FilterGroup label="KB">
          <AppSelect v-model="filters.kb" aria-label="Fehlzeitenkürzel filtern">
            <option value="">Alle</option><option value="present">Mit KB</option><option value="missing">Ohne KB</option>
          </AppSelect>
        </FilterGroup>
        <FilterGroup label="Codes">
          <AppSelect v-model="filters.codes" aria-label="Unbekannte Codes filtern">
            <option value="">Alle</option><option value="unknown">Mit unbekannten Codes</option>
          </AppSelect>
        </FilterGroup>
      </ToolbarFilter>
      <SearchBar v-model="search" class="toolbar-search" placeholder="Lohnart oder Bedeutung suchen …" aria-label="Lohnart suchen" />
      <ToolbarLabel>{{ filteredRecords.length }} Lohnarten</ToolbarLabel>
      <template #actions><ToolbarButton variant="secondary" :disabled="loading" @click="loadList">Neu laden</ToolbarButton></template>
    </Toolbar>
    <p v-if="error" class="wage-types__error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="wage-types__state" role="status">Lohnarten werden geladen …</p>
    <div class="wage-types__workspace">
      <div class="wage-types__table-wrap">
        <table v-if="!loading && !error" class="lohn__table wage-types__table" aria-label="Lohnarten">
          <thead><tr>
            <th v-for="column in columns" :key="column.field" :data-field="column.field" :aria-sort="sortField === column.field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
              <button type="button" class="wage-types__sort" @click="sortBy(column.field)">{{ column.label }}<span v-if="sortField === column.field" aria-hidden="true">{{ sortDirection === 'asc' ? ' ↑' : ' ↓' }}</span></button>
            </th>
            <th>Kundenbezüge</th><th>Details</th>
          </tr></thead>
          <tbody>
            <tr v-for="record in filteredRecords" :key="record._id" :class="{ 'wage-types__row--selected': selectedId === record._id }" @click="selectRecord(record)">
              <td v-for="column in columns" :key="column.field" :data-field="column.field">
                <span :title="column.setting ? getSettingHint(record, column.field) : undefined">{{ column.setting ? formatSetting(record, column.field) : rawDisplay(record[column.field]) }}</span>
              </td>
              <td class="lohn__kunden"><div v-if="record.kunden?.length" class="wage-types__customers">
                <button v-for="customer in record.kunden.slice(0, 3)" :key="customer._id" type="button" class="lohn__kunde-link wage-types__link" @click.stop="openCustomerPrices(customer)">{{ customer.kuerzel || customer.kundName || customer.kundenNr }}</button>
                <details v-if="record.kunden.length > 3" class="wage-types__more-customers" @click.stop>
                  <summary>{{ record.kunden.length - 3 }} weitere</summary>
                  <div class="wage-types__customers"><button v-for="customer in record.kunden.slice(3)" :key="customer._id" type="button" class="lohn__kunde-link wage-types__link" @click.stop="openCustomerPrices(customer)">{{ customer.kuerzel || customer.kundName || customer.kundenNr }}</button></div>
                </details>
              </div><span v-else>—</span></td>
              <td><AppButton size="sm" variant="secondary" :aria-label="`Lohnart ${record.lohnartNummer} anzeigen`" @click.stop="selectRecord(record)">Anzeigen</AppButton></td>
            </tr>
            <tr v-if="!filteredRecords.length"><td colspan="8" class="wage-types__state">Keine Lohnarten vorhanden.</td></tr>
          </tbody>
        </table>
      </div>
      <WageTypeDetailsPanel :selected-id="selectedId" :selected-record="selectedRecord" @close="selectedId = ''" @select="selectTarget" @open-customer="openCustomerPrices" />
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import api from '@/utils/api';
import { useCustomerModals } from '@/composables/useCustomerModals';
import { families, getCodeMetadaten, formatSetting, getSettingHint } from '@/utils/wageTypeSettings';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import ToolbarLabel from '@/components/ui-elements/ToolbarLabel.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import WageTypeDetailsPanel from './WageTypeDetailsPanel.vue';

const { openCustomer } = useCustomerModals();
const records = ref([]);
const loading = ref(false);
const error = ref('');
const search = ref('');
const filtersOpen = ref(false);
const filters = reactive({ calculation: '', provision: '', kb: '', codes: '' });
const sortField = ref('lohnartNummer');
const sortDirection = ref('asc');
const selectedId = ref('');
const selectedTarget = ref(null);
const selectedRecord = computed(() => records.value.find(row => row._id === selectedId.value) || selectedTarget.value);
let request = 0;
let controller;
const columns = [
  { field: 'lohnartNummer', label: 'Nr.' },
  { field: 'lohnartKurzzeichen', label: 'Kürzel' },
  { field: 'lohnartBezeichnung', label: 'Bezeichnung' },
  { field: 'kb', label: 'KB' },
  { field: 'berechnungsartCode', label: 'Berechnungsart', setting: true },
  { field: 'fakturierungCode', label: 'Konditionsbereitstellung', setting: true },
];
const calculationOptions = computed(() => families.calculation?.types || []);
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length);
const activeFilterLabels = computed(() => [
  filters.calculation && `Berechnungsart: ${filters.calculation}`,
  filters.provision && `Bereitstellung: ${formatSetting({ fakturierungCode: filters.provision }, 'fakturierungCode')}`,
  filters.kb && (filters.kb === 'present' ? 'Mit KB' : 'Ohne KB'),
  filters.codes && 'Mit unbekannten Codes',
].filter(Boolean));

const searchableRecords = computed(() => records.value.map(row => {
  const metadata = getCodeMetadaten(row);
  const meanings = Object.values(metadata).filter(setting => setting.status !== 'missing').flatMap(setting => [setting.code, setting.label, setting.note]);
  const rawValues = Object.entries(row).filter(([key]) => !['codeMetadaten', 'berechnungsart', 'durchschnittsspeicherung'].includes(key)).flatMap(([, value]) => searchableValues(value));
  return { row, metadata, text: [...rawValues, ...meanings].join(' ').toLocaleLowerCase('de') };
}));
const filteredRecords = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('de');
  return searchableRecords.value.filter(({ row, metadata, text }) => (!query || text.includes(query))
    && (!filters.calculation || String(row.berechnungsartCode ?? '').trim() === filters.calculation)
    && (!filters.provision || String(row.fakturierungCode ?? '').trim() === filters.provision)
    && (!filters.kb || Boolean(String(row.kb ?? '').trim()) === (filters.kb === 'present'))
    && (!filters.codes || Object.values(metadata).some(setting => setting.status === 'unknown')))
    .map(({ row }) => row).sort((left, right) => {
      const a = String(left[sortField.value] ?? '').trim();
      const b = String(right[sortField.value] ?? '').trim();
      if (!a || !b) return a ? -1 : b ? 1 : 0;
      const comparison = a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' });
      return sortDirection.value === 'asc' ? comparison : -comparison;
    });
});

function rawDisplay(value) { return value == null || value === '' ? '—' : String(value); }
function searchableValues(value) {
  if (value == null) return [];
  if (typeof value === 'object') return Object.values(value).flatMap(searchableValues);
  return [String(value)];
}
function resetFilters() { Object.keys(filters).forEach(key => { filters[key] = ''; }); }
function sortBy(field) {
  sortDirection.value = sortField.value === field && sortDirection.value === 'asc' ? 'desc' : 'asc';
  sortField.value = field;
}
function selectRecord(record) { selectedTarget.value = record; selectedId.value = record._id; }
function selectTarget(target) { selectRecord(target); }
function openCustomerPrices(customer) { openCustomer(customer, { initialTab: 'preise' }); }
async function loadList() {
  const current = ++request;
  controller?.abort();
  controller = new AbortController();
  loading.value = true; error.value = '';
  try {
    const { data } = await api.get('/api/import/lohnarten', { signal: controller.signal });
    if (current !== request) return;
    records.value = Array.isArray(data.data) ? data.data : [];
  } catch (cause) {
    if (current !== request || controller.signal.aborted) return;
    error.value = cause?.response?.data?.message || 'Lohnarten konnten nicht geladen werden.';
  } finally { if (current === request) loading.value = false; }
}
onMounted(loadList);
onBeforeUnmount(() => { request++; controller?.abort(); });
</script>

<style scoped>
.wage-types { padding-top: 22px; min-width: 0; }
.wage-types__workspace { display: flex; align-items: flex-start; min-width: 0; }
.wage-types__table-wrap { flex: 1; min-width: 0; overflow-x: auto; }
.wage-types__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.wage-types__table th { white-space: nowrap; text-align: left; padding: 10px; border-bottom: 1px solid var(--border); color: var(--muted); }
.wage-types__table td { padding: 12px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
.wage-types__table tbody tr:not(:last-child), .wage-types__table tbody tr:has(button) { cursor: pointer; }
.wage-types__table tbody tr:has(button):hover { background: var(--hover); }
.wage-types__row--selected { background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.wage-types__sort { border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; font-weight: 600; text-align: left; }
.wage-types__sort:focus-visible { outline: 2px solid var(--primary); outline-offset: 4px; }
.wage-types__customers { display: flex; gap: 6px; flex-wrap: wrap; }
.wage-types__more-customers { font-size: 12px; }
.wage-types__more-customers summary { cursor: pointer; color: var(--muted); }
.wage-types__more-customers .wage-types__customers { margin-top: 8px; }
.wage-types__link { padding: 0; border: 0; background: transparent; color: var(--primary); font: inherit; cursor: pointer; text-align: left; }
.wage-types__link:hover { text-decoration: underline; }
.wage-types__state { color: var(--muted); padding: 12px 0; font-size: 13px; }
.wage-types__error { color: var(--danger, #b91c1c); }
:deep(.toolbar-filter .app-select) { max-width: 220px; min-width: 100px; }
</style>
