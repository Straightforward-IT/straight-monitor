import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import TimeCaptureModal from '../src/components/Modals/TimeCaptureModal.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn(), push: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: { get: mocks.get } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));

let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.clearAllMocks(); });

describe('time capture modal shared controls', () => {
  it('keeps dirty-close confirmation and exposes readable reload/order controls', async () => {
    mocks.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/orders')
      ? { orders: [{ auftragNr: '42', eventTitel: 'Einsatz' }] }
      : { auftrag: { eventTitel: 'Einsatz' }, einsaetze: [], entries: [] } }));
    wrapper = mount(TimeCaptureModal, {
      props: { employeeId: 'employee-1', minimizeId: 'time-capture-test' },
      global: { stubs: {
        ModalFrame: { template: '<div><slot name="actions"/><slot/><button data-test="frame-close" @click="$emit(\'close\')">Schließen</button></div>' },
        CustomTooltip: { template: '<div><slot/></div>' },
        Toolbar: { template: '<div><slot name="filter"/><slot/></div>' },
        ToolbarFilter: true,
        SearchBar: true,
        OrderDocuments: true,
        Stundenschnellerfassung: { template: '<button data-test="mark-dirty" @click="$emit(\'dirty-change\', true)">Ändern</button>' },
      } },
    });
    await flushPromises();

    expect(wrapper.get('button[aria-label="Neu laden"]').classes()).toContain('app-button');
    expect(wrapper.get('select[aria-label="Auftrag"]').classes()).toContain('app-select');
    await wrapper.get('[data-test="mark-dirty"]').trigger('click');
    await wrapper.get('[data-test="frame-close"]').trigger('click');
    expect(wrapper.get('.time-capture__confirm').text()).toContain('Ungespeicherte Änderungen verwerfen?');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();

    await wrapper.findAll('.time-capture__confirm button').find(button => button.text() === 'Weiter bearbeiten').trigger('click');
    expect(wrapper.find('.time-capture__confirm').exists()).toBe(false);
    await wrapper.get('[data-test="frame-close"]').trigger('click');
    await wrapper.findAll('.time-capture__confirm button').find(button => button.text() === 'Verwerfen').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
