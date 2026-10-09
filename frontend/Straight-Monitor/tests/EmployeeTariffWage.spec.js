import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import EmployeeTariffWage from '../src/components/tariffs/EmployeeTariffWage.vue';
const mocks = vi.hoisted(() => ({ api: { get: vi.fn() }, auth: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
const fixture = () => ({ date: '2026-10-07', activeImportId: 'import', baseRate: { status: 'RESOLVED', value: '15.33', payGroup: { name: 'EG 1' }, group: { name: 'Lohn Ost KZF' }, stage: { name: 'Eingangsstufe' } }, aboveTariff: { status: 'RESOLVED', values: { DPREIS: '2.40', DPREISPROD: '7.99' } } });
const pending = () => { let resolve; return { promise: new Promise(yes => { resolve = yes; }), resolve: value => resolve(value) }; };
let wrapper;
async function render(props = {}) { wrapper = mount(EmployeeTariffWage, { props: { employeeId: 'employee-1', date: '2026-10-07', ...props } }); await flushPromises(); }
async function reopen() { await wrapper.setProps({ active: false }); await wrapper.setProps({ active: true }); await flushPromises(); }
beforeEach(() => { vi.resetAllMocks(); mocks.auth = reactive({ user: { _id: 'admin', roles: ['ADMIN'] } }); mocks.api.get.mockResolvedValue({ data: fixture() }); });
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });

describe('Tariflohn in der Mitarbeiter-Lohnsection', () => {
  it('zeigt Tariflohn, Entgeltgruppe, separate ÜTZ und deren Summe', async () => {
    await render();
    expect(wrapper.get('[data-wage="base"]').text()).toBe('15,33 €');
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.get('[data-wage="group"]').text()).toBe('EG 1');
    expect(wrapper.get('[data-wage="above"]').text()).toBe('2,40 €');
    expect(wrapper.text()).toContain('07.10.2026');
    expect(wrapper.get('[data-wage="total"]').text()).toBe('17,73 €');
    expect(wrapper.text()).not.toContain('7,99');
    expect(mocks.api.get.mock.calls[0][0]).toBe('/api/tariffs/employees/employee-1/wage-info');
    expect(mocks.api.get.mock.calls[0][1].params).toEqual({ date: '2026-10-07' });
  });
  it('kann im kompakten Modus Kontextzeile und Zusatzabsätze zusammenfassen', async () => {
    await render({ compact: true });
    expect(wrapper.text()).toContain('Lohn Ost KZF · Eingangsstufe | Tarif am 07.10.2026');
    expect(wrapper.findAll('.employee-tariff-wage__context')).toHaveLength(0);
    expect(wrapper.findAll('.employee-tariff-wage__notice')).toHaveLength(0);
  });
  it('erklärt die Auswahl der aktuellen Personalnummer trotz offener historischer Zeilen', async () => {
    const data = fixture();
    data.baseRate.assignmentSelection = { basis: 'CURRENT_PERSONAL_NUMBER', personalNr: '2000001', excludedPersonalNumbers: ['1000001'] };
    data.aboveTariff.selection = { basis: 'HISTORICAL_PERSONAL_NUMBER', personalNr: '1000001', currentPersonalNr: '2000001' };
    mocks.api.get.mockResolvedValueOnce({ data }); await render();
    expect(wrapper.text()).toContain('Aktuelle Personalnummer 2000001 verwendet');
    expect(wrapper.text()).toContain('historischen Nummern 1000001');
    expect(wrapper.text()).toContain('ÜTZ: Historische Personalnummer 1000001 verwendet');
    expect(wrapper.get('[data-wage="total"]').text()).toBe('17,73 €');
  });
  it('addiert Tariflohn und ÜTZ ohne Gleitkommarundung oder weitere ÜTZ-Felder', async () => {
    const data = fixture();
    data.baseRate.value = '12345678901234567.8901';
    data.aboveTariff.values.DPREIS = '0.0099';
    mocks.api.get.mockResolvedValueOnce({ data }); await render();
    expect(wrapper.get('[data-wage="total"]').text()).toBe('12.345.678.901.234.567,90 €');
    const precise = fixture(); precise.baseRate.value = '15.33'; precise.aboveTariff.values.DPREIS = '2.400000000000000000001';
    mocks.api.get.mockResolvedValueOnce({ data: precise });
    await reopen();
    expect(wrapper.get('[data-wage="total"]').text()).toBe('17,730000000000000000001 €');
  });
  it('lädt erst beim Öffnen und sendet für Nichtadmins keine Anfragen', async () => {
    await render({ active: false });
    expect(mocks.api.get).not.toHaveBeenCalled();
    mocks.auth.user.roles = ['USER'];
    await wrapper.setProps({ active: true });
    expect(mocks.api.get).not.toHaveBeenCalled();
    mocks.auth.user.role = 'Admin'; await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledTimes(1);
    const request = pending(); mocks.api.get.mockReturnValueOnce(request.promise);
    await reopen();
    const signal = mocks.api.get.mock.calls[1][1].signal;
    mocks.auth.user.role = 'USER'; await flushPromises();
    expect(signal.aborted).toBe(true);
    request.resolve({ data: fixture() }); await flushPromises();
    expect(wrapper.text()).toBe('');
  });
  it('verwirft alte Antworten bei Mitarbeiter- und Stichtagswechsel', async () => {
    const request = pending(); mocks.api.get.mockReturnValueOnce(request.promise);
    await render();
    const signal = mocks.api.get.mock.calls[0][1].signal;
    await wrapper.setProps({ employeeId: 'employee-2', date: '2026-08-31' }); await flushPromises();
    expect(signal.aborted).toBe(true);
    const stale = fixture(); stale.baseRate.value = '999.99';
    request.resolve({ data: stale }); await flushPromises();
    expect(wrapper.text()).not.toContain('999,99');
    expect(mocks.api.get.mock.calls[1][0]).toContain('employee-2');
    expect(mocks.api.get.mock.calls[1][1].params.date).toBe('2026-08-31');
    await wrapper.setProps({ active: false });
    expect(wrapper.text()).toBe('');
  });
  it('verwendet Null bei fehlender ÜTZ, erklärt Überschneidungen und kann Fehler erneut laden', async () => {
    const data = fixture(); data.aboveTariff = { status: 'UNRESOLVED', code: 'ABOVE_TARIFF_MISSING' };
    mocks.api.get.mockResolvedValueOnce({ data }); await render();
    expect(wrapper.get('[data-wage="above"]').text()).toBe('0,00 €');
    expect(wrapper.get('[data-wage="total"]').text()).toBe('15,33 €');
    const overlap = fixture(); overlap.aboveTariff = { status: 'UNRESOLVED', code: 'ABOVE_TARIFF_AMBIGUOUS', message: '2 ÜTZ-Einträge gelten gleichzeitig.' };
    mocks.api.get.mockResolvedValueOnce({ data: overlap });
    await reopen();
    expect(wrapper.get('[data-wage="above"]').text()).toBe('Klärung erforderlich');
    expect(wrapper.find('[data-wage="total"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('2 ÜTZ-Einträge gelten gleichzeitig.');
    mocks.api.get.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Nur für Admins.' } } });
    await reopen();
    expect(wrapper.find('[data-wage="base"]').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toBe('Nur für Admins.');
    expect(wrapper.get('button').text()).toBe('Erneut versuchen');
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(wrapper.get('[data-wage="base"]').text()).toBe('15,33 €');
    expect(wrapper.find('button').exists()).toBe(false);
  });
  it('zeigt vorhandene ÜTZ auch ohne Tarifzuordnung und bewahrt exakte Nachkommastellen', async () => {
    const data = fixture(); data.baseRate = { status: 'UNRESOLVED', code: 'ASSIGNMENT_MISSING', message: 'Keine gültige Tarifzuordnung.' };
    data.aboveTariff.values.DPREIS = '2.400000000000000000001';
    mocks.api.get.mockResolvedValueOnce({ data }); await render();
    expect(wrapper.get('[data-wage="base"]').text()).toBe('Klärung erforderlich');
    expect(wrapper.text()).toContain('Keine gültige Tarifzuordnung.');
    expect(wrapper.find('[data-wage="total"]').exists()).toBe(false);
    expect(wrapper.get('[data-wage="above"]').text()).toBe('2,400000000000000000001 €');
  });
  it('zeigt Null und Gesamtlohn auch bei einem leeren ÜTZ-Betrag', async () => {
    const data = fixture(); data.aboveTariff.values.DPREIS = '0';
    mocks.api.get.mockResolvedValueOnce({ data }); await render();
    expect(wrapper.get('[data-wage="above"]').text()).toBe('0,00 €');
    expect(wrapper.get('[data-wage="total"]').text()).toBe('15,33 €');
    const missingPrice = fixture(); missingPrice.aboveTariff.values.DPREIS = null;
    mocks.api.get.mockResolvedValueOnce({ data: missingPrice });
    await reopen();
    expect(wrapper.get('[data-wage="above"]').text()).toBe('0,00 €');
    expect(wrapper.get('[data-wage="total"]').text()).toBe('15,33 €');
    expect(wrapper.text()).toContain('für die Summe wird 0,00 € verwendet');
  });
});
