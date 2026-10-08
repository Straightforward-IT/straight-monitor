<template>
  <details class="tariff-rule-section" :open="showIntervalStatus && ineffectiveCount > 0">
    <summary>{{ title }} <span class="tariff-muted">({{ records.length }})</span><span v-if="showIntervalStatus && ineffectiveCount"> · {{ ineffectiveCount }} unwirksam</span></summary>
    <p v-if="!records.length" class="tariff-muted">Keine Einträge im aktiven Datenstand.</p>
    <div v-else class="tariff-scroll">
      <table><thead><tr><th v-if="showIntervalStatus">Zeitraumstatus</th><th v-for="column in columns" :key="column">{{ column }}</th><th>Herkunft</th></tr></thead><tbody>
        <tr v-for="(record, index) in records" :key="`${record.legacyId || record.source?.row || index}:${index}`">
          <td v-if="showIntervalStatus"><TariffIntervalStatus :status="record.intervalStatus" /></td>
          <td v-for="column in columns" :key="column">{{ sourceValue(raw(record)[column]) }}</td>
          <td><TariffSourceDetails :source="record.source" /></td>
        </tr>
      </tbody></table>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue';
import TariffSourceDetails from './TariffSourceDetails.vue';
import TariffIntervalStatus from './TariffIntervalStatus.vue';
import { sourceValue } from './tariffDisplay';
const props = defineProps({ title: { type: String, required: true }, records: { type: Array, default: () => [] }, showIntervalStatus: { type: Boolean, default: false } });
const ineffectiveCount = computed(() => props.records.filter((record) => record.intervalStatus === 'INEFFECTIVE').length);
const raw = (record) => record.source?.raw || Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'source'));
const columns = computed(() => [...new Set(props.records.flatMap((record) => Object.keys(raw(record))))]);
</script>
