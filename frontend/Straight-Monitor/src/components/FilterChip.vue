<template>
  <button 
    class="filter-chip" 
    :class="{ 'active': active, 'hide-mode': hideMode, 'hidden': hideMode && !active }"
    type="button"
  >
    <slot></slot>
  </button>
</template>

<script>
export default {
  name: "FilterChip",
  props: {
    active: {
      type: Boolean,
      default: false
    },
    // When true, an inactive chip means "hidden" → show strikethrough + grayed out.
    // Active chips keep the standard orange highlight.
    hideMode: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style scoped>
.filter-chip {
  --brand: var(--primary);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 12px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  line-height: inherit;
}

.filter-chip:hover {
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
}

.filter-chip.active {
  background: transparent;
  border-color: var(--brand);
  color: var(--brand);
  box-shadow: inset 0 0 0 1px var(--brand);
  font-weight: 600;
}

/* hide-mode: chips default to active (orange). Inactive means content is hidden. */
.filter-chip.hide-mode.hidden {
  background: transparent;
  border-color: var(--border);
  color: var(--text-muted, #888);
  box-shadow: none;
  text-decoration: line-through;
  opacity: 0.55;
  font-weight: 500;
}

.filter-chip.hide-mode.hidden:hover {
  opacity: 0.8;
  border-color: var(--brand);
  background: transparent;
}

@media (max-width: 768px) {
  .filter-chip {
    padding: 4px 9px;
    font-size: 12px;
    border-radius: 5px;
  }
}
</style>
