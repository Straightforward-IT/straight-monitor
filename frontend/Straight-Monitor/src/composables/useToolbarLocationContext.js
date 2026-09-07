import { inject } from 'vue';

export const toolbarLocationContextKey = Symbol('toolbarLocationContext');

export function useToolbarLocationContext() {
  return inject(toolbarLocationContextKey, null);
}