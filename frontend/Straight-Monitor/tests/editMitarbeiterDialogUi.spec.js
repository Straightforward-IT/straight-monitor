import { afterEach, describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import EditMitarbeiterDialog from '../src/components/Modals/EditMitarbeiterDialog.vue';

const frameStub = {
  name: 'ModalFrame',
  props: ['showClose', 'closeOnBackdrop', 'closeOnEscape', 'title', 'layer'],
  emits: ['close'],
  template: '<div role="dialog"><slot /><slot name="footer" /></div>',
};

const employee = () => ({
  _id: 'employee-1',
  vorname: 'Ada',
  nachname: 'Test',
  personalnr: '100',
  email: 'ada@example.com',
  nationalitaet: '000',
  additionalEmails: ['alt@example.com'],
  personalnrHistory: [],
  adresse: { strasse: 'Altweg', plz: '20000', ort: 'Hamburg', land: 'DE' },
});

let wrapper;
function render(props = {}) {
  wrapper = shallowMount(EditMitarbeiterDialog, {
    attachTo: document.body,
    props: { mitarbeiter: employee(), ...props },
    global: {
      stubs: {
        ModalFrame: frameStub,
        AppButton: false,
        AppIconButton: false,
        AppTextInput: false,
        AppSelect: false,
        'font-awesome-icon': true,
      },
    },
  });
  return wrapper;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe('EditMitarbeiterDialog shared controls', () => {
  it('associates labels with shared inputs and preserves the save payload', async () => {
    render({ nationalitaeten: [{ schluessel: '000', staat: 'Deutschland', natKennz: 'DE' }] });
    const firstName = wrapper.get('input.app-text-input');
    expect(wrapper.get('label[for]').attributes('for')).toBe(firstName.attributes('id'));
    expect(firstName.element.value).toBe('Ada');
    expect(wrapper.get('select.app-select').element.value).toBe('000');
    expect(wrapper.get('input[aria-label="Alternative E-Mail 1"]').element.value).toBe('alt@example.com');

    await wrapper.get('input[id$="-personalnr"]').setValue('200');
    await wrapper.get('input[id$="-adresse-strasse"]').setValue('Neuweg');
    await wrapper.findAll('.modal-footer-actions button').find(button => button.text().includes('Speichern')).trigger('click');
    const payload = wrapper.emitted('save')?.[0]?.[0];
    expect(payload.personalnr).toBe('200');
    expect(payload.adresse.strasse).toBe('Neuweg');
    expect(payload.personalnrHistory[0].value).toBe('100');
    expect(payload.additionalEmails).toEqual(['alt@example.com']);
  });

  it('disables the form and closing controls while saving', async () => {
    render({ saving: true });
    const frame = wrapper.findComponent({ name: 'ModalFrame' });
    expect(frame.props()).toMatchObject({ showClose: false, closeOnBackdrop: false, closeOnEscape: false, layer: 'elevated' });
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
    expect(wrapper.get('fieldset').attributes('aria-busy')).toBe('true');
    expect(wrapper.findAll('.modal-footer-actions button').every(button => button.attributes('disabled') !== undefined)).toBe(true);
    frame.vm.$emit('close');
    expect(wrapper.emitted('close')).toBeUndefined();

    await wrapper.setProps({ saving: false });
    expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined();
    frame.vm.$emit('close');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('keeps conflict confirmation on a separate guarded action', async () => {
    render({ conflictInfo: { name: 'Andere Person' } });
    expect(wrapper.get('.conflict-warning').text()).toContain('Andere Person');
    await wrapper.findAll('.conflict-actions button').find(button => button.text().includes('Trotzdem zuweisen')).trigger('click');
    expect(wrapper.emitted('save-force')?.[0]?.[0].personalnr).toBe('100');

    await wrapper.setProps({ saving: true });
    expect(wrapper.findAll('.conflict-actions button').every(button => button.attributes('disabled') !== undefined)).toBe(true);
  });
});
