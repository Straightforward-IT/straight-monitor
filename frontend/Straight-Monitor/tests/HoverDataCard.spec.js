import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HoverDataCard from '../src/components/ui-elements/HoverDataCard.vue';

const data = { type: 'days-earnings', title: 'KZF 603 ohne AZK', group: { legacyId: '23437', name: 'Lohn Ost' }, groupDate: '2026-10-08',
  eyebrow: 'Oktober 2026', workedDays: 69, plannedDays: 2, dayLimit: 70, periodLabel: 'im Kalenderjahr 2026',
  workedHours: 20, plannedHours: 15, earningsStatus: 'RESOLVED', workedEarnings: '400.00', plannedEarnings: '250.00', totalEarnings: '650.00' };
const render = (props = {}) => mount(HoverDataCard, { props: { data, inline: true, ...props }, global: { stubs: { 'font-awesome-icon': true } } });

describe('HoverDataCard tarifgesteuerte Kontingente', () => {
  it('opens a separate window only through the optional popout action and blocks it during loading', async () => {
    const wrapper = render({ popout: true });
    const button = wrapper.get('button[aria-label="Kontingentübersicht in Fenster öffnen"]');
    expect(button.attributes('aria-haspopup')).toBe('dialog');
    expect(wrapper.emitted('popout')).toBeUndefined();
    await button.trigger('click');
    expect(wrapper.emitted('popout')).toHaveLength(1);
    await wrapper.setProps({ loading: true });
    expect(button.element.disabled).toBe(true);
    await wrapper.setProps({ loading: false, popout: false });
    expect(wrapper.find('button[aria-label="Kontingentübersicht in Fenster öffnen"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('shows days and monthly hours next to each other for KZF normal and pauschal', () => {
    const wrapper = render({ data: { ...data, type: 'days-hours', title: 'KZF normal', monthlyHours: 100, workedHours: 60, plannedHours: 30, hoursStatus: 'RESOLVED' } });
    const columns = wrapper.findAll('.hover-data-card__chart--column');
    expect(columns).toHaveLength(2);
    expect(columns[0].attributes('aria-label')).toContain('71 Tage');
    expect(columns[1].attributes('aria-label')).toContain('90,00 Std.');
    expect(wrapper.text()).toContain('100,00 Std.');
    expect(wrapper.text()).not.toContain('Verdienstprognose');
    wrapper.unmount();
  });

  it('explains an employment-based fallback without pretending to have a tariff group', () => {
    const wrapper = render({ data: { type: 'hours', title: 'Teilzeit beschäftigt', monthlyHours: 100, workedHours: 10,
      fallbackReason: 'Keine gültige Tarifzuordnung. Kontingent anhand des Arbeitsverhältnisses.' } });
    expect(wrapper.text()).toContain('Arbeitsverhältnisses');
    expect(wrapper.text()).not.toContain('Tarifgruppe');
    expect(wrapper.findAll('.hover-data-card__chart')).toHaveLength(1);
    wrapper.unmount();
  });
  it('renders two ordered columns within one card with independent limits and details', () => {
    const wrapper = render();
    const columns = wrapper.findAll('.hover-data-card__chart--column');
    expect(columns).toHaveLength(2);
    expect(columns[0].attributes('aria-label')).toContain('71 Tage');
    expect(columns[1].attributes('aria-label')).toContain('650,00');
    expect(wrapper.findAll('.hover-data-card__column-limit')).toHaveLength(2);
    expect(wrapper.findAll('.hover-data-card__view-toggle')).toHaveLength(0);
    expect(wrapper.text()).toContain('603,00');
    expect(wrapper.text()).toContain('Tarifgruppe 23437');
    expect(wrapper.findAll('.hover-data-card__combined .hover-data-card__title')).toHaveLength(0);
    expect(wrapper.findAll('.hover-data-card__combined .hover-data-card__metadata')).toHaveLength(0);
    expect(wrapper.text()).toContain('Keine Ist-Stunden');
    expect(wrapper.get('.hover-data-card__combined').findAll('.hover-data-card')).toHaveLength(2);
    wrapper.unmount();
  });
  it('keeps the day column while unknown money shows clarification and its affected date', () => {
    const wrapper = render({ data: { ...data, earningsStatus: 'UNRESOLVED', workedEarnings: null, plannedEarnings: null, totalEarnings: null,
      issues: [{ message: '2026-10-01: ÜTZ ist mehrdeutig.' }] } });
    expect(wrapper.findAll('.hover-data-card__chart--column')).toHaveLength(1);
    expect(wrapper.text()).toContain('Klärung erforderlich');
    expect(wrapper.text()).toContain('2026-10-01');
    expect(wrapper.text()).not.toContain('0,00');
    wrapper.unmount();
  });
  it('keeps single-card chart selection and meaningful accessibility labels', async () => {
    const wrapper = render({ data: { type: 'days', title: 'KZF normal', workedDays: 1 } });
    expect(wrapper.get('[role="region"]').attributes('aria-label')).toBe('KZF normal');
    await wrapper.get('button[title="Ringdiagramm"]').trigger('click');
    expect(wrapper.find('.hover-data-card__ring').exists()).toBe(true);
    wrapper.unmount();
  });
  it('shows a loading state without a premature forecast', () => {
    const wrapper = render({ loading: true });
    expect(wrapper.text()).toContain('werden geladen');
    expect(wrapper.find('.hover-data-card__combined').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows imported recorded hours and code totals instead of planned assignments', () => {
    const wrapper = render({ data: { type: 'hours', title: 'Festangestellt', workedHours: 131.5, plannedHours: 10,
      importedHours: { total: '129', limit: '129.9', byCode: [
        { kb: '', label: 'Produktive Stunden', hours: '123', days: 19 },
        { kb: 'FS', label: 'Tageskennzeichnung', hours: '0', days: 11 },
        { kb: 'FA', label: 'Freizeitausgleich', hours: '6', days: 1 },
      ] } } });
    expect(wrapper.get('.hover-data-card__column-caption').text()).toContain('129,00');
    expect(wrapper.get('.hover-data-card__column-caption').text()).toContain('von 129,90 Std.');
    expect(wrapper.text()).toContain('Erfasste Stunden nach Kennzeichen');
    expect(wrapper.text()).toContain('0,00 Std. · 11 Tage');
    expect(wrapper.text()).toContain('123,00 Std. · 19 Tage');
    expect(wrapper.text()).toContain('6,00 Std. · 1 Tag');
    expect(wrapper.text()).toContain('Verbleibend');
    expect(wrapper.text()).not.toContain('Eingesetzt');
    expect(wrapper.text()).not.toContain('Geplant');
    expect(wrapper.text()).not.toContain('produktive Stunden werden hier noch nicht erfasst');
    expect(wrapper.find('.hover-data-card__column-limit').exists()).toBe(false);
    wrapper.unmount();
  });

  it('offers both diagram views for a 603 imported overview without a monthly-hours allowance', async () => {
    const wrapper = render({ data: { type: 'hours', title: 'KZF 603 mit AZK', hoursStatus: 'UNRESOLVED',
      importedHours: { total: '1.004999999999999999', limit: null, byCode: [{ kb: '', label: 'Produktive Stunden', hours: '1.004999999999999999', days: 1 }] } } });
    expect(wrapper.get('.hover-data-card__column-caption strong').text()).toBe('1,00');
    expect(wrapper.get('.hover-data-card__chart').attributes('aria-label')).toMatch(/^1,00 Std\./);
    expect(wrapper.text()).not.toContain('von ');
    expect(wrapper.text()).not.toContain('Monats-Sollstunden');
    expect(wrapper.text()).not.toContain('Verbleibend');
    expect(wrapper.text()).not.toContain('Überschreitung');
    expect(wrapper.find('.hover-data-card__column-limit').exists()).toBe(false);
    await wrapper.get('button[title="Ringdiagramm"]').trigger('click');
    expect(wrapper.get('.hover-data-card__ring-center strong').text()).toBe('1,00');
    expect(wrapper.find('.hover-data-card__ring-over').exists()).toBe(false);
    wrapper.unmount();
  });

  it('retains two columns for imported KZF hours with an independent days limit', () => {
    const wrapper = render({ data: { type: 'days-hours', workedDays: 71, dayLimit: 70,
      importedHours: { total: '20', limit: '30', byCode: [{ kb: '', label: 'Produktive Stunden', hours: '20', days: 3 }] } } });
    const columns = wrapper.findAll('.hover-data-card__chart--column');
    expect(columns).toHaveLength(2);
    expect(columns[0].attributes('aria-label')).toContain('71 Tage');
    expect(columns[1].attributes('aria-label')).toContain('20,00 Std. von 30,00 Std.');
    expect(wrapper.findAll('.hover-data-card__column-limit')).toHaveLength(1);
    expect(wrapper.text()).toContain('Erfasste Stunden');
    expect(wrapper.text()).toContain('10,00 Std.');
    wrapper.unmount();
  });

  it('shows signed corrections without representing positive-only consumption as the full total', () => {
    const wrapper = render({ data: { type: 'hours', importedHours: { total: '-2', limit: null,
      byCode: [{ kb: '', label: 'Korrektur', hours: '-2', days: 1 }, { kb: 'FS', label: 'Tageskennzeichnung', hours: null, days: 2 }] } } });
    expect(wrapper.get('.hover-data-card__column-caption strong').text()).toBe('-2,00');
    expect(wrapper.text()).toContain('-2,00 Std. · 1 Tag');
    expect(wrapper.text()).toContain('— Std. · 2 Tage');
    expect(wrapper.text()).toContain('Negative Stundenkorrekturen');
    expect(wrapper.findAll('.hover-data-card__column-segment')).toHaveLength(0);
    expect(wrapper.find('.hover-data-card__column-limit').exists()).toBe(false);
    wrapper.unmount();
  });

  it('draws correction-adjusted overage once instead of as additional consumed hours', async () => {
    const wrapper = render({ data: { type: 'hours', importedHours: { total: '12', limit: '10', byCode: [
      { kb: '', label: 'Produktive Stunden', hours: '15', days: 2 }, { kb: 'FA', label: 'Korrektur', hours: '-3', days: 1 },
    ] } } });
    expect(wrapper.get('.hover-data-card__column-caption strong').text()).toBe('12,00');
    expect(wrapper.findAll('.hover-data-card__column-segment')).toHaveLength(1);
    expect(wrapper.findAll('.hover-data-card__column-limit')).toHaveLength(1);
    expect(wrapper.text()).toContain('2,00 Std.');
    await wrapper.get('button[title="Ringdiagramm"]').trigger('click');
    expect(wrapper.findAll('.hover-data-card__ring-slice')).toHaveLength(1);
    expect(wrapper.findAll('.hover-data-card__ring-over')).toHaveLength(1);
    wrapper.unmount();
  });
});
