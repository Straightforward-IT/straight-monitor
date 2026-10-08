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
});
