<template>
  <EditMitarbeiterDialog
    :mitarbeiter="mitarbeiter"
    :nationalitaeten="nationalitaeten"
    :saving="saving"
    :conflict-info="conflict"
    @close="close"
    @save="save($event)"
    @save-force="save($event, true)"
    @cancel-conflict="conflict = null"
  />
</template>

<script setup>
import { ref } from 'vue';
import { useCurrentDockedModal } from '@bleck-it/vue-modal-dock';
import EditMitarbeiterDialog from './EditMitarbeiterDialog.vue';
import { useDataCache } from '@/stores/dataCache';
import api from '@/utils/api';

const props = defineProps({
  mitarbeiter: { type: Object, required: true },
  nationalitaeten: { type: Array, default: () => [] },
});
const current = useCurrentDockedModal();
const cache = useDataCache();
const saving = ref(false);
const conflict = ref(null);

function close() {
  if (!saving.value) current.remove();
}

async function save(form, force = false) {
  if (saving.value) return;
  saving.value = true;
  conflict.value = null;
  const fields = ['vorname', 'nachname', 'personalnr', 'email', 'telefon', 'iban',
    'konfektionsgroesse', 'schuhgroesse', 'geburtsname', 'geburtsort', 'nationalitaet',
    'additionalEmails', 'personalnrHistory', 'adresse', 'adresse2', 'vorarbeitgebertage',
    'fuehrerscheine'];
  const payload = Object.fromEntries(fields.map(field => [field, form[field]]));
  if (Array.isArray(payload.fuehrerscheine)) {
    payload.fuehrerscheine = payload.fuehrerscheine.map((license) => ({
      ...license,
      source: license.source === 'import' ? 'import' : 'manual',
    }));
  }
  payload.geburtsdatum = form.geburtsdatum || null;
  if (force) payload.forcePersonalnr = true;
  try {
    const { data } = await api.patch(`/api/personal/mitarbeiter/${props.mitarbeiter._id}`, payload);
    if (!data?.success) throw new Error(data?.message || 'Fehler beim Speichern');
    Object.assign(props.mitarbeiter, data.data);
    cache.updateOneMitarbeiter(data.data);
    current.remove();
  } catch (error) {
    if (!force && error.response?.status === 409 && error.response.data?.conflict) {
      conflict.value = error.response.data.conflict;
    } else {
      alert(`Fehler beim Speichern: ${error.response?.data?.message || error.message}`);
    }
  } finally {
    saving.value = false;
  }
}
</script>