import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PayrollAverageModal from '@/components/Modals/PayrollAverageModal.vue';
const mocks = vi.hoisted(() => ({ get: vi.fn(), openLohnart: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: { get: mocks.get } }));
vi.mock('@/composables/useLohnartModals', () => ({ useLohnartModals: () => ({ openLohnart: mocks.openLohnart }) }));
let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.clearAllMocks(); });
const result = () => ({ employee: { id: 'employee-1', personalNr: '2000638', name: 'Testperson' }, months: ['2026-05', '2026-06', '2026-07'],
  sources: [{ filename: 'Ausweislohn 2026.xlsx' }], issues: [], rows: [{ month: '2026-05', personalNr: '2000638', wageType: '100', label: 'Normalstunden', sp1: '1', rule: 'Alle Dimensionen', hours: '72', amount: '1296' }, { month: '2026-05', personalNr: '2000638', wageType: '146', label: 'Sonntagszuschlag', sp1: '2', hours: '0', amount: '51.75' }],
  days: [{ month: '2026-05', days: '21', knownDays: '21', fsDays: 9 }, { month: '2026-06', days: '22', knownDays: '22', fsDays: 13 }, { month: '2026-07', days: '23', knownDays: '23', fsDays: 8 }],
  totals: { hours: '264', days: '66', amount: '4855.5', averageHours: '4.00', averageAmount: '18.39', dailyRate: '73.57' } });
function render(props = {}) {
  wrapper = mount(PayrollAverageModal, { props: { modelValue: true, employeeId: 'employee-1', employeeName: 'Testperson', month: '2026-08', ...props }, global: { stubs: {
    ModalFrame: { props: ['modelValue', 'title', 'subtitle'], template: '<div v-if="modelValue" role="dialog"><h3>{{ title }}</h3><p>{{ subtitle }}</p><slot/><footer><slot name="footer"/></footer></div>' },
  } } });
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

describe('historical SP1 average modal', () => {
  it('toggles exact numeric header sorting, keeps missing values last and preserves equal-value order and source rows', async () => {
    const data = result();
    data.rows = [
      { ...data.rows[0], wageType: '100', hours: '9.0000000000000000002', amount: '2.5' },
      { ...data.rows[0], wageType: '101', hours: '9.0000000000000000001', amount: '10' },
      { ...data.rows[0], wageType: '102', hours: '0', amount: '-1' },
      { ...data.rows[0], wageType: '103', hours: null, amount: null },
      { ...data.rows[0], wageType: '104', hours: '0', amount: '2.50' },
    ];
    const original = structuredClone(data.rows);
    mocks.get.mockResolvedValue({ data }); render(); await flushPromises();
    const table = wrapper.get('[aria-label="Lohnarten nach Monaten"]');
    const wageNumbers = () => table.findAll('tbody tr').map(row => row.findAll('td')[3].text());
    const hours = table.get('[data-sort-key="hours"]');
    await hours.get('button').trigger('click');
    expect(hours.attributes('aria-sort')).toBe('ascending');
    expect(wageNumbers()).toEqual(['102', '104', '101', '100', '103']);
    await hours.get('button').trigger('click');
    expect(hours.attributes('aria-sort')).toBe('descending');
    expect(wageNumbers()).toEqual(['100', '101', '102', '104', '103']);
    await table.get('[data-sort-key="amount"] button').trigger('click');
    expect(hours.attributes('aria-sort')).toBe('none');
    expect(wageNumbers()).toEqual(['102', '100', '104', '101', '103']);
    expect(data.rows).toEqual(original);
    expect(wrapper.get('.payroll-average__totals tbody').text()).toContain('73,57');
  });
  it('sorts months chronologically and lets the days table sort independently from wages', async () => {
    const data = result();
    data.rows = ['2027-01', '2026-12', '2026-11'].map((month, index) => ({ ...data.rows[0], month, wageType: String(100 + index) }));
    mocks.get.mockResolvedValue({ data }); render(); await flushPromises();
    const wages = wrapper.get('[aria-label="Lohnarten nach Monaten"]');
    const days = wrapper.get('[aria-label="Arbeitstage nach Monaten"]');
    const wageMonths = () => wages.findAll('tbody tr').map(row => row.findAll('td').slice(0, 2).map(cell => cell.text()));
    await wages.get('[data-sort-key="month"] button').trigger('click');
    expect(wageMonths()).toEqual([['2026', 'November'], ['2026', 'Dezember'], ['2027', 'Januar']]);
    await days.get('[data-sort-key="fsDays"] button').trigger('click');
    expect(days.findAll('tbody tr').map(row => row.findAll('td')[1].text())).toEqual(['Juli', 'Mai', 'Juni']);
    expect(wages.get('[data-sort-key="month"]').attributes('aria-sort')).toBe('ascending');
    expect(wageMonths()).toEqual([['2026', 'November'], ['2026', 'Dezember'], ['2027', 'Januar']]);
    await wages.get('[data-sort-key="month"] button').trigger('click');
    expect(wageMonths()).toEqual([['2027', 'Januar'], ['2026', 'Dezember'], ['2026', 'November']]);
  });
  it('loads preceding months and presents the wage, days and exact final ratio results', async () => {
    mocks.get.mockResolvedValue({ data: result() }); render(); await flushPromises();
    expect(mocks.get).toHaveBeenCalledWith('/api/payroll/employees/employee-1/average', expect.objectContaining({ params: { cutoff: '2026-08-01', months: 3 } }));
    expect(wrapper.text()).toContain('Stunden-Schnittberechnung Monat'); expect(wrapper.text()).toContain('AUSWEISLOHN');
    expect(wrapper.get('.payroll-average__period').text()).toContain('Mai 2026');
    expect(wrapper.get('[aria-label="Lohnarten im Durchschnitt"]').text()).toContain('Sonntagszuschlag');
    await wrapper.get('button[aria-label="Lohnart 100 öffnen"]').trigger('click');
    expect(mocks.openLohnart).toHaveBeenCalledWith('100');
    expect(wrapper.get('[aria-label="Arbeitstage im Durchschnitt"]').text()).toContain('Davon FS');
    const totals = wrapper.get('.payroll-average__totals tbody').text();
    expect(totals).toContain('264,00'); expect(totals).toContain('66,00'); expect(totals).toContain('4855,50');
    expect(totals).toContain('18,39'); expect(totals).toContain('73,57'); expect(totals).not.toContain('73,56');
  });
  it('clears stale results after input changes and prepares the newly selected period explicitly', async () => {
    mocks.get.mockResolvedValue({ data: result() }); render(); await flushPromises();
    await wrapper.get('input[type="date"]').setValue('2026-09-01');
    expect(wrapper.find('.payroll-average__totals').exists()).toBe(false);
    await wrapper.get('input[type="number"]').setValue('2');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(mocks.get.mock.calls.at(-1)[1].params).toEqual({ cutoff: '2026-09-01', months: 2 });
  });
  it('displays missing values and day-rule issues without turning them into zero', async () => {
    const data = result(); data.days[0].days = null; data.totals.days = null; data.totals.dailyRate = null;
    data.issues = [{ message: 'Der Monatskalender fehlt.' }];
    mocks.get.mockResolvedValue({ data }); render(); await flushPromises();
    expect(wrapper.text()).toContain('Kalenderzählung offen'); expect(wrapper.text()).toContain('Der Monatskalender fehlt.');
    expect(wrapper.get('.payroll-average__totals tbody').text()).toContain('—');
  });
  it('labels calendar weekdays explicitly and displays an unavailable FS count separately', async () => {
    const data = result(); data.days[0].fsDays = null;
    mocks.get.mockResolvedValue({ data }); render(); await flushPromises();
    expect(wrapper.text()).toContain('Werktage (Montag–Freitag)');
    expect(wrapper.text()).toContain('Alle Montag–Freitag des Kalendermonats');
    const first = wrapper.get('[aria-label="Arbeitstage nach Monaten"] tbody tr');
    expect(first.findAll('td')[3].text()).toBe('21,00'); expect(first.findAll('td')[4].text()).toBe('—');
    expect(wrapper.get('.payroll-average__totals tbody').text()).toContain('66,00');
  });
  it('ignores requests for an old employee or a closed modal and clears old data on failure', async () => {
    const old = deferred(); mocks.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: { ...result(), employee: { personalNr: '222', name: 'Neue Person' } } });
    render(); await wrapper.setProps({ employeeId: 'employee-2' }); await flushPromises();
    old.resolve({ data: result() }); await flushPromises();
    expect(wrapper.get('input[readonly]').element.value).toBe('1 · SP1');
    expect(wrapper.text()).not.toContain('Neue Person');
    expect(wrapper.findAll('input[readonly]')[1].element.value).toBe('222');
    mocks.get.mockRejectedValueOnce({ response: { data: { message: 'Quelldatei fehlt.' } } });
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Quelldatei fehlt.'); expect(wrapper.find('.payroll-average__totals').exists()).toBe(false);
    const closing = deferred(); mocks.get.mockReturnValueOnce(closing.promise);
    await wrapper.get('form').trigger('submit'); await wrapper.setProps({ modelValue: false });
    closing.resolve({ data: result() }); await flushPromises(); expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});
