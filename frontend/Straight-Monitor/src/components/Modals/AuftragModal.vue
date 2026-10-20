<template>
  <AuftragCalendarWorkspace
    v-if="modelValue && String(auftragNr ?? '').trim()"
    :hosted-auftrag-nr="auftragNr"
    :detail-minimizable="minimizable"
    :detail-minimize-id="minimizeId"
    @close="close"
    @order-loaded="emit('order-loaded', $event)"
    @mitarbeiter-drop="emit('mitarbeiter-drop', $event)"
  />
</template>

<script setup>
import AuftragCalendarWorkspace from '@/components/orders/calendar/AuftragCalendarWorkspace.vue';

defineProps({
  modelValue: { type: Boolean, default: false }, auftragNr: { type: [String, Number], required: true },
  minimizable: { type: Boolean, default: false }, minimizeId: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'close', 'order-loaded', 'mitarbeiter-drop']);
function close() { emit('update:modelValue', false); emit('close'); }
</script>
