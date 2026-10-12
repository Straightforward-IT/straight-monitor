import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import DatenImport from '@/components/DatenImport.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  cache: { invalidateCache: vi.fn() },
  auth: { user: { roles: ['ADMIN'] } },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

let wrapper;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { user: { roles: ['ADMIN'] } };
  mocks.api.get.mockResolvedValue({ data: { success: true, data: {} } });
});

it('keeps the standalone hours importer hidden and makes no hours import requests for non-admins', async () => {
  mocks.auth.user.roles = ['PAYROLL'];
  wrapper = mount(DatenImport, {
    global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  expect(wrapper.findComponent({ name: 'ZvooveHoursImport' }).exists()).toBe(false);
  expect(wrapper.find('input[aria-label="Monatliche Lohndaten: Datei auswählen"]').exists()).toBe(false);
  expect(mocks.api.get.mock.calls.some(([url]) => url.startsWith('/api/payroll/imports'))).toBe(false);
});

it('uploads monthly payroll data without a Prüffeld and refreshes employee data and history', async () => {
  wrapper = mount(DatenImport, { global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } } });
  await flushPromises();
  const file = new File(['LGELENA'], 'Lohndaten.xlsx');
  mocks.api.post.mockResolvedValueOnce({ data: { success: true, message: 'Monatsdaten importiert', details: { matched: 2 } } });
  await wrapper.vm.setFile(file, 'monatliche-lohndaten');
  expect(wrapper.vm.hasAnyFile()).toBeTruthy();
  vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
  await wrapper.vm.processFiles();
  expect(mocks.api.post.mock.calls[0][0]).toBe('/api/import/monatliche-lohndaten');
  expect(mocks.api.post.mock.calls[0][1].get('file')).toBe(file);
  expect(mocks.cache.invalidateCache).toHaveBeenCalledWith('mitarbeiter');
  expect(wrapper.vm.monatlicheLohndatenFile).toBeNull();
  expect(wrapper.vm.getLabel('monatliche-lohndaten')).toBe('Monatliche Lohndaten');
});
afterEach(() => {
  vi.restoreAllMocks();
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
  expect(wrapper.findAll('.app-file-dropzone')).toHaveLength(17);
  expect(wrapper.findAll('.app-file-dropzone').every(zone => zone.element.tagName === 'LABEL')).toBe(true);
  expect(wrapper.find('.app-file-dropzone button').exists()).toBe(false);
  expect(wrapper.text()).toContain('Zvoove Export hier ablegen');
  expect(wrapper.find('.actions-bar button.app-button--primary').element.disabled).toBe(true);

  const fileInput = wrapper.find('input[aria-label="Berufe: Datei auswählen"]');
  const file = new File(['test'], 'berufe.xlsx');
  Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [file] });
  await fileInput.trigger('change');
  await flushPromises();
  expect(wrapper.find('.actions-bar button.app-button--primary').element.disabled).toBe(false);
  expect(wrapper.findComponent({ name: 'ZvooveHoursImport' }).find('button.app-button--primary').element.disabled).toBe(true);

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
