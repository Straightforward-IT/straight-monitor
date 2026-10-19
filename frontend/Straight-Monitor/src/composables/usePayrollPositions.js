import { onBeforeUnmount, ref } from 'vue';
import api from '@/utils/api';

export function usePayrollPositions(enabled) {
  const data = ref(null), loading = ref(false), error = ref('');
  let generation = 0, controller;
  function clear() { generation++; controller?.abort(); data.value = null; error.value = ''; loading.value = false; }
  async function load(employeeId, month) {
    clear();
    if (!enabled.value || !employeeId) return;
    const current = generation; controller = new AbortController(); loading.value = true;
    try {
      const response = await api.get(`/api/payroll/employees/${encodeURIComponent(employeeId)}/positions`, { params: { month }, signal: controller.signal });
      if (current !== generation || !enabled.value) return;
      if (!Array.isArray(response.data?.rows)) throw new Error('Positionen fehlen.');
      data.value = response.data;
    } catch (cause) {
      if (current === generation) { data.value = null; error.value = cause?.response?.data?.message || 'Eigene Berechnungspositionen konnten nicht geladen werden.'; }
    } finally { if (current === generation) loading.value = false; }
  }
  onBeforeUnmount(clear);
  return { data, loading, error, load, clear };
}
