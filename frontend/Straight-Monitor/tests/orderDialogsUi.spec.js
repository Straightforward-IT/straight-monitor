import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount, shallowMount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import api from '@/utils/api';
import AuftragCalendarWorkspace from '@/components/orders/calendar/AuftragCalendarWorkspace.vue';
import OrderActionDialog from '@/components/orders/dialogs/OrderActionDialog.vue';
import PseudoOrderCreateDialog from '@/components/orders/dialogs/PseudoOrderCreateDialog.vue';
import SidePanelFrame from '@/components/frames/SidePanelFrame.vue';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const wrappers = [];
const order = () => ({ _id: 'order', auftragNr: 42, eventTitel: 'Konferenz', labels: [], einsaetze: [], schichten: [] });
const employee = { _id: 'employee-1', name: 'Anna Muster', email: 'anna@example.test' };
const otherEmployee = { _id: 'employee-2', name: 'Tom Beispiel', email: 'tom@example.test' };
const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]'));
const button = (wrapper, label) => wrapper.get(`button[aria-label="${label}"]`);
const submit = () => dialog().get('button[type="submit"]');
async function clickSubmit() { submit().element.click(); await flushPromises(); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

// Keep real workspace methods, controlled dialog bindings, native form validation,
// and teleported ModalFrame; isolate authenticated startup loads and dock setup.
function workspace(data = {}, query = {}) {
  const fixture = {
    ...AuftragCalendarWorkspace,
    setup: () => ({ formatEmployeeName: item => item.name }),
    mounted() { document.addEventListener('keydown', this.handleEscapeKey); },
    methods: {
      ...AuftragCalendarWorkspace.methods,
      loadStundenlisteStatus: vi.fn(), loadEinsatzDoks: vi.fn(), loadReisekosten: vi.fn(),
      fetchAuftragDocs: vi.fn(),
    },
  };
  const wrapper = shallowMount(fixture, {
    attachTo: document.body,
    data: () => ({ selectedEvent: order(), auftraege: [order()], ...data }),
    global: {
      plugins: [createPinia()], mocks: { $route: { query }, $router: { replace: vi.fn() } },
      stubs: {
        'font-awesome-icon': true, RouterLink: true, CustomTooltip: { template: '<div><slot /></div>' },
        OrderLabelDialog: false, PseudoOrderCreateDialog: false, PseudoAssignmentDialog: false,
        OrderActionDialog: false, ModalFrame: false, PassThrough: false, Teleport: false, AppButton: false, AppIconButton: false,
        AppTextInput: false, AppSegmentedControl: false,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
function render(component, options) {
  const wrapper = mount(component, { attachTo: document.body, global: { stubs: { 'font-awesome-icon': true } }, ...options });
  wrappers.push(wrapper);
  return wrapper;
}
function escape() {
  // jsdom has no layout; mark only the shared overlay visible for Frame's guard.
  document.querySelectorAll('.mf-overlay').forEach(overlay => { overlay.getClientRects = () => [{}]; });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: { labels: [] } });
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('order dialog frame and close boundaries', () => {
  it('associates the external footer with a native validated form and accessible title', async () => {
    const wrapper = render(OrderActionDialog, {
      props: { modelValue: true, title: 'Testauftrag', icon: 'fa-solid fa-plus', canSubmit: true, submitLabel: 'Speichern' },
      slots: { default: '<input aria-label="Pflichtfeld" required>' },
    });
    expect(dialog().attributes('aria-labelledby')).toBe(dialog().get('h2').attributes('id'));
    expect(submit().element.form).toBe(dialog().get('form').element);
    await clickSubmit();
    expect(wrapper.emitted('submit')).toBeUndefined();
    await dialog().get('input').setValue('Gültig');
    await clickSubmit();
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it.each(['showLabelDialog', 'showNewAuftragDialog', 'showPseudoDialog'])('Escape closes %s only, keeping the workspace detail', async key => {
    const wrapper = workspace({ [key]: true });
    expect(document.body.style.overflow).toBe('hidden');
    escape(); await flushPromises();
    expect(wrapper.vm[key]).toBe(false);
    expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the shared side panel open behind a visible modal and permits Escape after it closes', async () => {
    const panel = render(SidePanelFrame, { props: { modelValue: true, title: 'Details' } });
    const wrapper = workspace({ showLabelDialog: true });
    escape(); await flushPromises();
    expect(wrapper.vm.showLabelDialog).toBe(false);
    expect(panel.emitted('close')).toBeUndefined();
    escape(); await flushPromises();
    expect(panel.emitted('close')).toHaveLength(1);
  });

  it('does not let a hidden/minimized modal block the underlying panel', () => {
    const panel = render(SidePanelFrame, { props: { modelValue: true, title: 'Details' } });
    const hidden = document.createElement('div');
    hidden.className = 'mf-overlay'; hidden.style.display = 'none'; document.body.appendChild(hidden);
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(panel.emitted('close')).toHaveLength(1);
    } finally { hidden.remove(); }
  });

  it.each([
    ['showNewAuftragDialog', 'newAuftragSaving', 'saveNewPseudoAuftrag'],
    ['showPseudoDialog', 'pseudoSaving', 'savePseudoEinsatz'],
  ])('also guards closing and repeated submission in %s while busy', async (openKey, busyKey, saveMethod) => {
    const wrapper = workspace({ [openKey]: true, [busyKey]: true, pseudoSelectedMas: [employee] });
    escape(); await flushPromises();
    await button(dialog(), 'Schließen').trigger('click');
    await new DOMWrapper(document.querySelector('.mf-overlay')).trigger('mousedown');
    await wrapper.vm[saveMethod]();
    expect(wrapper.vm[openKey]).toBe(true);
    expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
    expect(api.post).not.toHaveBeenCalled();
    expect(dialog().get('fieldset').element.disabled).toBe(true);
  });

  it('guards header, backdrop and Escape while saving, without a second request', async () => {
    const pending = deferred(); api.post.mockReturnValueOnce(pending.promise);
    const wrapper = workspace({ showLabelDialog: true, newLabelName: 'Dringend' });
    await clickSubmit();
    expect(submit().attributes('aria-busy')).toBe('true');
    expect(dialog().get('fieldset').element.disabled).toBe(true);
    await button(dialog(), 'Schließen').trigger('click');
    await new DOMWrapper(document.querySelector('.mf-overlay')).trigger('mousedown');
    escape(); await flushPromises();
    await wrapper.vm.saveLabel();
    expect(wrapper.vm.showLabelDialog).toBe(true);
    expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
    expect(api.post).toHaveBeenCalledTimes(1);
    pending.resolve({ data: { labels: [] } }); await flushPromises();
    await new DOMWrapper(document.querySelector('.mf-overlay')).trigger('mousedown');
    expect(wrapper.vm.showLabelDialog).toBe(false);
  });
});

describe('order label dialog integration', () => {
  it('creates a trimmed label, synchronizes detail/list and refreshes suggestions without closing', async () => {
    const labels = [{ _id: 'urgent', name: 'Dringend', color: '#ffffff' }];
    api.post.mockResolvedValueOnce({ data: { labels } });
    api.get.mockResolvedValueOnce({ data: labels });
    const wrapper = workspace({ showLabelDialog: true });
    expect(submit().element.disabled).toBe(true);
    await dialog().get('input[type="text"]').setValue(' Dringend ');
    await dialog().get('input[type="color"]').setValue('#ffffff');
    await clickSubmit();
    expect(api.post).toHaveBeenCalledWith('/api/auftraege/42/labels', { name: 'Dringend', color: '#ffffff' });
    expect(wrapper.vm.selectedEvent.labels).toEqual(labels);
    expect(wrapper.vm.auftraege[0].labels).toEqual(labels);
    expect(wrapper.vm.globalLabels).toEqual(labels);
    expect(wrapper.vm.newLabelName).toBe('');
    expect(wrapper.vm.showLabelDialog).toBe(true);
    expect(dialog().get('.label-dialog-chip').element.style.color).toBe('');
  });

  it('adds an existing suggestion without requiring a new name and tracks palette selection', async () => {
    const wrapper = workspace({ showLabelDialog: true, globalLabels: [{ name: 'Bekannt', color: '#ffffff' }] });
    await button(dialog(), 'Farbe #ef4444').trigger('click');
    expect(wrapper.vm.newLabelColor).toBe('#ef4444');
    expect(button(dialog(), 'Farbe #ef4444').attributes('aria-pressed')).toBe('true');
    const quick = dialog().findAll('button').find(item => item.text().includes('+ Bekannt'));
    expect(quick.attributes('type')).toBe('button');
    quick.element.click(); await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/api/auftraege/42/labels', { name: 'Bekannt', color: '#ffffff' });
  });

  it('locks label removal, avoids concurrent label edits and retains state on API failure', async () => {
    const pending = deferred(); api.delete.mockReturnValueOnce(pending.promise);
    const labels = [{ _id: 'urgent', name: 'Dringend', color: '#ffffff' }];
    const wrapper = workspace({ showLabelDialog: true, selectedEvent: { ...order(), labels } });
    await button(dialog(), 'Label Dringend entfernen').trigger('click');
    expect(api.delete).toHaveBeenCalledWith('/api/auftraege/42/labels/urgent');
    expect(wrapper.vm.labelRemovingId).toBe('urgent');
    expect(button(dialog(), 'Label Dringend entfernen').attributes('aria-busy')).toBe('true');
    await wrapper.vm.saveLabel('Weiteres', '#ffffff');
    await wrapper.vm.removeLabel('urgent');
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledTimes(1);
    pending.resolve({ data: { labels: [] } }); await flushPromises();
    expect(wrapper.vm.selectedEvent.labels).toEqual([]);
    expect(wrapper.vm.auftraege[0].labels).toEqual([]);
    expect(wrapper.vm.labelRemovingId).toBe('');
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Nicht gespeichert' } } });
    await dialog().get('input[type="text"]').setValue('Entwurf'); await clickSubmit();
    expect(alert).toHaveBeenCalledWith('Nicht gespeichert');
    expect(wrapper.vm.newLabelName).toBe('Entwurf');
    expect(wrapper.vm.labelSaving).toBe(false);
  });

  it('retains a label after a failed removal and unlocks retry', async () => {
    const labels = [{ _id: 'urgent', name: 'Dringend', color: '#ffffff' }];
    api.delete.mockRejectedValueOnce({ response: { data: { message: 'Entfernen fehlgeschlagen' } } });
    const wrapper = workspace({ showLabelDialog: true, selectedEvent: { ...order(), labels } });
    await button(dialog(), 'Label Dringend entfernen').trigger('click'); await flushPromises();
    expect(alert).toHaveBeenCalledWith('Entfernen fehlgeschlagen');
    expect(wrapper.vm.selectedEvent.labels).toEqual(labels);
    expect(wrapper.vm.labelRemovingId).toBe('');
    expect(wrapper.vm.showLabelDialog).toBe(true);
  });
});

describe('pseudo-order create dialog', () => {
  it('creates with normalized optional fields, updates the calendar and opens the same detail', async () => {
    const created = { ...order(), _id: 'created', auftragNr: 43, eventTitel: 'Neuer Auftrag' };
    api.post.mockResolvedValueOnce({ data: created }); api.get.mockResolvedValueOnce({ data: created });
    const wrapper = workspace({ showNewAuftragDialog: true, locations: [{ _id: 'hamburg', nameFull: 'Hamburg' }] });
    await dialog().get('input[required][type="text"]').setValue(' Neuer Auftrag ');
    await dialog().findAll('input[type="date"]')[0].setValue('2026-09-29');
    await dialog().findAll('input[type="date"]')[1].setValue('2026-09-30');
    await dialog().get('select').setValue('hamburg');
    await dialog().get('input[placeholder="z.B. Berlin"]').setValue(' Hamburg ');
    await dialog().get('input[placeholder="z.B. Messe Berlin"]').setValue(' Messe ');
    await clickSubmit();
    expect(api.post).toHaveBeenCalledWith('/api/auftraege', { eventTitel: 'Neuer Auftrag', vonDatum: '2026-09-29', bisDatum: '2026-09-30', locationV2: 'hamburg', eventOrt: 'Hamburg', eventLocation: 'Messe' });
    expect(wrapper.vm.auftraege.at(-1)).toMatchObject({ auftragNr: 43, einsaetzeCount: 0, schichtStatus: 'none' });
    expect(wrapper.vm.selectedEvent.auftragNr).toBe(43);
    expect(api.get).toHaveBeenCalledWith('/api/auftraege/43/details');
    expect(wrapper.vm.showNewAuftragDialog).toBe(false);
  });

  it('retains the draft on failure and consumes only the openPseudo route flag when reopening', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Anlegen fehlgeschlagen' } } });
    const wrapper = workspace({}, { openPseudo: '1', tab: 'list', other: 'retain' });
    wrapper.vm.handlePseudoRouteQuery(); await flushPromises();
    expect(wrapper.vm.$router.replace).toHaveBeenCalledWith({ query: { tab: 'list', other: 'retain' } });
    await dialog().get('input[required][type="text"]').setValue('Entwurf'); await clickSubmit();
    expect(api.post.mock.calls[0][1]).toEqual({ eventTitel: 'Entwurf', vonDatum: wrapper.vm.newAuftrag.vonDatum, bisDatum: wrapper.vm.newAuftrag.bisDatum });
    expect(alert).toHaveBeenCalledWith('Anlegen fehlgeschlagen');
    expect(wrapper.vm.showNewAuftragDialog).toBe(true);
    expect(wrapper.vm.newAuftrag.eventTitel).toBe('Entwurf');
    expect(wrapper.vm.newAuftragSaving).toBe(false);
  });

  it('uses real native date refs for showPicker and the focus/click fallback without mutating the supplied form', async () => {
    const form = { eventTitel: '', vonDatum: '2026-09-29', bisDatum: '2026-09-30', locationV2: '', eventOrt: '', eventLocation: '' };
    const wrapper = render(PseudoOrderCreateDialog, { props: { modelValue: true, form } });
    const dates = dialog().findAll('input[type="date"]');
    dates[0].element.showPicker = vi.fn();
    await button(dialog(), 'Anfangsdatum wählen').trigger('click');
    expect(dates[0].element.showPicker).toHaveBeenCalledOnce();
    const click = vi.spyOn(dates[1].element, 'click');
    await button(dialog(), 'Enddatum wählen').trigger('click');
    expect(document.activeElement).toBe(dates[1].element); expect(click).toHaveBeenCalledOnce();
    await dates[0].setValue('2026-10-01');
    expect(form.vonDatum).toBe('2026-09-29');
    expect(wrapper.emitted('update:form')[0][0].vonDatum).toBe('2026-10-01');
  });
});

describe('pseudo-assignment integration', () => {
  it('debounces employee search, exposes native selectable buttons and removes selection without submitting', async () => {
    vi.useFakeTimers(); api.get.mockResolvedValueOnce({ data: [employee] });
    const wrapper = workspace(); wrapper.vm.openPseudoDialog(); await wrapper.vm.$nextTick();
    await dialog().get('input[placeholder="Name oder E-Mail..."]').setValue(' A ');
    await vi.advanceTimersByTimeAsync(300); expect(api.get).not.toHaveBeenCalled();
    await dialog().get('input[placeholder="Name oder E-Mail..."]').setValue(' Anna & ');
    await vi.advanceTimersByTimeAsync(299); expect(api.get).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await flushPromises();
    expect(api.get).toHaveBeenCalledWith('/api/personal/search?q=Anna%20%26');
    const result = dialog().get('.pseudo-assignment-result');
    expect(result.attributes('type')).toBe('button'); expect(result.text()).toContain('Anna Muster');
    await result.trigger('click');
    expect(result.attributes('aria-pressed')).toBe('true');
    await button(dialog(), 'Anna Muster aus Auswahl entfernen').trigger('click');
    expect(wrapper.vm.pseudoSelectedMas).toEqual([]); expect(api.post).not.toHaveBeenCalled();
  });

  it.each([null, 'none', 'shift-1'])('retains existing shift payload semantics for %s', async shiftKey => {
    api.get.mockResolvedValueOnce({ data: order() });
    const wrapper = workspace({ showPseudoDialog: true, pseudoSelectedMas: [employee], preparedSchichten: [{ key: 'none', meta: {} }, { key: 'shift-1', meta: { schichtBezeichnung: 'Service', uhrzeitVon: '08:00' } }] });
    if (shiftKey !== null) await dialog().get('select').setValue(shiftKey);
    expect(wrapper.vm.pseudoSelectedSchicht).toBe(shiftKey);
    await clickSubmit();
    expect(api.post).toHaveBeenCalledWith('/api/auftraege/42/pseudo-einsatz', { mitarbeiterId: employee._id, ...(shiftKey === null ? {} : { schichtId: shiftKey }) });
    expect(wrapper.vm.showPseudoDialog).toBe(false);
    expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
  });

  it('changes modes by keyboard, retains new-shift drafts and reports partial failures after refreshing details', async () => {
    api.post.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({ response: { data: { message: 'Nicht verfügbar' } } });
    api.get.mockResolvedValueOnce({ data: order() });
    const wrapper = workspace({ showPseudoDialog: true, pseudoSelectedMas: [employee, otherEmployee] });
    await dialog().get('[role="radio"]').trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.vm.pseudoSchichtMode).toBe('new'); expect(submit().element.disabled).toBe(true);
    await dialog().get('input[required]').setValue(' Service ');
    await dialog().findAll('input[type="time"]')[0].setValue('08:00');
    await dialog().findAll('[role="radio"]')[0].trigger('click');
    await dialog().findAll('[role="radio"]')[1].trigger('click');
    expect(dialog().get('input[required]').element.value).toBe(' Service ');
    expect(submit().text()).toContain('2 Mitarbeiter einplanen');
    await clickSubmit();
    expect(api.post.mock.calls.map(call => call[1])).toEqual([employee, otherEmployee].map(item => ({ mitarbeiterId: item._id, isNewPseudoSchicht: true, newSchichtBezeichnung: 'Service', newUhrzeitVon: '08:00' })));
    expect(api.get).toHaveBeenCalledWith('/api/auftraege/42/details');
    expect(alert).toHaveBeenCalledWith('Einige konnten nicht eingeplant werden:\nTom Beispiel: Nicht verfügbar');
    expect(wrapper.vm.showPseudoDialog).toBe(false); expect(wrapper.vm.pseudoSaving).toBe(false);
  });

  it('preserves confirmation before deleting a pseudo-assignment', async () => {
    const wrapper = workspace();
    await wrapper.vm.removePseudoEinsatz('assignment'); expect(api.delete).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith('Pseudo-Einsatz entfernen?');
    confirm.mockReturnValueOnce(true); api.get.mockResolvedValueOnce({ data: order() });
    await wrapper.vm.removePseudoEinsatz('assignment');
    expect(api.delete).toHaveBeenCalledWith('/api/auftraege/42/pseudo-einsatz/assignment');
    expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
  });
});
