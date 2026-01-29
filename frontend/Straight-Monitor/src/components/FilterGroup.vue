<template>
  <div class="filter-group">
    <span v-if="label" class="filter-group-label">{{ label }}</span>
    <slot></slot>
  </div>
</template>

<script>
export default {
  name: "FilterGroup",
  props: {
    label: {
      type: String,
      default: ""
    }
  }
};
</script>

<style scoped>
.filter-group {
  --brand: var(--primary);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface); /* Ensure parent defines --surface or use fallback */
  background: var(--panel, #fff); /* Fallback */
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  transition: all 200ms ease;
  position: relative;
}

.filter-group:hover {
  background: color-mix(in srgb, var(--brand) 5%, var(--panel, #fff));
  border-color: color-mix(in srgb, var(--brand) 30%, var(--border));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 10%, transparent);
}

.filter-group::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--brand);
  border-radius: 2px 0 0 2px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.filter-group:hover::before {
  opacity: 0.6;
}

.filter-group-label {
  color: var(--brand);
  font-weight: 700;
  margin-right: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 0;
  white-space: nowrap;
}
</style>
