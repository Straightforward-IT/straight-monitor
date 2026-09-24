import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { usePayrollPreparation } from '../src/composables/usePayrollPreparation';
import { preparationInput, absenceDays, preparationCalendar } from '../src/utils/payrollPreparation';
import PayrollMonthlyReview from '../src/components/payroll/PayrollMonthlyReview.vue';
import PayrollPreparationEditor from '../src/components/payroll/PayrollPreparationEditor.vue';
import TimeManagement from '../src/components/ui-elements/TimeManagement.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, leave: null, update: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: fn => { mocks.leave = fn; }, onBeforeRouteUpdate: fn => { mocks.update = fn; }, useRoute: () => ({ query: {} }) }));
let wrapper;
const state = () => ({ revision: 1, state: 'DRAFT', items: [], inherited: [], sources: [], sourceHash: 'source-v1', stale: false, totals: { workedMinutes: 450, absenceMinutes: 0, adjustmentMinutes: 0, proposedDepositMinutes: 0, proposedWithdrawalMinutes: 0 }, snapshots: [], history: [], canReview: true });
beforeEach(() => { vi.clearAllMocks(); mocks.api.get.mockResolvedValue({ data: state() }); });
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });
function harness() {
  let preparation;
  wrapper = mount(defineComponent({ setup() { preparation = usePayrollPreparation(ref('employee-1'), ref('2026-09')); return () => null; } }));
  return preparation;
}
describe('Payroll preparation persistence', () => {
  it('waits for API success before marking edits saved and retains inputs on a conflict', async () => {
    const p = harness(); await p.load();
    p.items.value.push({ id: 'a', kind: 'ADJUSTMENT', date: '2026-09-01', source: '', minutes: 60, reason: 'Correction' });
    p.reason.value = 'Review';
    let reject;
    mocks.api.put.mockReturnValue(new Promise((_, no) => { reject = no; }));
    const pending = p.act();
    expect(p.dirty.value).toBe(true); expect(p.busy.value).toBe(true);
    reject({ response: { data: { message: 'Revision conflict' } } }); await pending;
    expect(p.dirty.value).toBe(true); expect(p.items.value[0].minutes).toBe(60); expect(p.error.value).toBe('Revision conflict');
    mocks.api.put.mockResolvedValue({ data: { ...state(), revision: 2, items: p.items.value } });
    await p.act();
    expect(p.dirty.value).toBe(false); expect(p.state.value.revision).toBe(2);
  });
  it('guards navigation for entry and mapping edits but allows tab changes', async () => {
    const p = harness(); await p.load(); p.formDirty.value = true;
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(mocks.leave()).toBe(false);
    expect(mocks.update({ query: { employeeId: 'a', month: '2026-09', tab: 'monatspruefung' } }, { query: { employeeId: 'a', month: '2026-09' } })).toBe(true);
    expect(mocks.update({ query: { employeeId: 'b', month: '2026-09' } }, { query: { employeeId: 'a', month: '2026-09' } })).toBe(false);
    expect(mocks.update({ query: { employeeId: '' } }, { query: {} })).toBe(false);
    p.formDirty.value = false; p.mappingDirty.value = true; expect(mocks.leave()).toBe(false);
  });
  it('does not let a stale employee read replace the newest month', async () => {
    const p = harness(); let first;
    mocks.api.get.mockReturnValueOnce(new Promise(resolve => { first = resolve; })).mockResolvedValueOnce({ data: { ...state(), revision: 8 } });
    const old = p.load(); await p.load(); first({ data: state() }); await old;
    expect(p.state.value.revision).toBe(8);
  });
  it('refreshes source facts without losing draft inputs and refuses concurrent revision adoption', async () => {
    const p = harness(); await p.load();
    p.items.value.push({ id: 'a', kind: 'ADJUSTMENT', date: '2026-09-01', minutes: 60, reason: 'Keep me' });
    p.formDirty.value = true; p.reason.value = 'Keep this too'; p.reconcile.value = true;
    mocks.api.get.mockResolvedValue({ data: { ...state(), sourceHash: 'new-release', stale: true } });
    await p.refreshSources();
    expect(p.state.value.sourceHash).toBe('new-release'); expect(p.reconcile.value).toBe(false);
    expect(p.items.value[0].reason).toBe('Keep me'); expect(p.formDirty.value).toBe(true); expect(p.reason.value).toBe('Keep this too');
    mocks.api.get.mockResolvedValue({ data: { ...state(), revision: 2, items: [] } });
    await p.refreshSources();
    expect(p.state.value.revision).toBe(1); expect(p.items.value).toHaveLength(1);
    expect(p.error.value).toContain('anderer Benutzer');
  });
  it('keeps saved category metadata for display without sending it as editable facts', async () => {
    const p = harness();
    const item = { id: 'a', kind: 'ABSENCE', code: 'K', label: 'Saved label', credited: true, sourceLohnart: '999', startDate: '2026-09-01', endDate: '2026-09-01', daily: [{ date: '2026-09-01', minutes: 120 }], reason: 'Checked' };
    mocks.api.get.mockResolvedValue({ data: { ...state(), items: [item] } }); await p.load();
    expect(p.items.value[0].label).toBe('Saved label');
    expect(preparationCalendar(p.items.value, [], '2026-09', [{ code: 'K', credited: false }])[0].credited).toBe(true);
    expect(preparationInput(p.items.value[0])).not.toHaveProperty('credited');
    expect(preparationInput(p.items.value[0])).not.toHaveProperty('label');
  });
  it('never serializes Zeitkonto balances', () => {
    const item = { id: 'x', kind: 'TRANSFER', source: 'AZK', target: 'PAYMENT', date: '2026-09-01', minutes: 120, reason: 'Request', bankMinutes: 999, balance: 999 };
    expect(preparationInput(item)).not.toHaveProperty('bankMinutes');
    expect(preparationInput(item)).not.toHaveProperty('balance');
  });
  it('keeps original period dates while showing explicitly entered quantities in each month', () => {
    const daily = absenceDays('2026-09-30', '2026-10-02', [{ date: '2026-10-01', minutes: 120 }]);
    expect(daily).toEqual([{ date: '2026-09-30', minutes: 0 }, { date: '2026-10-01', minutes: 120 }, { date: '2026-10-02', minutes: 0 }]);
    const item = { id: 'a', kind: 'ABSENCE', code: 'K', daily, startDate: '2026-09-30', endDate: '2026-10-02' };
    const rows = preparationCalendar([], [item], '2026-10', [{ code: 'K', kind: 'sick', credited: true }]);
    expect(rows).toHaveLength(2); expect(rows[0].minutes).toBe(120); expect(item.startDate).toBe('2026-09-30');
  });
});

describe('Payroll preparation UI', () => {
  it('shows unknown Zeitkonto without a zero balance or demo save and opens AZK proposal actions', async () => {
    wrapper = mount(TimeManagement, { props: { employee: { id: 'e', monthlyHours: 100 }, month: '2026-09', initialData: { entries: [] }, preparationMode: true, bucketEnabled: true, showGuide: false }, global: { stubs: { TimeMonthMatrix: true, HoverDataCard: true, HourBucket: true, TimeDayEntryModal: true } } });
    expect(wrapper.find('.tm-bank').text()).toContain('Zeitkonto nicht verfügbar');
    expect(wrapper.find('.tm-bank__balance').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Demo speichern');
    await wrapper.find('.tm-bank').trigger('click');
    expect(wrapper.emitted('prepareTransfer')[0][0]).toMatchObject({ source: 'AZK', target: 'PAYMENT' });
  });
  it('offers cross-month original-period editing and preserves the selected source category', async () => {
    wrapper = mount(PayrollPreparationEditor, { props: { modelValue: [], sources: [], month: '2026-09', types: [{ code: 'K', kind: 'sick', label: 'Krank' }], inherited: [{ id: 'old:a', kind: 'ABSENCE', code: 'K', startDate: '2026-08-31', endDate: '2026-09-02', daily: [], originMonth: '2026-08' }] }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
    expect(wrapper.text()).toContain('Im Ursprungsmonat 2026-08 bearbeiten');
    await wrapper.findAll('select')[1].setValue('K');
    await wrapper.find('input[maxlength]').setValue('Verified');
    await wrapper.findAll('button').find(b => b.text() === 'Zum Entwurf hinzufügen').trigger('click');
    expect(wrapper.emitted('update:modelValue')[0][0][0].code).toBe('K');
  });
  it('requires a clean draft to finalize and loads reactive mappings without losing form state', async () => {
    wrapper = mount(PayrollMonthlyReview, { props: { state: state(), reason: 'Approved', dirty: true, mapping: { version: 1, config: { clientId: '123-4', personnelNumber: 12, rules: [] } } } });
    expect(wrapper.findAll('button').find(b => b.text() === 'Monat intern abschließen').attributes('disabled')).toBeDefined();
    await wrapper.setProps({ dirty: false });
    await wrapper.findAll('button').find(b => b.text() === 'Monat intern abschließen').trigger('click');
    expect(wrapper.emitted('action')[0]).toEqual(['finalize']);
    await wrapper.find('input').setValue('123-5'); await flushPromises();
    expect(wrapper.emitted('mappingDirty').at(-1)).toEqual([true]);
  });
});
