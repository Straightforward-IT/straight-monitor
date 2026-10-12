import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import PayrollPage from '@/components/PayrollPage.vue';
import ZvooveTimeWorkspace from '@/components/payroll/ZvooveTimeWorkspace.vue';
import ZvooveDayDetails from '@/components/payroll/ZvooveDayDetails.vue';
import { payrollTabs } from '@/components/layout/pageTabDefinitions';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn() }, route: null, replace: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ replace: mocks.replace }) }));

let wrapper;
const monthData = { employee: { id: 'employee-1', name: 'Ada Test', personalNr: 2001113, monthlyHours: 100, employmentLabel: 'Teilzeit' }, month: '2026-10',
  entries: [], totals: { hours: '0', byCode: [] }, datasetRevision: 0, issues: [] };
const tariffData = { type: 'days-earnings', title: 'KZF 603 mit AZK', group: { legacyId: '27356' }, totalEarnings: '650.00' };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function render() {
  wrapper = shallowMount(PayrollPage, { global: { stubs: {
    RouterPageLayout: { template: '<div><slot /></div>' },
    Toolbar: { template: '<div><slot /><slot name="bottom-actions" /></div>' },
    ToolbarGroup: { template: '<div><slot /></div>' },
    ToolbarButton: { template: '<button><slot /></button>' },
    CustomTooltip: { template: '<div><slot /></div>' },
    SidePanelFrame: { template: '<aside><slot /></aside>' },
  } } });
}
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.route = reactive({ query: { employeeId: 'employee-1', month: '2026-10' } });
  mocks.api.get.mockImplementation(async url => ({ data: url.includes('/analytics/contingent') ? tariffData : monthData }));
});
afterEach(() => { wrapper?.unmount(); wrapper = null; sessionStorage.clear(); });

describe('Payroll Zvoove month and tariff contingent integration', () => {
  it('loads import facts only, preserves the separate tariff forecast and reloads both', async () => {
    render(); await flushPromises();
    const card = () => wrapper.getComponent(ZvooveTimeWorkspace);
    expect(mocks.api.get).toHaveBeenCalledWith('/api/payroll/employees/employee-1/month', { params: { month: '2026-10' } });
    expect(mocks.api.get.mock.calls.some(([url]) => url.includes('/working-times/') || url.includes('/preparation'))).toBe(false);
    expect(mocks.api.get).toHaveBeenCalledWith('/api/personal/employee-1/analytics/contingent', expect.objectContaining({ params: { year: 2026, month: 10 } }));
    expect(card().props('contingentData')).toMatchObject({ ...tariffData, employeeName: 'Ada Test' });
    expect(card().props('contingentLoading')).toBe(false);
    expect(wrapper.text()).toContain('keine importierten Zvoove-Stunden');
    expect(wrapper.text()).not.toMatch(/Eimer|Monatsprüfung|Vorbereitung speichern/);
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(mocks.api.get.mock.calls.filter(([url]) => url.includes('/analytics/contingent'))).toHaveLength(2);
    expect(mocks.api.get.mock.calls.filter(([url]) => url.includes('/api/payroll/'))).toHaveLength(2);
  });

  it('opens provenance for a selected imported day without inventing order links', async () => {
    const entry = { id: 'source-1', date: '2026-10-08', hours: '6.123', kb: '', label: 'Produktive Stunden', kind: 'productive', personalNr: 2001113,
      source: { filename: 'Oktober.xlsx', sheet: 'Tabelle1', row: 2, daySlot: 4 } };
    mocks.api.get.mockImplementation(async url => ({ data: url.includes('/analytics/contingent') ? tariffData : { ...monthData, entries: [entry] } }));
    render(); await flushPromises();
    wrapper.getComponent(ZvooveTimeWorkspace).vm.$emit('select-day', '2026-10-08');
    await nextTick();
    expect(wrapper.getComponent(ZvooveDayDetails).props('entries')).toEqual([entry]);
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('selectedDate')).toBe('2026-10-08');
    expect(wrapper.find('[aria-label="Aktionen für diesen Tag"]').exists()).toBe(false);
  });

  it('normalizes retired review bookmarks and offers only Stundenerfassung', async () => {
    mocks.route.query.tab = 'monatspruefung';
    render(); await flushPromises();
    expect(payrollTabs.map(tab => tab.id)).toEqual(['stundenerfassung']);
    expect(mocks.replace).toHaveBeenCalledWith({ query: { employeeId: 'employee-1', month: '2026-10' } });
  });

  it('shows loading/errors and discards old contingent responses after employee and month changes', async () => {
    const old = deferred();
    const defaultGet = mocks.api.get.getMockImplementation();
    mocks.api.get.mockImplementation((url, config) => url.includes('/analytics/contingent') && config.params.month === 10
      ? old.promise : defaultGet(url, config));
    render(); await flushPromises();
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('contingentLoading')).toBe(true);
    mocks.route.query = { employeeId: 'employee-2', month: '2026-11' };
    await nextTick(); await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/personal/employee-2/analytics/contingent', expect.objectContaining({ params: { year: 2026, month: 11 } }));
    old.resolve({ data: { type: 'hours', title: 'Veraltete Daten' } }); await flushPromises();
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('contingentData').title).toBe(tariffData.title);
    mocks.api.get.mockImplementation((url, config) => url.includes('/analytics/contingent')
      ? Promise.reject(new Error('offline')) : defaultGet(url, config));
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('contingentData')).toMatchObject({ type: 'notice', issues: [{ code: 'LOAD_FAILED' }] });
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('contingentLoading')).toBe(false);
  });

  it('discards old monthly responses, clears day details and shows import API errors', async () => {
    const old = deferred();
    mocks.api.get.mockImplementation((url, config) => url.includes('/analytics/contingent') ? Promise.resolve({ data: tariffData })
      : config.params.month === '2026-10' ? old.promise : Promise.resolve({ data: { ...monthData, employee: { ...monthData.employee, id: 'employee-2', name: 'Aktueller Monat' } } }));
    render(); await flushPromises();
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('loading')).toBe(true);
    mocks.route.query = { employeeId: 'employee-2', month: '2026-11' }; await nextTick(); await flushPromises();
    old.resolve({ data: { ...monthData, employee: { ...monthData.employee, name: 'Veraltet' } } }); await flushPromises();
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('employee').name).toBe('Aktueller Monat');
    mocks.api.get.mockImplementation(async url => { if (url.includes('/api/payroll/')) throw { response: { data: { message: 'Kein Zugriff auf den Standort.' } } }; return { data: tariffData }; });
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Kein Zugriff auf den Standort.');
    expect(wrapper.getComponent(ZvooveTimeWorkspace).isVisible()).toBe(false);
    expect(wrapper.getComponent(ZvooveTimeWorkspace).props('entries')).toEqual([]);
  });
});
