<template>
  <WageTypeDetailsPanel
    v-if="modelValue"
    :selected-id="lohnartId"
    :selected-number="lohnartNummer"
    :selected-record="selectedRecord"
    :initial-tab="initialTab"
    presentation="modal"
    modal-size="lg"
    layer="elevated"
    :modal-minimizable="minimizable"
    :minimize-id="minimizeId"
    @close="close"
    @title-change="emit('title-change', $event)"
    @select="openLohnart($event, { initialTab: 'tariff' })"
    @open-customer="openCustomer($event, { initialTab: 'preise' })"
  >
    <template #modal-footer><AppButton variant="secondary" @click="close">Schließen</AppButton></template>
  </WageTypeDetailsPanel>
</template>

<script setup>
import WageTypeDetailsPanel from '@/components/payroll/WageTypeDetailsPanel.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import { useLohnartModals } from '@/composables/useLohnartModals';
import { useCustomerModals } from '@/composables/useCustomerModals';

defineProps({
  modelValue: { type: Boolean, default: false }, lohnartId: { type: String, default: '' },
  lohnartNummer: { type: [String, Number], default: '' }, selectedRecord: { type: Object, default: null },
  initialTab: { type: String, default: 'calculation' }, minimizable: { type: Boolean, default: false },
  minimizeId: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'close', 'title-change']);
const { openLohnart } = useLohnartModals();
const { openCustomer } = useCustomerModals();
function close() { emit('update:modelValue', false); emit('close'); }
</script>
