<template>
  <button 
    class="filter-chip" 
    :class="{ 'active': active }"
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
</style>
