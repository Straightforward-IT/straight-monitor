import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import PayrollPage from '@/components/PayrollPage.vue';
import ZvooveTimeWorkspace from '@/components/payroll/ZvooveTimeWorkspace.vue';
import PayrollWageTypesSection from '@/components/payroll/PayrollWageTypesSection.vue';
import EmployeeTariffWage from '@/components/tariffs/EmployeeTariffWage.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn() }, route: null, replace: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ replace: mocks.replace }) }));

let wrapper;
const pendingMonths = new Map();
const contingent = { type: 'hours', title: 'Festangestellt', monthlyHours: 100,
  group: { legacyId: '21195', name: 'Lohn Ost Festangestellt' }, groupDate: '2026-08-31' };
function monthData(month, hours = '6.25') {
  return {
    employee: { id: 'employee-1', name: 'Ada Test', personalNr: '2001113', monthlyHours: 100 }, month,
    entries: [{ id: `entry-${month}`, date: `${month}-15`, hours, kb: '', kind: 'productive',
      label: 'Produktive Stunden', personalNr: '2001113', source: { filename: `${month}.xlsx`, sheet: 'Tabelle1', row: 2, daySlot: 1 } }],
    totals: { hours, byCode: [{ kb: '', label: 'Produktive Stunden', hours, days: 1 }] }, issues: [], datasetRevision: 1,
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function render() {
  wrapper = mount(PayrollPage, { attachTo: document.body, global: { stubs: {
    RouterPageLayout: { template: '<div><slot /></div>' },
    EmployeeCard: true,
    MitarbeiterSearch: true,
    EmployeeTariffWage: { props: ['employeeId', 'date'], template: '<div class="tariff-wage" :data-date="date" />' },
    PayrollHelpModal: true,
    SidePanelFrame: { props: ['modelValue'], template: '<aside v-if="modelValue"><slot /></aside>' },
    CustomTooltip: { template: '<span><slot /></span>' },
    'font-awesome-icon': true,
  } } });
}
const workspace = () => wrapper.getComponent(ZvooveTimeWorkspace);
const wageTypes = () => wrapper.getComponent(PayrollWageTypesSection);
const informationTab = id => wrapper.get(`.zvoove-information [data-tab-id="${id}"]`);
const wageTab = id => wrapper.get(`.payroll-wage-types [data-tab-id="${id}"]`);
async function selectTabs() {
  await informationTab('wage').trigger('click');
  await wageTab('fehlzeiten').trigger('click');
}
function expectSelectedTabs() {
  expect(informationTab('wage').attributes('aria-selected')).toBe('true');
  expect(wageTab('fehlzeiten').attributes('aria-selected')).toBe('true');
}
async function changeMonth(month) {
  mocks.route.query.month = month;
  await nextTick();
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks(); pendingMonths.clear(); sessionStorage.clear(); localStorage.clear();
  mocks.route = reactive({ query: { employeeId: 'employee-1', month: '2026-08' } });
  mocks.api.get.mockImplementation((url, config) => url.includes('/analytics/contingent')
    ? Promise.resolve({ data: contingent })
    : pendingMonths.get(config.params.month)?.promise || Promise.resolve({ data: monthData(config.params.month) }));
});
afterEach(() => {
  wrapper?.unmount(); wrapper = null; document.body.innerHTML = ''; sessionStorage.clear(); localStorage.clear();
});

describe('Payroll UI state across month requests', () => {
  it('retains both selected tabs while replacing month facts and clearing the selected day', async () => {
    render(); await flushPromises();
    await selectTabs();
    await wrapper.get('[data-day="2026-08-15"] .tmx-date').trigger('click');
    expect(workspace().props('selectedDate')).toBe('2026-08-15');
    const workspaceInstance = workspace().vm.$.uid;
    const wageTypesInstance = wageTypes().vm.$.uid;
    const navigation = wrapper.get('nav[aria-label="Lohnartenbereiche"]').element;
    navigation.scrollLeft = 145;
    const september = deferred(); pendingMonths.set('2026-09', september);

    await changeMonth('2026-09');
    expect(workspace().vm.$.uid).toBe(workspaceInstance);
    expect(wageTypes().vm.$.uid).toBe(wageTypesInstance);
    expectSelectedTabs();
    expect(workspace().props('month')).toBe('2026-09');
    expect(workspace().props('entries')).toEqual([]);
    expect(workspace().props('totals')).toEqual({ hours: '0', byCode: [] });
    expect(workspace().props('selectedDate')).toBe('');
    expect(wrapper.find('.tm-entry--imported').exists()).toBe(false);
    expect(wageTypes().text()).toContain('September 2026');
    expect(wageTypes().text()).toContain('Nicht ausgewählt');
    expect(wrapper.getComponent(EmployeeTariffWage).props('employeeId')).toBe('employee-1');
    expect(wrapper.getComponent(EmployeeTariffWage).props('date')).toBe('2026-09-30');
    expect(navigation.scrollLeft).toBe(145);

    september.resolve({ data: monthData('2026-09', '9.5') }); await flushPromises();
    expect(workspace().vm.$.uid).toBe(workspaceInstance);
    expectSelectedTabs();
    expect(wrapper.get('[data-day="2026-09-15"] .tm-entry--imported strong').text()).toBe('9,50');
    expect(navigation.scrollLeft).toBe(145);
  });

  it('retains the chosen chart view and tab-strip position on month change and manual reload', async () => {
    render(); await flushPromises();
    await wrapper.get('[title="Ringdiagramm"]').trigger('click');
    await wageTab('zusammenfassung').trigger('click');
    const workspaceInstance = workspace().vm.$.uid;
    const chartInstance = wrapper.getComponent(HoverDataCard).vm.$.uid;
    const navigation = wrapper.get('nav[aria-label="Lohnartenbereiche"]').element;
    navigation.scrollLeft = 220;

    await changeMonth('2026-09');
    expect(workspace().vm.$.uid).toBe(workspaceInstance);
    expect(wrapper.find('.hover-data-card__chart--ring').exists()).toBe(true);
    expect(wageTab('zusammenfassung').attributes('aria-selected')).toBe('true');
    expect(navigation.scrollLeft).toBe(220);

    const reload = deferred(); pendingMonths.set('2026-09', reload);
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(workspace().vm.$.uid).toBe(workspaceInstance);
    expect(workspace().props('entries')).toEqual([]);
    expect(wrapper.getComponent(HoverDataCard).vm.$.uid).toBe(chartInstance);
    expect(wageTab('zusammenfassung').attributes('aria-selected')).toBe('true');
    reload.resolve({ data: monthData('2026-09', '8') }); await flushPromises();
    expect(wrapper.find('.hover-data-card__chart--ring').exists()).toBe(true);
    expect(wageTab('zusammenfassung').attributes('aria-selected')).toBe('true');
    expect(navigation.scrollLeft).toBe(220);
  });

  it('keeps selections through a failed month request and retry without showing old entries', async () => {
    render(); await flushPromises(); await selectTabs();
    const workspaceInstance = workspace().vm.$.uid;
    const september = deferred(); pendingMonths.set('2026-09', september);
    await changeMonth('2026-09');
    september.reject({ response: { data: { message: 'Monatsstunden vorübergehend nicht erreichbar.' } } }); await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe('Monatsstunden vorübergehend nicht erreichbar.');
    expect(workspace().vm.$.uid).toBe(workspaceInstance);
    expect(workspace().isVisible()).toBe(false);
    expect(workspace().props('entries')).toEqual([]);

    const retry = deferred(); pendingMonths.set('2026-09', retry);
    await wrapper.get('[aria-label="Stand neu laden"]').trigger('click'); await flushPromises();
    expect(workspace().vm.$.uid).toBe(workspaceInstance);
    expect(workspace().isVisible()).toBe(true);
    expectSelectedTabs();
    expect(workspace().props('entries')).toEqual([]);
    retry.resolve({ data: monthData('2026-09', '7.5') }); await flushPromises();
    expectSelectedTabs();
    expect(wrapper.get('[data-day="2026-09-15"] .tm-entry--imported strong').text()).toBe('7,50');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
