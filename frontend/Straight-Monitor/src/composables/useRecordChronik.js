import { computed, ref, unref, watch } from 'vue';
import api from '@/utils/api';

/**
 * Shared comment-backed history for a selected record. Domain workspaces may
 * append normalized, read-only timeline items (for example future activities).
 */
export function useRecordChronik({ recordId, scope, resourceType, currentUserId }) {
  const entries = ref([]);
  const loading = ref(false);
  const draft = ref('');
  const adding = ref(false);
  let requestVersion = 0;

  function resolveId(source) {
    const value = unref(typeof source === 'function' ? source() : source);
    const candidate = value && typeof value === 'object' ? unref(value._id ?? value.id) : value;
    return candidate === undefined || candidate === null || candidate === '' ? null : String(candidate);
  }

  const selectedId = computed(() => resolveId(recordId));
  const userId = computed(() => resolveId(currentUserId));

  function clear() {
    requestVersion += 1;
    entries.value = [];
    draft.value = '';
    loading.value = false;
  }

  async function load(id = selectedId.value) {
    if (!id) return clear();
    const version = ++requestVersion;
    loading.value = true;
    entries.value = [];
    try {
      const { data } = await api.get('/api/comments', { params: { scope, resourceId: id } });
      if (version === requestVersion) entries.value = Array.isArray(data) ? data : [];
    } catch (error) {
      if (version === requestVersion) console.error('Chronik laden fehlgeschlagen', error);
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  async function add({ text = draft.value, isSystem = false, id = selectedId.value } = {}) {
    if (!id || !text?.trim()) return null;
    adding.value = true;
    try {
      const { data } = await api.post('/api/comments', {
        scope,
        text: text.trim(),
        isSystem,
        context: { resourceId: id, resourceType },
      });
      if (id === selectedId.value) entries.value.push(data);
      if (!isSystem) draft.value = '';
      return data;
    } catch (error) {
      console.error('Chronik-Eintrag fehlgeschlagen', error);
      return null;
    } finally {
      adding.value = false;
    }
  }

  async function remove(entryId) {
    try {
      await api.delete(`/api/comments/${entryId}`);
      entries.value = entries.value.filter((entry) => entry._id !== entryId);
    } catch (error) {
      console.error('Chronik-Eintrag löschen fehlgeschlagen', error);
    }
  }

  function canDelete(entry) {
    return !!userId.value && String(entry.authorId) === String(userId.value);
  }

  watch(selectedId, (id) => { if (id) load(id); else clear(); }, { immediate: true });

  return { entries, loading, draft, adding, load, add, remove, clear, canDelete };
}
