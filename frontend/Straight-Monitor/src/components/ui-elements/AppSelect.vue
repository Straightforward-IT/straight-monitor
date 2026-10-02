<template>
  <select
    v-model="value"
    v-bind="$attrs"
    class="app-select"
    :class="`app-select--${size}`"
  >
    <slot />
  </select>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  size: {
    type: String,
    default: 'md',
    validator: value => ['sm', 'md'].includes(value),
  },
});
const emit = defineEmits(['update:modelValue']);

const value = computed({
  get: () => props.modelValue,
  set: selected => emit('update:modelValue', selected),
});
</script>

<style scoped lang="scss">
.app-select {
  display: inline-block;
  min-width: 0;
  min-height: 38px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--control-input-border, var(--border));
  border-radius: var(--control-radius, 8px);
  background: var(--control-input-bg, var(--tile-bg));
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.25;

  &:focus-visible {
    border-color: var(--primary);
    outline: 2px solid var(--control-focus-ring, color-mix(in srgb, var(--primary) 42%, transparent));
    outline-offset: 1px;
  }

  &:disabled {
    border-color: var(--control-disabled-border, var(--border));
    background: var(--control-disabled-bg, var(--hover));
    color: var(--control-disabled-text, var(--muted));
    cursor: not-allowed;
  }

  &--sm {
    min-height: 28px;
    padding: 3px 6px;
    border-radius: 6px;
    font-size: 0.75rem;
  }
}
</style>
