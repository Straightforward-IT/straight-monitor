import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TimeMonthMatrix from '@/components/ui-elements/TimeMonthMatrix.vue';
import ZvooveDayDetails from '@/components/payroll/ZvooveDayDetails.vue';
import ZvooveTimeWorkspace from '@/components/payroll/ZvooveTimeWorkspace.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';
import { buildPayrollHoursOverview } from '@/utils/payrollHoursOverview';
import { formatImportedHours, sumImportedHours } from '@/utils/importedHours';
vi.mock('@/composables/useAuftragModals', () => ({ useAuftragModals: () => ({ openAuftrag: vi.fn() }) }));
vi.mock('@/composables/useLohnartModals', () => ({ useLohnartModals: () => ({ openLohnart: vi.fn() }) }));

let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; localStorage.clear(); });
const source = { filename: 'Januar.xlsx', sheet: 'Tabelle1', row: 22, daySlot: 1 };
const entries = [
  { id: 'productive', date: '2026-03-02', hours: '6.1234567890123456789', kb: '', label: 'Produktive Stunden', kind: 'productive', personalNr: 2001113, source },
  { id: 'zero', date: '2026-03-03', hours: '0', kb: '', label: 'Produktive Stunden', kind: 'productive', personalNr: 2001113, source: { ...source, daySlot: 2 } },
  { id: 'fs', date: '2026-03-04', hours: null, kb: 'FS', label: 'Freischicht', kind: 'marker', personalNr: 2001113, source: { ...source, daySlot: 3 } },
  { id: 'vacation', date: '2026-03-05', hours: '4.05', kb: 'U', label: 'Urlaub bezahlt', kind: 'absence', lohnartNummer: 310, personalNr: 2001113, source: { ...source, daySlot: 4 } },
];

describe('Imported Zvoove hour presentation', () => {
  it('preserves precision, adds decimal strings exactly and rounds only display values', () => {
    expect(sumImportedHours(['0.1', '0.2'])).toBe('0.3');
    expect(sumImportedHours(['6.1234567890123456789', '4.05'])).toBe('10.1734567890123456789');
    expect(formatImportedHours('6.1234567890123456789')).toBe('6,1234567890123456789');
    expect(formatImportedHours('6.125', 2)).toBe('6,13');
    expect(formatImportedHours('9.995', 2)).toBe('10,00');
    expect(formatImportedHours('0', 2)).toBe('0,00');
    expect(formatImportedHours(null, 2)).toBe('—');
  });

  it('renders six calendar weeks, productive hours with empty KB, zero and markers in a read-only matrix', async () => {
    wrapper = mount(TimeMonthMatrix, { props: { month: '2026-03', entries, imported: true, readonly: true } });
    expect(wrapper.findAll('.tmx-week')).toHaveLength(6);
    expect(wrapper.text()).toContain('Dezimalstunden');
    const productive = wrapper.get('.tmx-table [data-day="2026-03-02"] .tm-entry--productive');
    expect(productive.text()).toBe('P6,12');
    expect(wrapper.get('[data-day="2026-03-03"] .tm-entry--productive').text()).toBe('P0,00');
    expect(wrapper.get('[data-day="2026-03-04"] .tm-entry--marker').text()).toBe('FS—');
    expect(wrapper.get('[data-day="2026-03-05"] .tm-entry--absence').text()).toBe('U4,05');
    expect(wrapper.find('.tm-entry__type').exists()).toBe(false);
    expect(wrapper.find('[data-time-target]').exists()).toBe(false);
    expect(wrapper.find('[data-day="2026-03-06"] .tm-entry').exists()).toBe(false);
    await productive.trigger('click');
    expect(wrapper.emitted('selectDay')).toEqual([['2026-03-02']]);
    expect(wrapper.emitted('changeType')).toBeUndefined();
  });

  it('shows exact source values, original personal number and workbook provenance in day details', () => {
    wrapper = mount(ZvooveDayDetails, { props: { entries } });
    expect(wrapper.text()).toContain('6,1234567890123456789 Std.');
    expect(wrapper.text()).toContain('Leer · produktive Stunden');
    expect(wrapper.text()).toContain('0 Std.');
    expect(wrapper.text()).toContain('Kein Stundenwert');
    expect(wrapper.text()).toContain('Tageskennzeichnung');
    expect(wrapper.text()).toContain('310');
    expect(wrapper.text()).toContain('2001113');
    expect(wrapper.text()).toContain('Januar.xlsx');
    expect(wrapper.text()).toContain('Tabelle1 / 22');
    expect(wrapper.text()).toContain('T1 / KZ1');
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('displays planning beside recorded hours without adding it to imported week totals or provenance', async () => {
    const planned = { id: 'planned:1', einsatzId: '1', date: '2026-03-02', kind: 'planned', credited: false, auftragNr: 2510476, label: 'Abendschicht', hours: '8', plannedStart: '22:00', plannedEnd: '06:00' };
    wrapper = mount(TimeMonthMatrix, { props: { month: '2026-03', entries, plannedEntries: [planned, { ...planned, id: 'planned:2', date: '2026-03-06', hours: null }], imported: true, readonly: true } });
    const day = wrapper.get('[data-day="2026-03-02"]');
    expect(day.findAll('.tm-entry')).toHaveLength(2);
    expect(day.get('.tm-entry--productive').text()).toBe('P6,12');
    expect(day.get('.tm-entry--planned').text()).toBe('PL8,00');
    expect(wrapper.findAll('.tmx-week')[1].text()).toContain('Std. 10,17');
    expect(wrapper.get('[data-day="2026-03-06"] .tm-entry--planned').text()).toBe('PL—');
    expect(wrapper.find('[data-day="2026-03-06"] .tmx-imported-empty').exists()).toBe(false);
    await day.get('.tm-entry--planned').trigger('click'); expect(wrapper.emitted('selectDay')).toEqual([['2026-03-02']]);
    wrapper.unmount();
    wrapper = mount(ZvooveDayDetails, { props: { entries: [planned] } });
    expect(wrapper.text()).toContain('Geplante Schicht'); expect(wrapper.text()).toContain('22:00–06:00');
    expect(wrapper.get('[aria-label="Auftrag 2510476 öffnen"]').exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/Gebuchte Arbeitszeit|Quellwert|Tabellenblatt|Zvoove/);
  });

  it('moves the imported total and breakdown into the information card and retains visibility controls', async () => {
    wrapper = mount(ZvooveTimeWorkspace, { props: { employee: { id: 'employee-1' }, month: '2026-03', entries,
      totals: { hours: '10.1734567890123456789', byCode: [
        { kb: '', label: 'Produktive Stunden', hours: '6.1234567890123456789', days: 2 },
        { kb: 'FS', label: 'Freischicht', hours: '0', days: 1 },
        { kb: 'U', label: 'Urlaub bezahlt', hours: '4.05', days: 1 },
      ] },
      contingentData: { type: 'hours', title: 'Festangestellt', monthlyHours: 100, workedHours: 90, plannedHours: 15 } },
      global: { stubs: { EmployeeTariffWage: true, 'font-awesome-icon': true } } });
    expect(wrapper.text()).toMatch(/Erfasste Stunden\s*10,17 Std\./);
    expect(wrapper.find('.zvoove-workspace__totals').exists()).toBe(false);
    const information = wrapper.get('.zvoove-information');
    expect(information.text()).toContain('P · Produktive Stunden');
    expect(information.text()).toContain('FS · Freischicht');
    expect(information.text()).toContain('0,00 Std. · 1 Tag');
    expect(information.text()).toContain('U · Urlaub bezahlt');
    expect(information.text()).toContain('89,83 Std.');
    expect(information.text()).not.toMatch(/Geplant|Eingesetzt|Soll-Stunden, produktive/);
    expect(wrapper.text()).not.toMatch(/Eimer|Monatsprüfung|Tageseintrag|LODAS/);
    await wrapper.get('[aria-label="Informationen ausblenden"]').trigger('click');
    expect(wrapper.find('.zvoove-information').exists()).toBe(false);
    await wrapper.get('[aria-label="Informationen einblenden"]').trigger('click');
    expect(wrapper.find('.zvoove-information').exists()).toBe(true);
  });

  it.each([
    ['21015', 'days-hours', 'days-hours', 100],
    ['21195', 'hours', 'hours', 100],
    ['22436', 'days-hours', 'days-hours', 100],
    ['23437', 'days-earnings', 'days-hours', null],
    ['27356', 'days-earnings', 'days-hours', null],
  ])('uses imported quantities for tariff group %s independently of employment labels', (id, sourceType, type, limit) => {
    const data = buildPayrollHoursOverview({ employee: { id: 'employee-1', employmentLabel: 'Anderer Vertrag', monthlyHours: 100 }, entries,
      totals: { hours: '10.1734567890123456789', byCode: [] },
      contingentData: { type: sourceType, group: { legacyId: id }, monthlyHours: 100, workedHours: 700, plannedHours: 500,
        workedDays: 29, plannedDays: 3, priorEmployerDays: 5, dayLimit: 70,
        earningsStatus: 'UNRESOLVED', issues: [{ code: 'UTZ_OVERLAP', message: 'ÜTZ ist mehrdeutig.' }] } });
    expect(data.type).toBe(type);
    expect(data.importedHours).toMatchObject({ total: '10.1734567890123456789', limit });
    expect(data.workedDays).toBe(29);
    expect(data.plannedDays).toBe(3);
    expect(data.priorEmployerDays).toBe(5);
    expect(data.issues).toEqual([]);
  });

  it('shows 603 hours without a money forecast, Soll or hours-overage marker', () => {
    wrapper = mount(ZvooveTimeWorkspace, { props: { employee: { id: 'employee-1', monthlyHours: 10 }, month: '2026-03', entries,
      totals: { hours: '129', byCode: [{ kb: '', label: 'Produktive Stunden', hours: '123', days: 19 }, { kb: 'FA', label: 'Freizeitausgleich', hours: '6', days: 1 }] },
      contingentData: { type: 'days-earnings', title: 'KZF 603', group: { legacyId: '27356' }, workedDays: 2, dayLimit: 70,
        workedEarnings: '5000', plannedEarnings: '1000', totalEarnings: '6000', workedHours: 700, plannedHours: 500 } },
      global: { stubs: { EmployeeTariffWage: true, 'font-awesome-icon': true } } });
    const columns = wrapper.findAll('.hover-data-card__chart--column');
    expect(columns).toHaveLength(2);
    expect(columns[0].attributes('aria-label')).toContain('2 Tage');
    expect(columns[1].attributes('aria-label')).toContain('129,00 Std.');
    expect(columns[1].attributes('aria-label')).not.toContain('von');
    const hoursCard = wrapper.getComponent(HoverDataCard).findAllComponents(HoverDataCard)[1];
    expect(hoursCard.text()).toContain('123,00 Std. · 19 Tage');
    expect(hoursCard.text()).not.toMatch(/Monats-Sollstunden|Geplant|Eingesetzt|Verbleibend|603,00|€|Verdienst/);
    expect(hoursCard.find('.hover-data-card__column-limit').exists()).toBe(false);
  });

  it('keeps imported hours visible when monthly Soll or tariff classification is unavailable', () => {
    const props = { employee: { id: 'employee-1', monthlyHours: null }, totals: { hours: '6', byCode: [] }, entries };
    const missingSoll = buildPayrollHoursOverview({ ...props, contingentData: { type: 'notice', group: { legacyId: '21195' },
      issues: [{ code: 'MONTHLY_HOURS_MISSING', message: 'Monatsstunden fehlen.' }] } });
    expect(missingSoll.type).toBe('hours');
    expect(missingSoll.importedHours.limit).toBeNull();
    expect(missingSoll.issues[0].code).toBe('MONTHLY_HOURS_MISSING');
    const unresolved = buildPayrollHoursOverview({ ...props, employee: { ...props.employee, monthlyHours: 100 },
      contingentData: { type: 'notice', issues: [{ code: 'ASSIGNMENT_OVERLAP', message: 'Tarifgruppe ist mehrdeutig.' }] } });
    expect(unresolved.importedHours.limit).toBeNull();
    expect(unresolved.group).toBeUndefined();
    expect(unresolved.issues[0].code).toBe('ASSIGNMENT_OVERLAP');
  });
});
