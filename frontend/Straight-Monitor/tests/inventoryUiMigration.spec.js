import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import InventoryItemModal from '../src/components/InventoryItemModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  exportPdf: vi.fn(),
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: mocks.exportPdf }));

const wrappers = [];
const global = {
  stubs: {
    teleport: true,
    CustomTooltip: { template: '<div><slot /></div>' },
    'font-awesome-icon': true,
  },
};
function render(component, options) {
  const wrapper = mount(component, { global, ...options });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.get.mockResolvedValue({ data: [{ _id: 'hamburg', shortName: 'HH', nameFull: 'Hamburg' }] });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
});

describe('inventory item shared-control migration', () => {
  it('loads when mounted open and submits numeric stock data through the shared inputs', async () => {
    mocks.api.post.mockResolvedValue({ data: { _id: 'new-item' } });
    const wrapper = render(InventoryItemModal, { props: { modelValue: true } });
    await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/locations');
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe(wrapper.get('h3').attributes('id'));
    expect(wrapper.get('.app-button--primary').attributes('disabled')).toBeDefined();
    await wrapper.get('input[placeholder="z. B. T-Shirt"]').setValue('T-Shirt');
    await wrapper.get('.location-chip input').setValue(true);
    const numbers = wrapper.findAll('.matrix-row input[type="number"]');
    await numbers[0].setValue('12');
    await numbers[1].setValue('20');
    await wrapper.get('.app-button--primary').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/inventory/items', expect.objectContaining({
      bezeichnung: 'T-Shirt',
      bestaende: [expect.objectContaining({ location: 'hamburg', bestand: 12, soll: 20, groesseKey: 'onesize' })],
    }));
    expect(wrapper.emitted('created')).toEqual([[{ _id: 'new-item' }]]);
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('preserves stock IDs when editing and retains input after a failed request', async () => {
    mocks.api.patch.mockRejectedValueOnce({ response: { data: { message: 'Speichern fehlgeschlagen' } } });
    const wrapper = render(InventoryItemModal, {
      props: {
        modelValue: true,
        item: {
          _id: 'item-1', bezeichnung: 'Jacke',
          stocks: [{ _id: 'stock-1', locationId: 'hamburg', bestand: 3, soll: 7, groesseKey: 'onesize' }],
        },
      },
    });
    await flushPromises();
    const amount = wrapper.get('.matrix-row input[type="number"]');
    expect(amount.element.value).toBe('3');
    await amount.setValue('9');
    await wrapper.get('.app-button--primary').trigger('click');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/inventory/items/item-1', expect.objectContaining({
      bestaende: [expect.objectContaining({ stockId: 'stock-1', location: 'hamburg', bestand: 9, soll: 7 })],
    }));
    expect(wrapper.get('.error').text()).toBe('Speichern fehlgeschlagen');
    expect(amount.element.value).toBe('9');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.get('.app-button--primary').attributes('disabled')).toBeUndefined();
    await wrapper.get('.app-button--secondary').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true, item: null });
    await flushPromises();
    expect(wrapper.get('input[placeholder="z. B. T-Shirt"]').element.value).toBe('');
    expect(wrapper.find('.matrix-row').exists()).toBe(false);
  });
});

describe('shared modal header actions', () => {
  it('exports the dialog via the shared PDF button and closes via the shared close button', async () => {
    const wrapper = render(ModalFrame, {
      props: { modelValue: true, title: 'Bestand', pdfExport: true },
      slots: { default: '<p>Artikel</p>' },
    });
    expect(document.body.style.overflow).toBe('hidden');
    await wrapper.get('button[aria-label="Als PDF exportieren"]').trigger('click');
    expect(mocks.exportPdf).toHaveBeenCalledWith(wrapper.get('[role="dialog"]').element, { title: 'Bestand' });
    await wrapper.get('button[aria-label="Schließen"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    expect(wrapper.emitted('close')).toHaveLength(1);
    await wrapper.setProps({ modelValue: false });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});
