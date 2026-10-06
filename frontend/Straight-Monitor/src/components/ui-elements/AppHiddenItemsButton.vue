<template>
  <AppButton
    class="app-hidden-items-button"
    :class="{ 'is-active': active }"
    variant="secondary"
    size="sm"
    :aria-pressed="active"
    :aria-label="active ? (activeAriaLabel || activeLabel) : (inactiveAriaLabel || inactiveLabel)"
    :title="active ? (activeTitle || activeAriaLabel || activeLabel) : (inactiveTitle || inactiveAriaLabel || inactiveLabel)"
    @click="emit('click', $event)"
  >
    <font-awesome-icon
      :icon="active ? 'fa-solid fa-arrow-left' : 'fa-solid fa-eye-slash'"
      aria-hidden="true"
    />
    {{ active ? activeLabel : inactiveLabel }}
  </AppButton>
</template>

<script setup>
import AppButton from './AppButton.vue';

defineProps({
  active: { type: Boolean, default: false },
  inactiveLabel: { type: String, required: true },
  activeLabel: { type: String, default: 'Zurück' },
  inactiveAriaLabel: { type: String, default: '' },
  activeAriaLabel: { type: String, default: '' },
  inactiveTitle: { type: String, default: '' },
  activeTitle: { type: String, default: '' },
});

const emit = defineEmits(['click']);
</script>

<style scoped lang="scss">
.app-hidden-items-button {
  min-height: 32px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  user-select: none;

  &.is-active {
    --app-button-background: color-mix(in srgb, var(--primary) 12%, var(--surface));
    --app-button-border: var(--primary);
    --app-button-color: var(--action-accent-text);
  }
}
</style>
