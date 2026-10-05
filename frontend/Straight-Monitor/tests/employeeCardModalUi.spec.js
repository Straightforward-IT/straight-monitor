import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EmployeeCardModal from '../src/components/Modals/EmployeeCardModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({ dock: { open: vi.fn(), get: vi.fn(), remove: vi.fn(), updateTitle: vi.fn() } }));
vi.mock('@bleck-it/vue-modal-dock', () => ({
  useDockedModals: () => mocks.dock,
  useCurrentDockedModal: () => null,
  MinimizableRegion: {},
  MinimizeButton: {},
}));

const frameStub = {
  props: { minimizable: Boolean, minimizeTitle: String, showClose: Boolean },
  emits: ['close'],
  template: '<div role="dialog" v-bind="$attrs"><slot /></div>',
};
const cardStub = {
  name: 'EmployeeCard',
  props: { mitarbeiterId: String, initiallyExpanded: Boolean, showClose: Boolean },
  emits: ['close', 'profile-loaded'],
  template: '<div class="employee-card-stub" />',
};
const render = props => mount(EmployeeCardModal, {
  props,
  global: { stubs: { ModalFrame: frameStub, EmployeeCard: cardStub } },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('EmployeeCardModal shared frame', () => {
  it('keeps the hosted docked frame and updates its accessible employee name', async () => {
    mocks.dock.get.mockReturnValue({ title: 'Mitarbeiterprofil', props: { mitarbeiterId: 'employee-1', hosted: true }, persistence: { type: 'employee-card' } });
    const wrapper = render({ mitarbeiterId: 'employee-1', hosted: true });
    const frame = wrapper.getComponent(ModalFrame);
    expect(frame.props()).toMatchObject({ minimizable: true, showClose: false, minimizeTitle: 'Mitarbeiterprofil' });
    expect(frame.attributes('aria-label')).toBe('Mitarbeiterprofil');
    const card = wrapper.getComponent({ name: 'EmployeeCard' });
    expect(card.props()).toMatchObject({ mitarbeiterId: 'employee-1', initiallyExpanded: true, showClose: true });
    card.vm.$emit('profile-loaded', { vorname: 'Ada', nachname: 'Test' });
    await wrapper.vm.$nextTick();
    expect(frame.attributes('aria-label')).toBe('Ada Test');
    expect(mocks.dock.updateTitle).toHaveBeenCalledWith('employee-employee-1', 'Ada Test');
    card.vm.$emit('close');
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('delegates one employee profile to the global dock without an extra local frame', () => {
    const wrapper = render({ mitarbeiterId: 'employee-1' });
    expect(mocks.dock.open).toHaveBeenCalledWith(expect.objectContaining({
      id: 'employee-employee-1',
      props: expect.objectContaining({ mitarbeiterId: 'employee-1', hosted: true }),
    }));
    expect(wrapper.findComponent(ModalFrame).exists()).toBe(false);
    wrapper.unmount();
  });
});
