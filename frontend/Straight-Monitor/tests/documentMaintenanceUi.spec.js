import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, shallowMount } from '@vue/test-utils';
import DokumenteNachpflegeWorkspace from '../src/components/DokumenteNachpflegeWorkspace.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('@/stores/theme', () => ({ useTheme: () => ({ isDark: false }) }));

const employee = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test', personalnr: '100' };
const leader = { _id: 'employee-2', vorname: 'Ben', nachname: 'Leitung' };
const assignment = {
  auftragNr: 12345,
  eventTitel: 'Probeauftrag',
  locationV2: { _id: 'location-1' },
  vonDatum: '2026-10-01T00:00:00.000Z',
  einsaetze: [{ mitarbeiterData: employee }],
};

let wrapper;
const render = tab => {
  wrapper = shallowMount(DokumenteNachpflegeWorkspace, {
    props: { tab },
    global: { stubs: {
      AppButton: false,
      AppIconButton: false,
      AppTextInput: false,
      AppSelect: false,
      'font-awesome-icon': true,
    } },
  });
  return wrapper;
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.get.mockImplementation(url => {
    if (url === '/api/locations') return Promise.resolve({ data: [{ _id: 'location-1', nameFull: 'Hamburg' }] });
    if (url === '/api/auftraege/12345/details') return Promise.resolve({ data: assignment });
    if (url === '/api/personal/mitarbeiter/search') return Promise.resolve({ data: [leader] });
    return Promise.resolve({ data: [] });
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.useRealTimers();
  vi.resetAllMocks();
});

async function loadAssignment() {
  await wrapper.get('input[type="number"]').setValue('12345');
  await vi.advanceTimersByTimeAsync(400);
  await wrapper.vm.$nextTick();
}

describe('document maintenance shared actions', () => {
  it('uses associated shared fields and guards duplicate Laufzettel submissions', async () => {
    let resolvePost;
    mocks.post.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    render('laufzettel');
    expect(wrapper.get('label[for="lz-auftrag-nr"]').text()).toContain('Auftragsnummer');
    expect(wrapper.get('#lz-auftrag-nr').classes()).toContain('app-text-input');
    await loadAssignment();
    expect(wrapper.get('#lz-location').classes()).toContain('app-select');
    expect(wrapper.get('.einsatz-ma-btn').attributes('aria-pressed')).toBe('false');
    await wrapper.get('.einsatz-ma-btn').trigger('click');
    expect(wrapper.get('.einsatz-ma-btn').attributes('aria-pressed')).toBe('true');
    wrapper.findAllComponents({ name: 'PersonSearch' })[1].vm.$emit('update:modelValue', leader);
    await wrapper.vm.$nextTick();
    await wrapper.get('form').trigger('submit');

    expect(mocks.post).toHaveBeenCalledWith('/api/personal/laufzettel/manual', expect.objectContaining({
      mitarbeiter_id: 'employee-1', teamleiter_id: 'employee-2', locationV2: 'location-1', auftragNr: 12345,
    }));
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
    await wrapper.get('form').trigger('submit');
    expect(mocks.post).toHaveBeenCalledTimes(1);

    resolvePost({ data: { success: true } });
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.success-banner').attributes('role')).toBe('status');
    expect(wrapper.get('.success-banner button').classes()).toContain('app-button');
  });

  it('keeps event-report employee feedback additions and removals accessible', async () => {
    render('eventreport');
    await loadAssignment();
    const addButton = wrapper.get('.er-ma-chip');
    expect(addButton.classes()).toContain('app-button');
    await addButton.trigger('click');
    expect(wrapper.get('textarea[aria-label="Feedback zu Ada Test"]').exists()).toBe(true);
    const removeButton = wrapper.get('button[aria-label="Ada Test entfernen"]');
    expect(removeButton.classes()).toContain('app-button');
    await removeButton.trigger('click');
    expect(wrapper.find('textarea[aria-label="Feedback zu Ada Test"]').exists()).toBe(false);
  });

  it('preserves the Event Report feedback payload with shared submit controls', async () => {
    mocks.post.mockResolvedValue({ data: { success: true } });
    render('eventreport');
    await loadAssignment();
    wrapper.getComponent({ name: 'PersonSearch' }).vm.$emit('update:modelValue', leader);
    await wrapper.vm.$nextTick();
    await wrapper.get('.er-ma-chip').trigger('click');
    await wrapper.get('textarea[aria-label="Feedback zu Ada Test"]').setValue('Sehr gut');
    const submit = wrapper.findAll('button').find(button => button.text().includes('Event Report erstellen'));
    expect(submit.classes()).toContain('app-button');
    await wrapper.get('form').trigger('submit');
    expect(mocks.post).toHaveBeenCalledWith('/api/personal/eventreport/manual', expect.objectContaining({
      teamleiter_id: 'employee-2', kunde: 'Probeauftrag', locationV2: 'location-1',
      mitarbeiter_feedback: [{ mitarbeiterId: 'employee-1', name: 'Ada Test', text: 'Sehr gut' }],
    }));
  });

  it('offers keyboard-searchable employee results and a labelled clear action', async () => {
    wrapper = mount(DokumenteNachpflegeWorkspace, {
      props: { tab: 'laufzettel' },
      attachTo: document.body,
      global: { stubs: { 'font-awesome-icon': true } },
    });
    await loadAssignment();
    const searches = wrapper.findAll('input[role="combobox"]');
    expect(searches).toHaveLength(2);
    expect(wrapper.get(`label[for="${searches[1].attributes('id')}"]`).text()).toContain('Teamleitung');
    await searches[1].setValue('Ben');
    await vi.advanceTimersByTimeAsync(280);
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="listbox"] [role="option"]').text()).toContain('Ben Leitung');
    await searches[1].trigger('keydown', { key: 'ArrowDown' });
    await searches[1].trigger('keydown', { key: 'Enter' });
    expect(wrapper.get('.selected-chip').text()).toContain('Ben Leitung');
    const clear = wrapper.get('button[aria-label="Teamleitung Auswahl aufheben"]');
    await clear.trigger('click');
    expect(wrapper.find('.selected-chip').exists()).toBe(false);
  });
});
