<template>
  <ModalFrame
    class="hover-data-card-modal"
    :model-value="modelValue"
    :title="title"
    :subtitle="subtitle"
    :minimizable="minimizable"
    :minimize-title="title"
    size="md"
    style="--mf-max-width: min(640px, calc(100vw - 24px)); --mf-body-padding: 0"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('close')"
  >
    <HoverDataCard :data="data" :loading="loading" inline />
  </ModalFrame>
</template>

<script setup>
import ModalFrame from '@/components/frames/ModalFrame.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';

defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: 'Kontingentübersicht' },
  subtitle: { type: String, default: '' },
  data: {
    type: Object,
    default: () => ({
      type: 'notice',
      title: 'Kontingentübersicht',
      issues: [{ code: 'DATA_MISSING', message: 'Es wurden noch keine Kontingentdaten übergeben.' }],
    }),
  },
  loading: { type: Boolean, default: false },
  minimizable: { type: Boolean, default: false },
});
defineEmits(['update:modelValue', 'close']);
</script>

<style scoped>
:deep(.hover-data-card--inline) {
  border: 0;
  border-radius: 0;
}
</style>
