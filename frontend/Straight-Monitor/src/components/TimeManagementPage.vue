<template>
  <PageLayout
    title="Zeitverwaltung"
    width="full"
    content-variant="flush"
    class="time-management-page"
  >
    <template #actions>
      <label>Monat <input
        :value="month"
        type="month"
        @change="changeMonth"
      ></label>
      <button
        type="button"
        :disabled="loading"
        @click="load"
      >
        Stand neu laden
      </button>
      <button
        type="button"
        @click="openTimeCapture({ employeeId })"
      >
        Stundenschnellerfassung
      </button>
    </template>
    <p class="time-management-page__notice">
      Die übergebenen Schichtstunden kommen aus dem Backend. Umbuchungen, Fehlzeiten und Zeitkonto sind weiterhin eine lokale Vorschau; es wird noch kein bestehendes Zeitkonto geladen oder verändert.
    </p>
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
      <p
        v-if="!data.initialData.entries.length"
        class="time-management-page__notice"
      >
        Für diesen Monat wurden noch keine Stunden aus der Schnellerfassung übergeben.
      </p>
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
  </PageLayout>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';
import PageLayout from '@/components/layout/PageLayout.vue';
import TimeManagement from '@/components/ui-elements/TimeManagement.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
import { useTimeCaptureModals } from '@/composables/useTimeCaptureModals';
const route = useRoute(), router = useRouter();
const { openTimeCapture } = useTimeCaptureModals();
const employeeId = computed(() => String(route.params.employeeId));
const month = computed(() => String(route.query.month || new Date().toLocaleDateString('sv-SE').slice(0, 7)));
const data = ref(null), loading = ref(false), error = ref(''), revision = ref(0);
let request = 0;
function changeMonth(event) { if (event.target.value) router.replace({ query: { ...route.query, month: event.target.value } }); }
async function load() {
  const current = ++request;
  loading.value = true; error.value = '';
  try {
    const response = await api.get(`/api/working-times/employees/${employeeId.value}/month`, { params: { month: month.value } });
    if (current !== request) return;
    data.value = response.data; revision.value++;
  } catch (failure) {
    if (current === request) error.value = failure?.response?.data?.message || 'Monatsstunden konnten nicht geladen werden.';
  } finally { if (current === request) loading.value = false; }
}
watch([employeeId, month], load, { immediate: true });
onMounted(() => window.addEventListener('working-times:released', load));
onBeforeUnmount(() => { request++; window.removeEventListener('working-times:released', load); });
</script>
<style scoped>
.time-management-page { padding: 16px; min-width: 0; }
.time-management-page :deep(.page-layout__actions) { flex-wrap: wrap; }
.time-management-page button, .time-management-page input { color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
.time-management-page button { cursor: pointer; }
.time-management-page label { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.time-management-page__notice { padding: 10px 14px; font-size: 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; margin: 0 0 12px; }
</style>
