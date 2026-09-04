<template>
  <div v-bind="$attrs" class="toolbar" :class="{ 'toolbar--wrap': wrap, 'toolbar--actions-open': actionsOpen }">
    <slot name="filter" />
    <div class="toolbar-main-content" :class="{ 'toolbar-main-content--hidden': actionsOpen }">
      <slot />
    </div>
    <div id="toolbar-inline-actions" class="toolbar-inline-actions" :class="{ 'toolbar-inline-actions--open': actionsOpen }">
      <slot name="actions" />
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

    &--actions-open {
      gap: 0;
    }
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

    &--open {
      display: flex;
      align-self: stretch;
      min-height: 0;
    }

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
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex: 1;
      width: 100%;
      min-width: 0;
      gap: 6px;
    }

    :deep(.sort-menu) { justify-self: start; }

    :deep(.sort-menu__trigger) {
      width: 40px;
      height: 40px;
      padding: 0;
      justify-content: center;
      border-radius: 8px;
      font-size: 0;

      svg { font-size: 0.8rem; }
    }

    :deep(.pagination-compact) {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: flex-end;
      min-width: 0;
      gap: 6px;
    }

    :deep(.pagination-text) { display: none; }

    :deep(.pagination-select-compact) {
      width: 60px;
      height: 40px;
      min-width: 0;
      padding: 0 8px;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    :deep(.pagination-info-compact),
    :deep(.pagination-controls-compact) {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    :deep(.pagination-btn-compact) {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      border-radius: 8px;
      font-size: 0.8rem;
    }

    :deep(.page-indicator) {
      min-width: 36px;
      padding: 0 2px;
      text-align: center;
    }

    :deep(.pagination-text) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

@media (max-width: 380px) {
  .toolbar-inline-actions {
    :deep(.view-controls-right),
    :deep(.pagination-compact) {
      gap: 4px;
    }

    :deep(.sort-menu__trigger) {
      width: 38px;
      height: 38px;
    }

    :deep(.pagination-select-compact) {
      width: 56px;
      height: 38px;
      padding-inline: 6px;
    }

    :deep(.pagination-btn-compact) {
      width: 36px;
      height: 38px;
      flex-basis: 36px;
    }

    :deep(.page-indicator) {
      min-width: 32px;
      font-size: 0.78rem;
    }
  }
}
</style>
