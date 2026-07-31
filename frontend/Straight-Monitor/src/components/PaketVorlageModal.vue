<template>
  <Teleport to="body">
    <div class="backdrop" @mousedown.self="close">
      <section class="dialog" role="dialog" aria-modal="true" :aria-label="template.name">
        <header class="dialog__header">
          <div><p>Paketvorlage</p><h3>{{ template.name }}</h3></div>
          <button type="button" class="icon-button" title="Schließen" @click="close"><font-awesome-icon :icon="['fas', 'xmark']" /></button>
        </header>

        <div class="dialog__body">
          <div class="controls">
            <label>Standort
              <select v-model="locationId"><option v-for="location in availableLocations" :key="location._id" :value="location._id">{{ location.nameFull }} ({{ location.shortName }})</option></select>
            </label>
            <label>Mitarbeiter<MitarbeiterSearch v-model="mitarbeiterId" /></label>
          </div>

          <div class="mode-switch">
            <button type="button" :class="{ active: direction === 'issue' }" @click="setDirection('issue')">Entnahme</button>
            <button type="button" :class="{ active: direction === 'return' }" @click="setDirection('return')">Rückgabe</button>
          </div>

          <section v-for="section in template.sections.filter((entry) => entry.isActive)" :key="section._id" class="package-section">
            <h4>{{ section.name }}</h4>
            <label class="select-all"><input type="checkbox" :checked="sectionChecked(section)" @change="setSectionChecked(section, $event.target.checked)" /> Alles auswählen</label>
            <div class="entry-list">
              <div v-for="entry in section.entries.filter((item) => item.isActive)" :key="entry._id" class="entry-row" :class="{ unavailable: !lineFor(entry).options.length }">
                <input v-model="lineFor(entry).checked" type="checkbox" :disabled="!lineFor(entry).options.length" />
                <div class="entry-row__name"><b>{{ entry.label || entry.item?.bezeichnung }}</b><small v-if="!lineFor(entry).options.length">Nicht an diesem Standort verfügbar</small></div>
                <select v-model="lineFor(entry).stockId" :disabled="!lineFor(entry).options.length || !canChoose(entry)">
                  <option v-for="option in lineFor(entry).options" :key="option._id" :value="option._id">{{ stockLabel(option) }}</option>
                </select>
                <input v-model.number="lineFor(entry).anzahl" type="number" min="1" :max="maxQuantity(entry)" :disabled="!lineFor(entry).checked" />
              </div>
            </div>
          </section>

          <section class="package-section additional-section">
            <div class="additional-section__header">
              <h4>Zusätzliche Gegenstände</h4>
              <button type="button" class="add-item-button" @click="addAdditionalLine">
                <font-awesome-icon :icon="['fas', 'plus']" /> Gegenstand hinzufügen
              </button>
            </div>
            <div v-if="additionalLines.length" class="entry-list">
              <div v-for="line in additionalLines" :key="line.id" class="entry-row entry-row--additional">
                <select v-model="line.itemId" @change="selectAdditionalItem(line)">
                  <option value="">Artikel wählen</option>
                  <option v-for="item in catalogue" :key="item._id" :value="item._id">{{ item.bezeichnung }}</option>
                </select>
                <select v-model="line.stockId" :disabled="!additionalOptions(line).length">
                  <option value="">Variation und Größe wählen</option>
                  <option v-for="stock in additionalOptions(line)" :key="stock._id" :value="stock._id">{{ stockLabel(stock, additionalItem(line)) }}</option>
                </select>
                <input v-model.number="line.anzahl" type="number" min="1" :max="additionalMaxQuantity(line)" :disabled="!line.stockId" />
                <button type="button" class="remove-item-button" title="Gegenstand entfernen" @click="removeAdditionalLine(line.id)">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </button>
              </div>
            </div>
          </section>

          <label>Anmerkung<input v-model="anmerkung" type="text" placeholder="Optional" /></label>
          <p v-if="error" class="error">{{ error }}</p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="secondary" @click="close">Abbrechen</button>
          <button type="button" class="primary" :disabled="saving || !canBook" @click="book">
            <font-awesome-icon :icon="['fas', saving ? 'spinner' : 'check']" :spin="saving" />
            {{ direction === 'issue' ? 'Entnehmen' : 'Zurücknehmen' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faPlus, faSpinner, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import { useDataCache } from '@/stores/dataCache';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';

library.add(faCheck, faPlus, faSpinner, faTrash, faXmark);

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(['update:modelValue', 'booked']);
const template = computed(() => props.modelValue);
const dataCache = useDataCache();
const locations = ref([]);
const locationId = ref('');
const mitarbeiterId = ref(null);
const direction = ref('issue');
const lines = ref({});
const anmerkung = ref('');
const holdings = ref([]);
const catalogue = ref([]);
const additionalLines = ref([]);
const saving = ref(false);
const error = ref('');
let additionalLineSequence = 0;

const availableLocations = computed(() => {
  const allowed = template.value.allowedLocations || [];
  if (!allowed.length) return locations.value;
  const ids = new Set(allowed.map((location) => String(location._id || location)));
  return locations.value.filter((location) => ids.has(String(location._id)));
});

const bookableLines = computed(() => [
  ...Object.values(lines.value).filter((line) => line.checked && line.stockId && line.anzahl > 0),
  ...additionalLines.value.filter((line) => line.stockId && line.anzahl > 0),
]);
const canBook = computed(() => mitarbeiterId.value && bookableLines.value.length > 0);

function entryKey(entry) { return String(entry._id); }
function stockLabel(stock, item = null) {
  const variation = item?.variationen?.find((option) => option.key === stock.variationKey)?.label || stock.variationKey;
  const size = item?.groessen?.find((option) => option.key === stock.groesseKey)?.label || stock.groesseKey;
  return [variation, size !== 'onesize' ? size : ''].filter(Boolean).join(' · ') || 'onesize';
}
function matchingStocks(entry) {
  return (entry.item?.bestaende || []).filter((stock) => {
    const stockLocationId = String(stock.location?._id || stock.location);
    if (stockLocationId !== String(locationId.value) || !stock.isActive) return false;
    if (entry.variationMode === 'fixed' && stock.variationKey !== entry.variationKey) return false;
    if (entry.groesseMode === 'fixed' && stock.groesseKey !== entry.groesseKey) return false;
    return true;
  });
}
function lineFor(entry) { return lines.value[entryKey(entry)] || { checked: false, anzahl: entry.defaultQuantity, stockId: '', options: [] }; }
function additionalItem(line) { return catalogue.value.find((item) => String(item._id) === String(line.itemId)); }
function additionalOptions(line) {
  return (additionalItem(line)?.bestaende || []).filter((stock) => (
    stock.isActive && String(stock.location?._id || stock.location) === String(locationId.value)
  ));
}
function additionalMaxQuantity(line) {
  const stock = additionalOptions(line).find((option) => String(option._id) === String(line.stockId));
  return direction.value === 'issue' ? stock?.bestand || 0 : undefined;
}
function addAdditionalLine() {
  additionalLines.value = [...additionalLines.value, { id: `additional-${additionalLineSequence += 1}`, itemId: '', stockId: '', anzahl: 1 }];
}
function removeAdditionalLine(lineId) {
  additionalLines.value = additionalLines.value.filter((line) => line.id !== lineId);
}
function selectAdditionalItem(line) {
  line.stockId = additionalOptions(line)[0]?._id || '';
  line.anzahl = 1;
}
function syncAdditionalLines() {
  additionalLines.value.forEach((line) => {
    const selectedStock = additionalOptions(line).find((stock) => String(stock._id) === String(line.stockId));
    if (!selectedStock) line.stockId = additionalOptions(line)[0]?._id || '';
    if (direction.value === 'issue' && line.stockId) line.anzahl = Math.min(line.anzahl, additionalMaxQuantity(line)) || 1;
  });
}
function canChoose(entry) { return entry.variationMode === 'choose' || entry.groesseMode === 'choose'; }
function maxQuantity(entry) {
  const selected = lineFor(entry).options.find((stock) => String(stock._id) === String(lineFor(entry).stockId));
  return direction.value === 'issue' ? selected?.bestand || 0 : undefined;
}
function sectionChecked(section) { const entries = section.entries.filter((entry) => entry.isActive && lineFor(entry).options.length); return entries.length > 0 && entries.every((entry) => lineFor(entry).checked); }
function setSectionChecked(section, checked) { section.entries.filter((entry) => entry.isActive && lineFor(entry).options.length).forEach((entry) => { lineFor(entry).checked = checked; }); }

function setIssueDefaults() {
  const next = {};
  template.value.sections.forEach((section) => section.entries.filter((entry) => entry.isActive).forEach((entry) => {
    const options = matchingStocks(entry);
    next[entryKey(entry)] = { checked: !!entry.defaultSelected && options.length > 0, anzahl: entry.defaultQuantity, stockId: options[0]?._id || '', options };
  }));
  lines.value = next;
}

async function setReturnDefaults() {
  if (!mitarbeiterId.value) return setIssueDefaults();
  const { data } = await api.get(`/api/inventory/holdings/${mitarbeiterId.value}`);
  holdings.value = data;
  const next = {};
  template.value.sections.forEach((section) => section.entries.filter((entry) => entry.isActive).forEach((entry) => {
    const options = matchingStocks(entry);
    const held = options.map((option) => ({ option, holding: holdings.value.find((holding) => String(holding.stockId) === String(option._id)) })).find(({ holding }) => holding?.anzahl > 0);
    next[entryKey(entry)] = { checked: !!held, anzahl: held?.holding.anzahl || entry.defaultQuantity, stockId: held?.option._id || options[0]?._id || '', options };
  }));
  lines.value = next;
}

async function loadLocations() {
  const [locationsResponse, itemsResponse] = await Promise.all([api.get('/api/locations'), api.get('/api/inventory/items')]);
  locations.value = locationsResponse.data;
  catalogue.value = itemsResponse.data.filter((item) => item.isActive);
  locationId.value = availableLocations.value[0]?._id || '';
  setIssueDefaults();
}
async function setDirection(nextDirection) {
  direction.value = nextDirection;
  error.value = '';
  try { if (nextDirection === 'return') await setReturnDefaults(); else setIssueDefaults(); } catch { error.value = 'Mitarbeiterbestand konnte nicht geladen werden.'; }
}
async function book() {
  saving.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/api/inventory/transactions', {
      locationId: locationId.value,
      mitarbeiterId: mitarbeiterId.value,
      direction: direction.value,
      templateId: template.value._id,
      anmerkung: anmerkung.value,
      lines: bookableLines.value.map((line) => ({ stockId: line.stockId, anzahl: Number(line.anzahl) })),
    });
    for (const stock of data.updatedStocks) await dataCache.updateCachedItem(stock);
    emit('booked');
    close();
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Paket konnte nicht gebucht werden.';
  } finally { saving.value = false; }
}
function close() { emit('update:modelValue', null); }

watch(locationId, () => { if (direction.value === 'issue') setIssueDefaults(); else setReturnDefaults().catch(() => {}); syncAdditionalLines(); });
watch(mitarbeiterId, () => { if (direction.value === 'return') setReturnDefaults().catch(() => {}); });
watch(direction, syncAdditionalLines);
loadLocations().catch(() => { error.value = 'Standorte konnten nicht geladen werden.'; });
</script>

<style scoped lang="scss">
.backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 18px; background: var(--overlay); }.dialog { width: min(660px, 100%); max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); color: var(--text); box-shadow: 0 20px 50px rgba(0,0,0,.2); }.dialog__header, .dialog__footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 15px 18px; border-bottom: 1px solid var(--border); }.dialog__header p, .dialog__header h3 { margin: 0; }.dialog__header p { color: var(--primary); font-size: .72rem; font-weight: 700; text-transform: uppercase; }.dialog__header h3 { font-size: 1.08rem; }.dialog__body { display: grid; gap: 15px; overflow: auto; padding: 18px; }.controls { display: grid; grid-template-columns: 170px 1fr; gap: 12px; }.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border-radius: 7px; background: var(--hover); }.mode-switch button { background: transparent; color: var(--muted); }.mode-switch button.active { background: var(--tile-bg); color: var(--primary); box-shadow: 0 1px 3px rgba(0,0,0,.1); }.package-section { border-top: 1px solid var(--border); padding-top: 12px; }.package-section h4 { margin: 0 0 6px; font-size: .88rem; }.select-all { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: .72rem; color: var(--muted); }.entry-list { display: grid; gap: 6px; }.entry-row { display: grid; grid-template-columns: 18px minmax(110px, 1fr) minmax(130px, 1.2fr) 70px; align-items: center; gap: 8px; padding: 7px; border: 1px solid var(--border); border-radius: 6px; }.entry-row.unavailable { opacity: .5; }.entry-row__name { display: grid; gap: 2px; font-size: .78rem; }.entry-row__name small { color: #c3423f; font-size: .67rem; }label { display: grid; gap: 5px; font-size: .76rem; font-weight: 600; }input, select { min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 8px; background: var(--surface, var(--tile-bg)); color: var(--text); font: inherit; }input:focus, select:focus { outline: none; border-color: var(--primary); }.dialog__footer { justify-content: end; border-bottom: 0; border-top: 1px solid var(--border); }button { border: none; border-radius: 6px; cursor: pointer; padding: 8px 12px; font: inherit; font-weight: 600; }.icon-button, .secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }.primary { background: var(--primary); color: #fff; }button:disabled { cursor: not-allowed; opacity: .55; }.error { margin: 0; color: #c3423f; font-size: .78rem; }@media (max-width: 560px) { .controls, .entry-row { grid-template-columns: 1fr; }.entry-row > input { justify-self: start; } }
.dialog__body { gap: 11px; padding: 14px 16px; }
.controls { gap: 9px; }
.package-section { padding-top: 9px; }
.package-section h4 { margin-bottom: 3px; font-size: .82rem; }
.select-all { margin-bottom: 4px; font-size: .7rem; }
.entry-list { gap: 0; }
.entry-row { min-height: 38px; gap: 7px; padding: 3px 0; border: 0; border-radius: 0; }
.entry-row + .entry-row { border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent); }
.entry-row__name { font-size: .75rem; }
.entry-row input[type='number'], .entry-row select { height: 32px; padding: 4px 7px; border-radius: 5px; font-size: .78rem; }
.dialog__body > label input { height: 34px; padding: 5px 8px; }
.additional-section { display: grid; gap: 6px; }
.additional-section__header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.add-item-button, .remove-item-button { border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; font-size: .72rem; font-weight: 600; }
.add-item-button { padding: 4px 0; }
.remove-item-button { display: grid; place-items: center; width: 30px; height: 30px; color: var(--muted); }
.remove-item-button:hover { color: #c3423f; }
.entry-row--additional { grid-template-columns: minmax(130px, 1fr) minmax(155px, 1.25fr) 58px 30px; }
</style>