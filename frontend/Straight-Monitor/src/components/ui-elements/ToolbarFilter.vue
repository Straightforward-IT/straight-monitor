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

    <!-- Expanded panel — overlays the whole toolbar -->
    <transition name="tf-expand">
      <div v-if="modelValue" class="tf-panel">
        <button
          class="tf-toggle tf-toggle--active"
          type="button"
          title="Filter schließen"
          @click="toggle"
        >
          <span v-if="activeCount > 0" class="tf-count">{{ activeCount }}</span>
          <font-awesome-icon icon="fa-solid fa-xmark" />
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
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faFilter, faXmark, faRotateLeft } from '@fortawesome/free-solid-svg-icons';

library.add(faFilter, faXmark, faRotateLeft);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  activeCount: { type: Number, default: 0 },
});
const emit = defineEmits(['update:modelValue', 'reset']);

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
  overflow-x: clip;
  overflow-y: visible;
  min-width: 0;
  flex: 1;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

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
