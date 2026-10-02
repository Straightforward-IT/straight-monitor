<template>
  <ModalFrame
    class="inventory-report-modal"
    :title="reportTitle"
    size="xl"
    @close="emit('close')"
  >
    <template #header="{ titleId }">
      <div class="report-title-block">
        <h3 :id="titleId">
          <font-awesome-icon :icon="['fas', mode === 'excel' ? 'file-excel' : 'paper-plane']" />
          {{ reportTitle }}
        </h3>
        <p>{{ reportRows.length }} Bestandskombinationen aus {{ selectedLocationIds.length }} Standorten</p>
      </div>
    </template>

    <div class="report-body">
      <aside class="report-controls">
        <section>
          <div class="control-heading">
            <h4>Standorte</h4>
            <AppButton
              variant="ghost"
              size="sm"
              @click="toggleAllLocations"
            >
              {{ allLocationsSelected ? 'Keine' : 'Alle' }}
            </AppButton>
          </div>
          <label
            v-for="location in availableLocations"
            :key="location._id"
            class="choice"
          >
            <input
              v-model="selectedLocationIds"
              type="checkbox"
              :value="String(location._id)"
            >
            <span>{{ location.nameFull }}</span>
            <small v-if="mode === 'email' && !location.contact?.mainEmail">Keine E-Mail</small>
          </label>
        </section>
        <section>
          <div class="control-heading">
            <h4>Artikel</h4>
            <AppButton
              variant="ghost"
              size="sm"
              @click="toggleAllItems"
            >
              {{ allItemsSelected ? 'Keine' : 'Alle' }}
            </AppButton>
          </div>
          <label
            v-for="item in availableItems"
            :key="item.id"
            class="choice"
          >
            <input
              v-model="selectedItemIds"
              type="checkbox"
              :value="item.id"
            >
            <span>{{ item.bezeichnung }}</span>
            <small>{{ item.stockCount }}</small>
          </label>
        </section>
        <label class="group-toggle"><input
          v-model="groupByShop"
          type="checkbox"
        > Nach Shop gruppieren</label>
      </aside>

      <section class="report-preview">
        <div class="preview-heading">
          <h4>Vorschau</h4><span>{{ selectedItemIds.length }} Artikel</span>
        </div>
        <div
          v-if="reportRows.length"
          class="preview-scroll"
        >
          <table>
            <thead><tr><th>Standort</th><th>Artikel</th><th>Variation</th><th>Größe</th><th>Bestand</th><th>Soll</th><th>Shop</th></tr></thead>
            <tbody>
              <tr
                v-for="row in reportRows.slice(0, 50)"
                :key="row.stockId"
              >
                <td>{{ row.standort }}</td><td>{{ row.bezeichnung }}</td><td>{{ row.variation || 'Standard' }}</td><td>{{ row.groesse || 'Onesize' }}</td><td>{{ row.anzahl }}</td><td>{{ row.soll }}</td><td>{{ shopLabel(row.shopUrl) }}</td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="reportRows.length > 50"
            class="preview-limit"
          >
            Vorschau zeigt 50 von {{ reportRows.length }} Zeilen.
          </p>
        </div>
        <p
          v-else
          class="empty-state"
        >
          Wähle mindestens einen Standort und Artikel aus.
        </p>
        <p
          v-if="message"
          class="result-message"
          :class="{ 'result-message--error': messageError }"
        >
          {{ message }}
        </p>
      </section>
    </div>

    <template #footer>
      <AppButton
        variant="secondary"
        @click="emit('close')"
      >
        Abbrechen
      </AppButton>
      <AppButton
        :disabled="!reportRows.length || sending"
        :loading="sending"
        @click="submit"
      >
        <font-awesome-icon :icon="['fas', mode === 'excel' ? 'download' : 'paper-plane']" />
        {{ mode === 'excel' ? 'Excel herunterladen' : 'Update senden' }}
      </AppButton>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faDownload, faFileExcel, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';

library.add(faDownload, faFileExcel, faPaperPlane);

const props = defineProps({
  mode: { type: String, required: true },
  stocks: { type: Array, default: () => [] },
  locations: { type: Array, default: () => [] },
  initialLocationIds: { type: Array, default: () => [] },
});
const emit = defineEmits(['close']);
const reportTitle = computed(() => props.mode === 'excel' ? 'Bestandsliste exportieren' : 'Bestandsupdate senden');
const itemIdsWithStock = new Set(props.stocks.map((stock) => String(stock.itemId || stock._id)));
const availableLocations = computed(() => props.locations.filter((location) => props.stocks.some((stock) => String(stock.locationId) === String(location._id))));
const availableItems = computed(() => {
  const items = new Map();
  for (const stock of props.stocks) {
    const id = String(stock.itemId || stock._id);
    if (!items.has(id)) items.set(id, { id, bezeichnung: stock.bezeichnung, stockCount: 0 });
    items.get(id).stockCount += 1;
  }
  return [...items.values()].sort((left, right) => left.bezeichnung.localeCompare(right.bezeichnung, 'de'));
});
const selectedLocationIds = ref((props.initialLocationIds.length ? props.initialLocationIds : availableLocations.value.map((location) => String(location._id))).map(String));
const selectedItemIds = ref([...itemIdsWithStock]);
const groupByShop = ref(true);
const sending = ref(false);
const message = ref('');
const messageError = ref(false);
const allLocationsSelected = computed(() => selectedLocationIds.value.length === availableLocations.value.length);
const allItemsSelected = computed(() => selectedItemIds.value.length === availableItems.value.length);
const reportRows = computed(() => props.stocks
  .filter((stock) => selectedLocationIds.value.includes(String(stock.locationId)) && selectedItemIds.value.includes(String(stock.itemId || stock._id)))
  .sort((left, right) => [left.standort, shopLabel(left.shopUrl), left.bezeichnung, left.variation, left.groesse].join('|').localeCompare([right.standort, shopLabel(right.shopUrl), right.bezeichnung, right.variation, right.groesse].join('|'), 'de')));

function toggleAllLocations() { selectedLocationIds.value = allLocationsSelected.value ? [] : availableLocations.value.map((location) => String(location._id)); }
function toggleAllItems() { selectedItemIds.value = allItemsSelected.value ? [] : availableItems.value.map((item) => item.id); }
function shopLabel(shopUrl) {
  if (!shopUrl) return 'Ohne Shop';
  try {
    const url = new URL(shopUrl);
    return url.hostname ? url.hostname.replace(/^www\./, '') : shopUrl;
  } catch { return shopUrl; }
}
function sheetName(name, usedNames) {
  const base = String(name).replace(/[\\/?*\[\]:]/g, '-').slice(0, 31) || 'Bestand';
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) candidate = `${base.slice(0, 28)}-${suffix++}`;
  usedNames.add(candidate);
  return candidate;
}
function worksheetRows(rows) {
  return rows.map((row) => ({
    Standort: row.standort,
    Artikel: row.bezeichnung,
    Variation: row.variation || 'Standard',
    Größe: row.groesse || 'Onesize',
    Bestand: row.anzahl,
    Soll: row.soll,
    Differenz: Number(row.anzahl) - Number(row.soll),
    Shop: row.shopUrl || '',
  }));
}
function exportExcel() {
  const workbook = XLSX.utils.book_new();
  const groups = groupByShop.value
    ? [...reportRows.value.reduce((map, row) => { const key = shopLabel(row.shopUrl); if (!map.has(key)) map.set(key, []); map.get(key).push(row); return map; }, new Map()).entries()]
    : [['Bestand', reportRows.value]];
  const usedNames = new Set();
  for (const [shop, rows] of groups) {
    const worksheet = XLSX.utils.json_to_sheet(worksheetRows(rows));
    worksheet['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 34 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(shop, usedNames));
  }
  XLSX.writeFile(workbook, `Bestandsliste_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}.xlsx`);
}
async function submit() {
  message.value = '';
  if (props.mode === 'excel') { exportExcel(); return; }
  sending.value = true;
  try {
    const { data } = await api.post('/api/inventory/stock-report/email', { locationIds: selectedLocationIds.value, itemIds: selectedItemIds.value, groupByShop: groupByShop.value });
    const skipped = data.skipped?.length ? ` ${data.skipped.map((entry) => `${entry.location}: ${entry.reason}`).join(' | ')}` : '';
    message.value = `${data.sent.length} Bestandsupdate(s) gesendet.${skipped}`;
    messageError.value = !data.sent.length;
  } catch (error) {
    message.value = error.response?.data?.message || 'Der Versand ist fehlgeschlagen.';
    messageError.value = true;
  } finally { sending.value = false; }
}
</script>

<style scoped lang="scss">
:global(.inventory-report-modal) { --mf-max-width: 1060px; --mf-max-height: min(760px, calc(100vh - 32px)); --mf-border: 1px solid var(--border); --mf-radius: 8px; --mf-surface: var(--tile-bg); --mf-body-padding: 0; --mf-footer-padding: 16px 18px; }
.report-title-block h3 { margin: 0; font-size: 1.05rem; } .report-title-block p, .preview-heading span { margin: 4px 0 0; color: var(--muted); font-size: .78rem; }
.report-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(240px, 290px) minmax(0, 1fr); }
.report-controls { overflow: auto; padding: 14px; border-right: 1px solid var(--border); } .report-controls section + section { margin-top: 18px; }
.control-heading, .preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; } .control-heading h4, .preview-heading h4 { margin: 0; font-size: .82rem; }
.choice { display: flex; align-items: center; gap: 7px; padding: 7px 0; font-size: .8rem; cursor: pointer; } .choice input { accent-color: var(--primary); } .choice span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .choice small { margin-left: auto; color: var(--muted); white-space: nowrap; font-size: .68rem; }
.group-toggle { display: flex; align-items: center; gap: 7px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); font-size: .8rem; } .group-toggle input { accent-color: var(--primary); }
.report-preview { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); padding: 14px; } .preview-heading { margin-bottom: 10px; }
.preview-scroll { overflow: auto; border: 1px solid var(--border); border-radius: 6px; } table { width: 100%; border-collapse: collapse; font-size: .76rem; } th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; } th { position: sticky; top: 0; background: var(--tile-bg); color: var(--muted); font-size: .68rem; } tr:last-child td { border-bottom: 0; } .preview-limit, .empty-state, .result-message { margin: 10px 0 0; color: var(--muted); font-size: .78rem; } .result-message { color: var(--status-success-text); } .result-message--error { color: var(--status-danger-text); }
@media (max-width: 720px) { :global(.inventory-report-modal) { --mf-max-height: calc(100vh - 20px); --mf-header-padding: 12px; --mf-footer-padding: 12px; } .report-body { grid-template-columns: 1fr; overflow: auto; } .report-controls { max-height: 270px; border-right: 0; border-bottom: 1px solid var(--border); } .report-preview { min-height: 330px; } }
</style>
