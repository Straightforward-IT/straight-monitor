import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import KundenwunschModal from '../src/components/Modals/KundenwunschModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import KundeSearch from '../src/components/ui-elements/KundeSearch.vue';

const frameStub = {
  props: ['modelValue', 'title', 'showClose', 'closeOnBackdrop', 'closeOnEscape'],
  emits: ['close'],
  template: '<div v-if="modelValue" role="dialog" aria-labelledby="title-id"><h3 id="title-id">{{ title }}</h3><slot /></div>',
};
const searchStub = {
  props: ['inputId', 'disabled', 'locationV2', 'mitarbeiterId'],
  emits: ['select'],
  template: '<input :id="inputId" :disabled="disabled" />',
};
const createModal = (props = {}) => mount(KundenwunschModal, {
  props: { open: true, mitarbeiterId: 'employee-1', locationV2: 'location-1', ...props },
  global: { stubs: { ModalFrame: frameStub, KundeSearch: searchStub } },
});

describe('KundenwunschModal', () => {
  it('uses the shared frame and submits the selected customer with the chosen type', async () => {
    const wrapper = createModal();
    expect(wrapper.getComponent(ModalFrame).props('title')).toBe('Kundenwunsch hinzufügen');
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe('title-id');
    expect(wrapper.get('label').attributes('for')).toBe('kundenwunsch-kunde');
    expect(wrapper.getComponent(KundeSearch).props()).toMatchObject({
      inputId: 'kundenwunsch-kunde', mitarbeiterId: 'employee-1', locationV2: 'location-1',
    });
    const choices = wrapper.findAll('.kundenwunsch-modal__choice');
    expect(choices.map(button => button.attributes('aria-pressed'))).toEqual(['true', 'false']);
    await choices[1].trigger('click');
    expect(choices.map(button => button.attributes('aria-pressed'))).toEqual(['false', 'true']);
    wrapper.getComponent(KundeSearch).vm.$emit('select', { _id: 'customer-1' });
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ kunde: { _id: 'customer-1' }, typ: 'negativ' }]);
    wrapper.unmount();
  });

  it('locks dismissal and search while saving, then offers retry on a visible error', async () => {
    const wrapper = createModal();
    wrapper.getComponent(KundeSearch).vm.$emit('select', { _id: 'customer-1' });
    await wrapper.setProps({ saving: true });
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({
      showClose: false, closeOnBackdrop: false, closeOnEscape: false,
    });
    expect(wrapper.getComponent(KundeSearch).props('disabled')).toBe(true);
    expect(wrapper.get('#kundenwunsch-kunde').attributes('disabled')).toBeDefined();
    wrapper.getComponent(ModalFrame).vm.$emit('close');
    expect(wrapper.emitted('close')).toBeUndefined();
    await wrapper.setProps({ saving: false, error: 'Speichern fehlgeschlagen' });
    expect(wrapper.get('[role="alert"]').text()).toContain('Speichern fehlgeschlagen');
    await wrapper.findAll('button').find(button => button.text().includes('Erneut versuchen')).trigger('click');
    expect(wrapper.emitted('submit')).toHaveLength(2);
    wrapper.unmount();
  });
});
