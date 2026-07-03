<template>
  <button class="toolbar-icon-btn" :class="{ 'toolbar-icon-btn--active': active }" type="button">
    <slot />
  </button>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false },
});
</script>

<style scoped lang="scss">
.toolbar-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
  }

  &--active {
    color: var(--primary);
    border-color: var(--primary);
    background: color-mix(in oklab, var(--primary) 10%, transparent);
  }
}
</style>
