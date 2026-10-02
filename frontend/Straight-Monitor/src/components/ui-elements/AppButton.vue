<template>
  <button
    v-bind="$attrs"
    class="app-button"
    :class="[
      `app-button--${variant}`,
      `app-button--${size}`,
      { 'app-button--block': block, 'app-button--icon-only': iconOnly, 'app-button--loading': loading },
    ]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span
      v-if="loading"
      class="app-button__spinner"
      aria-hidden="true"
    />
    <span class="app-button__content"><slot /></span>
  </button>
</template>

<script setup>
defineOptions({ inheritAttrs: false });

defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'outlined', 'ghost', 'danger'].includes(value),
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value),
  },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false },
});
</script>

<style scoped lang="scss">
.app-button {
  --app-button-background: var(--action-primary, var(--primary));
  --app-button-border: var(--action-primary, var(--primary));
  --app-button-color: var(--on-action-primary, var(--primary-contrast, #2a2118));

  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 8px 14px;
  border: 1px solid var(--app-button-border);
  border-radius: var(--control-radius, 8px);
  background: var(--app-button-background);
  color: var(--app-button-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease;

  &:hover:not(:disabled) {
    background: var(--action-primary-hover, color-mix(in srgb, var(--primary) 88%, #000));
    border-color: var(--action-primary-hover, color-mix(in srgb, var(--primary) 88%, #000));
  }

  &:focus-visible {
    outline: 2px solid var(--control-focus-ring, color-mix(in srgb, var(--primary) 42%, transparent));
    outline-offset: 2px;
  }

  &:disabled {
    border-color: var(--control-disabled-border, var(--border));
    background: var(--control-disabled-bg, var(--hover));
    color: var(--control-disabled-text, var(--muted));
    cursor: not-allowed;
    opacity: 1;
  }

  &--secondary {
    --app-button-background: var(--action-secondary, var(--tile-bg));
    --app-button-border: var(--action-secondary-border, var(--border));
    --app-button-color: var(--action-secondary-text, var(--text));

    &:hover:not(:disabled) {
      background: var(--action-secondary-hover, var(--hover));
      border-color: var(--primary);
      color: var(--action-accent-text, var(--text));
    }
  }

  &--ghost {
    --app-button-background: transparent;
    --app-button-border: transparent;
    --app-button-color: var(--action-ghost-text, var(--text));

    &:hover:not(:disabled) {
      background: var(--action-ghost-hover, color-mix(in srgb, var(--primary) 12%, transparent));
      border-color: transparent;
      color: var(--action-accent-text, var(--text));
    }
  }

  &--outlined {
    --app-button-background: transparent;
    --app-button-border: var(--primary);
    --app-button-color: var(--action-accent-text, var(--text));

    &:hover:not(:disabled) {
      background: var(--action-ghost-hover, color-mix(in srgb, var(--primary) 12%, transparent));
      border-color: var(--primary);
      color: var(--action-accent-text, var(--text));
    }
  }

  &--danger {
    --app-button-background: var(--action-danger, #c43d3d);
    --app-button-border: var(--action-danger, #c43d3d);
    --app-button-color: var(--on-action-danger, #fff);

    &:hover:not(:disabled) {
      background: var(--action-danger-hover, #a92f2f);
      border-color: var(--action-danger-hover, #a92f2f);
    }
  }

  &--sm { min-height: 30px; padding: 5px 10px; font-size: 0.78rem; }
  &--lg { min-height: 44px; padding: 10px 18px; font-size: 0.95rem; }
  &--block { display: flex; width: 100%; }
  &--icon-only { width: var(--app-button-icon-size, 38px); padding: 0; }
  &--icon-only.app-button--sm { width: var(--app-button-icon-size, 30px); }
  &--icon-only.app-button--lg { width: var(--app-button-icon-size, 44px); }

  &__content { display: inline-flex; align-items: center; justify-content: center; gap: inherit; font-weight: inherit; }
  &__spinner { width: 0.9em; height: 0.9em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: app-button-spin .65s linear infinite; }
}

@keyframes app-button-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .app-button { transition: none; }
  .app-button__spinner { animation-duration: 1.5s; }
}
</style>
