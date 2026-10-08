import { reactive, onScopeDispose } from 'vue';
import api from '@/utils/api';

/** Per-workspace cache. Both employee surfaces use the same dated API and view. */
export function useEmployeeContingents({ cacheMs = 60000 } = {}) {
  const entries = reactive({});
  const pending = new Map();
  let sequence = 0;
  const keyFor = (id, period) => `${id}:${period.year}:${period.month}`;
  const placeholder = employee => ({ type: 'notice', title: 'Tarifkontingent',
    employeeName: [employee?.vorname, employee?.nachname].filter(Boolean).join(' ') });

  function dataFor(employee, period) {
    return entries[keyFor(employee?._id, period)]?.data || placeholder(employee);
  }
  function isLoading(employee, period) {
    return Boolean(entries[keyFor(employee?._id, period)]?.loading);
  }
  function load(employeeId, period, { force = false } = {}) {
    if (!employeeId) return Promise.resolve(null);
    const key = keyFor(employeeId, period);
    if (!force && pending.has(key)) return pending.get(key).promise;
    const cached = entries[key];
    if (!force && cached?.data && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
    pending.get(key)?.controller.abort();
    const controller = new AbortController();
    const requestId = ++sequence;
    entries[key] = { data: cached?.data || null, loading: true, requestId, expiresAt: 0 };
    const current = () => !controller.signal.aborted && entries[key]?.requestId === requestId;
    const promise = Promise.resolve().then(async () => {
      try {
        const { data } = await api.get(`/api/personal/${employeeId}/analytics/contingent`, {
          params: { year: period.year, month: period.month }, signal: controller.signal,
        });
        if (!current()) return null;
        entries[key].data = data;
        entries[key].expiresAt = Date.now() + cacheMs;
        return data;
      } catch (error) {
        if (!current()) return null;
        const data = { type: 'notice', title: 'Tarifkontingent', issues: [{ code: 'LOAD_FAILED',
          message: error.response?.data?.message || 'Die Kontingentdaten konnten nicht geladen werden. Bitte die Karte erneut öffnen.' }] };
        entries[key].data = data;
        return data;
      } finally {
        if (current()) entries[key].loading = false;
        if (pending.get(key)?.requestId === requestId) pending.delete(key);
      }
    });
    pending.set(key, { promise, controller, requestId });
    return promise;
  }
  function clear() {
    for (const request of pending.values()) request.controller.abort();
    pending.clear();
    for (const key of Object.keys(entries)) delete entries[key];
  }
  onScopeDispose(clear);
  return { dataFor, isLoading, load, clear };
}
