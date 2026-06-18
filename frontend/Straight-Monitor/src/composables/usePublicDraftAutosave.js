import { onBeforeUnmount } from 'vue';

const SAVE_DELAY = 2200; // Erst nach 2,2 Sekunden Inaktivität speichern
const SAVING_ANIMATION_MS = 1200;

export function usePublicDraftAutosave(emit, options = {}) {
  let saveTimer = null;
  let savedTimer = null;
  let restoring = false;
  let currentStatus = 'hidden';

  function setStatus(status) {
    currentStatus = status;
    emit('draft-status', status);
  }

  function storageGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function storageSet(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
      return true;
    } catch {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  }

  function clearTimers() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (savedTimer) {
      clearTimeout(savedTimer);
      savedTimer = null;
    }
  }

  function markSaved() {
    setStatus('saved');
    if (savedTimer) clearTimeout(savedTimer);
    // Status bleibt 'saved', bis der User wieder etwas eintippt
  }

  function saveNow(key, data) {
    if (!key || restoring) return false;
    if (savedTimer) {
      clearTimeout(savedTimer);
      savedTimer = null;
    }
    setStatus('saving');

    const didSave = storageSet(key, data);
    setTimeout(() => {
      if (didSave) markSaved();
      else setStatus('hidden');
    }, SAVING_ANIMATION_MS);
    return didSave;
  }

  function scheduleSave(key, data) {
    if (!key || restoring) return;
    if (saveTimer) clearTimeout(saveTimer);
    // Wenn User wieder tippt während 'saved' Status, zurück auf 'hidden'
    if (currentStatus === 'saved') {
      setStatus('hidden');
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow(key, data);
    }, options.delay ?? SAVE_DELAY);
  }

  function restore(fn) {
    restoring = true;
    try {
      const result = fn();
      if (result && typeof result.finally === 'function') {
        return result.finally(() => {
          restoring = false;
        });
      }
      restoring = false;
      return result;
    } catch (err) {
      restoring = false;
      throw err;
    }
  }

  function resetStatus() {
    clearTimers();
    currentStatus = 'hidden';
    setStatus('hidden');
  }

  onBeforeUnmount(resetStatus);

  return {
    storageGet,
    storageRemove,
    storageSet,
    scheduleSave,
    saveNow,
    restore,
    resetStatus
  };
}