import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, shallowMount } from '@vue/test-utils';
import DispoTable from '../src/components/DispoTable.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import KundenwunschModal from '../src/components/Modals/KundenwunschModal.vue';
import HoverDataCard from '../src/components/ui-elements/HoverDataCard.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  comments: { zvooveItems: [], fetch: vi.fn(), fetchChronikBatch: vi.fn(), getCellComments: vi.fn(), cellUnreadCount: vi.fn(), chronikForMa: vi.fn(), markRead: vi.fn(), post: vi.fn(), delete: vi.fn() },
  dispoEntries: [],
  dispoEmployees: [],
  openEmployeeContingent: vi.fn(),
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/composables/useEmployeeContingentModals', () => ({ useEmployeeContingentModals: () => ({ openEmployeeContingent: mocks.openEmployeeContingent }) }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { _id: 'user-1', roles: ['ADMIN'], email: 'test@example.com' }, employeeNameFormat: 'first-last' }) }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => ({}) }));
vi.mock('@/stores/flipAll', () => ({ useFlipAll: () => ({}) }));
vi.mock('@/stores/comments', () => ({ useComments: () => mocks.comments }));
vi.mock('@/stores/ui', () => ({ useUi: () => ({ panelType: null, hidden: true, close: vi.fn(), open: vi.fn(), toggle: vi.fn() }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ query: {} }) }));

const frameStub = {
  props: ['modelValue', 'title', 'showClose', 'closeOnBackdrop', 'closeOnEscape'],
  emits: ['close'],
  template: '<div v-if="modelValue" role="dialog"><slot name="header" title-id="test-title" /><slot /><slot name="footer" /></div>',
};
const stubs = {
  PageLayout: { template: '<div><slot /></div>' },
  ModalFrame: frameStub,
  AppButton: false,
  AppIconButton: false,
  AppTextarea: false,
  'font-awesome-icon': true,
};
const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]'));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mocks.dispoEntries = [];
  mocks.dispoEmployees = [];
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/users/me') return Promise.resolve({ data: { dispoPrefs: {} } });
    if (url === '/api/locations') return Promise.resolve({ data: [] });
    if (url.startsWith('/api/dispo?')) return Promise.resolve({ data: { mitarbeiter: mocks.dispoEmployees, eintraege: mocks.dispoEntries } });
    if (url.endsWith('/analytics/contingent')) return Promise.resolve({ data: { type: 'days-earnings', title: 'KZF 603 mit AZK', group: { legacyId: '27356' }, earningsStatus: 'RESOLVED', totalEarnings: '650.00', dayLimit: 70, earningsLimit: '603.00' } });
    throw new Error(`Unexpected request: ${url}`);
  });
  mocks.api.post.mockResolvedValue({ data: { _id: 'entry-1' } });
  mocks.comments.fetch.mockResolvedValue();
  mocks.comments.fetchChronikBatch.mockResolvedValue();
  mocks.comments.getCellComments.mockReturnValue([]);
  mocks.comments.cellUnreadCount.mockReturnValue(0);
  mocks.comments.chronikForMa.mockReturnValue([]);
  mocks.comments.post.mockResolvedValue();
  mocks.comments.delete.mockResolvedValue();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render() {
  wrapper = shallowMount(DispoTable, { attachTo: document.body, global: { stubs } });
  await flushPromises();
  wrapper.vm.nameMenu.ma = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test' };
  wrapper.vm.openVerfModal();
  await flushPromises();
}

describe('Dispo employee tariff contingents', () => {
  it('loads the same tariff view from both name triggers and only requests it on opening', async () => {
    mocks.dispoEmployees = [{ _id: 'employee-1', vorname: 'Ada', nachname: 'Test', isActive: true, arbeitsverhaeltnis: { typ: 2 } }];
    wrapper = shallowMount(DispoTable, { attachTo: document.body, global: { stubs } });
    await flushPromises();
    const cards = wrapper.findAllComponents(HoverDataCard);
    expect(cards).toHaveLength(2);
    expect(cards[0].props('disabled')).toBe(false);
    expect(cards[0].props('suppressed')).toBe(false);
    expect(cards[0].props('popout')).toBe(true);
    expect(mocks.openEmployeeContingent).not.toHaveBeenCalled();
    expect(mocks.api.get.mock.calls.some(([url]) => url.endsWith('/analytics/contingent'))).toBe(false);
    cards[0].vm.$emit('open'); cards[1].vm.$emit('open');
    await flushPromises();
    expect(mocks.api.get.mock.calls.filter(([url]) => url.endsWith('/analytics/contingent'))).toHaveLength(1);
    expect(cards[0].props('data')).toMatchObject({ type: 'days-earnings', group: { legacyId: '27356' }, employeeName: 'Ada Test', totalEarnings: '650.00' });
    expect(cards[1].props('data')).toEqual(cards[0].props('data'));
    expect(mocks.openEmployeeContingent).not.toHaveBeenCalled();
    cards[0].vm.$emit('popout');
    expect(mocks.openEmployeeContingent).toHaveBeenCalledWith(mocks.dispoEmployees[0], wrapper.vm.contingentPeriod,
      expect.objectContaining({ employeeName: 'Ada Test', type: 'days-earnings', totalEarnings: '650.00' }));
  });

  it('loads the shared card when mobile employee details expand, including direct selection', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);
    mocks.dispoEmployees = [{ _id: 'employee-1', vorname: 'Ada', nachname: 'Test', isActive: true }];
    wrapper = shallowMount(DispoTable, { attachTo: document.body, global: { stubs } });
    await flushPromises();
    expect(wrapper.findAllComponents(HoverDataCard)).toHaveLength(0);
    wrapper.vm.expandedCardId = 'employee-1';
    await flushPromises();
    const card = wrapper.findComponent(HoverDataCard);
    expect(card.props('inline')).toBe(true);
    expect(card.props('popout')).toBe(true);
    expect(card.props('data')).toMatchObject({ type: 'days-earnings', group: { legacyId: '27356' } });
    expect(mocks.api.get.mock.calls.filter(([url]) => url.endsWith('/analytics/contingent'))).toHaveLength(1);
    card.vm.$emit('popout');
    expect(mocks.openEmployeeContingent).toHaveBeenCalledTimes(1);
  });
});

describe('Dispo availability modal shared controls', () => {
  it('uses ModalFrame and keeps range entry and save payload', async () => {
    await render();
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({
      modelValue: true,
      title: 'Verfügbarkeiten — Ada Test',
      showClose: true,
    });
    expect(dialog().get('h3').attributes('id')).toBe('test-title');
    expect(dialog().get('input[type="date"]').attributes('aria-invalid')).toBe('false');
    await dialog().get('#verf-von-0').setValue('2026-10-01');
    await dialog().get('#verf-bis-0').setValue('2026-10-02');
    await dialog().findAll('button').find(button => button.text().includes('speichern')).trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/dispo', expect.objectContaining({
      mitarbeiter: 'employee-1', datumVon: '2026-10-01', datumBis: '2026-10-02', typ: 'verfuegbarkeit', verfuegbarkeit: 'available',
    }));
    expect(wrapper.getComponent(ModalFrame).props('modelValue')).toBe(false);
  });

  it('locks closing and duplicate submits during a pending save', async () => {
    await render();
    const zoomBefore = wrapper.vm.tableZoom;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    expect(wrapper.vm.tableZoom).toBe(zoomBefore);
    await dialog().get('#verf-von-0').setValue('2026-10-01');
    await dialog().get('#verf-bis-0').setValue('2026-10-02');
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    const save = dialog().findAll('button').find(button => button.text().includes('speichern'));
    await save.trigger('click');
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({ showClose: false, closeOnBackdrop: false, closeOnEscape: false });
    expect(save.attributes('aria-busy')).toBe('true');
    wrapper.getComponent(ModalFrame).vm.$emit('close');
    save.element.click();
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(wrapper.getComponent(ModalFrame).props('modelValue')).toBe(true);
    pending.resolve({ data: { _id: 'entry-1' } });
    await flushPromises();
    expect(wrapper.getComponent(ModalFrame).props('modelValue')).toBe(false);
  });

  it('keeps validation errors visible without submitting an incomplete range', async () => {
    await render();
    await dialog().findAll('button').find(button => button.text().includes('speichern')).trigger('click');
    expect(dialog().get('[role="alert"]').text()).toContain('Startdatum fehlt');
    expect(dialog().get('#verf-von-0').attributes('aria-invalid')).toBe('true');
    expect(dialog().get('#verf-von-0').attributes('aria-describedby')).toBe('verf-row-error-0');
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(wrapper.getComponent(ModalFrame).props('modelValue')).toBe(true);
  });

  it('keeps hard conflicts blocking save and splits the range around a planned day', async () => {
    mocks.dispoEntries = [{ _id: 'plan-1', mitarbeiter: 'employee-1', datumVon: '2026-10-02', datumBis: '2026-10-02', typ: 'planned' }];
    await render();
    await dialog().get('#verf-von-0').setValue('2026-10-01');
    await dialog().get('#verf-bis-0').setValue('2026-10-03');
    expect(dialog().text()).toContain('Einsatz-Konflikt');
    expect(dialog().findAll('button').find(button => button.text().includes('speichern')).attributes('disabled')).toBeDefined();
    await dialog().findAll('button').find(button => button.text().includes('Verfügbarkeit splitten')).trigger('click');
    expect(dialog().findAll('input[type="date"]').map(input => input.element.value)).toEqual([
      '2026-10-01', '2026-10-01', '2026-10-03', '2026-10-03',
    ]);
    expect(dialog().findAll('button').find(button => button.text().includes('speichern')).attributes('disabled')).toBeUndefined();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });
});

describe('Dispo comment dialog', () => {
  it('uses the shared frame and sends a comment from the labelled composer', async () => {
    await render();
    wrapper.vm.closeVerfModal();
    await wrapper.vm.openChatModal(
      { _id: 'employee-1', vorname: 'Ada', nachname: 'Test' },
      { iso: '2026-10-06' },
    );
    await flushPromises();

    const frame = wrapper.findAllComponents(ModalFrame).find(item => item.props('title')?.includes('Ada Test'));
    expect(frame.props('modelValue')).toBe(true);
    expect(dialog().get('h3').attributes('id')).toBe('test-title');
    await dialog().get('textarea[aria-label="Kommentar schreiben"]').setValue('Neue Nachricht');
    await dialog().get('button[aria-label="Kommentar senden"]').trigger('click');
    await flushPromises();

    expect(mocks.comments.post).toHaveBeenCalledWith({
      scope: 'dispo_day', text: 'Neue Nachricht',
      context: { mitarbeiter: 'employee-1', datum: '2026-10-06' },
    });
    frame.vm.$emit('close');
    await wrapper.vm.$nextTick();
    expect(frame.props('modelValue')).toBe(false);
  });
});

describe('Dispo customer wish persistence', () => {
  it('keeps the selected customer and type in the existing request', async () => {
    await render();
    wrapper.vm.closeVerfModal();
    wrapper.vm.openKwModal('employee-1');
    await wrapper.getComponent(KundenwunschModal).vm.$emit('submit', {
      kunde: { _id: 'customer-1' }, typ: 'negativ',
    });
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/personal/employee-1/kundenwuensche', {
      kunde: 'customer-1', typ: 'negativ',
    });
    expect(wrapper.getComponent(KundenwunschModal).props('open')).toBe(false);
  });

  it('blocks closing and duplicate submissions while saving, then permits retry after failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await render();
    wrapper.vm.closeVerfModal();
    wrapper.vm.openKwModal('employee-1');
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    const modal = wrapper.getComponent(KundenwunschModal);
    const selected = { kunde: { _id: 'customer-1' }, typ: 'positiv' };
    modal.vm.$emit('submit', selected);
    await wrapper.vm.$nextTick();
    expect(modal.props('saving')).toBe(true);
    modal.vm.$emit('close');
    modal.vm.$emit('submit', selected);
    expect(modal.props('open')).toBe(true);
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    pending.reject(new Error('offline'));
    await flushPromises();
    expect(modal.props('error')).toContain('Bitte erneut versuchen');
    expect(modal.props('saving')).toBe(false);
    modal.vm.$emit('submit', selected);
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledTimes(2);
    expect(modal.props('open')).toBe(false);
    consoleError.mockRestore();
  });
});
