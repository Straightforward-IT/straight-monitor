import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PublicReisekostenForm from '../src/components/public/PublicReisekostenForm.vue';

const mocks = vi.hoisted(() => ({
  apiPublic: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/utils/api-public', () => ({ default: mocks.apiPublic }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { accessToken: 'tok-test-123' } }),
}));
vi.mock('@/stores/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

let wrapper;

const defaultFormResponse = {
  state: 'active',
  data: {
    id: 'rk-42',
    auftragNr: 1001,
    mitarbeiterName: 'Max Mustermann',
    anlass: 'Einsatzfahrt',
    kundenName: 'Elbphilharmonie Events GmbH',
    eventTitel: 'Gala Dinner',
    eventLocation: 'Platz der Deutschen Einheit 4',
    start: 'Dammtorwall 15, 20355 Hamburg',
    ziel: 'Platz der Deutschen Einheit 4, 20457 Hamburg',
    datum: '2026-10-20T08:00:00.000Z',
    kmSatzCent: 36,
    nummernschild: '',
    anlagen: [],
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.apiPublic.get.mockResolvedValue({ data: defaultFormResponse });
  mocks.apiPublic.post.mockResolvedValue({ data: { success: true } });
  mocks.apiPublic.delete.mockResolvedValue({ data: { anlagen: [] } });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

async function render() {
  wrapper = mount(PublicReisekostenForm);
  await flushPromises();
}

describe('PublicReisekostenForm decision tree', () => {
  it('prefills Einsatzfahrt & Kundenname and keeps step 3 locked until a category is selected', async () => {
    await render();
    const disabledInputs = wrapper.findAll('input[disabled]');
    expect(disabledInputs[0].element.value).toBe('Einsatzfahrt');
    expect(disabledInputs[1].element.value).toBe('Elbphilharmonie Events GmbH');
    expect(wrapper.find('.form-section--locked').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('handles Tankbeleg Mietwagen with max 1 receipt, notice confirmation, and amount', async () => {
    await render();
    const mietwagenBtn = wrapper.findAll('.category-card')[0];
    await mietwagenBtn.trigger('click');

    expect(wrapper.find('.notice-box').text()).toContain('Original-Tankbeleg');

    // Simulate 1 receipt upload
    const fileInput = wrapper.find('input[type="file"]');
    const file = new File(['img'], 'tankbeleg.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [file] });
    mocks.apiPublic.post.mockResolvedValueOnce({
      data: { anlagen: [{ _id: 'a1', filename: 'tankbeleg.jpg', size: 2048 }] },
    });
    await fileInput.trigger('change');
    await flushPromises();

    // Upload button hidden once 1 receipt is uploaded
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);

    await wrapper.find('input[placeholder="z. B. HH-AB 1234"]').setValue('HH-MW 111');
    await wrapper.find('input[type="number"]').setValue('54.80');
    await wrapper.find('.notice-check input[type="checkbox"]').setValue(true);

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.apiPublic.post).toHaveBeenLastCalledWith('/api/public/reisekosten/tok-test-123/submit', expect.objectContaining({
      category: 'mietwagen',
      nummernschild: 'HH-MW 111',
      betragCent: 5480,
      originalReceiptNoteAccepted: true,
    }));
    expect(wrapper.text()).toContain('Reisekosten eingereicht');
  });

  it('handles Privat-PKW with mandatory license plate, prefilled start/destination, and 0.36 EUR/km calculation', async () => {
    await render();
    const pkwBtn = wrapper.findAll('.category-card')[2];
    await pkwBtn.trigger('click');

    const startInput = wrapper.find('input[placeholder="Startadresse / Treffpunkt"]');
    const zielInput = wrapper.find('input[placeholder="Zieladresse / Eventlocation"]');
    expect(startInput.element.value).toBe('Dammtorwall 15, 20355 Hamburg');
    expect(zielInput.element.value).toBe('Platz der Deutschen Einheit 4, 20457 Hamburg');

    await wrapper.find('input[placeholder="z. B. HH-XY 987"]').setValue('HH-PK 360');
    await wrapper.find('input[placeholder="z. B. 42"]').setValue('50');

    // 50 km * 0.36 EUR = 18,00 €
    expect(wrapper.find('.calculated-output').element.value).toBe('18,00 €');

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.apiPublic.post).toHaveBeenLastCalledWith('/api/public/reisekosten/tok-test-123/submit', expect.objectContaining({
      category: 'privatpkw',
      nummernschild: 'HH-PK 360',
      start: 'Dammtorwall 15, 20355 Hamburg',
      ziel: 'Platz der Deutschen Einheit 4, 20457 Hamburg',
      isRoundTrip: true,
      kilometer: 50,
    }));
  });
});
