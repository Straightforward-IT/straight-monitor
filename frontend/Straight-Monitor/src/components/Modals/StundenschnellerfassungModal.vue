<template>
  <ModalFrame
    :model-value="modelValue"
    title="Stundenschnellerfassung"
    :subtitle="`Auftrag #${auftrag.auftragNr} · ${auftrag.eventTitel || ''}`"
    size="xl"
    :close-on-backdrop="false"
    class="quick-time-modal"
    style="--mf-max-width: min(1540px, 96vw); --mf-body-padding: 0; --mf-body-overflow: hidden; --mf-max-height: 94dvh"
    @close="close"
  >
    <Stundenschnellerfassung
      v-if="modelValue"
      contained
      :auftrag="auftrag"
      :schichten="schichten"
      :einsaetze="einsaetze"
      :zeiten="zeiten"
      @submit="emit('submit', $event)"
      @cancel="close"
    />
  </ModalFrame>
</template>

<script setup>
import ModalFrame from '@/components/frames/ModalFrame.vue';
import Stundenschnellerfassung from '@/components/ui-elements/Stundenschnellerfassung.vue';

defineProps({
  modelValue: { type: Boolean, default: true },
  auftrag: { type: Object, required: true },
  schichten: { type: Array, default: () => [] },
  einsaetze: { type: Array, default: () => [] },
  zeiten: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'submit', 'close']);
function close() { emit('update:modelValue', false); emit('close'); }
</script>
