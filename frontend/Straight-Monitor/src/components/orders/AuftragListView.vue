<template>
  <section
    class="order-list-view"
    aria-label="Aufträge als Liste"
  >
    <Toolbar class="order-list-toolbar">
      <ToolbarFilter
        :model-value="filterExpanded"
        :active-count="activeFilterCount"
        @update:model-value="$emit('update:filterExpanded', $event)"
        @reset="$emit('resetFilters')"
      >
        <FilterGroup label="Standort">
          <LocationFilter
            :model-value="locationV2"
            :locations="locations"
            @update:model-value="$emit('update:locationV2', $event)"
          />
        </FilterGroup>
        <FilterDivider />
        <FilterGroup label="Einsätze">
          <FilterChip
            :active="bedarfStatus.includes('voll')"
            @click="$emit('toggleBedarfStatus', 'voll')"
          >
            Voll
          </FilterChip>
          <FilterChip
            :active="bedarfStatus.includes('offen')"
            @click="$emit('toggleBedarfStatus', 'offen')"
          >
            Offen
          </FilterChip>
          <FilterChip
            :active="pseudoEinsatz"
            @click="$emit('togglePseudoEinsatz')"
          >
            Pseudo
          </FilterChip>
        </FilterGroup>
        <FilterDivider />
        <FilterGroup label="Kunden">
          <PillMultiSelect
            :model-value="kunden"
            :options="kundenOptions"
            value-key="kundenNr"
            label-key="kundName"
            meta-key="kuerzel"
            placeholder="Kunden suchen…"
            @change="$emit('update:kunden', $event)"
          />
        </FilterGroup>
      </ToolbarFilter>
      <SearchBar
        class="toolbar-search"
        :model-value="searchQuery"
        placeholder="Auftrag, Kunde, Ort oder Mitarbeiter suchen…"
        aria-label="Aufträge durchsuchen"
        @update:model-value="$emit('update:searchQuery', $event)"
      />
      <span class="order-count">{{ sortedOrders.length }} Aufträge</span>
      <template #bottom-actions>
        <div
          class="toolbar-period-controls"
          role="group"
          aria-label="Aktuellen Zeitraum auswählen"
        >
          <button
            v-for="option in CURRENT_PERIOD_OPTIONS"
            :key="option.value"
            type="button"
            class="toolbar-period-controls__button"
            :class="{ 'is-active': period === option.value }"
            :aria-pressed="period === option.value"
            @click="$emit('update:period', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <CalendarControls v-model="referenceDateModel" :type="period" />
      </template>
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
        <button
          v-for="column in sortColumns"
          :key="column.key"
          type="button"
          class="sort-header"
          role="columnheader"
          :aria-sort="ariaSort(column.key)"
          @click="toggleSort(column.key)"
        >
          <span>{{ column.label }}</span>
          <span
            class="sort-indicator"
            :class="{ 'is-active': sortKey === column.key }"
            aria-hidden="true"
          >{{ sortKey === column.key && sortDirection === "desc" ? "▼" : "▲" }}</span>
        </button>
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
import { computed, ref } from "vue";
import CalendarControls from "@/components/ui-elements/CalendarControls.vue";
import FilterGroup from "@/components/FilterGroup.vue";
import SearchBar from "@/components/SearchBar.vue";
import FilterChip from "@/components/ui-elements/FilterChip.vue";
import FilterDivider from "@/components/ui-elements/FilterDivider.vue";
import LocationFilter from "@/components/ui-elements/LocationFilter.vue";
import PillMultiSelect from "@/components/ui-elements/PillMultiSelect.vue";
import Toolbar from "@/components/ui-elements/Toolbar.vue";
import ToolbarFilter from "@/components/ui-elements/ToolbarFilter.vue";
import {
  CURRENT_PERIOD_OPTIONS,
  getPeriodRange,
  orderOverlapsRange,
} from "@/utils/orderListPeriods";

const props = defineProps({
  orders: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  locations: { type: Array, default: () => [] },
  locationV2: { type: [String, Number], default: null },
  searchQuery: { type: String, default: "" },
  selectedOrderNumber: { type: [String, Number], default: null },
  filterExpanded: { type: Boolean, default: false },
  activeFilterCount: { type: Number, default: 0 },
  kunden: { type: Array, default: () => [] },
  kundenOptions: { type: Array, default: () => [] },
  bedarfStatus: { type: Array, default: () => [] },
  pseudoEinsatz: { type: Boolean, default: false },
  period: {
    type: String,
    default: "month",
    validator: (value) => CURRENT_PERIOD_OPTIONS.some((option) => option.value === value),
  },
  referenceDate: { type: Date, default: () => new Date() },
  statusClass: { type: Function, required: true },
  statusText: { type: Function, required: true },
});

const emit = defineEmits([
  "select",
  "update:locationV2",
  "update:searchQuery",
  "update:filterExpanded",
  "update:kunden",
  "update:period",
  "update:referenceDate",
  "toggleBedarfStatus",
  "togglePseudoEinsatz",
  "resetFilters",
]);

const sortColumns = [
  { key: "date", label: "Zeitraum" },
  { key: "order", label: "Auftrag" },
  { key: "customer", label: "Kunde" },
  { key: "location", label: "Ort" },
  { key: "status", label: "Status" },
  { key: "staffing", label: "Besetzung" },
];
const sortKey = ref("date");
const sortDirection = ref("asc");
const referenceDateModel = computed({
  get: () => props.referenceDate,
  set: (value) => emit("update:referenceDate", value),
});
const periodOrders = computed(() => {
  const range = getPeriodRange(props.period, props.referenceDate);
  return props.orders.filter((order) => orderOverlapsRange(order, range));
});

const sortedOrders = computed(() => [...periodOrders.value].sort((left, right) => {
  const comparison = compareValues(sortValue(left, sortKey.value), sortValue(right, sortKey.value));
  if (comparison !== 0) return sortDirection.value === "asc" ? comparison : -comparison;

  const dateComparison = compareValues(sortValue(left, "date"), sortValue(right, "date"));
  return dateComparison || compareValues(Number(left.auftragNr || 0), Number(right.auftragNr || 0));
}));

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = "asc";
}

function ariaSort(key) {
  if (sortKey.value !== key) return "none";
  return sortDirection.value === "asc" ? "ascending" : "descending";
}

function sortValue(order, key) {
  if (key === "date") return new Date(order.vonDatum || 0).getTime();
  if (key === "order") return Number(order.auftragNr || 0);
  if (key === "customer") return order.kundeData?.kundName || order.kundenName || "";
  if (key === "location") return order.eventOrt || order.eventLocation || "";
  if (key === "status") return Number(order.auftStatus || 0);
  if (key === "staffing") return staffingSummary(order).assigned;
  return "";
}

function compareValues(left, right) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "de", { numeric: true, sensitivity: "base" });
}

function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function hasDateRange(order) {
  if (!order.vonDatum || !order.bisDatum) return false;
  return new Date(order.vonDatum).toDateString() !== new Date(order.bisDatum).toDateString();
}

function staffingSummary(order) {
  if (Array.isArray(order.schichten) && order.schichten.length) {
    const assigned = order.schichten.reduce((sum, shift) => sum + (Number(shift.besetzt) || 0), 0);
    const required = order.schichten.reduce((sum, shift) => sum + (Number(shift.bedarf) || 0), 0);
    return { assigned, required };
  }

  return {
    assigned: typeof order.einsaetzeCount === "number" ? order.einsaetzeCount : null,
    required: null,
  };
}

function staffingText(order) {
  const staffing = staffingSummary(order);
  if (staffing.assigned == null) return "–";
  return `${staffing.assigned} / ${staffing.required ?? "–"}`;
}
</script>

<style scoped lang="scss">
.order-list-view { display: flex; min-width: 0; min-height: 0; flex-direction: column; }
.order-list-toolbar { margin-bottom: 29px; overflow: visible; }
.order-count { flex: 0 0 auto; color: var(--muted); font-size: 0.78rem; white-space: nowrap; }
.toolbar-period-controls {
  position: absolute;
  z-index: 5;
  top: 100%;
  left: 12px;
  display: flex;
  height: 24px;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.toolbar-period-controls__button {
  height: 24px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 0 0 5px 5px;
  background: var(--tile-bg);
  color: var(--text);
  font: inherit;
  font-size: .72rem;
  cursor: pointer;
}
.toolbar-period-controls__button:hover,
.toolbar-period-controls__button:focus-visible,
.toolbar-period-controls__button.is-active {
  border-color: var(--primary);
  color: var(--primary);
  outline: none;
}
.toolbar-period-controls__button.is-active {
  background: color-mix(in srgb, var(--primary) 8%, var(--tile-bg));
  font-weight: 700;
}
.order-list-table {
  max-height: calc(100dvh - var(--header-h, 56px) - 190px);
  min-height: 160px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--tile-bg);
}
.order-list-head,
.order-list-row {
  display: grid;
  grid-template-columns: minmax(130px, .8fr) minmax(190px, 1.4fr) minmax(160px, 1.2fr) minmax(130px, 1fr) minmax(105px, .7fr) minmax(85px, .55fr);
  align-items: center;
  gap: 14px;
  padding: 11px 14px;
}
.order-list-head { position: sticky; z-index: 2; top: 0; border-bottom: 1px solid var(--border); background: var(--hover); color: var(--muted); font-size: 0.7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.sort-header { display: inline-flex; min-width: 0; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-align: left; text-transform: inherit; cursor: pointer; }
.sort-header:hover,
.sort-header:focus-visible { color: var(--primary); outline: none; }
.sort-indicator { opacity: 0; font-size: .55rem; transition: opacity .15s; }
.sort-header:hover .sort-indicator,
.sort-header:focus-visible .sort-indicator,
.sort-indicator.is-active { opacity: 1; }
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

@media (max-width: 768px) {
  .order-count { display: none; }
  .toolbar-period-controls { left: 6px; gap: 3px; }
}

@media (max-width: 420px) {
  .order-list-toolbar { margin-bottom: 53px; }
  :deep(.calendar-controls) { top: calc(100% + 24px); }
}
</style>
