<template>
  <OrderActionDialog
    :model-value="modelValue"
    :title="mode === 'new' && !selected.length ? 'Pseudo-Schicht anlegen' : 'Pseudo-Mitarbeiter einplanen'"
    icon="fa-solid fa-user-plus"
    max-width="540px"
    :saving="saving"
    :can-submit="mode === 'new' ? !!newShift.bezeichnung.trim() : !!selected.length"
    :submit-label="submitLabel"
    @close="emit('update:modelValue', false)"
    @submit="emit('submit')"
  >
    <template #default="{ formId }">
      <div class="order-dialog-field">
        <span class="order-dialog-label">Schicht-Modus</span>
        <AppSegmentedControl
          :model-value="mode"
          :options="shiftModes"
          size="sm"
          label="Schicht auswählen"
          class="pseudo-assignment-mode"
          @update:model-value="emit('update:mode', $event)"
        />
      </div>

      <section
        v-if="mode === 'existing'"
        class="pseudo-dialog-section"
      >
        <header class="pseudo-dialog-section__header">
          <h3 class="pseudo-dialog-section__title">Bestehende Schicht</h3>
        </header>
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-shift`"
          >Ziel-Schicht</label>
          <select
            :id="`${formId}-shift`"
            v-model="shiftModel"
            class="order-dialog-native"
          >
            <option :value="null">
              — Automatisch (erste Schicht) —
            </option>
            <option
              v-for="shift in shifts"
              :key="shift.key"
              :value="shift.key"
            >
              {{ shift.meta.schichtBezeichnung || 'Schicht ' + shift.key }}{{ shift.meta.uhrzeitVon ? ' · ' + shift.meta.uhrzeitVon.substring(0, 5) : '' }}
            </option>
          </select>
        </div>
      </section>

      <template v-else>
        <!-- Section 1: Schicht & Zeitraum -->
        <section class="pseudo-dialog-section">
          <header class="pseudo-dialog-section__header">
            <h3 class="pseudo-dialog-section__title">Schicht &amp; Zeitraum</h3>
          </header>
          <div class="order-dialog-field">
            <label
              class="order-dialog-label"
              :for="`${formId}-shift-name`"
            >Bezeichnung *</label>
            <AppTextInput
              :id="`${formId}-shift-name`"
              :model-value="newShift.bezeichnung"
              required
              placeholder="z.B. Trainer, Service, Logistik..."
              @update:model-value="updateShift('bezeichnung', $event)"
            />
          </div>
          <div class="order-dialog-row">
            <div class="order-dialog-field">
              <label
                class="order-dialog-label"
                :for="`${formId}-from`"
              >Von</label>
              <input
                :id="`${formId}-from`"
                :value="newShift.uhrzeitVon"
                type="time"
                class="order-dialog-native"
                @input="updateShift('uhrzeitVon', $event.target.value)"
              >
            </div>
            <div class="order-dialog-field">
              <label
                class="order-dialog-label"
                :for="`${formId}-to`"
              >Bis</label>
              <input
                :id="`${formId}-to`"
                :value="newShift.uhrzeitBis"
                type="time"
                class="order-dialog-native"
                @input="updateShift('uhrzeitBis', $event.target.value)"
              >
            </div>
          </div>
          <div class="order-dialog-field">
            <label
              class="order-dialog-label"
              :for="`${formId}-bedarf`"
            >Bedarf (Anzahl Mitarbeiter)</label>
            <input
              :id="`${formId}-bedarf`"
              :value="newShift.bedarf ?? 1"
              type="number"
              min="1"
              step="1"
              class="order-dialog-native"
              @input="updateShift('bedarf', Math.max(1, Number.parseInt($event.target.value, 10) || 1))"
            >
          </div>
        </section>

        <!-- Section 2: Beruf, Qualifikation & Preis -->
        <section class="pseudo-dialog-section">
          <header class="pseudo-dialog-section__header">
            <h3 class="pseudo-dialog-section__title">Beruf, Qualifikation &amp; Preis</h3>
            <span class="pseudo-dialog-section__badge">Kundenkondition</span>
          </header>
          <div class="order-dialog-row">
            <div class="order-dialog-field">
              <label
                class="order-dialog-label"
                :for="`${formId}-beruf`"
              >Beruf</label>
              <BerufSearch
                :input-id="`${formId}-beruf`"
                :multiple="false"
                :model-value="newShift.berufSchl || ''"
                :disabled="saving"
                placeholder="Beruf suchen..."
                @update:model-value="updateShift('berufSchl', $event)"
              />
            </div>
            <div class="order-dialog-field">
              <label
                class="order-dialog-label"
                :for="`${formId}-quali`"
              >Qualifikation</label>
              <QualifikationSearch
                :input-id="`${formId}-quali`"
                :multiple="false"
                :model-value="newShift.qualSchl || ''"
                :disabled="saving"
                placeholder="Qualifikation suchen..."
                @update:model-value="updateShift('qualSchl', $event)"
              />
            </div>
          </div>
          <div class="order-dialog-field">
            <div class="pseudo-price-label-row">
              <label
                class="order-dialog-label"
                :for="`${formId}-preis`"
              >Qualifikationspreis (Vorschau)</label>
              <span class="pseudo-price-tag">Pseudo · deaktiviert</span>
            </div>
            <input
              :id="`${formId}-preis`"
              :value="qualificationPricePreview"
              type="text"
              disabled
              readonly
              class="order-dialog-native pseudo-price-input"
              placeholder="Automatisch anhand der Qualifikation (Vorschau)"
            >
            <small class="pseudo-price-hint">
              Wird bei regulären Schichten automatisch über den hinterlegten Kundenpreis der Qualifikation gesetzt.
            </small>
          </div>
        </section>
      </template>

      <!-- Section 3: Personal einplanen -->
      <section class="pseudo-dialog-section">
        <header class="pseudo-dialog-section__header">
          <h3 class="pseudo-dialog-section__title">Personal einplanen</h3>
          <span
            v-if="mode === 'new'"
            class="pseudo-dialog-section__optional"
          >Optional</span>
        </header>
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-search`"
          >Mitarbeiter suchen</label>
          <div class="pseudo-assignment-search">
            <AppTextInput
              :id="`${formId}-search`"
              :model-value="search"
              placeholder="Name oder E-Mail..."
              @update:model-value="emit('update:search', $event)"
            />
            <span
              v-if="searching"
              role="status"
            >Suche…</span>
          </div>
          <div
            v-if="results.length"
            class="pseudo-assignment-results"
          >
            <button
              v-for="employee in results"
              :key="employee._id"
              type="button"
              class="pseudo-assignment-result"
              :aria-pressed="isSelected(employee)"
              @click="emit('toggle', employee)"
            >
              <span>{{ formatName(employee) }} <span
                v-if="isSelected(employee)"
                aria-hidden="true"
              >✓</span></span>
              <small>{{ employee.email }}</small>
            </button>
          </div>
          <template v-if="selected.length">
            <span class="order-dialog-label">{{ selected.length }} Mitarbeiter ausgewählt</span>
            <div class="pseudo-assignment-chips">
              <span
                v-for="employee in selected"
                :key="employee._id"
                class="pseudo-assignment-chip"
              >
                {{ formatName(employee) }}
                <AppIconButton
                  variant="ghost"
                  size="sm"
                  :label="`${formatName(employee)} aus Auswahl entfernen`"
                  @click="emit('toggle', employee)"
                >×</AppIconButton>
              </span>
            </div>
          </template>
        </div>
      </section>
    </template>
  </OrderActionDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import api from '@/utils/api';
import OrderActionDialog from './OrderActionDialog.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';
import BerufSearch from '@/components/ui-elements/BerufSearch.vue';
import QualifikationSearch from '@/components/ui-elements/QualifikationSearch.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'existing' },
  newShift: { type: Object, required: true },
  shiftKey: { type: [String, Number], default: null },
  kundenNr: { type: [Number, String], default: null },
  orderDate: { type: [String, Date], default: null },
  shifts: { type: Array, default: () => [] },
  search: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  searching: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  formatName: { type: Function, required: true },
});
const emit = defineEmits(['update:modelValue', 'update:mode', 'update:newShift', 'update:shiftKey', 'update:search', 'toggle', 'submit']);
const shiftModes = [{ value: 'existing', label: 'Bestehende Schicht' }, { value: 'new', label: 'Neue Pseudo-Schicht' }];
const shiftModel = computed({ get: () => props.shiftKey, set: value => emit('update:shiftKey', value) });
const submitLabel = computed(() => {
  if (props.mode === 'new' && !props.selected.length) return 'Schicht anlegen';
  if (props.selected.length > 1) return `${props.selected.length} Mitarbeiter einplanen`;
  return 'Einplanen';
});

const kundenpreise = ref([]);
const kundenpreiseLoading = ref(false);
const loadedKundenNr = ref(null);
let priceRequestSeq = 0;

async function loadCustomerPrices() {
  const kNr = Number(props.kundenNr);
  if (!props.modelValue || props.mode !== 'new' || !Number.isInteger(kNr) || kNr <= 0) {
    return;
  }
  if (loadedKundenNr.value === kNr) return;
  const reqId = ++priceRequestSeq;
  kundenpreiseLoading.value = true;
  try {
    const { data } = await api.get(`/api/kunden/${kNr}/preise`);
    if (reqId !== priceRequestSeq) return;
    kundenpreise.value = Array.isArray(data) ? data : [];
    loadedKundenNr.value = kNr;
  } catch {
    if (reqId === priceRequestSeq) {
      kundenpreise.value = [];
      loadedKundenNr.value = null;
    }
  } finally {
    if (reqId === priceRequestSeq) {
      kundenpreiseLoading.value = false;
    }
  }
}

watch(
  () => [props.modelValue, props.mode, props.kundenNr],
  ([open, currentMode, kNr]) => {
    if (Number(kNr) !== loadedKundenNr.value) {
      kundenpreise.value = [];
      loadedKundenNr.value = null;
    }
    if (open && currentMode === 'new' && kNr) {
      void loadCustomerPrices();
    }
  },
  { immediate: true }
);

function formatCurrencyCents(cents) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatShortDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const qualificationPricePreview = computed(() => {
  const rawQual = props.newShift?.qualSchl;
  if (rawQual === null || rawQual === undefined || String(rawQual).trim() === '') {
    return '';
  }
  const qualKey = Number(rawQual);
  if (!Number.isInteger(qualKey)) return '';
  if (!props.kundenNr) {
    return 'Kein Kunde am Auftrag hinterlegt';
  }
  if (kundenpreiseLoading.value) {
    return 'Kundenpreis wird geladen…';
  }

  const matching = kundenpreise.value
    .filter((entry) => Number(entry.qualifikation?.qualificationKey ?? entry.qualSchluessel) === qualKey)
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());

  if (!matching.length) {
    return `Kein Kundenpreis für Qualifikation ${qualKey} hinterlegt`;
  }

  const parsedOrderTime = props.orderDate ? new Date(props.orderDate).getTime() : NaN;
  const refTime = Number.isFinite(parsedOrderTime) ? parsedOrderTime : Date.now();

  const activeAtRef = matching.filter((entry) => {
    const from = new Date(entry.validFrom).getTime();
    const till = entry.validTill ? new Date(entry.validTill).getTime() : Infinity;
    return from <= refTime && refTime <= till;
  });

  const chosen =
    activeAtRef[0] ||
    matching.find((entry) => new Date(entry.validFrom).getTime() <= refTime) ||
    matching[matching.length - 1];

  if (!chosen || typeof chosen.hourlyRateCents !== 'number') {
    return `Kein Kundenpreis für Qualifikation ${qualKey} hinterlegt`;
  }

  const formattedRate = `${formatCurrencyCents(chosen.hourlyRateCents)} / Std.`;
  const fromStr = formatShortDate(chosen.validFrom);
  return fromStr ? `${formattedRate} (gültig ab ${fromStr})` : formattedRate;
});

function updateShift(key, value) { emit('update:newShift', { ...props.newShift, [key]: value }); }
function isSelected(employee) { return props.selected.some(item => item._id === employee._id); }
</script>

<style scoped>
.pseudo-assignment-mode { width: fit-content; max-width: 100%; }
.pseudo-dialog-section {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface, var(--tile-bg)) 94%, var(--text) 6%);
}
.pseudo-dialog-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
}
.pseudo-dialog-section__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--muted);
}
.pseudo-dialog-section__badge,
.pseudo-dialog-section__optional {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  font-weight: 500;
}
.pseudo-dialog-section__optional {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
  color: var(--muted);
}
.pseudo-price-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pseudo-price-tag {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
  color: var(--muted);
}
.pseudo-price-input {
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.85;
}
.pseudo-price-hint {
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.35;
}
.pseudo-assignment-search { display: flex; align-items: center; gap: 8px; }
.pseudo-assignment-search span { color: var(--muted); font-size: .8rem; }
.pseudo-assignment-results { max-height: 180px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--control-radius); }
.pseudo-assignment-result { display: grid; gap: 3px; width: 100%; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--border); background: var(--surface); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.pseudo-assignment-result:hover, .pseudo-assignment-result[aria-pressed="true"] { background: var(--hover); }
.pseudo-assignment-result:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: -2px; }
.pseudo-assignment-result small { color: var(--muted); }
.pseudo-assignment-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pseudo-assignment-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px 2px 10px; border: 1px solid var(--primary); border-radius: 20px; background: var(--action-ghost-hover); color: var(--text); font-size: .8rem; }
</style>
