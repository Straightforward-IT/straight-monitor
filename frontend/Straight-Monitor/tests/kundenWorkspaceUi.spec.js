import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import CustomerListCard from '../src/components/customer/CustomerListCard.vue';
import KundenWorkspace from '../src/components/KundenWorkspace.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  cache: { kunden: [], loadKunden: vi.fn() },
  auth: { user: {}, kundenWatchlist: [], highlightedKunden: [], toggleKundeWatchlist: vi.fn(), toggleHighlightedKunde: vi.fn() },
  openCustomer: vi.fn(),
  route: { query: {} },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/composables/useAdditionalModals', () => ({ useAdditionalModals: () => ({ openContact: vi.fn() }) }));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: mocks.openCustomer }) }));
vi.mock('vue-router', async importOriginal => ({ ...(await importOriginal()), useRoute: () => mocks.route }));

const customer = { _id: 'customer-1', kundName: 'Acme GmbH', kundenNr: 123, kuerzel: 'ACME', kundStatus: 2, contacts: [{ vorname: 'Jane', nachname: 'Doe' }] };
const contact = { id: 'contact-1', _upn: 'jane@example.com', displayName: 'Jane Doe', givenName: 'Jane', surname: 'Doe', emailAddresses: [{ address: 'jane@example.com' }], companyName: 'ACME' };
const stubs = {
  'font-awesome-icon': true,
  Toolbar: { template: '<div><slot /><slot name="actions" /><slot name="bottom-actions" /></div>' },
  ToolbarFilter: true,
  ToolbarPageControls: true,
  ToolbarGroup: { template: '<div><slot /></div>' },
  FilterGroup: true,
  FilterChip: true,
  FilterDivider: true,
  LocationFilter: true,
  SortMenu: true,
  SearchBar: true,
  CustomerSearch: true,
  KontaktAnlegenModal: true,
  ContextMenu: { props: ['options'], template: '<div class="context-menu-stub" />' },
};
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.cache.kunden = [customer];
  mocks.cache.loadKunden.mockResolvedValue();
  mocks.auth.kundenWatchlist = ['customer-1'];
  mocks.auth.highlightedKunden = [];
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/locations') return Promise.resolve({ data: [] });
    if (url === '/api/graph/contacts') return Promise.resolve({ data: { contacts: [{ ...contact }] } });
    throw new Error(`Unexpected request: ${url}`);
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

describe('Kunden overview migration', () => {
  it('shares one keyboard-operable card without nesting its menu and star in the open button', async () => {
    wrapper = mount(CustomerListCard, { props: { kunde: customer, showHighlight: true }, global: { stubs: { 'font-awesome-icon': true } } });
    const open = wrapper.get('button[aria-label="Acme GmbH öffnen"]');
    expect(open.element.parentElement.querySelector('.card-controls')).toBeTruthy();
    expect(open.element.contains(wrapper.get('button[aria-label="Aktionen für Acme GmbH"]').element)).toBe(false);
    await open.trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([customer]);
    await wrapper.get('button[aria-label="Kunde hervorheben"]').trigger('click');
    expect(wrapper.emitted('toggle-highlight')?.[0]).toEqual([customer]);
    expect(wrapper.emitted('open')).toHaveLength(1);
  });

  it.each(['overview', 'watchlist'])('keeps %s card menu separate from opening the customer', async tab => {
    wrapper = mount(KundenWorkspace, { props: { tab }, global: { stubs } });
    await flushPromises();
    const card = wrapper.getComponent(CustomerListCard);
    await card.get('button[aria-label="Aktionen für Acme GmbH"]').trigger('click');
    expect(wrapper.find('.context-menu-stub').exists()).toBe(true);
    expect(mocks.openCustomer).not.toHaveBeenCalled();
    await card.get('button[aria-label="Acme GmbH öffnen"]').trigger('click');
    expect(mocks.openCustomer).toHaveBeenCalledWith(customer);
  });

  it('keeps contact edits in ModalFrame on failure and submits the original Graph payload on retry', async () => {
    wrapper = mount(KundenWorkspace, { attachTo: document.body, props: { tab: 'kontakte' }, global: { stubs } });
    await flushPromises();
    expect(wrapper.get('button[aria-label="Acme GmbH öffnen"]')).toBeTruthy();
    await wrapper.get('button[aria-label="Jane Doe bearbeiten"]').trigger('click');
    let dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(wrapper.getComponent(ModalFrame).props('modelValue')).toBe(true);
    expect(dialog.get('label[for="customer-contact-given-name"]').text()).toBe('Vorname');
    await dialog.get('#customer-contact-given-name').setValue('Janet');
    mocks.api.patch.mockRejectedValueOnce({ response: { data: { message: 'Bitte erneut versuchen' } } });
    dialog.findAll('button').find(button => button.text().includes('Speichern')).element.click();
    await flushPromises();
    dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(dialog.get('[role="alert"]').text()).toBe('Bitte erneut versuchen');
    expect(dialog.get('#customer-contact-given-name').element.value).toBe('Janet');
    mocks.api.patch.mockResolvedValueOnce({ data: { contact: { givenName: 'Janet' } } });
    dialog.findAll('button').find(button => button.text().includes('Speichern')).element.click();
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenLastCalledWith('/api/graph/contacts/contact-1', expect.objectContaining({
      upn: 'jane@example.com', givenName: 'Janet', companyName: 'ACME',
    }));
    expect(wrapper.getComponent(ModalFrame).props('modelValue')).toBe(false);
  });
});
