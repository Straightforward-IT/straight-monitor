<template>
  <AppButton
    v-bind="$attrs"
    class="app-icon-button"
    :class="{ 'app-icon-button--active': active }"
    :variant="variant"
    :size="size"
    :type="type"
    :disabled="disabled"
    :loading="loading"
    icon-only
    :aria-label="label"
    :aria-pressed="active === null ? undefined : active"
    :title="title || label"
  >
    <slot />
  </AppButton>
</template>

<script setup>
import AppButton from '@/components/ui-elements/AppButton.vue';

defineOptions({ inheritAttrs: false });

defineProps({
  label: { type: String, required: true },
  title: { type: String, default: '' },
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  active: { type: Boolean, default: null },
});
</script>

<style scoped lang="scss">
.app-icon-button--active:not(:disabled) {
  border-color: var(--primary);
  background: var(--action-ghost-hover, color-mix(in srgb, var(--primary) 12%, transparent));
  color: var(--action-accent-text, var(--text));
}
</style>
