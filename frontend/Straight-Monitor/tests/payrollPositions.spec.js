import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Section from '@/components/payroll/PayrollWageTypesSection.vue';
import Table from '@/components/payroll/PayrollPositionsTable.vue';
import { aggregatePositions, selectPositions, summarizePositions, formatPositionHours } from '@/utils/payrollPositions';

vi.mock('@/composables/useAuftragModals', () => ({ useAuftragModals: () => ({ openAuftrag: vi.fn() }) }));
vi.mock('@/composables/useLohnartModals', () => ({ useLohnartModals: () => ({ openLohnart: vi.fn() }) }));

const row = extra => ({ id: 'l100', date: '2026-10-09', side: 'L', kind: 'productive', wageType: '100', label: 'Normalstunden', auftragNr: 2510476, days: 1, hours: '8', quantityNumerator: '480', quantityDenominator: '60', rate: '15', percent: null, amount: '120.00', status: 'CALCULATED', countForTotalHours: true, offset: { code: '0' }, issues: [], ...extra });
const rows = [row(), row({ id: 'l110', wageType: '110', label: 'Übertarifliche Zulage', rate: '1.39', amount: '11.12', countForTotalHours: false, status: 'PARTIAL', offset: { code: '3', label: 'ÜTZ', target: '602', priority: '1' }, issues: [{ code: 'OFFSET', message: 'Verrechnung offen' }] }), row({ id: 'f100', side: 'F', rate: '33', amount: '264.00' }), row({ id: 'vacation', date: '2026-10-08', kind: 'absence', wageType: '310', label: 'Urlaub', hours: '4.05', quantityNumerator: null, quantityDenominator: null, rate: null, amount: null, countForTotalHours: false, status: 'PENDING', issues: [{ code: 'AVERAGE_NOT_IMPLEMENTED', message: 'Durchschnittsverfahren (SP1) noch nicht implementiert.' }] }), row({ id: 'fs', kind: 'marker', wageType: null, kb: 'FS', label: 'Freischicht', hours: null, quantityNumerator: null, quantityDenominator: null, rate: null, amount: null, countForTotalHours: false, status: 'PENDING' })];
const data = { rows, allowedSides: ['L', 'F'], conditions: [], issues: [] };
let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; });
const tab = id => wrapper.get(`[data-tab-id="${id}"]`);

describe('payroll position filters, quantities and presentation', () => {
  it('keeps the combined tab as the full union of L and F, including absence and pending positions', () => {
    expect(selectPositions(data, 'lohn-faktur', '').map(row => row.id)).toEqual(rows.map(row => row.id));
    const combined = selectPositions(data, 'lohn-faktur', '2026-10-09');
    expect(combined).toHaveLength(4); expect(combined.some(row => row.kb === 'FS')).toBe(true);
    expect(selectPositions(data, 'summe-lohn', '').every(row => row.side === 'L')).toBe(true);
    expect(selectPositions(data, 'summe-faktur', '').every(row => row.side === 'F')).toBe(true);
    expect(selectPositions(data, 'fehlzeiten', '').map(row => row.id)).toEqual(['vacation', 'fs']);
  });
  it('counts hours by the explicit total-hours flag and keeps L and F separate', () => {
    const summary = summarizePositions(rows);
    expect(summary.find(row => row.side === 'L')).toMatchObject({ hours: '8,00', amount: null, partialAmount: '131.12' });
    expect(summary.find(row => row.side === 'F')).toMatchObject({ hours: '8,00', amount: '264' });
    const unknown = summarizePositions([row({ countForTotalHours: null })])[0];
    expect(unknown.hoursComplete).toBe(false);
    expect(unknown.hours).toBe('—');
    expect(summarizePositions([row({ issues: [{ code: 'BOOKING_OVERLAP', message: 'Zeitkonflikt' }] })])[0].hours).toBe('—');
  });
  it('adds exact minute fractions before rounding and never sums unlike rates together', () => {
    const minutes = ['1', '2', '3'].map(id => row({ id, hours: '0.0166666667', quantityNumerator: '1', amount: '0.25' }));
    const result = aggregatePositions(minutes);
    expect(result).toHaveLength(1); expect(formatPositionHours(result[0])).toBe('0,05'); expect(result[0].amount).toBe('0.75');
    expect(aggregatePositions([...minutes, row({ rate: '16' })])).toHaveLength(2);
    expect(aggregatePositions([row(), row({ id: 'another', auftragNr: 2 })], true)).toHaveLength(2);
  });
  it('renders side colors, total-hours identification, missing values and offset context', () => {
    wrapper = mount(Table, { props: { rows } });
    expect(wrapper.findAll('tbody tr.payroll-positions__wage')).toHaveLength(4);
    expect(wrapper.findAll('tbody tr.payroll-positions__invoice')).toHaveLength(1);
    const allowance = wrapper.get('tbody [data-wage-type="110"]'); expect(allowance.text()).toContain('ÜTZ → 602'); expect(allowance.text()).toContain('Priorität 1'); expect(allowance.text()).toContain('Teilbewertung');
    expect(allowance.find('.payroll-positions__flag').exists()).toBe(false);
    expect(wrapper.get('tbody [data-wage-type="310"]').text()).toContain('Durchschnittsverfahren');
    expect(wrapper.get('tbody [data-wage-type="310"]').findAll('td')[8].text()).toBe('—');
  });
  it('filters the selected booking day, retains tab selection and allows returning to the month', async () => {
    wrapper = mount(Section, { props: { month: '2026-10', selectedDate: '2026-10-09', positions: data, hasAccess: true } });
    expect(wrapper.getComponent(Table).props('rows')).toHaveLength(4);
    await tab('summe-lohn').trigger('click'); expect(wrapper.getComponent(Table).props('rows').every(row => row.side === 'L')).toBe(true);
    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['Lohnart-Nr.', 'Lohnart-Bezeichnung', 'Stunden', 'Preis €', 'Zulage %', 'Betrag €']);
    const allowance = wrapper.get('[data-wage-type="110"]');
    expect(allowance.findAll('td').map(td => td.text())).toEqual(['110', 'Übertarifliche Zulage', '8,00', '1,39', '—', '11,12']);
    expect(wrapper.text()).toContain('Verrechnung offen');
    await tab('summe-faktur').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody tr').findAll('td').map(td => td.text())).toEqual(['100', 'NormalstundenGesamtstunden', '8,00', '33,00', '—', '264,00']);
    await tab('summe-lohn').trigger('click');
    await wrapper.setProps({ selectedDate: '2026-10-08' });
    expect(tab('summe-lohn').attributes('aria-selected')).toBe('true'); expect(wrapper.getComponent(Table).props('rows')[0].wageType).toBe('310');
    await wrapper.findAll('button').find(button => button.text() === 'Monat anzeigen').trigger('click'); expect(wrapper.emitted('clearDay')).toHaveLength(1);
    await tab('fehlzeiten').trigger('click'); expect(wrapper.getComponent(Table).props('rows')).toHaveLength(1);
  });
  it('removes private tables while loading, on failure and when access is withdrawn', async () => {
    wrapper = mount(Section, { props: { month: '2026-10', positions: data, hasAccess: true } });
    expect(wrapper.findComponent(Table).exists()).toBe(true);
    await wrapper.setProps({ loading: true }); expect(wrapper.findComponent(Table).exists()).toBe(false);
    await wrapper.setProps({ loading: false, error: 'Berechtigung entzogen' }); expect(wrapper.findComponent(Table).exists()).toBe(false); expect(wrapper.get('[role="alert"]').text()).toBe('Berechtigung entzogen');
    await wrapper.setProps({ error: '', hasAccess: false }); expect(wrapper.findComponent(Table).exists()).toBe(false);
  });
});
