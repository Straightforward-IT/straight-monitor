import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { createModalDock, DockedModalHost, useDockedModals } from '@bleck-it/vue-modal-dock';
import { useAuftragModals } from '@/composables/useAuftragModals';
import { useAuth } from '@/stores/auth';
import AuftragModal from '@/components/Modals/AuftragModal.vue';
import AuftragCalendarWorkspace from '@/components/orders/calendar/AuftragCalendarWorkspace.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn(), openCustomer: vi.fn(), openEvent: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: { get: mocks.get } }));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: mocks.openCustomer }) }));
vi.mock('@/composables/useEventModals', () => ({ useEventModals: () => ({ openEvent: mocks.openEvent, openCreateEvent: vi.fn() }) }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const customer = { _id: 'customer-1', kundName: 'Testkunde', kundenNr: 123 };
const order = (auftragNr = 42) => ({ _id: `order-${auftragNr}`, auftragNr, eventTitel: `Konferenz ${auftragNr}`, auftStatus: 2,
  vonDatum: '2026-10-20', bisDatum: '2026-10-20', kundeData: customer, eventLocation: 'Halle A', eventStrasse: 'Musterstraße 1', eventPlz: '20095', eventOrt: 'Hamburg', referenz: 'Service', labels: [],
  schichten: [{ _id: 'shift-1', idAuftragArbeitsschichten: 71, bezeichnung: 'Frühschicht', uhrzeitVon: '09:00', uhrzeitBis: '17:00', bedarf: 1 }],
  einsaetze: [{ _id: 'assignment-1', idAuftragArbeitsschichten: 71, mitarbeiterData: { _id: 'employee-1', vorname: 'Anna', nachname: 'Beispiel' }, stundenlisteIncluded: true }],
});
let wrapper, router, manager, launcher, pinia;
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.get.mockImplementation(url => {
    const match = url.match(/^\/api\/auftraege\/(\d+)\/details$/);
    return Promise.resolve({ data: match ? order(Number(match[1])) : url === '/api/kunden/customer-1' ? customer
      : url.endsWith('/einsatzdokumente') ? { data: [{ _id: 'doc-1', filename: 'Ablauf.pdf', title: 'Ablauf.pdf', scope: 'intern', size: 512 }] }
        : url.startsWith('/api/reports/') || url === '/api/reisekosten' ? { data: [] } : {} });
  });
});
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; });

async function render(withSidepanel = false) {
  const PageFixture = {
    ...AuftragCalendarWorkspace, mounted() {},
    data() { return { ...AuftragCalendarWorkspace.data.call(this), selectedEvent: order(), preparedSchichten: [], currentWeekStart: new Date(2026, 9, 19) }; },
  };
  const Launcher = defineComponent({ setup() {
    launcher = useAuftragModals();
    return () => withSidepanel ? h(PageFixture, { viewMode: 'list' }) : h('p', 'Auftragsliste');
  } });
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/auftraege', component: Launcher }, { path: '/other', component: { template: '<p>Andere Seite</p>' } },
  ] });
  await router.push('/auftraege');
  pinia = createPinia(); useAuth(pinia).user = { _id: 'user', role: 'USER', roles: ['USER'] };
  const Root = defineComponent({ setup() {
    manager = useDockedModals();
    return () => h('div', [h(RouterView), h(DockedModalHost)]);
  } });
  wrapper = mount(Root, { attachTo: document.body, global: { plugins: [pinia, router, createModalDock()], stubs: { 'font-awesome-icon': true } } });
  await flushPromises();
}
async function opened(auftrag = 42) {
  const entry = launcher.openAuftrag(auftrag);
  const find = () => wrapper.findAllComponents(AuftragModal).find(modal => modal.props('minimizeId') === entry.id);
  await flushPromises(); await vi.waitFor(() => expect(find()).toBeDefined()); await flushPromises();
  return find();
}

it('undocks beside the action menu and uses the same order, shifts, team and documents in one ModalFrame', async () => {
  await render(true);
  const side = wrapper.get('aside.detail-sidebar');
  const actions = side.get('.sidebar-header-actions').findAll('button');
  expect(actions.map(button => button.attributes('aria-label'))).toEqual(['Auftrag in Fenster öffnen', 'Aktionen für Auftrag 42']);
  await actions[0].trigger('click'); await flushPromises();
  await vi.waitFor(() => expect(wrapper.findComponent(AuftragModal).exists()).toBe(true)); await flushPromises();
  expect(wrapper.find('aside.detail-sidebar').exists()).toBe(false);
  const modal = wrapper.getComponent(AuftragModal);
  expect(modal.text()).toContain('Konferenz 42'); expect(modal.text()).toContain('#42'); expect(modal.text()).toContain('Testkunde');
  expect(modal.text()).toContain('Frühschicht'); expect(modal.text()).toContain('Anna Beispiel'); expect(modal.text()).toContain('Ablauf.pdf');
  const frames = modal.findAllComponents(ModalFrame).filter(frame => frame.props('modelValue'));
  expect(frames).toHaveLength(1); expect(frames[0].props('minimizable')).toBe(true);
  expect(modal.find('.main-content').exists()).toBe(false);
  expect(modal.find('button[aria-label="Auftrag in Fenster öffnen"]').exists()).toBe(false);
  expect(mocks.get.mock.calls.some(([url]) => url.includes('/filters') || url.includes('/locations') || url.includes('/holidays') || url.startsWith('/api/auftraege?'))).toBe(false);
});

it('retains one window and its state after minimizing, leaving the page and reopening', async () => {
  await render(); sessionStorage.setItem('auftraege_selected', '99');
  const modal = await opened(order()); const uid = modal.vm.$.uid;
  const details = modal.getComponent(AuftragCalendarWorkspace);
  details.vm.newLabelName = 'Entwurf';
  manager.minimize('auftrag-details-42'); await nextTick();
  await router.push('/other?auftragnr=77&openPseudo=1'); await flushPromises();
  expect(manager.get('auftrag-details-42').status).toBe('minimized');
  expect(sessionStorage.getItem('auftraege_selected')).toBe('99');
  await opened('42');
  expect(manager.modals.value).toHaveLength(1); expect(wrapper.getComponent(AuftragModal).vm.$.uid).toBe(uid);
  expect(details.vm.newLabelName).toBe('Entwurf'); expect(details.vm.selectedEvent.auftragNr).toBe(42);
  expect(details.vm.showNewAuftragDialog).toBe(false);
  expect(mocks.get.mock.calls.filter(([url]) => url.endsWith('/details')).map(([url]) => url)).toEqual(['/api/auftraege/42/details']);
  manager.requestClose('auftrag-details-42'); await nextTick();
  expect(manager.modals.value).toHaveLength(0);
});

it('links to the same order in the calendar and closes the modal when following the link', async () => {
  await render(); await router.push('/other');
  mocks.get.mockResolvedValueOnce({ data: { ...order(), locationV2: { _id: 'location-berlin' } } });
  const modal = await opened();
  const link = modal.get('a.auftrag-calendar-link');
  expect(link.text()).toBe('Im Auftragskalender öffnen');
  expect(link.attributes('href')).toBe('/auftraege?tab=calendar&auftragnr=42&focusDate=2026-10-20&locationV2=location-berlin');
  await link.trigger('click'); await flushPromises();
  expect(router.currentRoute.value.path).toBe('/auftraege');
  expect(router.currentRoute.value.query).toEqual({ tab: 'calendar', auftragnr: '42', focusDate: '2026-10-20', locationV2: 'location-berlin' });
  expect(manager.get('auftrag-details-42')).toBeUndefined();
});

it('keeps the modal and current route when opening the calendar link with a modifier key', async () => {
  await render(); await router.push('/other');
  const modal = await opened();
  const link = modal.get('a.auftrag-calendar-link');
  // JSDOM cannot open browser tabs; suppress the native navigation only.
  link.element.addEventListener('click', event => event.preventDefault(), { once: true });
  await link.trigger('click', { ctrlKey: true }); await flushPromises();
  expect(router.currentRoute.value.path).toBe('/other');
  expect(manager.get('auftrag-details-42')).toBeDefined();
});

it('preserves customer links, action menu and the existing role boundary', async () => {
  await render(); const modal = await opened();
  await modal.get('.kunde-link').trigger('click'); await flushPromises(); expect(mocks.openCustomer).toHaveBeenCalledWith(customer);
  await modal.get('button[aria-label="Aktionen für Auftrag 42"]').trigger('click');
  expect(modal.text()).toContain('Event-Editor'); expect(modal.text()).not.toContain('Stundenschnellerfassung');
  await modal.get('[role="menuitem"]').trigger('click');
  expect(mocks.openEvent).toHaveBeenCalledWith(expect.objectContaining({ auftragNr: 42 }), expect.objectContaining({ onUpdated: expect.any(Function) }));
  useAuth(pinia).user = { _id: 'admin', role: 'ADMIN', roles: ['ADMIN'] };
  await modal.get('button[aria-label="Aktionen für Auftrag 42"]').trigger('click');
  expect(modal.text()).toContain('Stundenschnellerfassung');
});

it('retains the existing pseudo-assignment dialog and closes only that nested dialog on Escape', async () => {
  await render(); const modal = await opened();
  await modal.get('button[aria-label="Aktionen für Auftrag 42"]').trigger('click');
  await modal.findAll('[role="menuitem"]').find(item => item.text() === 'Pseudo-MA einplanen').trigger('click');
  await flushPromises();
  document.querySelectorAll('.mf-overlay').forEach(overlay => { overlay.getClientRects = () => [{}]; });
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await nextTick();
  expect(modal.getComponent(AuftragCalendarWorkspace).vm.showPseudoDialog).toBe(false);
  expect(manager.get('auftrag-details-42')).toBeDefined();
});

it('shows a failed lookup without fabricated details and retries in the same window', async () => {
  mocks.get.mockRejectedValueOnce({ response: { data: { message: 'Auftrag nicht gefunden.' } } });
  await render(); const modal = await opened();
  expect(modal.get('[role="alert"]').text()).toContain('Auftrag nicht gefunden.');
  expect(modal.get('a.auftrag-calendar-link').attributes('href')).toBe('/auftraege?tab=calendar&auftragnr=42');
  expect(modal.find('.info-grid').exists()).toBe(false);
  await modal.get('[role="alert"] button').trigger('click'); await flushPromises();
  expect(modal.find('[role="alert"]').exists()).toBe(false); expect(modal.text()).toContain('Konferenz 42');
  expect(manager.get('auftrag-details-42').title).toBe('Konferenz 42 · #42');
});

it('cancels the detail lookup on close and ignores its late response', async () => {
  let resolve; mocks.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(); const modal = await opened();
  expect(modal.get('[role="status"]').text()).toContain('werden geladen');
  expect(modal.get('a.auftrag-calendar-link').attributes('href')).toBe('/auftraege?tab=calendar&auftragnr=42');
  const signal = mocks.get.mock.calls[0][1].signal;
  await modal.get('button[aria-label="Schließen"]').trigger('click');
  expect(signal.aborted).toBe(true);
  resolve({ data: order() }); await flushPromises();
  expect(manager.get('auftrag-details-42')).toBeUndefined();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
