import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import EmployeeCard from '../src/components/EmployeeCard.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import AppIconButton from '../src/components/ui-elements/AppIconButton.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn() },
  updateEmployee: vi.fn(),
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { roles: ['ADMIN'] } }) }));
vi.mock('@/stores/theme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/stores/flipAll', () => ({ useFlipAll: () => ({ enablePhotos: false, ensurePhoto: vi.fn() }) }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => ({ updateOneMitarbeiter: mocks.updateEmployee }) }));
vi.mock('@/stores/signaturModal', () => ({ useSignaturModal: () => ({}) }));
vi.mock('@/composables/useDocumentModals', () => ({ useDocumentModals: () => ({ openDocument: vi.fn() }) }));
vi.mock('@/composables/useTimeCaptureModals', () => ({ useTimeCaptureModals: () => ({ openTimeCapture: vi.fn() }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), resolve: vi.fn() }) }));

const frameStub = {
  props: ['title', 'showClose', 'closeOnBackdrop', 'closeOnEscape', 'layer'],
  emits: ['close'],
  template: '<div role="dialog" aria-labelledby="reactivation-title"><slot name="header" title-id="reactivation-title" /><slot /><slot name="footer" /></div>',
};
const employee = () => ({ _id: 'employee-1', vorname: 'Ada', nachname: 'Test', isActive: false, flip: { id: 'flip-1' }, qualifikationen: [] });
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockResolvedValue({ data: { data: [] } });
  mocks.api.patch.mockResolvedValue({ data: { success: true } });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});
function render(props = {}) {
  wrapper = shallowMount(EmployeeCard, {
    props: { ma: employee(), ...props },
    global: { stubs: { ModalFrame: frameStub, AppIconButton: false, AppButton: false, 'font-awesome-icon': true } },
  });
  return wrapper;
}

describe('EmployeeCard shared shell controls', () => {
  it('uses labelled shared header controls without toggling the card', async () => {
    render({ showClose: true });
    const close = wrapper.getComponent(AppIconButton);
    expect(close.props('label')).toBe('Schließen');
    await close.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.vm.expanded).toBe(false);

    await wrapper.setProps({ showClose: false });
    wrapper.vm.expanded = true;
    await wrapper.vm.$nextTick();
    const open = wrapper.getComponent(AppIconButton);
    expect(open.props('label')).toBe('Mitarbeiterprofil in Fenster öffnen');
    await open.trigger('click');
    expect(wrapper.emitted('open-profile-modal')?.[0]).toEqual(['employee-1']);
  });

  it('keeps the reactivation dialog open and non-dismissible while the request is pending', async () => {
    render();
    wrapper.vm.showReaktivierungModal = true;
    await wrapper.vm.$nextTick();
    const frame = wrapper.getComponent(ModalFrame);
    expect(frame.props()).toMatchObject({ title: 'Ada Test reaktivieren', layer: 'elevated' });
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe(wrapper.get('h3').attributes('id'));
    const pending = deferred();
    mocks.api.patch.mockReturnValueOnce(pending.promise);
    await wrapper.findAll('button').find(button => button.text().includes('Jetzt reaktivieren')).trigger('click');
    expect(frame.props()).toMatchObject({ showClose: false, closeOnBackdrop: false, closeOnEscape: false });
    frame.vm.$emit('close');
    await wrapper.vm.confirmReaktivierung();
    wrapper.vm.toggle();
    expect(mocks.api.patch).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.showReaktivierungModal).toBe(true);
    expect(wrapper.vm.expanded).toBe(false);
    pending.resolve({ data: { success: true } });
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/personal/mitarbeiter/employee-1', { isActive: true });
    expect(wrapper.emitted('reactivated')).toHaveLength(1);
    expect(wrapper.vm.showReaktivierungModal).toBe(false);
  });

  it('shows an inline error and permits retry when reactivation fails', async () => {
    render();
    wrapper.vm.showReaktivierungModal = true;
    mocks.api.patch.mockResolvedValueOnce({ data: { success: false } });
    await wrapper.vm.$nextTick();
    await wrapper.findAll('button').find(button => button.text().includes('Jetzt reaktivieren')).trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('erneut versuchen');
    expect(wrapper.emitted('reactivated')).toBeUndefined();
    expect(wrapper.vm.showReaktivierungModal).toBe(true);
    await wrapper.findAll('button').find(button => button.text().includes('Jetzt reaktivieren')).trigger('click');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('reactivated')).toHaveLength(1);
  });
});
