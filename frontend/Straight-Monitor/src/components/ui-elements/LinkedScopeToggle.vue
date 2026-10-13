<template>
  <CustomTooltip :text="description">
    <FilterChip
      class="linked-scope-toggle"
      :active="modelValue"
      :disabled="disabled"
      :aria-pressed="modelValue"
      :aria-label="description"
      @click="toggle"
    >
      <FontAwesomeIcon :icon="modelValue ? faLink : faLinkSlash" aria-hidden="true" />
    </FilterChip>
  </CustomTooltip>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLink, faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import CustomTooltip from '@/components/CustomTooltip.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
const description = computed(() => props.modelValue
  ? `${props.label}: Alle verknüpften Tage. Ausschalten, um nur das aktuelle Datum zu bearbeiten.`
  : `${props.label}: Nur das aktuelle Datum. Einschalten, um den gemeinsamen Wert für alle verknüpften Tage zu verwenden.`);
function toggle() { if (!props.disabled) emit('update:modelValue', !props.modelValue); }
</script>

<style scoped>
.linked-scope-toggle { min-width: 30px; min-height: 28px; padding: 4px 6px; justify-content: center; flex-shrink: 0; }
</style>
