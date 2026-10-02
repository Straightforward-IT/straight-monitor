import { afterEach, describe, expect, it } from 'vitest';
import { DOMWrapper, mount } from '@vue/test-utils';
import HelpModal from '../src/components/Modals/HelpModal.vue';
import PayrollHelpModal from '../src/components/Modals/PayrollHelpModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

let wrapper;
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe('shared HelpModal', () => {
  it('keeps its custom heading associated with the dialog and closes through ModalFrame', async () => {
    wrapper = mount(HelpModal, {
      attachTo: document.body,
      props: { modelValue: true },
      slots: {
        title: 'Dispo-Tabelle — Hilfe',
        toc: '<nav class="help-toc"><button data-section="help-one">Inhalt</button></nav>',
        default: '<section id="help-one" class="help-section">Hilfetext</section>',
      },
      global: { stubs: { 'font-awesome-icon': true, CustomTooltip: { template: '<div><slot /></div>' } } },
    });
    const dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(wrapper.getComponent(ModalFrame).props('title')).toBe('Hilfe');
    expect(dialog.attributes('aria-labelledby')).toBe(dialog.get('h3').attributes('id'));
    expect(dialog.get('h3').text()).toBe('Dispo-Tabelle — Hilfe');
    expect(dialog.get('.help-modal-toc').text()).toContain('Inhalt');
    await dialog.get('button[aria-label="Schließen"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false]);
  });

  it('retains the existing payroll help title and native TOC consumer', () => {
    wrapper = mount(PayrollHelpModal, {
      attachTo: document.body,
      props: { modelValue: true },
      global: { stubs: { 'font-awesome-icon': true, CustomTooltip: { template: '<div><slot /></div>' } } },
    });
    const dialog = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(dialog.get('h3').text()).toBe('Stundenerfassung — Anleitung');
    expect(dialog.attributes('aria-labelledby')).toBe(dialog.get('h3').attributes('id'));
    expect(dialog.get('.help-toc').findAll('button')).toHaveLength(6);
  });
});
