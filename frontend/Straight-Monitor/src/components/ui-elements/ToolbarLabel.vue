<template>
  <span class="toolbar-label">
    <slot />
  </span>
</template>

<style scoped lang="scss">
.toolbar-label {
  font-size: 0.82rem;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
