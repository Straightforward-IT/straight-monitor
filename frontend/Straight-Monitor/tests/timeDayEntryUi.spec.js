import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TimeDayEntryModal from '../src/components/Modals/TimeDayEntryModal.vue';

let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; });

describe('time day entry shared form controls', () => {
  it('keeps numeric entry and native form submission', async () => {
    wrapper = mount(TimeDayEntryModal, {
      props: { month: '2026-09', initialDate: '2026-09-08', dayEntryTypes: [{ code: 'K', label: 'Krankheit', credited: true }] },
      global: { stubs: { ModalFrame: { template: '<div><slot/><slot name="footer"/></div>' } } },
    });

    expect(wrapper.get('input[type="date"]').classes()).toContain('app-text-input');
    expect(wrapper.get('select').classes()).toContain('app-select');
    expect(wrapper.findAll('button').find(button => button.text() === 'Eintrag anlegen').classes()).toContain('app-button');
    await wrapper.get('input[type="number"][max="24"]').setValue('2');
    await wrapper.get('input[type="number"][max="59"]').setValue('30');
    await wrapper.get('input[maxlength="160"]').setValue('Geprüft');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('create')[0][0]).toMatchObject({ date: '2026-09-08', code: 'K', minutes: 150, note: 'Geprüft' });
  });
});
