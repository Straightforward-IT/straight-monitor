import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import PayrollPage from '@/components/PayrollPage.vue';
import TimeManagement from '@/components/ui-elements/TimeManagement.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn() }, route: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route, useRouter: () => ({ replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn(),
}));
vi.mock('@/composables/useTimeCaptureModals', () => ({ useTimeCaptureModals: () => ({ openTimeCapture: vi.fn() }) }));

let wrapper;
const monthData = { employee: { id: 'employee-1', name: 'Ada Test', monthlyHours: 100, employmentLabel: 'Teilzeit' },
  initialData: { entries: [], bankMinutes: null }, dayEntryTypes: [] };
const tariffData = { type: 'days-earnings', title: 'KZF 603 mit AZK', group: { legacyId: '27356' }, totalEarnings: '650.00' };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function render() {
  wrapper = shallowMount(PayrollPage, { global: { stubs: {
    RouterPageLayout: { template: '<div><slot /></div>' },
    Toolbar: { template: '<div><slot /><slot name="bottom-actions" /></div>' },
    ToolbarGroup: { template: '<div><slot /></div>' },
    ToolbarButton: { template: '<button><slot /></button>' },
    CustomTooltip: { template: '<div><slot /></div>' },
  } } });
}
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.route = reactive({ query: { employeeId: 'employee-1', month: '2026-10' } });
  mocks.api.get.mockImplementation(async url => ({ data: url.includes('/analytics/contingent') ? tariffData
    : url.includes('/working-times/') ? monthData
    : { revision: 0, state: 'DRAFT', items: [], inherited: [], sources: [], snapshots: [], history: [] } }));
});
afterEach(() => { wrapper?.unmount(); wrapper = null; sessionStorage.clear(); });

describe('Payroll tariff contingent integration', () => {
  it('loads the selected employee/month and refreshes tariff facts with the month data', async () => {
    render(); await flushPromises();
    const card = () => wrapper.getComponent(TimeManagement);
    expect(mocks.api.get).toHaveBeenCalledWith('/api/personal/employee-1/analytics/contingent', expect.objectContaining({ params: { year: 2026, month: 10 } }));
    expect(card().props('contingentData')).toMatchObject({ ...tariffData, employeeName: 'Ada Test' });
    expect(card().props('contingentLoading')).toBe(false);
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(mocks.api.get.mock.calls.filter(([url]) => url.includes('/analytics/contingent'))).toHaveLength(2);
  });

  it('shows loading/errors and discards old responses after employee and month changes', async () => {
    const old = deferred();
    const defaultGet = mocks.api.get.getMockImplementation();
    mocks.api.get.mockImplementation((url, config) => url.includes('/analytics/contingent') && config.params.month === 10
      ? old.promise : defaultGet(url, config));
    render(); await flushPromises();
    expect(wrapper.getComponent(TimeManagement).props('contingentLoading')).toBe(true);
    mocks.route.query = { employeeId: 'employee-2', month: '2026-11' };
    await nextTick(); await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/personal/employee-2/analytics/contingent', expect.objectContaining({ params: { year: 2026, month: 11 } }));
    old.resolve({ data: { type: 'hours', title: 'Veraltete Daten' } }); await flushPromises();
    expect(wrapper.getComponent(TimeManagement).props('contingentData').title).toBe(tariffData.title);
    mocks.api.get.mockImplementation((url, config) => url.includes('/analytics/contingent')
      ? Promise.reject(new Error('offline')) : defaultGet(url, config));
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(wrapper.getComponent(TimeManagement).props('contingentData')).toMatchObject({ type: 'notice', issues: [{ code: 'LOAD_FAILED' }] });
    expect(wrapper.getComponent(TimeManagement).props('contingentLoading')).toBe(false);
  });
});
