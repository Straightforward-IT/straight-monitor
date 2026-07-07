<template>
  <div class="toolbar-filter">
    <!-- Collapsed toggle (always in flow, holds the left slot) -->
    <button
      class="tf-toggle"
      :class="{ 'tf-toggle--active': modelValue }"
      type="button"
      :title="modelValue ? 'Filter schließen' : 'Filter'"
      @click="toggle"
    >
      <span v-if="activeCount > 0" class="tf-count">{{ activeCount }}</span>
      <font-awesome-icon icon="fa-solid fa-filter" />
    </button>

    <!-- Desktop: expanded panel — overlays the whole toolbar -->
    <transition name="tf-expand">
      <div v-if="modelValue && !isMobile" class="tf-panel">
        <button
          class="tf-toggle tf-toggle--active"
          type="button"
          title="Filter schließen"
          @click="toggle"
        >
          <span v-if="activeCount > 0" class="tf-count">{{ activeCount }}</span>
          <font-awesome-icon icon="fa-solid fa-filter" />
        </button>
        <div class="tf-content">
          <div class="tf-scroll">
            <slot />
          </div>
        </div>
        <button
          class="tf-reset"
          type="button"
          title="Filter zurücksetzen"
          @click="emit('reset')"
        >
          <font-awesome-icon icon="fa-solid fa-rotate-left" />
        </button>
      </div>
    </transition>

    <!-- Mobile: bottom sheet teleported to body -->
    <teleport to="body">
      <transition name="tf-mobile-sheet">
        <div v-if="modelValue && isMobile" class="tf-mobile-backdrop" @click.self="toggle">
          <div class="tf-mobile-sheet">
            <div class="tf-mobile-handle"></div>
            <div class="tf-mobile-header">
              <h3>Filter</h3>
              <button class="tf-mobile-close" type="button" @click="toggle">
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
            <div class="tf-mobile-body">
              <slot />
              <button class="tf-mobile-reset" type="button" @click="emit('reset'); toggle()">
                <font-awesome-icon icon="fa-solid fa-rotate-left" />
                Zurücksetzen
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faFilter, faXmark, faRotateLeft } from '@fortawesome/free-solid-svg-icons';

library.add(faFilter, faXmark, faRotateLeft);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  activeCount: { type: Number, default: 0 },
});
const emit = defineEmits(['update:modelValue', 'reset']);

const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= 768);
function onResize() { isMobile.value = window.innerWidth <= 768; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

function toggle() {
  emit('update:modelValue', !props.modelValue);
}
</script>

<style scoped lang="scss">
// ── Outer wrapper — cancels toolbar's left+top+bottom padding for flush fit ──
// Margins must mirror Toolbar.vue's padding (7px 14px) so the toggle sits flush
// with the toolbar edges on every page.
.toolbar-filter {
  margin: -7px 0 -7px -14px;
  align-self: stretch;
  display: flex;
  flex-shrink: 0;
}

// ── Toggle button (collapsed state + close button in expanded state) ─────────
.tf-toggle {
  position: relative;
  width: 44px;
  align-self: stretch;
  flex-direction: column;
  gap: 1px;

  // No outer box — only a right separator
  border: none;
  border-right: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border));
  border-radius: 11px 0 0 11px; // match toolbar's left corners

  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 8%, transparent);
  }

  &--active {
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 10%, transparent);
  }
}

.tf-count {
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1;
  color: var(--primary);
  pointer-events: none;
}

// ── Expanded overlay ─────────────────────────────────────────────────────────
.tf-panel {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: stretch;
  border-radius: 12px;
  overflow: visible;
  background: color-mix(in oklab, var(--tile-bg) 94%, var(--primary));
  // Clip only visually via outline/border, not overflow, so dropdowns escape
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
    border: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border));
    pointer-events: none;
    z-index: 0;
  }
}

// ── Reset button (right side, symmetric to close button) ─────────────────────
.tf-reset {
  position: relative;
  width: 44px;
  align-self: stretch;
  flex-shrink: 0;
  border: none;
  border-left: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border));
  border-radius: 0 11px 11px 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 8%, transparent);
  }
}

// ── Filter content ───────────────────────────────────────────────────────────
.tf-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  overflow: visible;
  padding: 0 14px 0 12px;
}

.tf-scroll {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: visible;
  min-width: 0;
  flex: 1;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (max-width: 768px) {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  // Strip FilterGroup's own box (border, bg, padding) for inline toolbar display
  :deep(.filter-group) {
    border: none;
    background: transparent;
    box-shadow: none;
    padding: 0;
    gap: 6px;
    border-radius: 0;
    flex-wrap: nowrap;

    &:hover {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
  }

  :deep(.filter-group-label) {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    color: var(--muted);
  }

  // Compact chips to match toolbar item height
  :deep(.filter-chip) {
    padding: 3px 9px;
    font-size: 0.78rem;
    line-height: 1.4;
  }

  // Shorter divider
  :deep(.filter-divider) {
    height: 20px;
  }
}

// ── Expand transition ────────────────────────────────────────────────────────
.tf-expand-enter-active,
.tf-expand-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: left center;
}
.tf-expand-enter-from,
.tf-expand-leave-to {
  opacity: 0;
  transform: scaleX(0.96);
}
</style>

<!-- Unscoped: mobile sheet — needs to affect teleported content and slot children -->
<style lang="scss">
// ── Mobile bottom sheet ──────────────────────────────────────────────────────
.tf-mobile-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: stretch;
}

.tf-mobile-sheet {
  width: 100%;
  max-height: 88vh;
  background: var(--surface, #fff);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

.tf-mobile-handle {
  width: 36px;
  height: 4px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  margin: 8px auto 4px;
  flex-shrink: 0;
}

.tf-mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px 10px;
  border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #222);
    font-family: -apple-system, BlinkMacSystemFont, "San Francisco", Helvetica, Arial, sans-serif;
  }
}

.tf-mobile-close {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  color: var(--muted, #888);
  font-size: 1rem;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active { background: rgba(0, 0, 0, 0.05); }
}

.tf-mobile-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  // Compact filter groups in vertical layout
  .filter-group {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 4px 0 !important;
    border-radius: 0 !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }

  // Horizontal divider instead of vertical bar
  .filter-divider {
    display: block !important;
    width: 100% !important;
    height: 1px !important;
    background: var(--border, rgba(0, 0, 0, 0.1)) !important;
    margin: 2px 0 !important;
    align-self: auto !important;
  }

  .filter-group-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted, #888);
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
}

.tf-mobile-reset {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-top: 4px;
  width: 100%;
  justify-content: center;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
  border-radius: 10px;
  background: transparent;
  color: var(--muted, #666);
  font-size: 0.88rem;
  font-family: -apple-system, BlinkMacSystemFont, "San Francisco", Helvetica, Arial, sans-serif;
  cursor: pointer;

  &:active { background: var(--hover, #f7f7f7); }
}

// ── Slide-up animation ───────────────────────────────────────────────────────
.tf-mobile-sheet-enter-active {
  transition: opacity 0.2s ease;
  .tf-mobile-sheet { transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
}
.tf-mobile-sheet-leave-active {
  transition: opacity 0.18s ease;
  .tf-mobile-sheet { transition: transform 0.2s ease; }
}
.tf-mobile-sheet-enter-from,
.tf-mobile-sheet-leave-to {
  opacity: 0;
  .tf-mobile-sheet { transform: translateY(100%); }
}
</style>
