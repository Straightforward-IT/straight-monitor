import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, shallowMount } from '@vue/test-utils';
import DispoTable from '../src/components/DispoTable.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import KundenwunschModal from '../src/components/Modals/KundenwunschModal.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  comments: { zvooveItems: [], fetch: vi.fn(), fetchChronikBatch: vi.fn(), getCellComments: vi.fn(), cellUnreadCount: vi.fn(), chronikForMa: vi.fn(), markRead: vi.fn(), post: vi.fn(), delete: vi.fn() },
  dispoEntries: [],
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
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
  mocks.dispoEntries = [];
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/users/me') return Promise.resolve({ data: { dispoPrefs: {} } });
    if (url === '/api/locations') return Promise.resolve({ data: [] });
    if (url.startsWith('/api/dispo?')) return Promise.resolve({ data: { mitarbeiter: [], eintraege: mocks.dispoEntries } });
    throw new Error(`Unexpected request: ${url}`);
  });
  mocks.api.post.mockResolvedValue({ data: { _id: 'entry-1' } });
  mocks.comments.fetch.mockResolvedValue();
  mocks.comments.fetchChronikBatch.mockResolvedValue();
  mocks.comments.getCellComments.mockReturnValue([]);
  mocks.comments.post.mockResolvedValue();
  mocks.comments.delete.mockResolvedValue();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.restoreAllMocks();
});
async function render() {
  wrapper = shallowMount(DispoTable, { attachTo: document.body, global: { stubs } });
  await flushPromises();
  wrapper.vm.nameMenu.ma = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test' };
  wrapper.vm.openVerfModal();
  await flushPromises();
}

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
