import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount, shallowMount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import CalendarControls from '../src/components/ui-elements/CalendarControls.vue';
import AuftragListView from '../src/components/orders/AuftragListView.vue';
import AuftragDetailsSidePanel from '../src/components/orders/AuftragDetailsSidePanel.vue';
import AuftragMobileDateNavigation from '../src/components/orders/calendar/AuftragMobileDateNavigation.vue';
import AuftragCalendarWorkspace from '../src/components/orders/calendar/AuftragCalendarWorkspace.vue';
import SidePanelFrame from '../src/components/frames/SidePanelFrame.vue';
import AuftraegePage from '../src/components/AuftraegePage.vue';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const stubs = {
  'font-awesome-icon': true,
  CustomTooltip: { template: '<div><slot /></div>' },
  PillMultiSelect: true,
};
const wrappers = [];
function render(component, options = {}) {
  const wrapper = mount(component, { attachTo: document.body, global: { stubs }, ...options });
  wrappers.push(wrapper);
  return wrapper;
}
const byLabel = (wrapper, label) => wrapper.get(`button[aria-label="${label}"]`);
const referenceDate = () => new Date(2026, 8, 29);
const orders = [
  { _id: 'early', auftragNr: 20, eventTitel: 'Früher Auftrag', vonDatum: '2026-09-27', bisDatum: '2026-09-27', schichten: [{ besetzt: 2, bedarf: 2 }] },
  { _id: 'range', auftragNr: 10, eventTitel: 'Mehrere Tage', vonDatum: '2026-09-28', bisDatum: '2026-10-02', schichten: [{ besetzt: 1, bedarf: 3 }] },
  { _id: 'today', auftragNr: 30, eventTitel: 'Heutiger Auftrag', vonDatum: '2026-09-29', bisDatum: '2026-09-29', schichten: [{ besetzt: 0, bedarf: 1 }] },
];
const listProps = () => ({ orders, referenceDate: referenceDate(), statusClass: () => 'status-draft', statusText: () => 'Entwurf' });
beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); });

describe('shared order date controls', () => {
  it.each([
    ['day', 'Vorheriger Tag', 'Nächster Tag', new Date(2026, 8, 28), new Date(2026, 8, 30)],
    ['week', 'Vorherige Kalenderwoche', 'Nächste Kalenderwoche', new Date(2026, 8, 22), new Date(2026, 9, 6)],
    ['month', 'Vorheriger Monat', 'Nächster Monat', new Date(2026, 7, 29), new Date(2026, 9, 29)],
    ['year', 'Vorheriges Jahr', 'Nächstes Jahr', new Date(2025, 8, 29), new Date(2027, 8, 29)],
  ])('preserves %s stepping and does not mutate the supplied date', async (type, previous, next, before, after) => {
    const value = referenceDate();
    const wrapper = render(CalendarControls, { props: { modelValue: value, type } });
    expect(wrapper.findAll('.app-button')).toHaveLength(3);
    expect(wrapper.findAll('button').every(button => button.attributes('type') === 'button')).toBe(true);
    await byLabel(wrapper, previous).trigger('click');
    await byLabel(wrapper, next).trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[before], [after]]);
    expect(value.getTime()).toBe(referenceDate().getTime());
  });

  it('keeps ISO week/year labels correct across the year boundary', () => {
    const wrapper = render(CalendarControls, { props: { modelValue: new Date(2021, 0, 1), type: 'week' } });
    expect(byLabel(wrapper, 'Kalenderwoche wählen').text()).toBe('KW 53 2020');
  });

  it.each(['day', 'week', 'month'])('opens the real %s picker and forwards its selection', async type => {
    const wrapper = render(CalendarControls, { props: { modelValue: referenceDate(), type } });
    await wrapper.get('.calendar-controls__picker').trigger('click');
    const popup = wrapper.get('.dp-popup');
    const choice = type === 'month' ? popup.findAll('.dp-month')[9] : popup.findAll('.dp-cell').find(button => button.text() === '15' && !button.classes().includes('dp-cell--other'));
    await choice.trigger('click');
    const selected = wrapper.emitted('update:modelValue')[0][0];
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(type === 'month' ? 9 : 8);
    expect(selected.getDate()).toBe(type === 'month' ? 1 : type === 'week' ? 14 : 15);
    expect(wrapper.find('.dp-popup').exists()).toBe(false);
  });
});

describe('order list shared controls', () => {
  it('offers only Tag/Woche/Monat and changes the controlled period by keyboard', async () => {
    const wrapper = render(AuftragListView, { props: listProps() });
    const choices = wrapper.findAll('[role="radio"]');
    expect(choices.map(choice => choice.text())).toEqual(['Tag', 'Woche', 'Monat']);
    expect(choices.map(choice => choice.attributes('tabindex'))).toEqual(['-1', '-1', '0']);
    expect(wrapper.get('.toolbar-period-controls').element.parentElement).toBe(wrapper.get('.order-list-toolbar').element);
    await choices[2].trigger('keydown', { key: 'Home' });
    expect(wrapper.emitted('update:period')).toEqual([['day']]);
    expect(document.activeElement).toBe(choices[0].element);
    await wrapper.setProps({ period: 'day' });
    expect(choices[0].attributes('aria-checked')).toBe('true');
    expect(wrapper.get('.calendar-controls__picker').attributes('aria-label')).toBe('Tag wählen');
  });

  it('keeps overlapping multi-day orders, sorting and selection in the specialized table', async () => {
    const wrapper = render(AuftragListView, { props: { ...listProps(), period: 'day', selectedOrderNumber: 10 } });
    let rows = wrapper.findAll('.order-list-row');
    expect(rows.map(row => row.get('.order-cell strong').text())).toEqual(['Mehrere Tage', 'Heutiger Auftrag']);
    expect(rows[0].classes()).toContain('is-selected');
    expect(rows.map(row => row.get('.staffing-pill').text())).toEqual(['1 / 3', '0 / 1']);
    const sort = wrapper.findAll('.sort-header')[1];
    await sort.trigger('click');
    expect(sort.attributes('aria-sort')).toBe('ascending');
    await sort.trigger('click');
    expect(sort.attributes('aria-sort')).toBe('descending');
    rows = wrapper.findAll('.order-list-row');
    expect(rows.map(row => row.get('.order-cell small').text())).toEqual(['#30', '#10']);
    await rows[0].trigger('click');
    expect(wrapper.emitted('select')[0][0]).toEqual(orders[2]);
    expect(wrapper.find('button button').exists()).toBe(false);
  });

  it('forwards date, search and filter actions without changing their parent contracts', async () => {
    const wrapper = render(AuftragListView, { props: listProps() });
    await byLabel(wrapper, 'Nächster Monat').trigger('click');
    expect(wrapper.emitted('update:referenceDate')).toEqual([[new Date(2026, 9, 29)]]);
    await wrapper.get('input[aria-label="Aufträge durchsuchen"]').setValue('Kunde');
    expect(wrapper.emitted('update:searchQuery')).toEqual([['Kunde']]);
    await byLabel(wrapper, 'Filter öffnen').trigger('click');
    expect(wrapper.emitted('update:filterExpanded')).toEqual([[true]]);
    await wrapper.setProps({ filterExpanded: true });
    await wrapper.get('button[title="Filter zurücksetzen"]').trigger('click');
    expect(wrapper.emitted('resetFilters')).toHaveLength(1);
    await wrapper.findAll('.filter-chip').find(button => button.text() === 'Voll').trigger('click');
    expect(wrapper.emitted('toggleBedarfStatus')).toEqual([['voll']]);
  });

  it('preserves loading and empty-period states', async () => {
    const wrapper = render(AuftragListView, { props: { ...listProps(), loading: true } });
    expect(wrapper.get('[role="status"]').text()).toBe('Lade Aufträge…');
    expect(wrapper.find('.order-list-row').exists()).toBe(false);
    await wrapper.setProps({ loading: false, referenceDate: new Date(2027, 0, 1) });
    expect(wrapper.get('.list-state').text()).toContain('Keine Aufträge');
    expect(wrapper.get('.order-count').text()).toBe('0 Aufträge');
  });
});

describe('shared order detail frame actions', () => {
  const props = () => ({ modelValue: true, event: orders[1], formatRange: () => '28.09.–02.10.', statusClass: () => 'status-draft', statusText: () => 'Entwurf' });
  it('labels the panel and forwards the native menu target without closing the detail', async () => {
    const wrapper = render(AuftragDetailsSidePanel, { props: props() });
    const panel = wrapper.get('[role="complementary"]');
    expect(panel.attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'));
    const menu = byLabel(wrapper, 'Aktionen für Auftrag 10');
    let eventTarget;
    await wrapper.setProps({ onActions: event => { eventTarget = event.currentTarget; } });
    await menu.trigger('click');
    expect(eventTarget).toBe(menu.element);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await byLabel(wrapper, 'Schließen').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('retains Escape/backdrop closing and disabled Escape behaviour', async () => {
    const wrapper = render(SidePanelFrame, { props: { modelValue: true, title: 'Details', closeOnEscape: false } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('close')).toBeUndefined();
    await wrapper.setProps({ closeOnEscape: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('close')).toHaveLength(1);
    await new DOMWrapper(document.querySelector('.sp-panel__backdrop')).trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(2);
    await wrapper.setProps({ modelValue: false });
    expect(wrapper.find('[role="complementary"]').exists()).toBe(false);
  });

  it('keeps the same accessible title contract for the modal presentation', async () => {
    const wrapper = render(SidePanelFrame, { props: { modelValue: true, title: 'Auftrag Details', presentation: 'modal' } });
    const modal = new DOMWrapper(document.querySelector('[role="dialog"]'));
    expect(modal.attributes('aria-labelledby')).toBe(modal.get('h2').attributes('id'));
    await wrapper.setProps({ title: '', modalTitle: 'Auftrag als Dialog' });
    expect(modal.get('h2').text()).toBe('Auftrag als Dialog');
    expect(modal.attributes('aria-labelledby')).toBe(modal.get('h2').attributes('id'));
    await byLabel(modal, 'Schließen').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('mobile order navigation and page routing', () => {
  it('emits day/week actions and opens the real picker from labelled shared buttons', async () => {
    const wrapper = render(AuftragMobileDateNavigation, { props: { modelValue: referenceDate() } });
    for (const [label, event] of [['Vorherige Woche', 'previous-week'], ['Vorheriger Tag', 'previous-day'], ['Nächster Tag', 'next-day'], ['Nächste Woche', 'next-week']]) {
      await byLabel(wrapper, label).trigger('click');
      expect(wrapper.emitted(event)).toHaveLength(1);
    }
    await byLabel(wrapper, 'Datum wählen').trigger('click');
    const popup = new DOMWrapper(document.querySelector('.dp-popup'));
    await popup.findAll('.dp-cell').find(button => button.text() === '15' && !button.classes().includes('dp-cell--other')).trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[new Date(2026, 8, 15)]]);
  });

  it('wires the mobile buttons to the existing workspace methods across week boundaries', async () => {
    const ensureMonthLoaded = vi.fn().mockResolvedValue();
    // Offline navigation fixture: retain real template/methods, isolate startup
    // loads and modal-launch setup; no authenticated API or dock validation.
    const fixture = {
      ...AuftragCalendarWorkspace,
      setup: () => ({ formatEmployeeName: () => '' }),
      mounted() {},
      methods: {
        ...AuftragCalendarWorkspace.methods, ensureMonthLoaded,
        ensureListPeriodLoaded: vi.fn().mockResolvedValue(),
        loadStundenlisteStatus: vi.fn(), loadEinsatzDoks: vi.fn(), loadReisekosten: vi.fn(),
      },
    };
    const wrapper = shallowMount(fixture, {
      attachTo: document.body,
      data: () => ({ isMobile: true, currentWeekStart: new Date(2026, 8, 28), mobileDayIndex: 0 }),
      global: {
        plugins: [createPinia()], mocks: { $route: { query: {} } },
        stubs: {
          ...stubs, RouterLink: true, AuftragMobileDateNavigation: false, AppIconButton: false, AppButton: false, DatePicker: false,
          Toolbar: { template: '<div><slot /><slot name="bottom-actions" /></div>' },
        },
      },
    });
    wrappers.push(wrapper);
    await byLabel(wrapper, 'Vorheriger Tag').trigger('click');
    await flushPromises();
    expect(wrapper.vm.currentWeekStart).toEqual(new Date(2026, 8, 21));
    expect(wrapper.vm.mobileDayIndex).toBe(6);
    await byLabel(wrapper, 'Nächster Tag').trigger('click');
    await flushPromises();
    expect(wrapper.vm.currentWeekStart).toEqual(new Date(2026, 8, 28));
    expect(wrapper.vm.mobileDayIndex).toBe(0);
    await byLabel(wrapper, 'Nächste Woche').trigger('click');
    await flushPromises();
    expect(wrapper.vm.currentWeekStart).toEqual(new Date(2026, 9, 5));
    expect(ensureMonthLoaded).toHaveBeenCalled();
    await wrapper.setData({ selectedEvent: orders[1] });
    const sharedDetail = wrapper.getComponent(AuftragDetailsSidePanel);
    const detailInstance = sharedDetail.vm;
    await wrapper.setProps({ viewMode: 'list' });
    expect(wrapper.getComponent(AuftragDetailsSidePanel).vm).toBe(detailInstance);
    expect(wrapper.getComponent(AuftragListView).props('selectedOrderNumber')).toBe(10);
    await wrapper.setProps({ viewMode: 'calendar' });
    expect(wrapper.getComponent(AuftragDetailsSidePanel).vm).toBe(detailInstance);
    expect(sharedDetail.props('event')).toEqual(orders[1]);
    sharedDetail.vm.$emit('update:modelValue', false);
    await flushPromises();
    expect(wrapper.vm.selectedEvent).toBe(null);
  });

  it('keeps route-backed calendar/list switching and the stable calendar instance', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/auftraege', name: 'Auftraege', component: AuftraegePage }] });
    await router.push('/auftraege?auftragnr=10');
    await router.isReady();
    const boundary = { props: ['viewMode'], template: '<div :data-view="viewMode" />' };
    const wrapper = render(AuftraegePage, { global: { plugins: [router], stubs: { ...stubs, AuftragKalender: boundary } } });
    const calendar = wrapper.getComponent(boundary).vm;
    await wrapper.get('[data-tab-id="list"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ auftragnr: '10', tab: 'list' });
    expect(wrapper.getComponent(boundary).props('viewMode')).toBe('list');
    expect(wrapper.getComponent(boundary).vm).toBe(calendar);
    await wrapper.get('[data-tab-id="calendar"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ auftragnr: '10' });
    expect(wrapper.getComponent(boundary).props('viewMode')).toBe('calendar');
  });
});
