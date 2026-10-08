<template>
  <EditMitarbeiterDialog
    :mitarbeiter="mitarbeiter"
    :nationalitaeten="nationalitaeten"
    :saving="saving"
    :can-edit-personalnr-history="isAdmin"
    :history-saving="historySaving"
    :conflict-info="conflict"
    @close="close"
    @save="save($event)"
    @save-force="save($event, true)"
    @cancel-conflict="conflict = null"
    @add-personalnr-history="addPersonalnrHistory"
    @remove-personalnr-history="removePersonalnrHistory"
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import { useCurrentDockedModal } from '@bleck-it/vue-modal-dock';
import EditMitarbeiterDialog from './EditMitarbeiterDialog.vue';
import { useDataCache } from '@/stores/dataCache';
import { useAuth } from '@/stores/auth';
import api from '@/utils/api';

const props = defineProps({
  mitarbeiter: { type: Object, required: true },
  nationalitaeten: { type: Array, default: () => [] },
});
const current = useCurrentDockedModal();
const cache = useDataCache();
const auth = useAuth();
const saving = ref(false);
const historySaving = ref(false);
const conflict = ref(null);
const isAdmin = computed(() => auth.user?.roles?.includes('ADMIN') || auth.user?.role === 'ADMIN');

function close() {
  if (!saving.value) current.remove();
}

async function save(form, force = false) {
  if (saving.value) return;
  saving.value = true;
  conflict.value = null;
  const fields = ['vorname', 'nachname', 'personalnr', 'email', 'telefon', 'iban',
    'konfektionsgroesse', 'schuhgroesse', 'geburtsname', 'geburtsort', 'nationalitaet',
    'additionalEmails', 'adresse', 'adresse2', 'vorarbeitgebertage',
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

async function addPersonalnrHistory(value) {
  if (historySaving.value) return;
  historySaving.value = true;
  try {
    const { data } = await api.post(
      `/api/personal/mitarbeiter/${props.mitarbeiter._id}/personalnr-history`,
      { value },
    );
    if (!data?.success) throw new Error(data?.message || 'Historieneintrag konnte nicht hinzugefügt werden.');
    Object.assign(props.mitarbeiter, data.data);
    cache.updateOneMitarbeiter(data.data);
  } catch (error) {
    alert(`Historieneintrag konnte nicht hinzugefügt werden: ${error.response?.data?.message || error.message}`);
  } finally {
    historySaving.value = false;
  }
}

async function removePersonalnrHistory(historyId) {
  if (historySaving.value) return;
  historySaving.value = true;
  try {
    const { data } = await api.delete(
      `/api/personal/mitarbeiter/${props.mitarbeiter._id}/personalnr-history/${historyId}`,
    );
    if (!data?.success) throw new Error(data?.message || 'Historieneintrag konnte nicht entfernt werden.');
    Object.assign(props.mitarbeiter, data.data);
    cache.updateOneMitarbeiter(data.data);
  } catch (error) {
    alert(`Historieneintrag konnte nicht entfernt werden: ${error.response?.data?.message || error.message}`);
  } finally {
    historySaving.value = false;
  }
}
</script>