<template>
  <section
    class="order-list-view"
    aria-label="Aufträge als Liste"
  >
    <Toolbar
      :show-location-filter="true"
      :locations="locations"
      :location-v2="locationV2"
      @update:location-v2="$emit('update:locationV2', $event)"
    >
      <SearchBar
        class="toolbar-search"
        :model-value="searchQuery"
        placeholder="Auftrag, Kunde, Ort oder Mitarbeiter suchen…"
        aria-label="Aufträge durchsuchen"
        @update:model-value="$emit('update:searchQuery', $event)"
      />
      <span class="order-count">{{ sortedOrders.length }} Aufträge</span>
    </Toolbar>

    <div
      class="order-list-table"
      role="table"
      aria-label="Auftragsliste"
    >
      <div
        class="order-list-head"
        role="row"
      >
        <span role="columnheader">Zeitraum</span>
        <span role="columnheader">Auftrag</span>
        <span role="columnheader">Kunde</span>
        <span role="columnheader">Ort</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Besetzung</span>
      </div>

      <div
        v-if="loading"
        class="list-state"
        role="status"
      >
        Lade Aufträge…
      </div>
      <div
        v-else-if="!sortedOrders.length"
        class="list-state"
      >
        Keine Aufträge für die aktuelle Auswahl gefunden.
      </div>
      <button
        v-for="order in sortedOrders"
        v-else
        :key="order._id || order.auftragNr"
        type="button"
        class="order-list-row"
        :class="{ 'is-selected': String(order.auftragNr) === String(selectedOrderNumber) }"
        role="row"
        @click="$emit('select', order)"
      >
        <span
          class="date-cell"
          role="cell"
        >
          <strong>{{ formatDate(order.vonDatum) }}</strong>
          <small v-if="hasDateRange(order)">bis {{ formatDate(order.bisDatum) }}</small>
        </span>
        <span
          class="order-cell"
          role="cell"
        >
          <strong>{{ order.eventTitel || "Ohne Titel" }}</strong>
          <small>#{{ order.auftragNr }}</small>
        </span>
        <span role="cell">{{ order.kundeData?.kundName || order.kundenName || "–" }}</span>
        <span role="cell">{{ order.eventOrt || order.eventLocation || "–" }}</span>
        <span role="cell">
          <span
            class="status-pill"
            :class="statusClass(order)"
          >
            {{ statusText(order.auftStatus) }}
          </span>
        </span>
        <span role="cell">{{ staffingText(order) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";
import SearchBar from "@/components/SearchBar.vue";
import Toolbar from "@/components/ui-elements/Toolbar.vue";

const props = defineProps({
  orders: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  locations: { type: Array, default: () => [] },
  locationV2: { type: [String, Number], default: null },
  searchQuery: { type: String, default: "" },
  selectedOrderNumber: { type: [String, Number], default: null },
  statusClass: { type: Function, required: true },
  statusText: { type: Function, required: true },
});

defineEmits(["select", "update:locationV2", "update:searchQuery"]);

const sortedOrders = computed(() => [...props.orders].sort((left, right) => {
  const leftDate = new Date(left.vonDatum || 0).getTime();
  const rightDate = new Date(right.vonDatum || 0).getTime();
  return leftDate - rightDate || Number(left.auftragNr || 0) - Number(right.auftragNr || 0);
}));

function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function hasDateRange(order) {
  if (!order.vonDatum || !order.bisDatum) return false;
  return new Date(order.vonDatum).toDateString() !== new Date(order.bisDatum).toDateString();
}

function staffingText(order) {
  const assigned = Array.isArray(order.einsaetze) ? order.einsaetze.length : null;
  const required = Array.isArray(order.schichten)
    ? order.schichten.reduce((sum, shift) => sum + (Number(shift.bedarf) || 0), 0)
    : null;
  if (assigned == null && required == null) return "–";
  return required ? `${assigned || 0} / ${required}` : String(assigned || 0);
}
</script>

<style scoped lang="scss">
.order-list-view { min-width: 0; }
.order-count { flex: 0 0 auto; color: var(--muted); font-size: 0.78rem; white-space: nowrap; }
.order-list-table { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--tile-bg); }
.order-list-head,
.order-list-row {
  display: grid;
  grid-template-columns: minmax(130px, .8fr) minmax(190px, 1.4fr) minmax(160px, 1.2fr) minmax(130px, 1fr) minmax(105px, .7fr) minmax(85px, .55fr);
  align-items: center;
  gap: 14px;
  padding: 11px 14px;
}
.order-list-head { border-bottom: 1px solid var(--border); background: var(--hover); color: var(--muted); font-size: 0.7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.order-list-row { width: 100%; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: background .15s; }
.order-list-row:last-child { border-bottom: 0; }
.order-list-row:hover,
.order-list-row:focus-visible { background: color-mix(in srgb, var(--primary) 7%, transparent); outline: none; }
.order-list-row.is-selected { background: color-mix(in srgb, var(--primary) 12%, transparent); box-shadow: inset 3px 0 var(--primary); }
.order-list-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.date-cell,
.order-cell { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.date-cell small,
.order-cell small { color: var(--muted); font-size: .72rem; }
.order-cell strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-pill { display: inline-flex; padding: 3px 8px; border-radius: 999px; background: var(--hover); color: var(--muted); font-size: .72rem; font-weight: 700; }
.status-pill.status-draft { background: color-mix(in srgb, #f59e0b 16%, transparent); color: #b45309; }
.status-pill.status-confirmed { background: color-mix(in srgb, #10b981 16%, transparent); color: #047857; }
.status-pill.status-completed { background: color-mix(in srgb, #3b82f6 16%, transparent); color: #1d4ed8; }
.list-state { padding: 48px 20px; color: var(--muted); text-align: center; }

@media (max-width: 900px) {
  .order-list-head { display: none; }
  .order-list-row { grid-template-columns: 1fr auto; gap: 8px 16px; padding: 14px; }
  .order-list-row > span { grid-column: 1; }
  .order-list-row > span:nth-child(5),
  .order-list-row > span:nth-child(6) { grid-column: 2; grid-row: 1; justify-self: end; }
  .order-list-row > span:nth-child(6) { grid-row: 2; color: var(--muted); font-size: .78rem; }
}
</style>
