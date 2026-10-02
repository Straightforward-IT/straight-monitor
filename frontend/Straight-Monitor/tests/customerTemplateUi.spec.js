import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import EinsatzinformationenEditor from '../src/components/customer/EinsatzinformationenEditor.vue';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: api }));

const savedTemplate = {
  _id: 'template-1', version: 1, name: 'Kunden-Default', htmlTemplate: '<p>Hallo</p>', isActive: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url.endsWith('/einsatzinformationen')) return { data: { templates: [savedTemplate], placeholders: {} } };
    return { data: { data: [] } };
  });
  api.post.mockResolvedValue({ data: { renderedHtml: '<p>Hallo</p>', unresolvedPlaceholders: [] } });
  api.put.mockResolvedValue({ data: { template: savedTemplate } });
});

describe('customer template controls', () => {
  it('uses shared fields/actions and locks edits during a save', async () => {
    const wrapper = mount(EinsatzinformationenEditor, { props: { kundenNr: 123 } });
    await flushPromises();
    expect(wrapper.get('.form-grid input').classes()).toContain('app-text-input');
    expect(wrapper.get('.scope-card').attributes('aria-pressed')).toBe('true');

    let finishSave;
    api.put.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    await wrapper.findAll('button').find(button => button.text() === 'Vorlage speichern').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.scope-card').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.rich-template-editor__surface').attributes('contenteditable')).toBe('false');
    expect(wrapper.get('.form-grid input').attributes('disabled')).toBeDefined();

    finishSave({ data: { template: savedTemplate } });
    await flushPromises();
    expect(api.put).toHaveBeenCalledWith('/api/kunden/123/einsatzinformationen/template-1', expect.objectContaining({ name: 'Kunden-Default' }));
    expect(wrapper.get('.scope-card').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('keeps site variants selectable with shared select controls', async () => {
    const wrapper = mount(EinsatzinformationenEditor, {
      props: { kundenNr: 123, einsatzorte: [{ _id: 'site-1', bezeichnung: 'Filiale', adresse: {} }] },
    });
    await flushPromises();
    await wrapper.get('.add-variant').trigger('click');
    expect(wrapper.get('.form-grid input').element.value).toContain('Filiale');
    expect(wrapper.findAll('.form-grid select')).toHaveLength(2);
    expect(wrapper.findAll('.form-grid select').every(select => select.classes().includes('app-select'))).toBe(true);
    wrapper.unmount();
  });
});
