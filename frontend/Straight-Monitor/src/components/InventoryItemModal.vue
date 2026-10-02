<template>
  <ModalFrame
    :model-value="modelValue"
    :title="isEditing ? 'Artikel bearbeiten' : 'Artikel anlegen'"
    subtitle="Bestand"
    size="xl"
    class="inventory-item-modal"
    @close="close"
  >
    <div class="dialog__body">
      <div class="base-grid">
        <label>Grundbezeichnung<AppTextInput
          v-model="form.bezeichnung"
          placeholder="z. B. T-Shirt"
        /></label>
        <label>Shop-Link<AppTextInput
          v-model="form.shopUrl"
          type="url"
          placeholder="https://…"
        /></label>
        <label>Variationen<span>Kommagetrennt, optional</span><AppTextInput
          v-model="form.variationen"
          placeholder="Schwarz, Weiß"
        /></label>
        <label>Größen<span>Kommagetrennt, optional</span><AppTextInput
          v-model="form.groessen"
          placeholder="S, M, L"
        /></label>
      </div>

      <section class="location-section">
        <div class="section-heading">
          <h4>Standorte</h4><span>{{ selectedLocationIds.length }} gewählt</span>
        </div>
        <div
          v-if="locations.length"
          class="location-chips"
        >
          <label
            v-for="location in locations"
            :key="location._id"
            class="location-chip"
          >
            <input
              v-model="selectedLocationIds"
              type="checkbox"
              :value="location._id"
            >
            <b>{{ location.shortName }}</b> {{ location.nameFull }}
          </label>
        </div>
        <p
          v-else
          class="hint"
        >
          Noch keine Standorte vorhanden. Diese werden in der Monitor Verwaltung angelegt.
        </p>
      </section>

      <section class="matrix-section">
        <div class="section-heading">
          <h4>Bestandskombinationen</h4><span>{{ stockRows.length }} Zeilen</span>
        </div>
        <p
          v-if="!stockRows.length"
          class="hint"
        >
          Wähle mindestens einen Standort aus.
        </p>
        <div
          v-else
          class="matrix"
        >
          <div
            v-for="row in stockRows"
            :key="row.key"
            class="matrix-row"
          >
            <label class="matrix-row__toggle"><input
              v-model="row.isActive"
              type="checkbox"
            ><span>{{ row.locationShort }}</span></label>
            <span>{{ row.variationLabel || 'Standard' }}</span>
            <span>{{ row.groesseLabel }}</span>
            <label>Bestand<AppTextInput
              v-model.number="row.bestand"
              type="number"
              min="0"
            /></label>
            <label>Soll<AppTextInput
              v-model.number="row.soll"
              type="number"
              min="0"
            /></label>
            <label class="matrix-row__url">Shop-Link<AppTextInput
              v-model="row.shopUrl"
              type="url"
              placeholder="Standard-Link"
            /></label>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <AppButton
        variant="secondary"
        @click="close"
      >
        Abbrechen
      </AppButton>
      <AppButton
        :disabled="!canSave"
        :loading="saving"
        @click="save"
      >
        <font-awesome-icon :icon="['fas', 'check']" />
        {{ isEditing ? 'Speichern' : 'Anlegen' }}
      </AppButton>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';

library.add(faCheck);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  item: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'created', 'updated']);
const form = ref({ bezeichnung: '', shopUrl: '', variationen: '', groessen: '' });
const locations = ref([]);
const selectedLocationIds = ref([]);
const stockRows = ref([]);
const saving = ref(false);
const error = ref('');
const isEditing = computed(() => Boolean(props.item?._id || props.item?.id));

function toKey(value) {
  return String(value).trim().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseOptions(value, uppercase = false) {
  const known = new Set();
  return String(value || '').split(',').map((label) => label.trim()).filter(Boolean).reduce((options, label) => {
    const key = toKey(label);
    const finalLabel = uppercase ? label.toUpperCase() : label;
    if (key && !known.has(key)) { known.add(key); options.push({ key, label: finalLabel }); }
    return options;
  }, []);
}

const variationOptions = computed(() => parseOptions(form.value.variationen));
const sizeOptions = computed(() => parseOptions(form.value.groessen, true));
const canSave = computed(() => form.value.bezeichnung.trim() && stockRows.value.some((row) => row.isActive));

async function loadLocations() {
  const { data } = await api.get('/api/locations');
  locations.value = data;
}

function rebuildMatrix() {
  const previous = new Map(stockRows.value.map((row) => [row.key, row]));
  const variations = variationOptions.value.length ? variationOptions.value : [{ key: null, label: '' }];
  const sizes = sizeOptions.value.length ? sizeOptions.value : [{ key: 'onesize', label: 'onesize' }];
  stockRows.value = selectedLocationIds.value.flatMap((locationId) => {
    const location = locations.value.find((entry) => entry._id === locationId);
    return variations.flatMap((variation) => sizes.map((groesse) => {
      const key = `${locationId}|${variation.key || ''}|${groesse.key}`;
      const existing = previous.get(key);
      if (existing) {
        existing.variationLabel = variation.label;
        existing.groesseLabel = groesse.label;
        return existing;
      }
      return {
        key,
        locationId,
        locationShort: location?.shortName || '',
        variationKey: variation.key,
        variationLabel: variation.label,
        groesseKey: groesse.key,
        groesseLabel: groesse.label,
        bestand: 0,
        soll: 0,
        shopUrl: form.value.shopUrl,
        isActive: true,
      };
    }));
  });
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const payload = {
      bezeichnung: form.value.bezeichnung,
      shopUrl: form.value.shopUrl,
      variationen: variationOptions.value,
      groessen: sizeOptions.value,
      bestaende: stockRows.value.filter((row) => row.isActive).map((row) => ({
        stockId: row.stockId,
        location: row.locationId,
        variationKey: row.variationKey,
        groesseKey: row.groesseKey,
        bestand: row.bestand,
        soll: row.soll,
        shopUrl: row.shopUrl,
      })),
    };
    const { data } = isEditing.value
      ? await api.patch(`/api/inventory/items/${props.item._id || props.item.id}`, payload)
      : await api.post('/api/inventory/items', payload);
    emit(isEditing.value ? 'updated' : 'created', data);
    close();
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Artikel konnte nicht angelegt werden.';
  } finally {
    saving.value = false;
  }
}

function reset() {
  form.value = { bezeichnung: '', shopUrl: '', variationen: '', groessen: '' };
  selectedLocationIds.value = [];
  stockRows.value = [];
  error.value = '';
}

function populateItem(item) {
  const existingStocks = item.stocks || [];
  const variationLabels = (item.variations || existingStocks
    .filter((stock) => stock.variationKey)
    .map((stock) => ({ key: stock.variationKey, label: stock.variation || stock.variationKey })))
    .map((variation) => variation.label)
    .filter(Boolean);
  const sizeLabels = (item.sizes || existingStocks
    .filter((stock) => stock.groesseKey && stock.groesseKey !== 'onesize')
    .map((stock) => ({ key: stock.groesseKey, label: stock.groesse || stock.groesseKey })))
    .map((size) => size.label)
    .filter((label) => label && label !== 'onesize');

  form.value = {
    bezeichnung: item.bezeichnung || '',
    shopUrl: item.shopUrl || existingStocks[0]?.shopUrl || '',
    variationen: variationLabels.join(', '),
    groessen: sizeLabels.join(', '),
  };
  selectedLocationIds.value = [...new Set(existingStocks.map((stock) => String(stock.locationId)).filter(Boolean))];
  stockRows.value = existingStocks.map((stock) => ({
    key: `${stock.locationId}|${stock.variationKey || ''}|${stock.groesseKey || 'onesize'}`,
    locationId: String(stock.locationId),
    locationShort: stock.standortKurz || '',
    variationKey: stock.variationKey || null,
    variationLabel: stock.variation || '',
    groesseKey: stock.groesseKey || 'onesize',
    groesseLabel: stock.groesse || 'onesize',
    bestand: Number(stock.bestand ?? stock.anzahl ?? 0),
    soll: Number(stock.soll ?? 0),
    stockId: stock._id,
    shopUrl: stock.shopUrl || '',
    isActive: true,
  }));
}

function close() { emit('update:modelValue', false); }

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  reset();
  try {
    await loadLocations();
    if (props.item) populateItem(props.item);
  } catch { error.value = 'Standorte konnten nicht geladen werden.'; }
}, { immediate: true });
watch([selectedLocationIds, variationOptions, sizeOptions], rebuildMatrix, { deep: true });
</script>

<style scoped lang="scss">
:global(.inventory-item-modal) { --mf-max-width: min(920px, 94vw); --mf-max-height: min(88vh, 800px); --mf-border: 1px solid var(--border); --mf-radius: 8px; --mf-surface: var(--tile-bg); --mf-body-padding: 18px; --mf-footer-padding: 15px 18px; }
.dialog__body { display: grid; gap: 22px; }
.base-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
label { display: grid; gap: 5px; color: var(--text); font-size: 0.8rem; font-weight: 600; } label span, .hint, .section-heading span { color: var(--muted); font-size: 0.72rem; font-weight: 400; }
input[type='checkbox'] { accent-color: var(--primary); }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; } .section-heading h4 { margin: 0; font-size: 0.9rem; }
.location-chips { display: flex; flex-wrap: wrap; gap: 7px; } .location-chip { display: inline-flex; grid-auto-flow: column; align-items: center; gap: 5px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 400; } .location-chip b { color: var(--action-accent-text); }
.matrix { display: grid; gap: 6px; } .matrix-row { display: grid; grid-template-columns: 82px 1fr 1fr 82px 70px minmax(140px, 1.5fr); gap: 7px; align-items: end; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.78rem; } .matrix-row > span { padding: 8px 0; color: var(--muted); } .matrix-row label { font-size: 0.68rem; } .matrix-row__toggle { display: flex; align-items: center; gap: 5px; padding-bottom: 8px; color: var(--action-accent-text); }
.error { margin: 0 auto 0 0; color: var(--status-danger-text); font-size: 0.78rem; }
@media (max-width: 720px) { .base-grid { grid-template-columns: 1fr; } .matrix-row { grid-template-columns: 70px 1fr 1fr; } .matrix-row label { grid-column: span 1; } .matrix-row__url { grid-column: 1 / -1; } }
</style>
