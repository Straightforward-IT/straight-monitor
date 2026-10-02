import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import ReisekostenModal from '../src/components/Modals/ReisekostenModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import AddressAutocomplete from '../src/components/ui-elements/AddressAutocomplete.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));

const stubs = {
  'font-awesome-icon': true,
  MinimizableRegion: { template: '<div><slot :minimized="false" /></div>' },
  MinimizeButton: true,
  AddressAutocomplete: { props: ['modelValue', 'localSuggestions', 'searchSuggestions', 'disabled'], template: '<input :value="modelValue" />' },
};
const employee = { personalNr: 7, mitarbeiterData: { vorname: 'Ada', nachname: 'Test' } };
const defaults = { kopf: { name: 'Test', vorname: 'Ada' } };
const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]'));
const button = text => dialog().findAll('button').find(b => b.text().includes(text));
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockResolvedValue({ data: defaults });
  mocks.api.post.mockResolvedValue({ data: { data: { _id: 'rk-1', anlagen: [] } } });
  mocks.api.put.mockResolvedValue({ data: { data: { _id: 'rk-1' } } });
  mocks.api.delete.mockResolvedValue({ data: { data: { anlagen: [] } } });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});
async function render(props = {}) {
  wrapper = mount(ReisekostenModal, {
    attachTo: document.body,
    props: { modelValue: true, auftragNr: 42, einsaetze: [employee], ...props },
    global: { stubs },
  });
  await flushPromises();
}

describe('ReisekostenModal shared-control migration', () => {
  it('provides its remote address source to the reusable UI component', async () => {
    await render();
    await button('Weiter').trigger('click');
    await button('Fahrt').trigger('click');
    const fields = wrapper.findAllComponents(AddressAutocomplete);
    expect(fields).toHaveLength(2);
    expect(fields[0].props('localSuggestions')).toEqual([]);
    mocks.api.get.mockResolvedValueOnce({ data: { suggestions: ['Hamburg Hbf'] } });
    await expect(fields[0].props('searchSuggestions')('Hamburg')).resolves.toEqual(['Hamburg Hbf']);
    expect(mocks.api.get).toHaveBeenLastCalledWith('/api/reisekosten/address-search', { params: { q: 'Hamburg' } });
  });

  it('preserves the docked frame and allows saving from every wizard step', async () => {
    await render();
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({ minimizable: true, minimizeId: 'reisekosten' });
    expect(dialog().findAll('.rk-step')).toHaveLength(4);
    await button('Weiter').trigger('click');
    expect(dialog().get('.rk-step[aria-current="step"]').text()).toContain('Reisedaten');
    expect(button('Speichern').attributes('disabled')).toBeUndefined();
    await button('Speichern').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/reisekosten', expect.objectContaining({ auftragNr: 42, personalNr: 7 }));
    expect(wrapper.emitted('saved')[0][0]).toMatchObject({ sign: false, doc: { _id: 'rk-1' } });
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false]);
  });

  it('locks navigation, dismissal and duplicate requests while saving', async () => {
    await render();
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    await button('Speichern').trigger('click');
    expect(button('Speichern').attributes('aria-busy')).toBe('true');
    expect(button('Weiter').attributes('disabled')).toBeDefined();
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({ showClose: false, closeOnBackdrop: false, closeOnEscape: false });
    button('Speichern').element.click();
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    pending.resolve({ data: { data: { _id: 'rk-1' } } });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false]);
  });

  it('uses labeled add and remove controls and keeps row data in the save payload', async () => {
    await render();
    await button('Weiter').trigger('click');
    await button('Fahrt').trigger('click');
    expect(dialog().get('button[aria-label="Fahrt 1 entfernen"]')).toBeTruthy();
    await dialog().get('.reise-row input[type="number"]').setValue('12.5');
    await button('Speichern').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/reisekosten', expect.objectContaining({
      reisedaten: [expect.objectContaining({ kilometer: 12.5 })],
      kilometerpauschale: [expect.objectContaining({ kilometer: 12.5 })],
    }));
  });

  it('keeps text edits and decimal expense amounts in the cents-based payload', async () => {
    await render();
    expect(dialog().get('label').text()).toContain('Name, Vorname');
    expect(dialog().get('input[disabled]').element.value).toBe('Test, Ada');
    await dialog().get('label:has(input[placeholder="z. B. HH-AB 123"]) input').setValue('HH-AB 123');
    await dialog().get('label:has(input[type="number"]) input[type="number"]').setValue('2');
    await dialog().findAll('.rk-step')[2].trigger('click');
    const fahrtkosten = dialog().findAll('.rk-block').find(block => block.find('h4').exists() && block.get('h4').text().startsWith('Fahrtkosten'));
    await fahrtkosten.get('button').trigger('click');
    await dialog().get('input[aria-label="Fahrtkosten 1 Bezeichnung"]').setValue('Parken');
    await dialog().get('input[aria-label="Fahrtkosten 1 Betrag in Euro"]').setValue('12.34');
    await dialog().get('input[aria-label="Vorschuss in Euro"]').setValue('1.50');
    await button('Speichern').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/reisekosten', expect.objectContaining({
      kopf: expect.objectContaining({ nummernschild: 'HH-AB 123', tage: 2 }),
      fahrtkosten: [expect.objectContaining({ bezeichnung: 'Parken', betragCent: 1234 })],
      vorschussCent: 150,
    }));
  });

  it('retains upload auto-save and prevents parallel attachment deletion', async () => {
    await render();
    await dialog().findAll('.rk-step')[3].trigger('click');
    const input = dialog().get('input[type="file"]');
    const file = new File(['receipt'], 'beleg.pdf', { type: 'application/pdf' });
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
    mocks.api.post.mockResolvedValueOnce({ data: { data: { _id: 'rk-1' } } })
      .mockResolvedValueOnce({ data: { data: { anlagen: [{ key: 'receipt-1', filename: 'beleg.pdf' }] } } });
    await input.trigger('change');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenNthCalledWith(1, '/api/reisekosten', expect.any(Object));
    expect(mocks.api.post).toHaveBeenNthCalledWith(2, '/api/reisekosten/rk-1/anlagen', expect.any(FormData), expect.any(Object));
    expect(wrapper.emitted('saved')[0][0].sign).toBe(false);
    const pending = deferred();
    mocks.api.delete.mockReturnValueOnce(pending.promise);
    await dialog().get('button[aria-label="beleg.pdf entfernen"]').trigger('click');
    expect(wrapper.getComponent(ModalFrame).props('showClose')).toBe(false);
    expect(dialog().get('button[aria-label="beleg.pdf entfernen"]').attributes('aria-busy')).toBe('true');
    pending.resolve({ data: { data: { anlagen: [] } } });
    await flushPromises();
    expect(dialog().find('button[aria-label="beleg.pdf entfernen"]').exists()).toBe(false);
  });

  it('keeps an existing document open with an actionable error when update fails', async () => {
    mocks.api.get.mockImplementation(url => url === '/api/reisekosten/rk-1'
      ? Promise.resolve({ data: { data: { ...defaults, personalNr: 7 } } })
      : Promise.resolve({ data: defaults }));
    await render({ docId: 'rk-1' });
    mocks.api.put.mockRejectedValueOnce({ response: { data: { message: 'Bitte erneut versuchen' } } });
    await button('Speichern').trigger('click');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenCalledWith('/api/reisekosten/rk-1', expect.objectContaining({ personalNr: 7 }));
    expect(dialog().get('[role="alert"]').text()).toBe('Bitte erneut versuchen');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(button('Speichern').attributes('disabled')).toBeUndefined();
  });

  it('loads existing amounts into shared inputs and writes edited cents by PUT', async () => {
    mocks.api.get.mockImplementation(url => url === '/api/reisekosten/rk-1'
      ? Promise.resolve({ data: { data: { ...defaults, personalNr: 7, fahrtkosten: [{ bezeichnung: 'Parken', betragCent: 1234 }] } } })
      : Promise.resolve({ data: defaults }));
    await render({ docId: 'rk-1' });
    await dialog().findAll('.rk-step')[2].trigger('click');
    const amount = dialog().get('input[aria-label="Fahrtkosten 1 Betrag in Euro"]');
    expect(amount.element.value).toBe('12.34');
    await amount.setValue('15.20');
    await button('Speichern').trigger('click');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenCalledWith('/api/reisekosten/rk-1', expect.objectContaining({
      fahrtkosten: [expect.objectContaining({ bezeichnung: 'Parken', betragCent: 1520 })],
    }));
  });

  it('previews without persisting or closing the draft', async () => {
    await render();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    mocks.api.post.mockResolvedValueOnce({ data: new Blob(['pdf'], { type: 'application/pdf' }) });
    await button('Vorschau').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/reisekosten/preview', expect.objectContaining({ personalNr: 7 }), { responseType: 'blob' });
    expect(open).toHaveBeenCalledWith('blob:preview', '_blank');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    open.mockRestore();
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  });
});
