import { computed, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import api from '@/utils/api';
import { preparationInput } from '@/utils/payrollPreparation';

export function usePayrollPreparation(employeeId, month) {
  const state = ref(null), items = ref([]), saved = ref('[]'), busy = ref(false), error = ref(''), notice = ref('');
  const reason = ref(''), reconcile = ref(false), review = ref(null), mapping = ref(null), mappingDirty = ref(false), formDirty = ref(false);
  let sequence = 0;
  const dirty = computed(() => JSON.stringify(items.value) !== saved.value || mappingDirty.value || formDirty.value);
  const base = () => `/api/payroll/employees/${employeeId.value}`;
  const monthUrl = () => `${base()}/months/${month.value}`;
  function accept(value) {
    state.value = value;
    items.value = value.items.map(preparationInput);
    saved.value = JSON.stringify(items.value);
    reconcile.value = false; review.value = null; formDirty.value = false;
  }
  async function load() {
    const token = ++sequence, url = monthUrl();
    state.value = null; mapping.value = null; review.value = null; error.value = ''; notice.value = '';
    items.value = []; saved.value = '[]'; reason.value = ''; reconcile.value = false; mappingDirty.value = false; formDirty.value = false;
    if (!employeeId.value) return;
    try {
      const response = await api.get(url);
      if (token !== sequence) return;
      accept(response.data);
    } catch (failure) { if (token === sequence) error.value = failure?.response?.data?.message || 'Vorbereitung konnte nicht geladen werden.'; }
  }
  async function act(action = 'save') {
    if (busy.value || !state.value) return;
    busy.value = true; error.value = ''; notice.value = '';
    const url = monthUrl();
    const payload = { revision: state.value.revision, sourceHash: state.value.sourceHash, reason: reason.value,
      ...(action === 'save' ? { items: items.value.map(preparationInput), reconcile: reconcile.value } : {}) };
    try {
      const response = action === 'save' ? await api.put(url, payload) : await api.post(`${url}/${action}`, payload);
      accept(response.data); notice.value = action === 'save' ? 'Vorbereitung gespeichert.' : action === 'finalize' ? 'Monat intern geprüft und eingefroren.' : 'Neue Entwurfsrevision geöffnet.';
    } catch (failure) { error.value = failure?.response?.data?.message || 'Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten.'; }
    finally { busy.value = false; }
  }
  async function loadPreview(id) {
    error.value = ''; busy.value = true;
    try { review.value = (await api.get(`${base()}/snapshots/${id}/preview`)).data; }
    catch (failure) { error.value = failure?.response?.data?.message || 'Vorschau konnte nicht geladen werden.'; }
    finally { busy.value = false; }
  }
  async function loadMapping() {
    error.value = ''; busy.value = true;
    try { mapping.value = (await api.get(`${base()}/lodas-mapping`)).data; mappingDirty.value = false; }
    catch (failure) { error.value = failure?.response?.data?.message || 'Zuordnungen konnten nicht geladen werden.'; }
    finally { busy.value = false; }
  }
  async function saveMapping(config) {
    if (busy.value) return;
    busy.value = true; error.value = '';
    try {
      mapping.value = (await api.put(`${base()}/lodas-mapping`, { version: mapping.value.version, config })).data;
      mappingDirty.value = false; review.value = null; notice.value = 'LODAS-Zuordnung als neue Version gespeichert.';
    } catch (failure) { error.value = failure?.response?.data?.message || 'Zuordnung konnte nicht gespeichert werden.'; }
    finally { busy.value = false; }
  }
  function confirmDiscard() {
    if (busy.value) return false;
    return !dirty.value || window.confirm('Ungespeicherte Vorbereitung verwerfen?');
  }
  onBeforeRouteLeave(confirmDiscard);
  onBeforeRouteUpdate((to, from) => {
    if (String(to.query.employeeId || '') === String(from.query.employeeId || '') && String(to.query.month || '') === String(from.query.month || '')) return true;
    return confirmDiscard();
  });
  return { state, items, busy, error, notice, reason, reconcile, review, mapping, mappingDirty, formDirty, dirty, load, act, loadPreview, loadMapping, saveMapping, confirmDiscard };
}
