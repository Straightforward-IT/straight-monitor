import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import ZvooveDayDetails from '@/components/payroll/ZvooveDayDetails.vue';

let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; });
const productive = () => ({
  id: 'booking-1', date: '2026-09-09', kind: 'productive', kb: '', personalNr: '100001', hours: '7.5',
  source: { filename: 'Stunduhr 2026.xlsx', sheet: 'Tabelle1', row: 22 },
  booking: { auftragNr: 2510476, start: '2026-09-09T06:00:00Z', end: '2026-09-09T14:00:00Z', breakMinutes: 30, breakLocationKnown: true,
    breaks: [{ start: '2026-09-09T10:00:00Z', end: '2026-09-09T10:30:00Z', paid: false }] },
  orderContext: { status: 'AVAILABLE',
    order: { number: 2510476, title: 'Messe Hamburg', customerName: 'Messekunde', customerNumber: 42, site: 'Messehalle', town: 'Hamburg' },
    shift: { status: 'MATCHED', externalId: '17', label: 'Service Früh', from: '2026-09-09', until: '2026-09-09', start: '08:00', end: '16:30', meetingTime: '07:45', meetingPoint: 'Haupteingang', contactName: 'Schichtleitung' },
    assignment: { status: 'MATCHED', externalNumber: '10017', title: 'Servicehost', from: '2026-09-09', until: '2026-09-09', start: '08:00', end: '16:30', guaranteedHours: 0 },
  },
});
async function render(entries) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }, { path: '/auftraege', component: { template: '<div />' } }] });
  await router.push('/'); await router.isReady();
  wrapper = mount(ZvooveDayDetails, { props: { entries }, global: { plugins: [router] } });
  return router;
}

describe('productive payroll day side panel', () => {
  it('links the order to the existing calendar and distinguishes planned and actual times', async () => {
    const router = await render([productive()]);
    const link = wrapper.get('a');
    expect(link.text()).toBe('Auftrag 2510476');
    expect(link.attributes('href')).toBe('/auftraege?tab=calendar&auftragnr=2510476&focusDate=2026-09-09');
    expect(wrapper.text()).toContain('Messe Hamburg'); expect(wrapper.text()).toContain('42 · Messekunde');
    expect(wrapper.text()).toContain('Messehalle'); expect(wrapper.text()).toContain('Service Früh'); expect(wrapper.text()).toContain('Servicehost');
    expect(wrapper.get('[aria-label="Gebuchte Arbeitszeit"]').text()).toContain('08:00–16:00');
    expect(wrapper.get('[aria-label="Schicht"]').text()).toContain('Geplante Zeit08:00–16:30');
    expect(wrapper.get('[aria-label="Schicht"]').text()).toContain('07:45 · Haupteingang');
    expect(wrapper.get('[aria-label="Einsatz"]').text()).toContain('Garantiestunden Lohn0,00 Std.');
    expect(wrapper.text()).toContain('12:00–12:30');
    expect(wrapper.get('details').attributes('open')).toBeUndefined();
    expect(wrapper.get('details').text()).toContain('Stunduhr 2026.xlsx');
    await link.trigger('click'); await new Promise(resolve => setTimeout(resolve, 0));
    expect(router.currentRoute.value.query).toEqual({ tab: 'calendar', auftragnr: '2510476', focusDate: '2026-09-09' });
  });
  it('renders one order section per booking and keeps nonproductive entries as day details', async () => {
    const second = productive(); second.id = 'booking-2'; second.booking.auftragNr = 2510477; second.orderContext.order.number = 2510477;
    await render([productive(), second, { id: 'absence', kind: 'absence', kb: 'U', label: 'Urlaub bezahlt', lohnartNummer: '310', hours: '4.05', personalNr: '100001' }]);
    expect(wrapper.findAll('.payroll-order-details')).toHaveLength(2);
    expect(wrapper.findAll('a').map(link => link.text())).toEqual(['Auftrag 2510476', 'Auftrag 2510477']);
    const absence = wrapper.get('.zvoove-day-entry--absence');
    expect(absence.text()).toContain('Urlaub bezahlt'); expect(absence.text()).toContain('310'); expect(absence.find('details').exists()).toBe(false);
  });
  it('reports incomplete mappings and unlocated pauses without inventing planned shifts', async () => {
    const entry = productive(); entry.booking.breakLocationKnown = false; entry.booking.breaks = [];
    entry.orderContext.shift = { status: 'MISSING', externalId: '17' };
    entry.orderContext.assignment = { status: 'AMBIGUOUS' };
    await render([entry]);
    expect(wrapper.text()).toContain('genaue Pausenlage fehlt');
    expect(wrapper.text()).toContain('Keine passende Schicht'); expect(wrapper.text()).toContain('Mehrere Einsätze passen');
    expect(wrapper.text()).not.toContain('Service Früh'); expect(wrapper.text()).not.toContain('Geplante Zeit');
  });
  it('does not expose related data or a calendar link for forbidden orders', async () => {
    const entry = productive(); entry.orderContext.status = 'FORBIDDEN';
    await render([entry]);
    expect(wrapper.text()).toContain('Auftrag 2510476'); expect(wrapper.text()).toContain('Keine Berechtigung');
    expect(wrapper.find('a').exists()).toBe(false); expect(wrapper.text()).not.toContain('Messekunde');
    expect(wrapper.text()).not.toContain('Servicehost'); expect(wrapper.find('[aria-label="Schicht"]').exists()).toBe(false);
  });
  it('retains source values without inferring an order for legacy monthly quantities', async () => {
    const entry = productive(); delete entry.booking; delete entry.orderContext;
    await render([entry]);
    expect(wrapper.text()).toContain('Auftrag nicht zugeordnet'); expect(wrapper.text()).toContain('keine eindeutige Auftrags-');
    expect(wrapper.text()).toContain('7,50 Std.'); expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.get('details').text()).toContain('100001');
  });
});
