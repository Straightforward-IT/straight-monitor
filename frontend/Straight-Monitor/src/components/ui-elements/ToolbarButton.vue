<template>
  <button class="toolbar-btn" :class="`toolbar-btn--${variant}`" type="button">
    <slot />
  </button>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
    // 'primary' | 'secondary'
  },
});
</script>

<style scoped lang="scss">
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: none;
  border-radius: 9px;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;

  &--primary {
    background: var(--primary);
    color: #fff;
    &:hover { background: color-mix(in srgb, var(--primary) 88%, #000); }
  }

  &--secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
    &:hover { border-color: var(--primary); color: var(--primary); }
  }

  &--outlined {
    background: transparent;
    color: var(--primary);
    border: 1px solid var(--primary);
    &:hover { background: color-mix(in oklab, var(--primary) 12%, transparent); }
  }
}
</style>
