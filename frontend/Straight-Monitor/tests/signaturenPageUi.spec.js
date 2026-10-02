import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import SignaturenWorkspace from '../src/components/SignaturenWorkspace.vue';
import SignaturCard from '../src/components/SignaturCard.vue';
import SignaturTemplateBuilderModal from '../src/components/SignaturTemplateBuilderModal.vue';
import CustomerSignaturesPanel from '../src/components/customer/CustomerSignaturesPanel.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import AppSelect from '../src/components/ui-elements/AppSelect.vue';
import { useSignaturBuilder } from '../src/stores/signaturBuilder';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), put: vi.fn() },
  auth: { user: { roles: ['ADMIN'], locationV2: 'hh' } },
  route: { query: {} },
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('vue-router', async importOriginal => ({
  ...(await importOriginal()),
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
}));
vi.mock('@/composables/useDocumentPreviewModals', () => ({
  useDocumentPreviewModals: () => ({ openDocumentPreview: vi.fn() }),
}));

const template = { id: 42, name: 'Arbeitsvertrag', fields: [], defaultTypId: 'typ' };
const type = { _id: 'typ', key: 'vertrag', label: 'Vertrag' };
const stubs = {
  'font-awesome-icon': true,
  R2FileBrowser: true,
  SignaturTypAnlegenModal: true,
  DocusealBuilder: true,
  DocusealForm: true,
  ContactSearchPicker: true,
  CustomerEmailTemplatesEditor: true,
  RouterLink: true,
};
let wrapper;
let pinia;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  pinia = createPinia();
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/signaturen?refresh=true' || url === '/api/signaturen') return Promise.resolve({ data: [] });
    if (url === '/api/signatur-typen') return Promise.resolve({ data: [type] });
    if (url === '/api/locations') return Promise.resolve({ data: [{ _id: 'hh', nameFull: 'Hamburg' }] });
    if (url === '/api/docuseal/templates') return Promise.resolve({ data: [template] });
    if (url === '/api/signaturen/builder-token') return Promise.resolve({ data: { token: 'test-token' } });
    if (url === '/api/graph/contacts') return Promise.resolve({ data: { contacts: [] } });
    if (url === '/api/signaturen/folge-defaults') return Promise.resolve({ data: { ausliefernAn: [{ displayName: 'Jane', email: 'jane@example.com' }] } });
    throw new Error(`Unexpected request: ${url}`);
  });
  mocks.api.put.mockResolvedValue({ data: { ausliefernAn: [] } });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

describe('Signaturen page shared controls', () => {
  it('keeps the template card keyboard-operable and submits the shared modal form', async () => {
    wrapper = mount(SignaturenWorkspace, {
      props: { tab: 'templates' },
      attachTo: document.body,
      global: { plugins: [pinia], stubs },
    });
    await flushPromises();
    const card = wrapper.get('.template-card');
    expect(card.attributes('tabindex')).toBe('0');
    await card.trigger('keydown.enter');
    await flushPromises();
    let dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(dialog.get('h2').text()).toBe('Vorlage bearbeiten');
    expect(dialog.getComponent(AppSelect).props('modelValue')).toBe('typ');

    await dialog.get('button[aria-label="Schließen"]').trigger('click');
    await wrapper.findAll('button').find(button => button.text().includes('Neue Vorlage')).trigger('click');
    await flushPromises();
    dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    await dialog.get('#template-create-name').setValue('Neue Vorlage');
    await dialog.getComponent(AppSelect).get('select').setValue('typ');
    await dialog.get('form').trigger('submit');
    expect(useSignaturBuilder(pinia).open).toBe(true);
    expect(useSignaturBuilder(pinia).name).toBe('Neue Vorlage');
    expect(useSignaturBuilder(pinia).defaultTypId).toBe('typ');
  });

  it('uses labelled shared actions on a signature card without changing expand behavior', async () => {
    wrapper = mount(SignaturCard, {
      props: { vorgang: { _id: 'sig', name: 'Vertrag', status: 'draft', submitters: [], createdAt: '2026-09-30' } },
      global: { stubs },
    });
    const toggle = wrapper.get('button[aria-label="Signaturdetails öffnen"]');
    await toggle.trigger('click');
    expect(wrapper.get('button[aria-label="Signaturdetails schließen"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('.sc-actions').text()).toContain('Bearbeiten');
    expect(wrapper.get('.sc-actions').text()).toContain('Stornieren');
    await wrapper.get('.sc-actions button').trigger('click');
    expect(wrapper.emitted('edit-draft')).toHaveLength(1);
  });

  it('uses ModalFrame for the embedded template builder and keeps close handling', async () => {
    wrapper = mount(SignaturTemplateBuilderModal, {
      attachTo: document.body,
      global: { plugins: [pinia], stubs },
    });
    const builder = useSignaturBuilder(pinia);
    builder.openBuilder({ templateId: 42, name: 'Arbeitsvertrag' });
    await flushPromises();
    const dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(wrapper.getComponent(ModalFrame).props('layer')).toBe('elevated');
    expect(dialog.attributes('aria-labelledby')).toBe(dialog.get('h2').attributes('id'));
    expect(dialog.text()).toContain('Vorlage bearbeiten');
    await dialog.get('button[aria-label="Schließen"]').trigger('click');
    await flushPromises();
    expect(builder.open).toBe(false);
  });

  it('keeps customer delivery defaults operable with shared controls', async () => {
    wrapper = mount(CustomerSignaturesPanel, {
      props: { kunde: { _id: 'customer', kundenNr: 123, kuerzel: 'ACME' } },
      global: { plugins: [pinia], stubs },
    });
    await flushPromises();
    await wrapper.findAll('.signature-sections button')[2].trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.signature-sections button')[2].attributes('aria-current')).toBe('page');
    const select = wrapper.getComponent(AppSelect);
    await select.get('select').setValue('typ');
    await flushPromises();
    expect(wrapper.get('button[aria-label="Jane entfernen"]')).toBeTruthy();
    await wrapper.get('button[aria-label="Jane entfernen"]').trigger('click');
    await wrapper.findAll('button').find(button => button.text().includes('Standard speichern')).trigger('click');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenCalledWith('/api/signaturen/folge-defaults', {
      kundeId: 'customer', typId: 'typ', ausliefernAn: [],
    });
  });
});
