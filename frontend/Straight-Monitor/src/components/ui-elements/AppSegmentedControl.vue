<template>
  <div
    class="app-segmented-control"
    :class="`app-segmented-control--${size}`"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="app-segmented-control__option"
      :class="{ 'app-segmented-control__option--active': option.value === modelValue }"
      :aria-checked="option.value === modelValue"
      :tabindex="!disabled && option.value === tabStop ? 0 : -1"
      :disabled="disabled || option.disabled"
      :data-label="typeof option.label === 'string' ? option.label : ''"
      @click="emit('update:modelValue', option.value)"
      @keydown="onKeydown($event, option.value)"
    >
      <slot
        name="option"
        :option="option"
      >
        {{ option.label }}
      </slot>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], required: true },
  options: { type: Array, required: true },
  label: { type: String, required: true },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md'].includes(value),
  },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const enabledOptions = computed(() => props.options.filter(option => !option.disabled));
const tabStop = computed(() => enabledOptions.value.find(option => option.value === props.modelValue)?.value
  ?? enabledOptions.value[0]?.value);

function onKeydown(event, value) {
  if (props.disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const enabled = enabledOptions.value;
  if (!enabled.length) return;
  event.preventDefault();
  const index = enabled.findIndex(option => option.value === value);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? enabled.length - 1
      : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + enabled.length) % enabled.length;
  const next = enabled[nextIndex];
  const allIndex = props.options.findIndex(option => option.value === next.value);
  event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[allIndex]?.focus();
  emit('update:modelValue', next.value);
}
</script>

<style scoped lang="scss">
.app-segmented-control {
  display: inline-grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  width: fit-content;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 6%, transparent);

  &__option {
    position: relative;
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 6px 16px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.84rem;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    transition: color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;

    // Reserve the bold width so options never shift when selection changes.
    &::after {
      content: attr(data-label);
      height: 0;
      overflow: hidden;
      visibility: hidden;
      pointer-events: none;
      font-weight: 600;
    }

    &:hover:not(:disabled):not(.app-segmented-control__option--active) { color: var(--text); }
    &:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
    &:disabled { color: var(--control-disabled-text); cursor: not-allowed; }
  }

  &__option--active {
    color: var(--action-accent-text, var(--primary));
    font-weight: 600;
    background: var(--surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 0 0 1px color-mix(in srgb, var(--primary) 32%, transparent);
  }

  &--sm .app-segmented-control__option { min-height: 26px; padding: 4px 12px; font-size: 0.78rem; }
}

@media (prefers-reduced-motion: reduce) {
  .app-segmented-control__option { transition: none; }
}
</style>
