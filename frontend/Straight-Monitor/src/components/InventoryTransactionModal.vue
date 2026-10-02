<template>
  <ModalFrame
    class="inventory-transaction-modal"
    :title="stock.bezeichnung"
    :subtitle="stock.standort"
    size="sm"
    @close="close"
  >
    <div class="transaction-body">
      <p class="transaction-variant">
        {{ variantLabel }}
      </p>
      <AppSegmentedControl
        v-model="direction"
        :options="directionOptions"
        label="Buchungsart"
      />
      <p class="available">
        Aktueller Bestand: <b>{{ stock.anzahl }}</b> / {{ stock.soll }}
      </p>
      <label v-if="direction !== 'adjust'">Mitarbeiter <span>(optional)</span><MitarbeiterSearch
        v-model="mitarbeiterId"
        include-inactive
      /></label>
      <div class="two-columns">
        <label>
          {{ direction === 'adjust' ? 'Neuer Bestand' : 'Menge' }}
          <AppTextInput
            v-model.number="anzahl"
            type="number"
            :min="direction === 'adjust' ? 0 : 1"
            :max="direction === 'issue' ? stock.anzahl : undefined"
          />
        </label>
        <label>
          Anmerkung
          <AppTextInput
            v-model="anmerkung"
            type="text"
            placeholder="Optional"
          />
        </label>
      </div>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
    </div>

    <template #footer>
      <AppButton
        variant="secondary"
        @click="close"
      >
        Abbrechen
      </AppButton>
      <AppButton
        :disabled="saving || !canSubmit"
        :loading="saving"
        @click="submit"
      >
        <font-awesome-icon :icon="['fas', 'check']" />
        {{ direction === 'issue' ? 'Entnehmen' : direction === 'return' ? 'Einlagern' : 'Bestand anpassen' }}
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
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';

library.add(faCheck);

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(['update:modelValue', 'updated']);
const stock = computed(() => props.modelValue);
const direction = ref('issue');
const directionOptions = Object.freeze([
  { value: 'issue', label: 'Entnahme' },
  { value: 'return', label: 'Zugabe' },
  { value: 'adjust', label: 'Änderung' },
]);
const mitarbeiterId = ref(null);
const anzahl = ref(1);
const anmerkung = ref('');
const saving = ref(false);
const error = ref('');
const canSubmit = computed(() => {
  const quantity = Number(anzahl.value);
  if (!Number.isInteger(quantity)) return false;
  if (direction.value === 'adjust') return quantity >= 0;
  return quantity > 0 && (direction.value === 'return' || quantity <= stock.value.anzahl);
});
const variantLabel = computed(() => [stock.value.variation, stock.value.groesse !== 'onesize' ? stock.value.groesse : ''].filter(Boolean).join(' · ') || 'Standard');

watch(direction, (newDirection, previousDirection) => {
  if (newDirection === 'adjust') {
    anzahl.value = Number(stock.value.anzahl || 0);
    mitarbeiterId.value = null;
  } else if (previousDirection === 'adjust') {
    anzahl.value = 1;
  }
});

function close() { emit('update:modelValue', null); }

async function submit() {
  saving.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/api/inventory/transactions', {
      locationId: stock.value.locationId,
      mitarbeiterId: mitarbeiterId.value,
      direction: direction.value,
      anmerkung: anmerkung.value,
      lines: [{ stockId: stock.value._id, anzahl: Number(anzahl.value) }],
    });
    emit('updated', data.updatedStocks[0]);
    close();
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Buchung konnte nicht ausgeführt werden.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
:global(.inventory-transaction-modal) { --mf-border: 1px solid var(--border); --mf-radius: 8px; --mf-surface: var(--tile-bg); --mf-body-padding: 18px; --mf-footer-padding: 15px 18px; }
.transaction-body { display: grid; gap: 14px; } .transaction-variant { margin: 0; color: var(--muted); font-size: 0.78rem; }
.available { margin: 0; color: var(--muted); font-size: 0.82rem; } .available b { color: var(--text); }
label { display: grid; gap: 5px; font-size: 0.78rem; font-weight: 600; } label span { color: var(--muted); font-size: 0.72rem; font-weight: 400; } .two-columns { display: grid; grid-template-columns: 100px 1fr; gap: 10px; }
.error { margin: 0; color: var(--status-danger-text); font-size: 0.78rem; }
</style>
