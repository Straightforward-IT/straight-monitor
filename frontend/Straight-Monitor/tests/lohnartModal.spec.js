import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { createModalDock, DockedModalHost, useDockedModals } from '@bleck-it/vue-modal-dock';
import { useLohnartModals } from '@/composables/useLohnartModals';
import LohnartModal from '@/components/Modals/LohnartModal.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import WageTypesTab from '@/components/payroll/WageTypesTab.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn(), openCustomer: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: { get: mocks.get } }));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: mocks.openCustomer }) }));
const customer = { _id: 'customer-1', kundenNr: 123, kundName: 'Testkunde' };
const normal = { _id: 'normal-id', lohnartNummer: '100', lohnartBezeichnung: 'Normalstunden', berechnungsartCode: '2', kunden: [customer],
  kundenkonditionen: [{ _id: 'condition-1', kunde: customer, verwendung: 'F', preisBetrag: '33' }],
  source: { filename: 'Lohnarten.xlsx', sheet: 'Tabelle1', row: 2, columns: [{ index: 1, header: 'LOHNARTNR', occurrence: 1, value: 100 }] } };
const utz = { _id: 'utz-id', lohnartNummer: '110', lohnartBezeichnung: 'ÜTZ', verrechnungsbezug: { targetNumber: '602', target: { _id: 'offset-id', lohnartNummer: '602', lohnartBezeichnung: 'Verrechnung' } } };
let wrapper, manager, launcher, showLauncher;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(url => Promise.resolve({ data: { data:
    url === '/api/import/lohnarten' ? [normal, utz]
      : url.endsWith('/110') || url.endsWith('/utz-id') ? utz
        : url.endsWith('/offset-id') ? utz.verrechnungsbezug.target : normal,
  } }));
});
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; });

function render(admin = false) {
  showLauncher = ref(true);
  const Launcher = defineComponent({ setup() {
    launcher = useLohnartModals();
    return () => admin ? h(WageTypesTab) : h('p', 'Launching page');
  } });
  const Root = defineComponent({ setup() {
    manager = useDockedModals();
    return () => h('div', [showLauncher.value && h(Launcher), h(DockedModalHost)]);
  } });
  wrapper = mount(Root, { attachTo: document.body, global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } } });
}
async function opened(lohnart, options) {
  const entry = launcher.openLohnart(lohnart, options);
  const find = () => wrapper.findAllComponents(LohnartModal).find(modal => modal.props('minimizeId') === entry.id);
  await flushPromises();
  await vi.waitFor(() => expect(find()).toBeDefined());
  await flushPromises();
  return find();
}
const panel = modal => modal.get('[role="tabpanel"]:not([hidden])');

it('loads by number, reuses all six tabs and opens the customer price card', async () => {
  render(); const modal = await opened(100);
  expect(mocks.get).toHaveBeenCalledWith('/api/import/lohnarten/nummer/100', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(modal.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['Berechnung', 'Zeit & Fehlzeiten', 'Faktur & Konditionen', 'Tarif & Verrechnung', 'Abrechnung', 'Herkunft']);
  expect(modal.findAllComponents(ModalFrame)).toHaveLength(1);
  expect(modal.getComponent(ModalFrame).props('minimizable')).toBe(true);
  expect(panel(modal).text()).toContain('Normalstunden');
  await modal.get('[data-tab-id="conditions"]').trigger('click');
  await panel(modal).get('.wage-detail__link').trigger('click');
  expect(mocks.openCustomer).toHaveBeenCalledWith(customer, { initialTab: 'preise' });
  await modal.get('[data-tab-id="source"]').trigger('click');
  expect(panel(modal).text()).toContain('Lohnarten.xlsx');
  expect(manager.modals.value[0].title).toBe('Lohnart 100 · Normalstunden');
});

it('keeps one instance and its tab after minimizing, leaving the page and reopening', async () => {
  render(); const modal = await opened('100', { initialTab: 'time' });
  const uid = modal.vm.$.uid;
  expect(modal.get('[data-tab-id="time"]').attributes('aria-selected')).toBe('true');
  await modal.get('[data-tab-id="source"]').trigger('click');
  const id = manager.modals.value[0].id;
  manager.minimize(id); showLauncher.value = false; await nextTick();
  expect(manager.get(id).status).toBe('minimized');
  launcher.openLohnart(normal);
  await flushPromises();
  expect(manager.modals.value).toHaveLength(1);
  expect(manager.get(id).status).toBe('open');
  expect(wrapper.getComponent(LohnartModal).vm.$.uid).toBe(uid);
  expect(modal.get('[data-tab-id="source"]').attributes('aria-selected')).toBe('true');
  expect(manager.get(id).title).toBe('Lohnart 100 · Normalstunden');
  manager.requestClose(id); await nextTick();
  expect(manager.modals.value).toHaveLength(0);
});

it('accepts a MongoDB ID even when it consists entirely of digits', async () => {
  render(); await opened('000000000000000000000123');
  expect(mocks.get).toHaveBeenCalledWith('/api/import/lohnarten/000000000000000000000123', expect.any(Object));
});

it('opens an offset target in its own reusable modal with the tariff tab', async () => {
  render(); const modal = await opened('110', { initialTab: 'tariff' });
  await panel(modal).get('.wage-detail__relation button').trigger('click'); await flushPromises();
  expect(manager.modals.value).toHaveLength(2);
  expect(mocks.get).toHaveBeenCalledWith('/api/import/lohnarten/offset-id', expect.any(Object));
  const target = wrapper.findAllComponents(LohnartModal).find(item => item.props('lohnartId') === 'offset-id');
  expect(target.get('[data-tab-id="tariff"]').attributes('aria-selected')).toBe('true');
});

it('shows missing-record errors and retries; closing aborts an unfinished load', async () => {
  mocks.get.mockRejectedValueOnce({ response: { data: { message: 'Lohnart nicht gefunden.' } } });
  render(); const modal = await opened('999');
  expect(modal.get('[role="alert"]').text()).toContain('Lohnart nicht gefunden.');
  await modal.get('[role="alert"] button').trigger('click'); await flushPromises();
  expect(modal.find('[role="alert"]').exists()).toBe(false);
  let finish;
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = await opened('101');
  const signal = mocks.get.mock.calls.at(-1)[1].signal;
  await pending.get('button[aria-label="Schließen"]').trigger('click');
  expect(signal.aborted).toBe(true);
  finish({ data: { data: normal } }); await flushPromises();
  expect(manager.get('lohnart-nummer-101')).toBeUndefined();
});

it('opens the selected admin sidepanel record in the same tab', async () => {
  render(true); await flushPromises();
  await wrapper.get('button[aria-label="Lohnart 100 anzeigen"]').trigger('click'); await flushPromises();
  const side = wrapper.get('aside.wage-detail');
  await side.get('[data-tab-id="accounting"]').trigger('click');
  await side.get('button[aria-label="Lohnart im Modal öffnen"]').trigger('click'); await flushPromises();
  await vi.waitFor(() => expect(wrapper.findComponent(LohnartModal).exists()).toBe(true));
  expect(wrapper.getComponent(LohnartModal).get('[data-tab-id="accounting"]').attributes('aria-selected')).toBe('true');
});
