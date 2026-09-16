<template>
  <Teleport to="body">
    <div v-if="visible" class="search-dropdown" :style="style">
      <button
        v-for="auftrag in results"
        :key="auftrag._id"
        class="sdrop-item"
        @mousedown.prevent="$emit('select', auftrag)"
      >
        <span v-if="auftrag.kundeData?.kuerzel" class="sdrop-kuerzel">
          {{ auftrag.kundeData.kuerzel }}
        </span>
        <span class="sdrop-title">{{ auftrag.eventTitel || "(kein Titel)" }}</span>
        <span class="sdrop-date">{{ formatDate(auftrag.vonDatum) }}</span>
      </button>
      <div v-if="loading && !results.length" class="sdrop-empty">Suche…</div>
      <div v-else-if="!results.length" class="sdrop-empty">Keine Ergebnisse</div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: "AuftragCalendarSearchDropdown",
  props: {
    visible: { type: Boolean, default: false },
    style: { type: Object, default: () => ({}) },
    results: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    formatDate: { type: Function, required: true },
  },
  emits: ["select"],
};
</script>

<style scoped lang="scss">
.search-dropdown {
  min-width: 240px;
  overflow: hidden;
  border: 1px solid color-mix(in oklab, var(--primary) 25%, var(--border));
  border-radius: 10px;
  background: var(--tile-bg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
}

.sdrop-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 0;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 60%, transparent);
  background: transparent;
  cursor: pointer;
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "San Francisco", Helvetica, Arial, sans-serif;
  font-weight: 300;
  text-align: left;
  transition: background 0.12s;

  &:last-child { border-bottom: 0; }
  &:hover { background: color-mix(in oklab, var(--primary) 8%, transparent); }
}

.sdrop-kuerzel {
  flex-shrink: 0;
  padding: 1px 5px;
  border: 1px solid color-mix(in oklab, var(--primary) 30%, transparent);
  border-radius: 4px;
  background: color-mix(in oklab, var(--primary) 12%, transparent);
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.sdrop-title { flex: 1; font-size: 0.85rem; font-weight: 500; }
.sdrop-date { flex-shrink: 0; color: var(--muted); font-size: 0.75rem; white-space: nowrap; }
.sdrop-empty { padding: 12px 14px; color: var(--muted); font-size: 0.85rem; text-align: center; }
</style>
