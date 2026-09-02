<template>
  <section class="inventory-page inventory-overview-tab">

    <Toolbar wrap>
      <ToolbarFilter v-model="filterOpen" :active-count="activeFilterCount" @reset="resetFilters">
        <FilterGroup label="Standort">
          <FilterChip
            v-for="location in locations"
            :key="location._id"
            :active="selectedLocationIds.includes(String(location._id))"
            :style="{ '--location-color': location.color || '#6b7280' }"
            @click="toggleLocationFilter(String(location._id))"
          >
            {{ location.nameFull }}
          </FilterChip>
        </FilterGroup>
        <FilterGroup label="Bestand">
          <FilterChip :active="stockState === 'under-target'" @click="stockState = stockState === 'under-target' ? 'all' : 'under-target'">Unter Soll</FilterChip>
          <FilterChip :active="stockState === 'empty'" @click="stockState = stockState === 'empty' ? 'all' : 'empty'">Leer</FilterChip>
        </FilterGroup>
        <FilterGroup label="Merkmale">
          <FilterChip :active="variationOnly" @click="variationOnly = !variationOnly">Mit Variation</FilterChip>
          <FilterChip :active="sizeOnly" @click="sizeOnly = !sizeOnly">Mit Größe</FilterChip>
        </FilterGroup>
      </ToolbarFilter>

      <SearchBar v-model="search" class="toolbar-search" placeholder="Bezeichnung, Variante, Größe oder Standort" />

      <ToolbarLabel>{{ filteredStocks.length }} Kombinationen</ToolbarLabel>

      <template #actions>
      <ToolbarGroup push-right>
        <ToolbarButton variant="secondary" title="Bestandsaktionen" @click="openActionMenu">
          <font-awesome-icon :icon="['fas', 'ellipsis']" />
          Aktionen
        </ToolbarButton>
        <ToolbarButton variant="secondary" title="Bestand aktualisieren" @click="refreshStocks">
          <font-awesome-icon :icon="['fas', loading ? 'spinner' : 'rotate']" :spin="loading" />
          Aktualisieren
        </ToolbarButton>
        <ToolbarButton @click="openItemCreate">
          <font-awesome-icon :icon="['fas', 'plus']" />
          Artikel anlegen
        </ToolbarButton>
      </ToolbarGroup>
      </template>
    </Toolbar>

    <p v-if="error" class="state state--error">{{ error }}</p>
    <p v-else-if="loading && !stocks.length" class="state">Bestand wird geladen…</p>
    <p v-else-if="!filteredStocks.length" class="state">Keine Bestandskombinationen gefunden.</p>

    <div v-else class="inventory-list">
      <article v-for="item in groupedItems" :key="item.id" class="item-card">
        <header class="item-card__header" @click="toggleItemDetails(item)">
          <div class="item-card__summary">
            <button type="button" class="item-card__details-trigger" :aria-expanded="isItemExpanded(item.id)" @click.stop="toggleItemDetails(item)">
              <span class="item-card__title-row">
                <FavoriteStarButton
                  :active="isItemHighlighted(item)"
                  active-title="Favorit entfernen"
                  inactive-title="Als Favorit markieren"
                  @toggle="toggleItemHighlight(item)"
                />
                <h3>{{ item.bezeichnung }}</h3>
              </span>
              <span class="item-card__meta">{{ item.locations.length }} {{ item.locations.length === 1 ? 'Standort' : 'Standorte' }} · {{ item.stocks.length }} Kombinationen</span>
            </button>
            <a v-if="item.shopUrl" :href="item.shopUrl" target="_blank" rel="noopener noreferrer" class="shop-link" @click.stop>
              <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" /> Shop
            </a>
          </div>
          <div class="item-card__actions">
            <span class="item-card__totals" aria-label="Bestand nach Standort">
              <span
                v-for="location in item.locationTotals"
                :key="location.id"
                class="item-card__total"
                :style="{ '--location-color': location.color }"
                :title="`${location.name}: ${location.anzahl}`"
              >{{ location.shortName || location.name }} {{ location.anzahl }}</span>
            </span>
            <button type="button" class="item-card__edit" title="Artikel bearbeiten" @click.stop="openItemEdit(item)">
              <font-awesome-icon :icon="['fas', 'pen']" />
            </button>
            <button v-if="isAdmin" type="button" class="item-card__edit item-card__delete" title="Artikel löschen" @click.stop="deleteItem(item)">
              <font-awesome-icon :icon="['fas', 'trash']" />
            </button>
            <button type="button" class="item-card__edit" :title="isItemExpanded(item.id) ? 'Details schließen' : 'Details anzeigen'" @click.stop="toggleItemDetails(item)">
              <font-awesome-icon :icon="['fas', isItemExpanded(item.id) ? 'chevron-up' : 'chevron-down']" />
            </button>
          </div>
        </header>

        <div v-if="isItemExpanded(item.id)" class="item-card__details">
          <div v-if="item.locations.length > 1" class="location-tabs" role="tablist" aria-label="Standort auswählen">
            <button
              v-for="location in item.locations"
              :key="location.id"
              type="button"
              :class="{ active: selectedItemLocation(item) === location.id }"
              @click="selectItemLocation(item.id, location.id)"
            >
              {{ location.shortName || location.name }}
            </button>
          </div>

          <section v-for="location in visibleItemLocations(item)" :key="location.id" class="stock-matrix-section">
            <div class="stock-matrix-section__header">
              <h4>{{ location.name }}</h4>
              <span>{{ location.shortName }}</span>
            </div>
            <div class="stock-matrix-scroll">
              <table class="stock-matrix">
                <thead>
                  <tr>
                    <th scope="col">Variation</th>
                    <th v-for="size in item.sizes" :key="size.key" scope="col">{{ size.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="variation in item.variations" :key="variation.key">
                    <th scope="row">{{ variation.label }}</th>
                    <td v-for="size in item.sizes" :key="size.key">
                      <button
                        v-if="matrixStock(item, location.id, variation.key, size.key)"
                        type="button"
                        class="matrix-cell"
                        :class="matrixCellState(matrixStock(item, location.id, variation.key, size.key))"
                        @click="selectedStock = matrixStock(item, location.id, variation.key, size.key)"
                      >
                        <b>{{ matrixStock(item, location.id, variation.key, size.key).anzahl }}</b>
                        <small>/ {{ matrixStock(item, location.id, variation.key, size.key).soll }}</small>
                      </button>
                      <span v-else class="matrix-cell--empty">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-if="isAdmin && item.createdAt" class="item-creation-info">
            <span>Erstellt am {{ formatCreationDate(item.createdAt) }}</span>
            <span>von {{ item.createdBy?.name || item.createdBy?.email || 'Unbekannt' }}</span>
          </section>
        </div>
      </article>
    </div>

    <InventoryItemModal v-model="showCreateDialog" :item="editingItem" @created="handleCreated" @updated="handleItemUpdated" />
    <InventoryTransactionModal v-if="selectedStock" v-model="selectedStock" @updated="handleStockUpdated" />
    <InventoryReportModal
      v-if="reportMode"
      :mode="reportMode"
      :stocks="stocks"
      :locations="locationRecords"
      :initial-location-ids="selectedLocationIds"
      @close="reportMode = null"
    />
    <ContextMenu v-if="actionMenu.visible" :x="actionMenu.x" :y="actionMenu.y" :options="actionMenuOptions" @close="actionMenu.visible = false" @select="handleActionMenu" />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowUpRightFromSquare, faChevronDown, faChevronUp, faEllipsis, faPen, faPlus, faRotate, faSpinner, faTrash, faWarehouse } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import { useDataCache } from '@/stores/dataCache';
import { useAuth } from '@/stores/auth';
import { useInventoryFilters } from '@/stores/inventoryFilters';
import api from '@/utils/api';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import ToolbarLabel from '@/components/ui-elements/ToolbarLabel.vue';
import SearchBar from '@/components/ui-elements/SearchBar.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import InventoryItemModal from '@/components/InventoryItemModal.vue';
import InventoryTransactionModal from '@/components/InventoryTransactionModal.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import InventoryReportModal from '@/components/InventoryReportModal.vue';
import FavoriteStarButton from '@/components/ui-elements/FavoriteStarButton.vue';

library.add(faArrowUpRightFromSquare, faChevronDown, faChevronUp, faEllipsis, faPen, faPlus, faRotate, faSpinner, faTrash, faWarehouse);

const dataCache = useDataCache();
const auth = useAuth();
const inventoryFilters = useInventoryFilters();
const { locationIds: selectedLocationIds } = storeToRefs(inventoryFilters);
const stocks = computed(() => dataCache.items);
const search = ref('');
const filterOpen = ref(false);
const locationRecords = ref([]);
const stockState = ref('all');
const variationOnly = ref(false);
const sizeOnly = ref(false);
const loading = ref(false);
const error = ref('');
const selectedStock = ref(null);
const showCreateDialog = ref(false);
const editingItem = ref(null);
const expandedItemIds = ref([]);
const selectedItemLocationIds = ref({});
const reportMode = ref(null);
const actionMenu = ref({ visible: false, x: 0, y: 0 });
const actionMenuOptions = [
  { label: 'Bestandsupdate senden', action: 'email' },
  { label: 'Excel-Liste herunterladen', action: 'excel' },
];
const isAdmin = computed(() => auth.user?.role === 'ADMIN' || auth.user?.roles?.includes('ADMIN'));
const locations = computed(() => {
  const usedLocationIds = new Set(stocks.value.map((stock) => String(stock.locationId)).filter(Boolean));
  return locationRecords.value
    .filter((location) => usedLocationIds.has(String(location._id)))
    .sort((left, right) => left.nameFull.localeCompare(right.nameFull, 'de'));
});
const activeFilterCount = computed(() => selectedLocationIds.value.length + (stockState.value !== 'all' ? 1 : 0) + Number(variationOnly.value) + Number(sizeOnly.value));

const filteredStocks = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('de');
  return stocks.value.filter((stock) => {
    if (selectedLocationIds.value.length && !selectedLocationIds.value.includes(String(stock.locationId))) return false;
    if (stockState.value === 'under-target' && !(stock.anzahl < stock.soll)) return false;
    if (stockState.value === 'empty' && stock.anzahl !== 0) return false;
    if (variationOnly.value && !stock.variationKey) return false;
    if (sizeOnly.value && (!stock.groesseKey || stock.groesseKey === 'onesize')) return false;
    if (!needle) return true;
    return [stock.bezeichnung, stock.standort, stock.standortKurz, stock.variation, stock.groesse]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('de').includes(needle));
  });
});

const groupedItems = computed(() => {
  const groups = new Map();
  for (const stock of filteredStocks.value) {
    const key = String(stock.itemId || stock._id);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        bezeichnung: stock.bezeichnung,
        shopUrl: stock.shopUrl,
        createdAt: stock.itemCreatedAt,
        createdBy: stock.itemCreatedBy,
        stocks: [],
        locations: new Map(),
        variations: new Map(),
        sizes: new Map(),
      });
    }
    const group = groups.get(key);
    group.stocks.push(stock);
    group.locations.set(String(stock.locationId), {
      id: String(stock.locationId),
      name: stock.standort || 'Ohne Standort',
      shortName: stock.standortKurz || '',
      color: stock.standortColor || '#6b7280',
    });
    group.variations.set(stock.variationKey || '__standard', {
      key: stock.variationKey || '__standard',
      label: stock.variation || 'Standard',
      order: stock.variationOrder,
    });
    group.sizes.set(stock.groesseKey || 'onesize', {
      key: stock.groesseKey || 'onesize',
      label: stock.groesse || 'onesize',
      order: stock.groesseOrder,
    });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    locations: [...group.locations.values()].sort((left, right) => left.name.localeCompare(right.name, 'de')),
    locationTotals: [...group.locations.values()]
      .map((location) => ({
        ...location,
        anzahl: group.stocks
          .filter((stock) => String(stock.locationId) === location.id)
          .reduce((total, stock) => total + Number(stock.anzahl || 0), 0),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'de')),
    variations: [...group.variations.values()].sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, 'de')),
    sizes: [...group.sizes.values()].sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, 'de')),
  })).sort((left, right) => {
    if (isItemHighlighted(left) !== isItemHighlighted(right)) return isItemHighlighted(left) ? -1 : 1;
    return left.bezeichnung.localeCompare(right.bezeichnung, 'de');
  });
});

function isItemHighlighted(item) {
  return auth.highlightedInventoryItems.some((id) => id.toString() === String(item.id));
}

async function toggleItemHighlight(item) {
  try {
    await auth.toggleHighlightedInventoryItem(item.id);
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Favorit konnte nicht aktualisiert werden.';
  }
}

function toggleLocationFilter(locationId) {
  inventoryFilters.toggleLocation(locationId);
}

function resetFilters() {
  inventoryFilters.clearLocations();
  stockState.value = 'all';
  variationOnly.value = false;
  sizeOnly.value = false;
}

function openActionMenu(event) {
  actionMenu.value = { visible: true, x: event.clientX - 150, y: event.clientY + 8 };
}

function handleActionMenu(action) {
  reportMode.value = action;
}

async function refreshStocks() {
  loading.value = true;
  error.value = '';
  try {
    const [, locationsResponse] = await Promise.all([
      dataCache.loadItems(true),
      api.get('/api/locations'),
    ]);
    locationRecords.value = locationsResponse.data;
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Der Bestand konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

async function handleCreated() {
  await refreshStocks();
}

function openItemCreate() {
  editingItem.value = null;
  showCreateDialog.value = true;
}

function openItemEdit(item) {
  editingItem.value = {
    ...item,
    variations: item.variations.filter((variation) => variation.key !== '__standard'),
    sizes: item.sizes,
    stocks: stocks.value.filter((stock) => String(stock.itemId || stock._id) === item.id),
  };
  showCreateDialog.value = true;
}

async function deleteItem(item) {
  if (!window.confirm(`Artikel „${item.bezeichnung}“ wirklich löschen?`)) return;
  error.value = '';
  try {
    await api.delete(`/api/inventory/items/${item.id}`);
    expandedItemIds.value = expandedItemIds.value.filter((itemId) => itemId !== item.id);
    await refreshStocks();
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Artikel konnte nicht gelöscht werden.';
  }
}

function isItemExpanded(itemId) {
  return expandedItemIds.value.includes(itemId);
}

function toggleItemDetails(item) {
  if (isItemExpanded(item.id)) {
    expandedItemIds.value = expandedItemIds.value.filter((itemId) => itemId !== item.id);
    return;
  }
  expandedItemIds.value = [...expandedItemIds.value, item.id];
  if (!selectedItemLocationIds.value[item.id]) selectItemLocation(item.id, item.locations[0]?.id);
}

function formatCreationDate(value) {
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function selectItemLocation(itemId, locationId) {
  selectedItemLocationIds.value = { ...selectedItemLocationIds.value, [itemId]: locationId };
}

function selectedItemLocation(item) {
  return selectedItemLocationIds.value[item.id] || item.locations[0]?.id;
}

function visibleItemLocations(item) {
  const selectedLocationId = selectedItemLocation(item);
  return item.locations.filter((location) => location.id === selectedLocationId);
}

function matrixStock(item, locationId, variationKey, sizeKey) {
  return item.stocks.find((stock) => (
    String(stock.locationId) === locationId
    && (stock.variationKey || '__standard') === variationKey
    && (stock.groesseKey || 'onesize') === sizeKey
  ));
}

function matrixCellState(stock) {
  if (stock.anzahl === 0) return 'matrix-cell--empty-stock';
  if (stock.anzahl < stock.soll) return 'matrix-cell--under-target';
  return '';
}

async function handleItemUpdated() {
  await refreshStocks();
}

async function handleStockUpdated() {
  await refreshStocks();
}

let filterRefreshTimeout;
watch([search, selectedLocationIds, stockState, variationOnly, sizeOnly], (_values, _previousValues, onCleanup) => {
  clearTimeout(filterRefreshTimeout);
  filterRefreshTimeout = setTimeout(refreshStocks, 250);
  onCleanup(() => clearTimeout(filterRefreshTimeout));
});

onMounted(refreshStocks);
</script>

<style scoped lang="scss">
.inventory-page { color: var(--text); }
.inventory-page :deep(.filter-chip) { border-color: color-mix(in srgb, var(--location-color) 45%, var(--border)); color: var(--location-color); }
.inventory-page :deep(.filter-chip.active) { border-color: var(--location-color); color: var(--location-color); background: color-mix(in srgb, var(--location-color) 12%, transparent); }
.state { margin: 24px 0; color: var(--muted); }
.state--error { color: #c3423f; }
.inventory-list { display: grid; gap: 10px; }
.item-card { border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); overflow: hidden; }
.item-card__header { display: flex; align-items: start; justify-content: space-between; gap: 12px; padding: 14px 14px 11px; border-bottom: 1px solid var(--border); cursor: pointer; }
.item-card__summary { min-width: 0; display: grid; justify-items: start; gap: 5px; }
.item-card__details-trigger { min-width: 0; display: grid; justify-items: start; gap: 5px; border: 0; padding: 0; background: transparent; color: var(--text); cursor: pointer; font: inherit; text-align: left; }
.item-card__title-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
.item-card h3 { font-size: 0.98rem; margin: 0; }
.item-card__meta { color: var(--muted); font-size: 0.74rem; }
.item-card__actions { display: flex; align-items: center; gap: 7px; }
.item-card__totals { display: flex; align-items: center; justify-content: flex-end; gap: 4px; flex-wrap: wrap; }
.item-card__total { min-width: 28px; padding: 4px 7px; border-radius: 5px; background: color-mix(in srgb, var(--location-color) 14%, var(--tile-bg)); color: var(--location-color); font-size: 0.78rem; font-weight: 700; text-align: center; white-space: nowrap; }
.item-card__edit { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
.item-card__edit:hover { border-color: var(--primary); color: var(--primary); }
.item-card__delete:hover { border-color: #c3423f; color: #c3423f; }
.shop-link { color: var(--muted); font-size: 0.72rem; text-decoration: none; }
.shop-link:hover { color: var(--primary); }
.item-card__details { display: grid; gap: 12px; padding: 12px 14px 14px; }
.location-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.location-tabs button { flex: 0 0 auto; border: 1px solid var(--border); border-radius: 6px; padding: 6px 9px; background: transparent; color: var(--muted); cursor: pointer; font: inherit; font-size: 0.76rem; }
.location-tabs button.active { border-color: var(--primary); color: var(--primary); }
.stock-matrix-section { border: 1px solid var(--border); border-radius: 7px; overflow: hidden; }
.stock-matrix-section__header { display: flex; align-items: baseline; gap: 8px; padding: 9px 11px; border-bottom: 1px solid var(--border); }
.stock-matrix-section__header h4 { margin: 0; font-size: 0.84rem; }
.stock-matrix-section__header span { color: var(--muted); font-size: 0.72rem; }
.item-creation-info { display: flex; flex-wrap: wrap; gap: 6px 12px; border-top: 1px solid var(--border); padding-top: 10px; color: var(--muted); font-size: 0.72rem; }
.stock-matrix-scroll { overflow-x: auto; }
.stock-matrix { width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.78rem; }
.stock-matrix th, .stock-matrix td { height: 48px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 4px; text-align: center; }
.stock-matrix th { background: color-mix(in srgb, var(--hover) 70%, var(--tile-bg)); color: var(--muted); font-size: 0.72rem; font-weight: 600; }
.stock-matrix th:first-child { min-width: 120px; padding: 0 9px; text-align: left; }
.stock-matrix tr:last-child th, .stock-matrix tr:last-child td { border-bottom: 0; }
.stock-matrix th:last-child, .stock-matrix td:last-child { border-right: 0; }
.matrix-cell { width: 100%; height: 100%; min-height: 38px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text); cursor: pointer; font: inherit; }
.matrix-cell:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, var(--tile-bg)); }
.matrix-cell b { font-size: 0.88rem; }
.matrix-cell small { color: var(--muted); font-size: 0.7rem; }
.matrix-cell--under-target { color: #a96100; background: color-mix(in srgb, #d78a00 10%, var(--tile-bg)); }
.matrix-cell--empty-stock { color: #c3423f; background: color-mix(in srgb, #c3423f 9%, var(--tile-bg)); }
.matrix-cell--empty { color: var(--muted); }
@media (max-width: 620px) { .page-header { align-items: start; flex-direction: column; gap: 5px; } .stock-count { padding: 0; } .item-card__header { padding: 12px; } .item-card__details { padding: 10px; } }
</style>
