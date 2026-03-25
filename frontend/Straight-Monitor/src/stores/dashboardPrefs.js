/**
 * Dashboard Preferences Store
 *
 * Manages per-user widget selection & ordering.
 * Source of truth priority: Backend (User.dashboardPrefs) → localStorage → defaults.
 *
 * On every change the preferences are persisted to localStorage immediately and
 * synced to the backend with a short debounce so rapid toggles/moves result in
 * only one PUT request.
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { WIDGET_DEFINITIONS } from "@/components/widgets/widgetRegistry";
import api from "@/utils/api";

const STORAGE_PREFIX = "dashboard_widgets_";
const SYNC_DEBOUNCE_MS = 800;

export const useDashboardPrefs = defineStore("dashboardPrefs", () => {
  /* ── state ─────────────────────────────────────────── */
  const userId = ref("default");
  const widgetOrder = ref([]); // [{ id, visible }]  – order = display order
  const loaded = ref(false);

  /* ── private helpers ───────────────────────────────── */
  const _key = () => `${STORAGE_PREFIX}${userId.value}`;

  const _defaults = () =>
    WIDGET_DEFINITIONS.map((w) => ({
      id: w.id,
      visible: w.defaultVisible !== false,
    }));

  /** Merge a saved array with the current registry (adds new widgets, removes deleted ones) */
  function _merge(saved) {
    const savedIds = new Set(saved.map((s) => s.id));
    const registryIds = new Set(WIDGET_DEFINITIONS.map((d) => d.id));
    const merged = saved.filter((w) => registryIds.has(w.id));
    for (const def of WIDGET_DEFINITIONS) {
      if (!savedIds.has(def.id)) {
        merged.push({ id: def.id, visible: def.defaultVisible !== false });
      }
    }
    return merged;
  }

  /** Persist to localStorage */
  function _saveLocalStorage() {
    try {
      localStorage.setItem(_key(), JSON.stringify(widgetOrder.value));
    } catch {
      /* quota exceeded – silently ignore */
    }
  }

  /* Debounced backend sync */
  let _syncTimer = null;
  function _syncToBackend() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        await api.put("/api/users/me/dashboard-prefs", { prefs: widgetOrder.value });
      } catch {
        /* silently ignore – localStorage is the fallback */
      }
    }, SYNC_DEBOUNCE_MS);
  }

  function _save() {
    _saveLocalStorage();
    _syncToBackend();
  }

  /* ── actions ───────────────────────────────────────── */

  /**
   * Load preferences. Call after the user object is available.
   *
   * @param {string} [id]           – user._id
   * @param {Array|null} [backendPrefs] – value of User.dashboardPrefs from /api/users/me
   *                                     Pass it here to avoid a second HTTP request.
   */
  function load(id, backendPrefs) {
    if (id) userId.value = id;

    // 1. Backend prefs (most authoritative – survive device switches)
    if (Array.isArray(backendPrefs) && backendPrefs.length > 0) {
      widgetOrder.value = _merge(backendPrefs);
      _saveLocalStorage(); // keep localStorage in sync
      loaded.value = true;
      return;
    }

    // 2. localStorage fallback
    try {
      const raw = localStorage.getItem(_key());
      if (raw) {
        widgetOrder.value = _merge(JSON.parse(raw));
      } else {
        widgetOrder.value = _defaults();
      }
    } catch {
      widgetOrder.value = _defaults();
    }

    loaded.value = true;
  }

  /** Toggle visibility of a single widget */
  function setVisible(id, visible) {
    const item = widgetOrder.value.find((w) => w.id === id);
    if (item) {
      item.visible = visible;
      _save();
    }
  }

  /**
   * Move a widget up (direction = -1) or down (direction = +1).
   */
  function moveWidget(id, direction) {
    const idx = widgetOrder.value.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= widgetOrder.value.length) return;

    const arr = [...widgetOrder.value];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    widgetOrder.value = arr;
    _save();
  }

  /**
   * Move a widget from one index to another (drag-and-drop).
   */
  function reorderWidget(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const arr = [...widgetOrder.value];
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, item);
    widgetOrder.value = arr;
    _save();
  }

  /** Reset to factory defaults */
  function resetToDefaults() {
    widgetOrder.value = _defaults();
    _save();
  }

  /* ── getters ───────────────────────────────────────── */

  /** Visible widgets enriched with their component & metadata from the registry */
  const activeWidgets = computed(() =>
    widgetOrder.value
      .filter((w) => w.visible)
      .map((w) => {
        const def = WIDGET_DEFINITIONS.find((d) => d.id === w.id);
        return def ? { ...w, ...def } : null;
      })
      .filter(Boolean)
  );

  return {
    widgetOrder,
    activeWidgets,
    loaded,
    load,
    setVisible,
    moveWidget,
    reorderWidget,
    resetToDefaults,
  };
});
