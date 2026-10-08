import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import KuendigungModal from '../src/components/Modals/KuendigungModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
const endpoint = '/api/personal/mitarbeiter/employee-1/documents/kuendigung';
const employee = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test', personalnr: '42' };
const document = { _id: 'doc-1', filename: 'Kuendigung.pdf', r2Key: 'employees/employee-1/documents/Kuendigung.pdf' };
const prepared = {
  ready: true,
  parameters: {
    anrede: 'herr',
    locationId: 'location-1',
    briefdatum: '2026-10-08',
    beendigungsdatum: '',
    freistellung: 'none',
    freistellungAb: '',
    arbeitszeitkontoStunden: '',
    resturlaubTage: '',
  },
  locations: [{ _id: 'location-1', name: 'Hamburg', ort: 'Hamburg' }],
  documents: [],
};
const button = text => wrapper.findAll('button').find(control => control.text().includes(text));
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockResolvedValue({ data: prepared });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});
async function render() {
  wrapper = mount(KuendigungModal, {
    props: { modelValue: true, mitarbeiter: employee },
    global: {
      stubs: {
        ModalFrame: {
          props: ['showClose', 'closeOnBackdrop', 'closeOnEscape', 'layer'],
          emits: ['close'],
          template: '<div role="dialog"><slot /><slot name="footer" /></div>',
        },
      },
    },
  });
  await flushPromises();
}

describe('KuendigungModal', () => {
  it('loads all letter parameters and keeps the default release state independent', async () => {
    await render();
    expect(mocks.api.get).toHaveBeenCalledWith(endpoint);
    expect(wrapper.text()).toContain('Ada Test');
    expect(wrapper.text()).toContain('Personalnummer: 42');
    expect(wrapper.get('select').element.value).toBe('location-1');
    expect(wrapper.get('input[type="date"]').element.value).toBe('2026-10-08');
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);
    expect(button('PDF erstellen').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.document-hint').text()).toContain('Beendigungsdatum – fehlt');
  });

  it('shows only time-account or vacation inputs for their matching release modes', async () => {
    await render();
    const selects = wrapper.findAll('select');
    await selects[2].setValue('arbeitszeitkonto');
    expect(wrapper.text()).toContain('Arbeitszeitkonto (Stunden)');
    expect(wrapper.text()).not.toContain('Resturlaub (Tage)');
    await selects[2].setValue('resturlaub');
    expect(wrapper.text()).not.toContain('Arbeitszeitkonto (Stunden)');
    expect(wrapper.text()).toContain('Resturlaub (Tage)');
    await selects[2].setValue('beides');
    expect(wrapper.text()).toContain('Arbeitszeitkonto (Stunden)');
    expect(wrapper.text()).toContain('Resturlaub (Tage)');
  });

  it('submits all selected values without starting a signature flow', async () => {
    await render();
    const selects = wrapper.findAll('select');
    await selects[1].setValue('frau');
    await wrapper.findAll('input[type="date"]')[1].setValue('2026-11-30');
    await selects[2].setValue('beides');
    await wrapper.findAll('input[type="date"]')[2].setValue('2026-11-01');
    await wrapper.findAll('input[type="number"]')[0].setValue('12.5');
    await wrapper.findAll('input[type="number"]')[1].setValue('3.5');
    mocks.api.post.mockResolvedValue({ data: { document } });
    await button('PDF erstellen').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith(endpoint, {
      parameters: {
        ...prepared.parameters,
        anrede: 'frau',
        beendigungsdatum: '2026-11-30',
        freistellung: 'beides',
        freistellungAb: '2026-11-01',
        arbeitszeitkontoStunden: 12.5,
        resturlaubTage: 3.5,
      },
    });
    expect(wrapper.emitted('saved')[0]).toEqual([document]);
    expect(wrapper.text()).toContain('kein Signaturvorgang');
  });

  it('locks duplicate creation and dismissal while the PDF is being saved', async () => {
    let resolve;
    mocks.api.post.mockReturnValue(new Promise(done => { resolve = done; }));
    await render();
    await wrapper.findAll('input[type="date"]')[1].setValue('2026-11-30');
    await button('PDF erstellen').trigger('click');
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({
      showClose: false, closeOnBackdrop: false, closeOnEscape: false,
    });
    expect(button('Schließen').attributes('disabled')).toBeDefined();
    await button('PDF erstellen').trigger('click');
    wrapper.getComponent(ModalFrame).vm.$emit('close');
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    resolve({ data: { document } });
    await flushPromises();
  });

  it('surfaces preparation, generation and download errors', async () => {
    mocks.api.get.mockRejectedValueOnce({ response: { data: { message: 'Mitarbeiter nicht gefunden.' } } });
    await render();
    expect(wrapper.get('[role="alert"]').text()).toBe('Mitarbeiter nicht gefunden.');
    await button('Erneut laden').trigger('click');
    await flushPromises();
    await wrapper.findAll('input[type="date"]')[1].setValue('2026-11-30');
    mocks.api.post.mockRejectedValueOnce({ response: { data: { message: 'Ungültige Parameter.' } } });
    await button('PDF erstellen').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Ungültige Parameter.');

    mocks.api.get.mockResolvedValueOnce({ data: { ...prepared, documents: [document] } });
    await wrapper.setProps({ mitarbeiter: { ...employee, _id: 'employee-2' } });
    await flushPromises();
    mocks.api.get.mockRejectedValueOnce(new Error('offline'));
    await button('Herunterladen').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Dokument konnte nicht heruntergeladen werden.');
  });
});
