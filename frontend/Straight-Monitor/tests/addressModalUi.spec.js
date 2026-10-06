import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AddressModal from '../src/components/Modals/AddressModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const frameStub = {
  props: ['modelValue', 'title', 'closeOnEscape', 'closeOnBackdrop', 'showClose'],
  template: '<section v-if="modelValue" role="dialog"><slot /><slot name="footer" /></section>',
};

describe('reusable address modal', () => {
  it('copies an existing address and emits only normalized address fields', async () => {
    const wrapper = mount(AddressModal, {
      props: {
        modelValue: true,
        address: { street: 'Alte Straße 1', zip: '12345', city: 'Berlin', country: 'Deutschland', internalId: 'keep-out' },
      },
      global: { stubs: { ModalFrame: frameStub } },
    });

    expect(wrapper.getComponent(ModalFrame).props('title')).toBe('Adresse eingeben');
    expect(wrapper.get('input[autocomplete="street-address"]').element.value).toBe('Alte Straße 1');
    await wrapper.get('input[autocomplete="street-address"]').setValue(' Neue Straße 2 ');
    await wrapper.get('input[autocomplete="address-level2"]').setValue(' Hamburg ');
    await wrapper.findAll('button').find(button => button.text() === 'Speichern').trigger('click');

    expect(wrapper.emitted('save')).toEqual([[{
      street: 'Neue Straße 2', zip: '12345', city: 'Hamburg', country: 'Deutschland',
    }]]);
    wrapper.unmount();
  });

  it('resets its draft on reopen and prevents saving while busy', async () => {
    const wrapper = mount(AddressModal, {
      props: { modelValue: false, address: { street: 'Erste Straße' } },
      global: { stubs: { ModalFrame: frameStub } },
    });
    await wrapper.setProps({ modelValue: true });
    expect(wrapper.get('input[autocomplete="street-address"]').element.value).toBe('Erste Straße');
    await wrapper.get('input[autocomplete="street-address"]').setValue('Entwurf');
    await wrapper.setProps({ modelValue: false, address: { street: 'Zweite Straße' } });
    await wrapper.setProps({ modelValue: true, saving: true });
    expect(wrapper.get('input[autocomplete="street-address"]').element.value).toBe('Zweite Straße');
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({ closeOnEscape: false, closeOnBackdrop: false, showClose: false });
    await wrapper.findAll('button').find(button => button.text() === 'Speichern').trigger('click');
    expect(wrapper.emitted('save')).toBeUndefined();
    wrapper.unmount();
  });
});
