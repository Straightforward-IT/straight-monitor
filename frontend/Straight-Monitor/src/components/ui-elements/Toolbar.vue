<template>
  <div v-bind="$attrs" class="toolbar" :class="{ 'toolbar--wrap': wrap, 'toolbar--actions-open': actionsOpen }">
    <slot />
    <button
      v-if="$slots.actions"
      class="toolbar-mobile-actions-toggle"
      type="button"
      :aria-expanded="actionsOpen"
      aria-controls="toolbar-mobile-actions"
      aria-label="Weitere Aktionen"
      @click="actionsOpen = !actionsOpen"
    >
      <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
    </button>

    <teleport to="body" :disabled="!isMobile">
      <div
        class="toolbar-mobile-actions"
        :class="{ 'toolbar-mobile-actions--open': actionsOpen }"
        @click.self="actionsOpen = false"
      >
        <section id="toolbar-mobile-actions" class="toolbar-mobile-sheet" aria-label="Weitere Aktionen">
          <div class="toolbar-mobile-handle" aria-hidden="true"></div>
          <header class="toolbar-mobile-header">
            <h3>Aktionen</h3>
            <button type="button" aria-label="Aktionen schließen" @click="actionsOpen = false">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </header>
          <div class="toolbar-mobile-action-list">
            <slot name="actions" />
          </div>
        </section>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faEllipsisVertical, faXmark } from '@fortawesome/free-solid-svg-icons';

library.add(faEllipsisVertical, faXmark);

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

.toolbar-mobile-actions-toggle {
  display: none;
}

@media (max-width: 768px) {
  .toolbar {
    gap: 8px;
    padding-right: 7px;
    overflow: visible;

    :deep(.toolbar-search) {
      min-width: 0;
      max-width: none;
    }

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

.toolbar-mobile-actions {
  display: contents;
}

.toolbar-mobile-sheet {
  display: contents;
}

.toolbar-mobile-handle {
  width: 36px;
  height: 4px;
  margin: 0 auto 12px;
  border-radius: 4px;
  background: var(--border);
}

.toolbar-mobile-header {
  display: none;

  h3 { margin: 0; font-size: 1rem; }

  button {
    display: inline-flex;
    width: 36px;
    height: 36px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
}

@media (max-width: 768px) {
  .toolbar-mobile-actions {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: none;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.45);

    &--open { display: flex; }
  }

  .toolbar-mobile-sheet {
    display: block;
    width: 100%;
    padding: 12px 20px calc(24px + env(safe-area-inset-bottom));
    border-radius: 20px 20px 0 0;
    background: var(--tile-bg);
    color: var(--text);
    animation: toolbar-sheet-in 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .toolbar-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 { margin: 0; font-size: 1rem; }

    button {
      display: inline-flex;
      width: 36px;
      height: 36px;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
  }

  .toolbar-mobile-action-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;

    :deep(.toolbar-group) {
      display: grid;
      gap: 8px;

      :deep(.toolbar-button),
      :deep(.toolbar-icon-button) {
        width: 100%;
        justify-content: flex-start;
      }
    }
  }
}

@keyframes toolbar-sheet-in {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
