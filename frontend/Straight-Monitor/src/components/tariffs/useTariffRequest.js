import { inject, onBeforeUnmount, ref, shallowRef } from 'vue';

export const TARIFF_ACCESS_DENIED = Symbol('tariff-access-denied');

export function tariffError(error) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Die Anfrage konnte nicht abgeschlossen werden.';
}

// Both abort and a revision guard are necessary when a response has already arrived.
export function useTariffRequest() {
  const denyAccess = inject(TARIFF_ACCESS_DENIED, null);
  const data = shallowRef(null);
  const loading = ref(false);
  const error = ref('');
  let revision = 0;
  let controller;

  function cancel() {
    revision += 1;
    controller?.abort();
    controller = null;
    loading.value = false;
  }

  function clear() {
    cancel();
    data.value = null;
    error.value = '';
  }

  async function run(request) {
    clear();
    const current = revision;
    controller = new AbortController();
    loading.value = true;
    try {
      const response = await request(controller.signal);
      if (current !== revision) return null;
      data.value = response.data;
      return response.data;
    } catch (cause) {
      if (current === revision && cause?.code !== 'ERR_CANCELED' && cause?.name !== 'AbortError') {
        error.value = tariffError(cause);
        if ([401, 403].includes(cause?.response?.status)) denyAccess?.(error.value);
      }
      return null;
    } finally {
      if (current === revision) loading.value = false;
    }
  }

  onBeforeUnmount(cancel);
  return { data, loading, error, run, clear, cancel };
}
