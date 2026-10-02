import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ExportMitarbeiterModal from '../src/components/ExportMitarbeiterModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: api }));

beforeEach(() => {
  api.get.mockResolvedValue({ data: { data: [] } });
});

const frameStub = {
  props: ['title', 'subtitle'],
  template: '<section role="dialog"><slot /><footer><slot name="footer" /></footer></section>',
};

describe('personal export shared actions', () => {
  it('names column and row actions and updates the preview without changing export data', async () => {
    const wrapper = mount(ExportMitarbeiterModal, {
      props: { mitarbeiterList: [
        { _id: 'employee-1', vorname: 'Jane', nachname: 'Doe' },
        { _id: 'employee-2', vorname: 'John', nachname: 'Doe' },
      ] },
      global: { stubs: { ModalFrame: frameStub, ContextMenu: true, 'font-awesome-icon': true } },
    });
    await flushPromises();
    expect(wrapper.getComponent(ModalFrame).props('subtitle')).toBe('2 Mitarbeiter');
    expect(wrapper.get('button[aria-label="Vorname entfernen"]').classes()).toContain('app-button');
    expect(wrapper.get('button[aria-label="Spalte hinzufügen"]').classes()).toContain('app-button');
    await wrapper.get('button[aria-label="Jane Doe aus Export entfernen"]').trigger('click');
    expect(wrapper.getComponent(ModalFrame).props('subtitle')).toBe('1 Mitarbeiter');
    expect(wrapper.findAll('.preview-table tbody tr')).toHaveLength(1);
    await wrapper.get('button[aria-label="Vorname entfernen"]').trigger('click');
    expect(wrapper.get('.footer-info').text()).toContain('3 Spalten');
    wrapper.unmount();
  });
});
