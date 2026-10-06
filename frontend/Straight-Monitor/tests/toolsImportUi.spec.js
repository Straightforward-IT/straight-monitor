import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import DatenImport from '@/components/DatenImport.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  cache: { invalidateCache: vi.fn() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { roles: ['ADMIN'] } }) }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

let wrapper;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.get.mockResolvedValue({ data: { success: true, data: {} } });
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

it('uses one file control per import type and a shared result dialog without importing', async () => {
  wrapper = mount(DatenImport, {
    attachTo: document.body,
    global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  expect(wrapper.find('h1').text()).toBe('Daten Import');
  expect(wrapper.findAll('.app-file-dropzone')).toHaveLength(15);
  expect(wrapper.findAll('.app-file-dropzone').every(zone => zone.element.tagName === 'LABEL')).toBe(true);
  expect(wrapper.find('.app-file-dropzone button').exists()).toBe(false);
  expect(wrapper.text()).toContain('Zvoove Export hier ablegen');
  expect(wrapper.find('button.app-button--primary').element.disabled).toBe(true);

  const fileInput = wrapper.find('input[aria-label="Berufe: Datei auswählen"]');
  const file = new File(['test'], 'berufe.xlsx');
  Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [file] });
  await fileInput.trigger('change');
  await flushPromises();
  expect(wrapper.find('button.app-button--primary').element.disabled).toBe(false);

  wrapper.vm.resultModalData = { success: true, message: 'Import abgeschlossen', details: {
    notFoundEntries: [{ email: 'ada@example.com', personalnr: '12' }],
  } };
  wrapper.vm.showResultModal = true;
  await flushPromises();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Import-Ergebnis');
  [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Mitarbeiter suchen')).click();
  wrapper.vm.searchResults = [{ _id: 'ma-1', vorname: 'Ada', nachname: 'Lovelace', email: 'ada@example.com', isActive: true }];
  await flushPromises();
  expect(dialog.querySelector('button.search-result-item')?.textContent).toContain('Ada Lovelace');
  expect(mocks.api.post).not.toHaveBeenCalled();
});
