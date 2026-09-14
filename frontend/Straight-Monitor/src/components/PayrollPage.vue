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
      <Toolbar wrap class="payroll-page__toolbar">
        <label class="payroll-page__field payroll-page__field--employee">
          <span>Mitarbeiter</span>
          <MitarbeiterSearch
            v-model="selectedEmployeeId"
            include-inactive
            :selected-item="selectedEmployee"
            placeholder="Mitarbeiter suchen …"
          />
        </label>
        <label class="payroll-page__field">
          <span>Monat</span>
          <input :value="month" type="month" @change="changeMonth">
        </label>
        <template #actions>
          <ToolbarGroup push-right>
            <ToolbarButton variant="secondary" :disabled="loading || !employeeId" @click="loadMonth">
              Stand neu laden
            </ToolbarButton>
            <ToolbarButton :disabled="!employeeId" @click="openTimeCapture({ employeeId })">
              Stundenschnellerfassung
            </ToolbarButton>
          </ToolbarGroup>
        </template>
      </Toolbar>
      <template v-if="!employeeId">
        <p class="payroll-page__notice">Wähle einen Mitarbeiter, um übergebene Schichtstunden, Zeitkonto und Fehlzeiten für den Monat zu verwalten.</p>
      </template>
      <template v-else>
        <p class="payroll-page__notice">Übergebene Schichtstunden stammen aus der Stundenschnellerfassung. Umbuchungen, Fehlzeiten und Zeitkonto sind weiterhin eine lokale Vorschau; ein bestehendes Zeitkonto wird noch nicht verändert.</p>
        <p v-if="loading" role="status">Monatsstunden werden geladen …</p>
        <p v-else-if="error" role="alert">{{ error }}</p>
        <template v-else-if="data">
          <p v-if="!data.initialData.entries.length" class="payroll-page__notice">Für diesen Monat wurden noch keine Stunden aus der Schnellerfassung übergeben.</p>
          <TimeManagement
            :key="revision"
            :employee="data.employee"
            :month="month"
            :initial-data="data.initialData"
            :save-enabled="false"
          >
            <template #documents="{ auftragNr }">
              <OrderDocuments :auftrag-nr="auftragNr" />
            </template>
          </TimeManagement>
        </template>
      </template>
    </div>
  </RouterPageLayout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import TimeManagement from '@/components/ui-elements/TimeManagement.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
import { payrollTabs } from '@/components/layout/pageTabDefinitions';
import { useTimeCaptureModals } from '@/composables/useTimeCaptureModals';

const route = useRoute();
const router = useRouter();
const { openTimeCapture } = useTimeCaptureModals();
const data = ref(null);
const loading = ref(false);
const error = ref('');
const revision = ref(0);
let request = 0;

const employeeId = computed(() => String(route.query.employeeId || ''));
const month = computed(() => String(route.query.month || new Date().toLocaleDateString('sv-SE').slice(0, 7)));
const selectedEmployeeId = computed({
  get: () => employeeId.value || null,
  set: value => replaceQuery({ employeeId: value || null }),
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
function changeMonth(event) { if (event.target.value) replaceQuery({ month: event.target.value }); }
async function loadMonth() {
  if (!employeeId.value) return;
  const current = ++request;
  loading.value = true;
  error.value = '';
  data.value = null;
  try {
    const response = await api.get(`/api/working-times/employees/${employeeId.value}/month`, { params: { month: month.value } });
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
  window.addEventListener('working-times:released', loadMonth);
});
onBeforeUnmount(() => {
  request++;
  window.removeEventListener('working-times:released', loadMonth);
});
</script>

<style scoped>
.payroll-page { padding: 16px; min-width: 0; }
.payroll-page__toolbar { margin-bottom: 16px; }
.payroll-page__field { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--muted); font-size: 12px; }
.payroll-page__field--employee { width: min(360px, 100%); }
.payroll-page__field--employee :deep(.ma-search) { min-width: 0; }
.payroll-page__field input { color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
.payroll-page__body { min-width: 0; }
.payroll-page__notice { padding: 10px 14px; margin: 0 0 12px; color: var(--muted); font-size: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
@media (max-width: 720px) {
  .payroll-page { padding: 10px; }
  .payroll-page__field { width: 100%; justify-content: space-between; }
  .payroll-page__field--employee { width: 100%; }
  .payroll-page__field input { flex: 1; min-width: 0; }
}
</style>
