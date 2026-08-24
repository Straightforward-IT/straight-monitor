<template>
  <ModalFrame layer="elevated" style="--mf-max-width: 680px; --mf-body-padding: 20px" @close="emit('close')">
    <template #header>
      <h3 class="form-title">{{ isEditing ? 'Einsatzort bearbeiten' : 'Einsatzort anlegen' }}</h3>
    </template>

    <form id="einsatzort-form" class="form" @submit.prevent="save">
      <div class="form-grid">
        <label class="form-field form-field--wide">
          <span>Bezeichnung <strong>*</strong></span>
          <input ref="nameInput" v-model="form.bezeichnung" required />
        </label>
        <label class="form-field form-field--wide">
          <span>Adressname</span>
          <input v-model="form.adressName" />
        </label>
        <label class="form-field form-field--wide">
          <span>Straße</span>
          <input v-model="form.strasse" autocomplete="street-address" />
        </label>
        <label class="form-field">
          <span>PLZ</span>
          <input v-model="form.plz" autocomplete="postal-code" />
        </label>
        <label class="form-field">
          <span>Ort</span>
          <input v-model="form.ort" autocomplete="address-level2" />
        </label>
        <label class="form-field">
          <span>Bundesland</span>
          <input v-model="form.bundesland" />
        </label>
        <label class="form-field">
          <span>Land</span>
          <input v-model="form.land" autocomplete="country-name" />
        </label>
      </div>
      <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
    </form>

    <template #footer>
      <button class="btn-secondary" type="button" :disabled="saving" @click="emit('close')">Abbrechen</button>
      <button class="btn-primary" type="submit" form="einsatzort-form" :disabled="saving || !form.bezeichnung.trim()">
        {{ saving ? 'Wird gespeichert...' : 'Speichern' }}
      </button>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import api from '@/utils/api';

const props = defineProps({
  kundenNr: { type: [String, Number], required: true },
  einsatzort: { type: Object, default: null },
});
const emit = defineEmits(['close', 'saved']);
const isEditing = computed(() => Boolean(props.einsatzort?._id));
const saving = ref(false);
const errorMessage = ref('');
const nameInput = ref(null);
const address = props.einsatzort?.adresse || {};
const form = reactive({
  bezeichnung: props.einsatzort?.bezeichnung || '',
  adressName: address.name || '',
  strasse: address.strasse || '',
  plz: address.plz || '',
  ort: address.ort || '',
  bundesland: props.einsatzort?.bundesland || '',
  land: address.land || 'Deutschland',
});

onMounted(() => nextTick(() => nameInput.value?.focus()));

async function save() {
  if (!form.bezeichnung.trim() || saving.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const baseUrl = `/api/kunden/${props.kundenNr}/einsatzorte`;
    const { data } = isEditing.value
      ? await api.patch(`${baseUrl}/${props.einsatzort._id}`, form)
      : await api.post(baseUrl, form);
    emit('saved', data.einsatzort);
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Der Einsatzort konnte nicht gespeichert werden.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.form-title { margin: 0; color: var(--text); font-size: 16px; font-weight: 600; }
.form { display: flex; flex-direction: column; gap: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.form-field { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.form-field--wide { grid-column: 1 / -1; }
.form-field > span { color: var(--muted); font-size: 12px; font-weight: 600; }
.form-field strong { color: var(--primary); }
.form-field input, .form-field select { box-sizing: border-box; width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; outline: none; background: var(--surface); color: var(--text); font: inherit; font-size: 13px; }
.form-field input:focus, .form-field select:focus { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent); }
.form-error { margin: 0; color: #dc3545; font-size: 12px; }
.btn-secondary, .btn-primary { min-height: 36px; padding: 8px 14px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; }
.btn-secondary { border: 1px solid var(--border); background: transparent; color: var(--text); }
.btn-primary { border: 1px solid var(--primary); background: var(--primary); color: #fff; }
.btn-secondary:disabled, .btn-primary:disabled { cursor: not-allowed; opacity: 0.55; }
@media (max-width: 560px) { .form-grid { grid-template-columns: 1fr; } .form-field--wide { grid-column: auto; } }
</style>