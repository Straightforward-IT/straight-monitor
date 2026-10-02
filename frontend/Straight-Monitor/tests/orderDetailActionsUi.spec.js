import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, shallowMount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import api from '@/utils/api';
import { useSignaturModal } from '@/stores/signaturModal';
import OrderHoursVisibilityButton from '@/components/orders/OrderHoursVisibilityButton.vue';
import AuftragCalendarWorkspace from '@/components/orders/calendar/AuftragCalendarWorkspace.vue';
vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const wrappers = [];
const employee = { _id: 'employee', name: 'Anna Muster' };
const assignment = (id = 'assignment', included = true) => ({ _id: id, mitarbeiterData: employee, stundenlisteIncluded: included, isPseudo: true });
const order = () => ({ _id: 'order', auftragNr: 42, eventTitel: 'Konferenz', labels: [], einsaetze: [], schichten: [] });
const doc = { _id: 'report', docType: 'Event-Bericht', details: { teamleiter: 'employee' } };
const byLabel = (wrapper, label) => wrapper.get(`button[aria-label="${label}"]`);
function workspace(data = {}, methods = {}) {
  const pinia = createPinia();
  const loadStatus = vi.fn(); const openDocument = vi.fn();
  const wrapper = shallowMount({
    ...AuftragCalendarWorkspace,
    setup: () => ({ formatEmployeeName: record => record.name, restoreMinimizedStundenliste: () => false, openDocumentModal: openDocument }),
    mounted() {},
    methods: {
      ...AuftragCalendarWorkspace.methods, ensureMonthLoaded: vi.fn(), loadStundenlisteStatus: loadStatus,
      loadEinsatzDoks: vi.fn(), loadReisekosten: vi.fn(), fetchAuftragDocs: vi.fn(), ...methods,
    },
  }, {
    attachTo: document.body,
    data: () => ({ selectedEvent: order(), currentWeekStart: new Date(2026, 8, 28), ...data }),
    global: { plugins: [pinia], mocks: { $route: { query: {} } }, stubs: {
      'font-awesome-icon': true, RouterLink: true, AppButton: false, AppIconButton: false, OrderHoursVisibilityButton: false,
      CustomTooltip: { template: '<span><slot /></span>' }, AuftragDetailsSidePanel: { template: '<aside><slot /></aside>' },
    } },
  });
  wrappers.push(wrapper); return { wrapper, pinia, loadStatus, openDocument };
}
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks();
  api.patch.mockResolvedValue({}); api.get.mockResolvedValue({ data: order() }); api.delete.mockResolvedValue({});
  vi.stubGlobal('alert', vi.fn()); vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
});
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('shared hours-list visibility control', () => {
  it('keeps a stable contextual name and pressed state, and forwards only a toggle', async () => {
    const wrapper = mount(OrderHoursVisibilityButton, { props: { subject: 'Service' }, global: { stubs: { 'font-awesome-icon': true } } });
    wrappers.push(wrapper);
    const button = byLabel(wrapper, 'Service: Aufnahme in Stundenliste');
    expect(button.attributes('type')).toBe('button'); expect(button.attributes('aria-pressed')).toBe('true');
    expect(button.attributes('title')).toBe('Service aus Stundenliste ausschließen');
    await button.trigger('click'); expect(wrapper.emitted('toggle')).toEqual([[]]);
    await wrapper.setProps({ included: false, pending: true });
    expect(button.attributes('aria-pressed')).toBe('false'); expect(button.attributes('aria-busy')).toBe('true');
    expect(button.element.disabled).toBe(true);
    button.element.click(); expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('patches a single assignment and refreshes hours-list status after success', async () => {
    const item = assignment();
    const { wrapper, loadStatus } = workspace({ preparedSchichten: [{ key: 'shift', meta: { schichtBezeichnung: 'Service' }, einsaetze: [item] }] });
    await byLabel(wrapper, 'Anna Muster: Aufnahme in Stundenliste').trigger('click'); await flushPromises();
    expect(api.patch).toHaveBeenCalledWith('/api/auftraege/42/einsaetze/assignment', { stundenlisteIncluded: false });
    expect(loadStatus).toHaveBeenCalledWith(42);
    expect(byLabel(wrapper, 'Anna Muster: Aufnahme in Stundenliste').attributes('aria-pressed')).toBe('false');
  });

  it('preserves whole-shift semantics for a mixed selection and blocks parallel requests', async () => {
    let resolve; api.patch.mockReturnValue(new Promise(done => { resolve = done; }));
    const { wrapper } = workspace({ preparedSchichten: [{ key: 'shift', meta: { schichtBezeichnung: 'Service' }, einsaetze: [assignment('first'), assignment('second', false)] }] });
    const button = byLabel(wrapper, 'Service: Aufnahme in Stundenliste');
    expect(button.attributes('aria-pressed')).toBe('false');
    await button.trigger('click');
    expect(api.patch.mock.calls).toEqual([
      ['/api/auftraege/42/einsaetze/first', { stundenlisteIncluded: true }],
      ['/api/auftraege/42/einsaetze/second', { stundenlisteIncluded: true }],
    ]);
    expect(button.element.disabled).toBe(true);
    await wrapper.vm.updateStundenlisteInclusion(wrapper.vm.preparedSchichten[0].einsaetze[0], true);
    expect(api.patch).toHaveBeenCalledTimes(2);
    resolve({}); await flushPromises(); expect(button.attributes('aria-pressed')).toBe('true');
  });

  it('retains the previous inclusion state and permits retry on failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.patch.mockRejectedValueOnce({ response: { data: { message: 'Änderung abgelehnt' } } });
    const { wrapper } = workspace({ preparedSchichten: [{ key: 'shift', meta: { schichtBezeichnung: 'Service' }, einsaetze: [assignment()] }] });
    await byLabel(wrapper, 'Anna Muster: Aufnahme in Stundenliste').trigger('click'); await flushPromises();
    expect(alert).toHaveBeenCalledWith('Änderung abgelehnt');
    expect(byLabel(wrapper, 'Anna Muster: Aufnahme in Stundenliste').attributes('aria-pressed')).toBe('true');
    expect(byLabel(wrapper, 'Anna Muster: Aufnahme in Stundenliste').element.disabled).toBe(false);
  });
});

describe('remaining order detail actions and signature cleanup', () => {
  it('opens employee reports from labelled shared buttons with the same document context', async () => {
    const { wrapper, openDocument } = workspace({ auftragDocs: [doc], preparedSchichten: [{ key: 'shift', meta: {}, einsaetze: [assignment()] }] });
    const button = byLabel(wrapper, 'Event-Bericht für Anna Muster öffnen');
    expect(button.classes()).toContain('app-icon-button'); expect(button.get('img').attributes('alt')).toBe('');
    await button.trigger('click'); expect(openDocument).toHaveBeenCalledWith(doc, { eventTitle: 'Konferenz' });
  });

  it('keeps pseudo-removal confirmation and refreshes the existing order', async () => {
    const { wrapper } = workspace({ preparedSchichten: [{ key: 'shift', meta: {}, einsaetze: [assignment()] }] });
    const button = byLabel(wrapper, 'Pseudo-Einsatz für Anna Muster entfernen');
    await button.trigger('click'); expect(api.delete).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); await button.trigger('click'); await flushPromises();
    expect(api.delete).toHaveBeenCalledWith('/api/auftraege/42/pseudo-einsatz/assignment');
    expect(api.get).toHaveBeenCalledWith('/api/auftraege/42/details');
  });

  it('preserves week-scroll targets with accessible current-week shared buttons', async () => {
    const { wrapper } = workspace();
    wrapper.get('.kw-scroller').element.scrollTo = vi.fn();
    const current = wrapper.get('.kw-week-btn.is-active');
    expect(current.attributes('aria-current')).toBe('date'); expect(current.classes()).toContain('app-button');
    const next = wrapper.vm.weekScrollList.find(week => week.date.getTime() === new Date(2026, 9, 5).getTime());
    await byLabel(wrapper, `Kalenderwoche ${next.kw} ${next.year} wählen`).trigger('click');
    expect(wrapper.vm.currentWeekStart.getTime()).toBe(next.date.getTime());
    expect(wrapper.get('.kw-week-btn.is-active').attributes('aria-label')).toBe(`Kalenderwoche ${next.kw} ${next.year} wählen`);
  });

  it('keeps label colors as markings without using them as text colors', () => {
    const { wrapper } = workspace({ selectedEvent: { ...order(), labels: [{ _id: 'white', name: 'Helles Label', color: '#ffffff' }] } });
    expect(wrapper.get('.label-chip').attributes('style')).toContain('color: var(--text)');
    expect(wrapper.get('.label-chip').attributes('style')).toContain('border-color: rgb(255, 255, 255)');
  });

  it('refreshes the current order after central signature submission without storing obsolete inline state', async () => {
    const { wrapper, pinia, loadStatus } = workspace({ stundenlisteStatus: { vorgang: { _id: 'draft', status: 'draft' } } });
    await wrapper.vm.openSignatureDialog();
    const store = useSignaturModal(pinia); expect(store.context.draftId).toBe('draft');
    store.notifyCreated({ embed: { src: '/signing' } });
    expect(loadStatus).toHaveBeenCalledWith(42); expect('sigResult' in wrapper.vm.$data).toBe(false);
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
    expect('showSignatureDialog' in wrapper.vm.$data).toBe(false);
  });

  it('does not refresh a different order when a delayed signature callback arrives', async () => {
    const { wrapper, pinia, loadStatus } = workspace({ stundenlisteStatus: { vorgang: { _id: 'draft', status: 'draft' } } });
    await wrapper.vm.openSignatureDialog();
    await wrapper.setData({ selectedEvent: { ...order(), auftragNr: 43 } }); loadStatus.mockClear();
    useSignaturModal(pinia).notifyCreated({ embed: { src: '/signing' } });
    expect(loadStatus).not.toHaveBeenCalled();
  });
});
