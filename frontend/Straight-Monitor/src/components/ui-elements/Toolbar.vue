<template>
  <div v-bind="$attrs" class="toolbar" :class="{ 'toolbar--wrap': wrap, 'toolbar--actions-open': actionsOpen }">
    <slot name="filter" />
    <div class="toolbar-main-content" :class="{ 'toolbar-main-content--hidden': actionsOpen }">
      <slot />
    </div>
    <button
      v-if="$slots.actions"
      class="toolbar-mobile-actions-toggle"
      type="button"
      :aria-expanded="actionsOpen"
      aria-controls="toolbar-inline-actions"
      :aria-label="actionsOpen ? 'Suche anzeigen' : 'Weitere Aktionen'"
      @click="actionsOpen = !actionsOpen"
    >
      <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
    </button>

    <div id="toolbar-inline-actions" class="toolbar-inline-actions" :class="{ 'toolbar-inline-actions--open': actionsOpen }">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';

library.add(faEllipsisVertical);

defineOptions({ inheritAttrs: false });

defineProps({
  wrap: { type: Boolean, default: false },
});

const actionsOpen = ref(false);
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= 768);

function onResize() {
  isMobile.value = window.innerWidth <= 768;
  if (!isMobile.value) actionsOpen.value = false;
}

function onKeydown(event) {
  if (event.key === 'Escape') actionsOpen.value = false;
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeydown);
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

.toolbar-main-content {
  display: contents;
}

.toolbar-mobile-actions-toggle {
  display: none;
}

@media (max-width: 768px) {
  .toolbar {
    gap: 8px;
    padding-right: 7px;
    overflow: visible;

    &--actions-open { gap: 0; }
  }

  .toolbar-main-content {
    display: flex;
    min-width: 0;
    flex: 1;
    align-self: stretch;
    align-items: center;
    gap: 8px;

    :deep(.toolbar-search) {
      min-width: 0;
      max-width: none;
    }

    &--hidden { display: none; }
  }

  .toolbar-mobile-actions-toggle {
    display: inline-flex;
    width: 44px;
    align-self: stretch;
    align-items: center;
    justify-content: center;
    flex: 0 0 44px;
    border: 0;
    border-left: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border));
    border-radius: 0 11px 11px 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--primary);
      background: color-mix(in oklab, var(--primary) 8%, transparent);
    }
  }
}

@media (max-width: 768px) {
  .toolbar-inline-actions {
    display: none;
    width: 0;
    min-width: 0;
    flex: 1;

    &--open { display: block; }

    :deep(.toolbar-group) {
      display: flex;
      gap: 8px;
      width: 100%;

      :deep(.toolbar-button),
      :deep(.toolbar-icon-button) {
        width: 100%;
        justify-content: flex-start;
      }
    }

    :deep(.view-controls-right) {
      display: grid;
      width: 100%;
      min-width: 0;
      align-items: center;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    :deep(.sort-menu),
    :deep(.sort-menu__trigger) {
      width: 100%;
    }

    :deep(.pagination-compact) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      gap: 8px;
    }

    :deep(.pagination-info-compact),
    :deep(.pagination-controls-compact) {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    :deep(.pagination-text) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
