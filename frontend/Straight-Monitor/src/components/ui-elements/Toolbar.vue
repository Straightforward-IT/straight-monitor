<template>
  <div class="toolbar" :class="{ 'toolbar--wrap': wrap }">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  wrap: { type: Boolean, default: false },
});
</script>

<style scoped lang="scss">
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 14px;
  margin: 0 0 16px;
  position: relative;
  background: color-mix(in oklab, var(--tile-bg) 94%, var(--primary));
  border: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border));
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  &--wrap {
    flex-wrap: wrap;
  }

  // Stretch a slotted SearchBar (or any element) that carries this class
  :deep(.toolbar-search) {
    flex: 1;
    max-width: 460px;
  }
}
</style>
