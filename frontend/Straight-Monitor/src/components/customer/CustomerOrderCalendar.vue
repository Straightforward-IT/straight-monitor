<template>
  <div>
    <AssignmentCalendar
      :calendar-year="year" :calendar-month="month" :calendar-einsaetze="orders"
      :calendar-loading="loading" empty-label="Keine Aufträge"
      @previous="moveMonth(-1)" @next="moveMonth(1)" @open="$emit('open', $event)"
    />
    <p v-if="error" role="alert" class="calendar-message">
      {{ error }} <button type="button" @click="loadOrders">Erneut laden</button>
    </p>
    <p v-else-if="!loading && !orders.length" class="calendar-message">Keine Aufträge in diesen beiden Monaten.</p>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import AssignmentCalendar from '@/components/ui-elements/AssignmentCalendar.vue';
import api from '@/utils/api';
const props = defineProps({ kundenNr: { type: [Number, String], required: true } });
defineEmits(['open']);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth());
const orders = ref([]);
const loading = ref(false);
const error = ref('');
let requestId = 0;
function moveMonth(offset) {
  const date = new Date(year.value, month.value + offset, 1);
  year.value = date.getFullYear();
  month.value = date.getMonth();
}
async function loadOrders() {
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  orders.value = [];
  try {
    const { data } = await api.get(`/api/kunden/${encodeURIComponent(props.kundenNr)}/auftragskalender`, {
      params: {
        von: new Date(year.value, month.value, 1).toISOString(),
        bis: new Date(year.value, month.value + 2, 0, 23, 59, 59, 999).toISOString(),
      },
    });
    if (id !== requestId) return;
    orders.value = data.map(order => ({
      ...order, datumVon: order.vonDatum, datumBis: order.bisDatum,
      bezeichnung: order.eventTitel || `Auftrag ${order.auftragNr}`,
    }));
  } catch {
    if (id === requestId) error.value = 'Aufträge konnten nicht geladen werden.';
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(() => [props.kundenNr, year.value, month.value], loadOrders, { immediate: true });
onBeforeUnmount(() => { requestId++; });
</script>

<style scoped>
.calendar-message { color: var(--muted); font-size: 12px; margin: 12px 0 0; }
.calendar-message button { color: var(--primary); background: transparent; border: 0; cursor: pointer; }
</style>
