import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import TariffOverview from '../src/components/tariffs/TariffOverview.vue';
import { decimalDifference, previousPeriod } from '../src/components/tariffs/tariffRelations';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: api }));
const group = { legacyId: '21015', name: 'Lohn Ost KZF', payGroups: [
  { legacyId: '24932', position: 3, name: 'EG 2b' },
  { legacyId: '21016', position: 1, name: 'EG 1' },
], stages: [{ legacyId: '21025', position: 1, name: 'Eingangsstufe' }] };
const period = (legacyId, validFrom, validUntil, values) => ({ legacyId, employeeGroupId: '21015', validFrom, validUntil,
  rates: values.map((value, index) => ({ stagePosition: 1, groupPosition: [1, 3][index], value })), wageRules: [], specialPayments: [], assignmentAllowances: [],
});
const fixture = () => ({ contract: { legacyId: '17055', name: 'IGZ ./. DGB' }, activeImportId: 'import', groups: [
  { ...group, legacyId: '17089', name: 'Historische Variante', statusLabel: 'Inaktiv' }, group,
  { ...group, legacyId: '22436', name: 'Zweite Variante', payGroups: [{ legacyId: 'pg1', position: 1, name: 'Andere EG 1' }, { legacyId: 'pg3', position: 3, name: 'Andere EG 2b' }] },
], periods: [period('1108622', '2026-09-01', null, ['15.33', '16.08']), period('1107092', '2026-01-01', '2026-08-31', ['14.96', '15.69']),
  { ...period('other', '2026-01-01', null, ['22.11', '23.42']), employeeGroupId: '22436' }],
});
let wrapper;
const start = async (data = fixture()) => { api.get.mockResolvedValue({ data }); wrapper = mount(TariffOverview); await flushPromises(); };
const value = () => wrapper.find('.tariff-resolution .tariff-value');
const setDate = async (date) => { await wrapper.find('input[type="date"]').setValue(date); await flushPromises(); };
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T12:00:00Z')); });
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.useRealTimers(); });

describe('Tarifbeziehungen in der Übersicht', () => {
  it('wählt eine aktive Variante, sortiert Matrixpositionen und erklärt beide dokumentierten Grundwerte', async () => {
    await start();
    expect(wrapper.find('[data-variant="21015"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.findAll('table[aria-label="Tarifliche Entgeltmatrix"] tbody th').map(row => row.text())).toEqual(['EG 1', 'EG 2b']);
    expect(value().text()).toBe('15,33 €');
    expect(wrapper.find('[data-cell="21016:21025"]').text()).toContain('+0,37 € zur Vorperiode');
    await wrapper.find('[data-cell="24932:21025"]').trigger('click');
    expect(value().text()).toBe('16,08 €');
    expect(wrapper.find('.tariff-resolution').text()).toContain('Zeile IY 3 + Spalte IX 1');
    expect(wrapper.find('.tariff-period-timeline__selection').text()).toContain('16,08 €');
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('wechselt Perioden an inklusiven Grenzen und synchronisiert eine historische Auswahl mit dem Stichtag', async () => {
    await start();
    await setDate('2026-08-31');
    expect(value().text()).toBe('14,96 €');
    await setDate('2026-09-01');
    expect(value().text()).toBe('15,33 €');
    const historical = wrapper.findAll('.tariff-period-timeline button').find(button => button.attributes('aria-label').startsWith('Tarifzeit 1107092:'));
    await historical.trigger('click');
    expect(wrapper.find('input[type="date"]').element.value).toBe('2026-01-01');
    expect(value().text()).toBe('14,96 €');
    expect(wrapper.find('[data-rule-scope="period"]').text()).toContain('Tarifperiode 1107092');
  });

  it('behält Matrixpositionen beim Variantenwechsel und zeigt nur die zugehörigen Perioden und Werte', async () => {
    await start();
    await wrapper.find('[data-cell="24932:21025"]').trigger('click');
    await wrapper.find('[data-variant="22436"]').trigger('click');
    expect(value().text()).toBe('23,42 €');
    expect(wrapper.find('.tariff-resolution').text()).toContain('Andere EG 2b');
    expect(wrapper.find('.tariff-period-timeline').text()).not.toContain('1108622');
    expect(wrapper.find('[data-rule-scope="period"]').text()).toContain('Tarifperiode other');
  });

  it('schätzt bei Lücken, Überlappungen und doppelten Matrixwerten keinen Grundwert', async () => {
    const data = fixture();
    data.periods.push(period('overlap', '2026-10-01', '2026-10-31', ['99.00', '100.00']));
    await start(data);
    expect(value().exists()).toBe(false);
    expect(wrapper.find('.tariff-resolution').text()).toContain('2 Tarifperioden gelten');
    await wrapper.findAll('.tariff-period-timeline button').find(button => button.attributes('aria-label').startsWith('Tarifzeit 1108622:')).trigger('click');
    expect(value().exists()).toBe(false); // Explicit inspection does not hide a date conflict.
    await setDate('2025-12-31');
    expect(value().exists()).toBe(false);
    expect(wrapper.text()).toContain('keine gültige Tarifperiode');
    await setDate('2026-09-30');
    expect(value().text()).toBe('15,33 €');
    wrapper.unmount();
    data.periods[0].rates.push({ stagePosition: 1, groupPosition: 1, value: '16.00' });
    await start(data);
    await setDate('2026-09-30');
    expect(value().exists()).toBe(false);
    expect(wrapper.find('[data-cell="21016:21025"]').text()).toContain('Mehrdeutig');
  });

  it('erklärt fehlende Matrixwerte und behält die übrigen Zellen auswählbar', async () => {
    const data = fixture();
    data.periods[0].rates.shift();
    await start(data);
    expect(value().exists()).toBe(false);
    expect(wrapper.find('.tariff-resolution').text()).toContain('fehlt ein importierter Grundwert');
    await wrapper.find('[data-cell="24932:21025"]').trigger('click');
    expect(value().text()).toBe('16,08 €');
  });
});

describe('Historische Entgeltänderung', () => {
  it('rechnet exakt ohne Rundung durch Gleitkommazahlen', () => {
    expect(decimalDifference('15.33', '14.96')).toBe('0.37');
    expect(decimalDifference('12345678901234567.8901', '12345678901234567.89')).toBe('0.0001');
    expect(decimalDifference('0.1', '0.30')).toBe('-0.2');
    expect(decimalDifference('15.330', '15.33')).toBe('0');
    expect(decimalDifference(null, '15.33')).toBeNull();
  });
  it('vergleicht nicht mit einer überlappenden oder mehrdeutigen Vorperiode', () => {
    const current = period('current', '2026-09-01', null, []);
    const earlier = period('earlier', '2026-01-01', null, []);
    expect(previousPeriod([earlier, current], current)).toBeNull();
    earlier.validUntil = '2026-08-31';
    expect(previousPeriod([earlier, current], current)).toBe(earlier);
    expect(previousPeriod([earlier, { ...earlier, legacyId: 'duplicate' }, current], current)).toBeNull();
  });
});
