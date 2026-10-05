<template>
  <label
    class="app-toggle-chip"
    :class="{ 'app-toggle-chip--active': modelValue, 'app-toggle-chip--disabled': disabled }"
  >
    <input
      class="app-toggle-chip__input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="accessibleLabel || undefined"
      @change="emit('update:modelValue', $event.target.checked)"
    >
    <span class="app-toggle-chip__text">{{ label }}</span>
  </label>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  accessibleLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
</script>

<style scoped lang="scss">
.app-toggle-chip {
  position: relative;
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  box-sizing: border-box;
  border: 1px solid var(--control-input-border, var(--border));
  border-radius: var(--control-radius, 8px);
  background: var(--control-input-bg, var(--panel));
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;

  &--active {
    border-color: var(--primary);
    background: var(--action-ghost-hover, color-mix(in srgb, var(--primary) 12%, transparent));
    color: var(--action-accent-text, var(--text));
  }

  &--disabled {
    border-color: var(--control-disabled-border, var(--border));
    background: var(--control-disabled-bg, var(--hover));
    color: var(--control-disabled-text, var(--muted));
    cursor: not-allowed;
  }

  &:has(.app-toggle-chip__input:focus-visible) {
    outline: 2px solid var(--control-focus-ring, color-mix(in srgb, var(--primary) 42%, transparent));
    outline-offset: 2px;
  }
}

.app-toggle-chip__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-toggle-chip__text { padding: 5px 9px; }
</style>
