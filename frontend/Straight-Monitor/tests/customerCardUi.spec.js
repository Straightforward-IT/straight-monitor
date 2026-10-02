import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import CustomerCard from '../src/components/Modals/CustomerCard.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
  cache: { kunden: [], berufe: [], qualifikationen: [], updateCachedKunde: vi.fn(), loadBerufe: vi.fn(), loadQualifikationen: vi.fn() },
  auth: { user: { roles: [] } },
  theme: { isDark: false },
  router: { push: vi.fn() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/stores/theme', () => ({ useTheme: () => mocks.theme }));
vi.mock('vue-router', async importOriginal => ({ ...(await importOriginal()), useRouter: () => mocks.router }));
vi.mock('@bleck-it/vue-modal-dock', async importOriginal => ({
  ...(await importOriginal()),
  useCurrentDockedModal: () => null,
}));

const frameStub = {
  props: ['title', 'minimizable'],
  template: '<section role="dialog" aria-labelledby="customer-title"><header><slot name="header" title-id="customer-title" /><slot name="actions" /></header><slot /></section>',
};
const stubs = {
  ModalFrame: frameStub,
  'font-awesome-icon': true,
  CustomerOrderCalendar: true,
  CustomerSignaturesPanel: true,
  KontaktAnlegenModal: true,
  ContactCard: true,
  EmployeeCardModal: true,
  KundenAnalyticsEmbed: true,
  EinsatzinformationenEditor: true,
  AdresseFormModal: true,
  EinsatzortFormModal: true,
  ContextMenu: true,
  CustomTooltip: { template: '<span><slot /></span>' },
};
let wrapper;
let customer;

beforeEach(() => {
  vi.resetAllMocks();
  customer = { _id: 'customer-1', kundenNr: 123, kundName: 'Acme GmbH', kundStatus: 2, kuerzel: '', bemerkung: ['Alt'] };
  mocks.cache.kunden = [customer];
  mocks.auth.user = { roles: [] };
  mocks.cache.berufe = [];
  mocks.cache.qualifikationen = [];
  mocks.api.get.mockResolvedValue({ data: [] });
  mocks.api.put.mockResolvedValue({ data: {} });
  mocks.api.post.mockResolvedValue({ data: {} });
  mocks.cache.updateCachedKunde.mockResolvedValue();
  mocks.cache.loadBerufe.mockResolvedValue();
  mocks.cache.loadQualifikationen.mockResolvedValue();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

async function render(initialTab = 'allgemein') {
  wrapper = mount(CustomerCard, { attachTo: document.body, props: { kunde: customer, initialTab }, global: { stubs } });
  await flushPromises();
  return wrapper;
}

describe('CustomerCard shared controls', () => {
  it('names the shared frame and exposes linked keyboard tabs', async () => {
    await render();
    expect(wrapper.getComponent(ModalFrame).props('title')).toBe('Acme GmbH');
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe(wrapper.get('h2.name').attributes('id'));
    const active = wrapper.get('.customer-tab[aria-selected="true"]');
    expect(active.text()).toContain('Allgemein');
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(active.attributes('id'));
    await active.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.get('.customer-tab[aria-selected="true"]').text()).toContain('Rechnung');
  });

  it('retains an editable abbreviation on failure and updates the shared customer after retry', async () => {
    await render();
    await wrapper.findAll('button').find(button => button.text().includes('Kürzel')).trigger('click');
    const input = wrapper.get('input[aria-label="Kürzel"]');
    expect(document.activeElement).toBe(input.element);
    await input.setValue('ACME');
    mocks.api.put.mockRejectedValueOnce({ response: { data: { message: 'Bitte erneut versuchen' } } });
    await wrapper.get('button[aria-label="Kürzel speichern"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('.kuerzel-error').text()).toBe('Bitte erneut versuchen');
    expect(wrapper.get('input[aria-label="Kürzel"]').element.value).toBe('ACME');
    await wrapper.get('button[aria-label="Kürzel speichern"]').trigger('click');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenLastCalledWith('/api/kunden/customer-1', { kuerzel: 'ACME' });
    expect(customer.kuerzel).toBe('ACME');
    expect(wrapper.find('.kuerzel-edit-row').exists()).toBe(false);
  });

  it('uses one focused remark editor and shows a retryable save error', async () => {
    await render();
    await wrapper.get('button[aria-label="Bemerkung 1 bearbeiten"]').trigger('click');
    expect(wrapper.findAll('.remark-editor')).toHaveLength(1);
    const input = wrapper.get('input[aria-label="Bemerkung 1"]');
    expect(document.activeElement).toBe(input.element);
    await input.setValue('Neu');
    mocks.api.put.mockRejectedValueOnce({ response: { data: { message: 'Speichern fehlgeschlagen' } } });
    await wrapper.get('button[aria-label="Bemerkung 1 speichern"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('.remark-error').text()).toBe('Speichern fehlgeschlagen');
    expect(wrapper.get('input[aria-label="Bemerkung 1"]').element.value).toBe('Neu');
    await wrapper.get('button[aria-label="Bemerkung 1 speichern"]').trigger('click');
    await flushPromises();
    expect(customer.bemerkung).toEqual(['Neu']);
    expect(wrapper.find('.remark-editor').exists()).toBe(false);
  });

  it('cancels remark editing on Escape without closing the customer card', async () => {
    await render();
    await wrapper.get('button[aria-label="Bemerkung 1 bearbeiten"]').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.remark-editor').exists()).toBe(false);
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('uses labelled address actions and the shared Einsatzort sorter', async () => {
    mocks.api.get.mockImplementation(async (url) => {
      if (url.endsWith('/adressen')) return { data: [{ nummer: 1, name: 'Zentrale', strasse: 'Hauptstr. 1' }] };
      if (url.endsWith('/einsatzorte')) return { data: [
        { _id: 'place-1', bezeichnung: 'Zentrale', adresse: { plz: '10000', ort: 'Berlin' } },
        { _id: 'place-2', bezeichnung: 'Filiale', adresse: { plz: '20000', ort: 'Hamburg' } },
      ] };
      return { data: [] };
    });
    await render();
    expect(wrapper.get('button[aria-label="Optionen für Zentrale"]').exists()).toBe(true);
    const sorter = wrapper.get('[role="radiogroup"][aria-label="Einsatzortsortierung"]');
    expect(sorter.get('[role="radio"][aria-checked="true"]').text()).toBe('Name');
    expect(wrapper.findAll('.address-card .address-name').map(item => item.text())).toEqual(['Filiale', 'Zentrale']);
    await sorter.get('[role="radio"][aria-checked="true"]').trigger('keydown', { key: 'ArrowRight' });
    expect(sorter.get('[role="radio"][aria-checked="true"]').text()).toBe('Adresse');
    expect(wrapper.findAll('.address-card .address-name').map(item => item.text())).toEqual(['Zentrale', 'Filiale']);
  });

  it('names the contact menu action without triggering the contact card', async () => {
    customer.kuerzel = 'ACME';
    mocks.api.get.mockImplementation(async (url) => url === '/api/graph/contacts'
      ? { data: { contacts: [{ id: 'contact-1', companyName: 'ACME', displayName: 'Jane Doe' }] } }
      : { data: [] });
    await render('kontakte');
    await wrapper.get('button[aria-label="Optionen für Jane Doe"]').trigger('click');
    expect(wrapper.find('context-menu-stub').exists()).toBe(true);
    expect(wrapper.find('contact-card-stub').exists()).toBe(false);
  });

  it('opens Preise directly and keeps the legacy Lohn initial-tab alias', async () => {
    await render('lohn');
    expect(wrapper.get('.customer-tab[aria-selected="true"]').text()).toContain('Preise');
    expect(wrapper.findAll('.customer-tab').some(tab => tab.text().includes('Lohn'))).toBe(false);
    expect(mocks.api.get).toHaveBeenCalledWith('/api/kunden/123/preise');
    expect(mocks.api.get).toHaveBeenCalledWith('/api/kunden/123/konditionen');
  });

  it('keeps the Rechnung form editable after a failed save and writes typed values on retry', async () => {
    await render('rechnung');
    await wrapper.get('.erechnung-settings input').setValue('991-123');
    await wrapper.findAll('.erechnung-settings select')[0].setValue('XRECHNUNG');
    await wrapper.findAll('.erechnung-settings select')[1].setValue('2');
    mocks.api.put.mockRejectedValueOnce({ response: { data: { message: 'Nicht gespeichert' } } });
    await wrapper.get('.erechnung-settings').trigger('submit');
    await flushPromises();
    expect(wrapper.get('.erechnung-error[role="alert"]').text()).toBe('Nicht gespeichert');
    expect(wrapper.get('.erechnung-settings input').element.value).toBe('991-123');
    await wrapper.get('.erechnung-settings').trigger('submit');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenLastCalledWith('/api/kunden/customer-1', {
      leitwegId: '991-123', eRechnungFormat: 'XRECHNUNG', mwst: 2,
    });
    expect(customer.mwst).toBe(2);
  });

  it('saves a new qualification price in cents and keeps the input in the shared form', async () => {
    mocks.api.get.mockImplementation(async (url) => url.endsWith('/preise')
      ? { data: [{ _id: 'price-1', qualifikation: { _id: 'qual-1', designation: 'Service', qualificationKey: 100, beruf: { _id: 'job-1', designation: 'Servicekräfte' } }, hourlyRateCents: 2000, validFrom: '2026-01-01' }] }
      : { data: [] });
    await render('preise');
    await wrapper.get('.preise-new-btn').trigger('click');
    expect(wrapper.get('.preise-new-form input[inputmode="decimal"]').exists()).toBe(true);
    await wrapper.get('.preise-new-form input[inputmode="decimal"]').setValue('23,50');
    await wrapper.get('.preise-new-form input[type="date"]').setValue('2026-11-01');
    await wrapper.get('.preise-new-form').trigger('submit');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/kunden/123/preise', {
      qualifikation: 'qual-1', hourlyRateCents: 2350, validFrom: '2026-11-01',
    });
    expect(wrapper.find('.preise-new-form').exists()).toBe(false);
  });

  it('keeps the shared qualification dialog open while saving and closes it afterward', async () => {
    mocks.cache.berufe = [{ _id: 'job-1', jobKey: 10, designation: 'Service' }];
    mocks.cache.qualifikationen = [{ _id: 'qual-1', qualificationKey: 11, designation: 'Service A', beruf: { _id: 'job-1' } }];
    await render('preise');
    await wrapper.get('.preise-add-btn').trigger('click');
    await flushPromises();
    expect(wrapper.findAllComponents(ModalFrame).map(frame => frame.props('title'))).toContain('Neue Qualifikation hinzufügen');
    await wrapper.findAll('.search-select-option')[0].trigger('click');
    await wrapper.findAll('.search-select-option')[0].trigger('click');
    await wrapper.get('.add-quali-form input[inputmode="decimal"]').setValue('18,75');
    await wrapper.get('.add-quali-form input[type="date"]').setValue('2026-11-01');

    let finishSave;
    mocks.api.post.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    await wrapper.get('.add-quali-form').trigger('submit');
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.customer-tab').every(tab => tab.attributes('disabled') !== undefined)).toBe(true);
    expect(wrapper.get('.add-quali-form input[inputmode="decimal"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.add-quali-form').exists()).toBe(true);

    finishSave({ data: {} });
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/kunden/123/preise', {
      qualifikation: 'qual-1', hourlyRateCents: 1875, validFrom: '2026-11-01',
    });
    expect(wrapper.find('.add-quali-form').exists()).toBe(false);
  });

  it('closes only the nested qualification dialog on Escape', async () => {
    await render('preise');
    await wrapper.get('.preise-add-btn').trigger('click');
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.add-quali-form').exists()).toBe(false);
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('uses a shared confirmation frame before reducing multiple signature recipients', async () => {
    customer.stundenlisteMehrereEinladungen = true;
    customer.signaturKontaktId = 'contact-1';
    customer.signaturKontakte = [
      { id: 'contact-1', name: 'Jane', email: 'jane@example.com' },
      { id: 'contact-2', name: 'John', email: 'john@example.com' },
    ];
    await render('einstellungen');
    await wrapper.findAll('.stundenliste-double-copy-toggle input')[2].setValue(false);
    expect(wrapper.findAllComponents(ModalFrame).map(frame => frame.props('title'))).toContain('Signatur-Standard auswählen');
    await wrapper.findAll('button').find(button => button.text() === 'Übernehmen').trigger('click');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenCalledWith('/api/kunden/customer-1', expect.objectContaining({
      stundenlisteMehrereEinladungen: false, signaturKontaktId: 'contact-1',
    }));
    expect(customer.signaturKontakte).toHaveLength(1);
  });
});
