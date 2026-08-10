<template>
  <Teleport to="body">
    <div class="backdrop" @mousedown.self="close">
      <section class="dialog" role="dialog" aria-modal="true" aria-label="Bestand buchen">
        <header>
          <div>
            <p>{{ stock.standort }}</p>
            <h3>{{ stock.bezeichnung }}</h3>
            <span>{{ [stock.variation, stock.groesse !== 'onesize' ? stock.groesse : ''].filter(Boolean).join(' · ') || 'Standard' }}</span>
          </div>
          <button type="button" class="icon-button" title="Schließen" @click="close"><font-awesome-icon :icon="['fas', 'xmark']" /></button>
        </header>

        <div class="body">
          <div class="mode-switch">
            <button type="button" :class="{ active: direction === 'issue' }" @click="direction = 'issue'">Entnahme</button>
            <button type="button" :class="{ active: direction === 'return' }" @click="direction = 'return'">Rückgabe</button>
          </div>
          <p class="available">Aktueller Bestand: <b>{{ stock.anzahl }}</b> / {{ stock.soll }}</p>
          <label>Mitarbeiter <span>(optional)</span><MitarbeiterSearch v-model="mitarbeiterId" include-inactive /></label>
          <div class="two-columns">
            <label>Menge<input v-model.number="anzahl" type="number" min="1" :max="direction === 'issue' ? stock.anzahl : undefined" /></label>
            <label>Anmerkung<input v-model="anmerkung" type="text" placeholder="Optional" /></label>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
        </div>

        <footer>
          <button type="button" class="secondary" @click="close">Abbrechen</button>
          <button type="button" class="primary" :disabled="saving || !canSubmit" @click="submit">
            <font-awesome-icon :icon="['fas', saving ? 'spinner' : 'check']" :spin="saving" />
            {{ direction === 'issue' ? 'Entnehmen' : 'Zurücknehmen' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';

library.add(faCheck, faSpinner, faXmark);

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(['update:modelValue', 'updated']);
const stock = computed(() => props.modelValue);
const direction = ref('issue');
const mitarbeiterId = ref(null);
const anzahl = ref(1);
const anmerkung = ref('');
const saving = ref(false);
const error = ref('');
const canSubmit = computed(() => Number.isInteger(Number(anzahl.value)) && Number(anzahl.value) > 0 && (direction.value === 'return' || Number(anzahl.value) <= stock.value.anzahl));

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
.backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 18px; background: var(--overlay); }
.dialog { width: min(440px, 100%); overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); color: var(--text); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2); }
header, footer { display: flex; align-items: start; justify-content: space-between; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); } header p, header h3, header span { margin: 0; } header p { color: var(--primary); font-size: 0.72rem; font-weight: 700; } header h3 { font-size: 1.05rem; margin: 3px 0; } header span { color: var(--muted); font-size: 0.78rem; }
.body { padding: 18px; display: grid; gap: 14px; } .mode-switch { display: grid; grid-template-columns: 1fr 1fr; padding: 3px; gap: 3px; border-radius: 7px; background: var(--hover); } .mode-switch button { background: transparent; color: var(--muted); } .mode-switch button.active { background: var(--tile-bg); color: var(--primary); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.available { margin: 0; color: var(--muted); font-size: 0.82rem; } .available b { color: var(--text); }
label { display: grid; gap: 5px; font-size: 0.78rem; font-weight: 600; } label span { color: var(--muted); font-size: 0.72rem; font-weight: 400; } input { min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 8px 9px; background: var(--surface, var(--tile-bg)); color: var(--text); font: inherit; } input:focus { border-color: var(--primary); outline: none; } .two-columns { display: grid; grid-template-columns: 100px 1fr; gap: 10px; }
footer { align-items: center; justify-content: end; border-bottom: none; border-top: 1px solid var(--border); } button { border: none; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 600; padding: 8px 12px; } .icon-button, .secondary { background: transparent; border: 1px solid var(--border); color: var(--text); } .primary { background: var(--primary); color: #fff; } button:disabled { cursor: not-allowed; opacity: 0.55; } .error { margin: 0; color: #c3423f; font-size: 0.78rem; }
</style>