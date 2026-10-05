import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import DocumentsOverviewTab from '../src/components/DocumentsOverviewTab.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  loadDocuments: vi.fn(),
  openDocument: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/utils/api', () => ({ default: { get: mocks.get, defaults: { headers: { common: {} } } } }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => ({
  auftraege: [],
  loadDocuments: mocks.loadDocuments,
  loadAuftraege: vi.fn(),
}) }));
vi.mock('@/composables/useDocumentModals', () => ({ useDocumentModals: () => ({
  dockedModals: { remove: vi.fn() },
  openDocument: mocks.openDocument,
}) }));

const document = {
  _id: 'doc-1',
  docType: 'Laufzettel',
  version: 'v2',
  bezeichnung: 'Probeauftrag',
  datum: '2026-10-01',
  status: 'Offen',
  details: { name_teamleiter: 'Ada Test', teamleiter: 'employee-1' },
};

let wrapper;
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  mocks.get.mockResolvedValue({ data: [] });
  mocks.loadDocuments.mockResolvedValue([document]);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.resetAllMocks();
});

describe('document overview shared actions', () => {
  it('opens a document from its title without coupling the person actions to row opening', async () => {
    wrapper = shallowMount(DocumentsOverviewTab, {
      global: {
        mocks: { $route: { query: {} }, $router: { push: mocks.push, replace: mocks.replace } },
        stubs: { Toolbar: { template: '<div><slot/><slot name="bottom-actions"/></div>' }, AppButton: false, AppIconButton: false, EmployeeCardModal: true, 'font-awesome-icon': true },
      },
    });
    await vi.waitFor(() => expect(wrapper.find('.document-title-button').exists()).toBe(true));
    expect(wrapper.get('.btn-nachpflege').classes()).toContain('app-button');
    expect(wrapper.get('.document-title-button').attributes('aria-label')).toBe('Probeauftrag öffnen');
    expect(wrapper.get('button[aria-label="Nach Ada Test filtern"]').classes()).toContain('app-button');

    await wrapper.get('button[aria-label="Nach Ada Test filtern"]').trigger('click');
    expect(wrapper.vm.filteredTeamleiter).toBe('Ada Test');
    expect(mocks.openDocument).not.toHaveBeenCalled();

    await wrapper.get('.document-title-button').trigger('click');
    expect(mocks.openDocument).toHaveBeenCalledWith(document, expect.objectContaining({ filteredTeamleiter: 'Ada Test' }));
    expect(mocks.replace).toHaveBeenCalledWith({ query: { docId: 'doc-1' } });
  });

  it('keeps sorting and the quick-action menu keyboard-operable buttons', async () => {
    wrapper = shallowMount(DocumentsOverviewTab, {
      global: {
        mocks: { $route: { query: {} }, $router: { push: mocks.push, replace: mocks.replace } },
        stubs: { Toolbar: { template: '<div><slot/><slot name="bottom-actions"/></div>' }, AppButton: false, AppIconButton: false, EmployeeCardModal: true, 'font-awesome-icon': true },
      },
    });
    await vi.waitFor(() => expect(wrapper.find('.document-title-button').exists()).toBe(true));
    await wrapper.get('button[aria-label="Nach Status sortieren"]').trigger('click');
    expect(wrapper.vm.sortKey).toBe('status');
    expect(wrapper.get('button[aria-label="Nach Status sortieren"]').attributes('aria-pressed')).toBe('true');
    const menu = wrapper.get('button[aria-label="Aktionen für Probeauftrag"]');
    await menu.trigger('click', { clientX: 10, clientY: 20 });
    expect(menu.attributes('aria-expanded')).toBe('true');
    expect(mocks.openDocument).not.toHaveBeenCalled();
  });
});
