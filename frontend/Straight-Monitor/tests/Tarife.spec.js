import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config, flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import TarifeWorkspace from '../src/components/tariffs/TarifeWorkspace.vue';
import TariffEmployees from '../src/components/tariffs/TariffEmployees.vue';
import TariffImport from '../src/components/tariffs/TariffImport.vue';
import AppFileDropzone from '../src/components/ui-elements/AppFileDropzone.vue';
import { formatTariffDecimal, tariffFileRoles } from '../src/components/tariffs/tariffDisplay';
import { tariffTabs } from '../src/components/layout/pageTabDefinitions';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn() }, auth: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
let wrapper;
config.global.stubs['font-awesome-icon'] = true;
const response = (data) => ({ data });
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const employee = (id, name = `Mitarbeiter ${id}`) => ({ key: id, employeeId: id, employeeName: name, personalNr: `100${id}`, matchStatus: 'MATCHED', assignmentCount: 1, allowanceCount: 1 });
const history = (id, name) => ({ employee: employee(id, name), assignments: [{ legacyId: `assignment-${id}`, personalNr: `100${id}`, employeeGroupId: '21015', payGroupId: '21016', stageId: '21025', validFrom: '2026-01-01', validUntil: null }], allowances: [] });
const preview = (overrides = {}) => ({ _id: 'draft', status: 'READY', createdAt: '2026-10-06T08:00:00Z', files: [], counts: {}, issues: [], errorCount: 0, warningCount: 0, changes: {}, basedOnImportId: 'before', ...overrides });
const button = (text) => wrapper.findAll('button').find((entry) => entry.text() === text);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = reactive({ user: { role: 'Admin', roles: [] } });
  mocks.api.get.mockResolvedValue(response({ data: [], activeImportId: 'before' }));
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });

describe('Tarife access, display, and route state', () => {
  it('sends no requests for non-Admins and cancels private reads on revocation', async () => {
    mocks.auth.user.role = 'Disponent';
    wrapper = mount(TarifeWorkspace, { props: { activeTab: 'overview' } });
    await flushPromises();
    expect(mocks.api.get).not.toHaveBeenCalled();
    const pending = deferred();
    mocks.api.get.mockReturnValueOnce(pending.promise);
    mocks.auth.user.roles = ['aDmIn'];
    await flushPromises();
    const signal = mocks.api.get.mock.calls[0][1].signal;
    mocks.auth.user.roles = [];
    await flushPromises();
    expect(signal.aborted).toBe(true);
    pending.resolve(response({ contract: { legacyId: '17055', name: 'Vertraulicher Tarif' }, groups: [], periods: [] }));
    await flushPromises();
    expect(wrapper.text()).not.toContain('Vertraulicher Tarif');
    expect(wrapper.text()).toContain('ausschließlich für Admins');
  });

  it('preserves exact decimal values and route query tabs', () => {
    expect(formatTariffDecimal('12345678901234567.8901', true)).toBe('12.345.678.901.234.567,8901 €');
    expect(formatTariffDecimal('15.33', true)).toBe('15,33 €');
    expect(formatTariffDecimal('0', true)).toBe('0,00 €');
    const route = { name: 'Tarife', query: { keep: 'value', tab: 'employees' } };
    expect(tariffTabs.find((entry) => entry.isActive(route)).id).toBe('employees');
    expect(tariffTabs[0].to(route)).toEqual({ path: '/tarife', query: { keep: 'value' } });
  });

  it('clears the whole workspace after a server permission denial', async () => {
    mocks.api.get.mockResolvedValueOnce(response({ data: [employee('one')], total: 1, pageSize: 50 }))
      .mockResolvedValueOnce(response(history('one', 'Vertrauliche Historie')))
      .mockResolvedValueOnce(response({ status: 'UNRESOLVED', message: 'Keine Tarifzuordnung am Stichtag.', allowances: [] }))
      .mockRejectedValueOnce({ response: { status: 403, data: { message: 'Der Admin-Zugriff wurde entzogen.' } } });
    wrapper = mount(TarifeWorkspace, { props: { activeTab: 'employees' } });
    await flushPromises();
    await button('Anzeigen').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Vertrauliche Historie');
    await button('Neu laden').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('Vertrauliche Historie');
    expect(wrapper.findAll('table')).toHaveLength(0);
    expect(wrapper.find('[role="alert"]').text()).toBe('Der Admin-Zugriff wurde entzogen.');
  });
});

describe('TariffEmployees', () => {
  it('öffnet Tarifdetails beim Klick auf eine Zeile und schließt sie über das gemeinsame Seitenpanel', async () => {
    mocks.api.get.mockResolvedValueOnce(response({ data: [employee('one')], total: 1, pageSize: 50 }))
      .mockResolvedValueOnce(response(history('one')))
      .mockResolvedValueOnce(response({ status: 'RESOLVED', value: '15.33', allowances: [{ values: { DPREIS: '2.4' } }] }));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    expect(wrapper.find('label').exists()).toBe(false);
    expect(wrapper.find('input[type="search"]').attributes('aria-label')).toBe('Mitarbeiter oder Personalnummer');
    await wrapper.find('tbody tr').trigger('click');
    await flushPromises();
    const panel = wrapper.find('aside[role="complementary"]');
    expect(panel.exists()).toBe(true);
    expect(panel.text()).toContain('Summe (Tariflohn + ÜTZ)');
    expect(panel.text()).toContain('17,73 €');
    expect(wrapper.find('.tariff-employees-list .tariff-employee-assignment').exists()).toBe(false);
    await panel.find('button[aria-label="Schließen"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('aside').exists()).toBe(false);
  });

  it('öffnet auch Mitarbeiter ohne Tarifhistorie mit einem verständlichen Hinweis', async () => {
    const missing = { ...employee('missing'), assignmentCount: 0, allowanceCount: 0 };
    mocks.api.get.mockResolvedValueOnce(response({ data: [missing], total: 1 }))
      .mockResolvedValueOnce(response({ employee: missing, assignments: [], allowances: [], groups: [] }))
      .mockResolvedValueOnce(response({ status: 'UNRESOLVED', code: 'ASSIGNMENT_MISSING', message: 'Keine gültige Tarifzuordnung.', allowances: [] }));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    await button('Anzeigen').trigger('click');
    await flushPromises();
    expect(wrapper.find('aside').text()).toContain('Keine Tarifzuordnung für diesen Mitarbeiter');
    expect(wrapper.find('aside').text()).toContain('Keine gültige Tarifzuordnung.');
  });

  it('fragt den Standort- und Tariflückenfilter über die gemeinsame Toolbar ab', async () => {
    mocks.api.get.mockResolvedValue(response({ data: [employee('one')], total: 1, pageSize: 50, locations: [{ _id: 'hh', shortName: 'HH', nameFull: 'Hamburg' }] }));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    await wrapper.find('.tf-toggle').trigger('click');
    await button('Ohne Tarifzuordnung').trigger('click');
    await flushPromises();
    expect(mocks.api.get.mock.calls.at(-1)[1].params).toMatchObject({ search: '', page: 1, pageSize: 50, tariff: 'missing' });
    await button('HH').trigger('click');
    await flushPromises();
    expect(mocks.api.get.mock.calls.at(-1)[1].params).toMatchObject({ search: '', page: 1, pageSize: 50, locationId: 'hh', tariff: 'missing' });
  });

  it('retains and marks reversed assignment and ÜTZ intervals without changing the resolved base rate', async () => {
    const employeeHistory = history('one');
    employeeHistory.assignments[0].intervalStatus = 'VALID';
    employeeHistory.assignments.push({ ...employeeHistory.assignments[0], legacyId: 'reversed-assignment', validFrom: '2026-09-01', validUntil: '2026-08-31', intervalStatus: 'INEFFECTIVE', source: { filename: 'Tarif Personal.xlsx', row: 17, raw: { ID: 'reversed-assignment', DTVON: '01.09.2026', DTBIS: '31.08.2026' } } });
    employeeHistory.allowances.push({ legacyId: 'reversed-allowance', validFrom: '2026-10-01', validUntil: '2026-09-30', intervalStatus: 'INEFFECTIVE', values: { DPREIS: '4.500' }, source: { filename: 'Tarif ÜTZ.xlsx', row: 23, raw: { ID: 'reversed-allowance', DTVON: '01.10.2026', DTBIS: '30.09.2026', DPREIS: '4.500' } } });
    mocks.api.get.mockResolvedValueOnce(response({ data: [employee('one')], total: 1, pageSize: 50 }))
      .mockResolvedValueOnce(response(employeeHistory))
      .mockResolvedValue(response({ status: 'RESOLVED', value: '15.33', date: '2026-09-01', allowances: [] }));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    await button('Anzeigen').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.tariff-interval-status--ineffective')).toHaveLength(2);
    expect(wrapper.find('[aria-label="Historische Tarifzuordnungen"]').findAll('.tariff-employee-assignment')).toHaveLength(2);
    expect(wrapper.text()).toContain('01.09.2026 – 31.08.2026');
    expect(wrapper.text()).toContain('01.10.2026');
    expect(wrapper.text()).toContain('30.09.2026');
    expect(wrapper.text()).toContain('4.500');
    expect(wrapper.text()).toContain('bei der Stichtagsabfrage nicht berücksichtigt');
    const allowanceSection = wrapper.findAll('.tariff-rule-section').find((entry) => entry.find('summary').text().startsWith('Individuelle ÜTZ'));
    expect(allowanceSection.attributes('open')).toBeDefined();
    expect(allowanceSection.find('summary').text()).toContain('1 unwirksam');
    await wrapper.find('input[type="date"]').setValue('2026-09-01');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.tariff-value').text()).toBe('15,33 €');
  });

  it('ignores stale history after another employee is selected', async () => {
    const old = deferred();
    mocks.api.get.mockResolvedValueOnce(response({ data: [employee('one'), employee('two')], total: 2, pageSize: 50 }))
      .mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(history('two', 'Aktuelle Person')));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    await wrapper.findAll('button').filter((entry) => entry.text() === 'Anzeigen')[0].trigger('click');
    const signal = mocks.api.get.mock.calls[1][1].signal;
    await wrapper.findAll('button').filter((entry) => entry.text() === 'Anzeigen')[1].trigger('click');
    await flushPromises();
    expect(signal.aborted).toBe(true);
    old.resolve(response(history('one', 'Veraltete Person')));
    await flushPromises();
    expect(wrapper.text()).toContain('Aktuelle Person');
    expect(wrapper.text()).not.toContain('Veraltete Person');
  });

  it('clears an in-flight rate when the date changes and never adds ÜTZ to the tariff value', async () => {
    const oldRate = deferred();
    mocks.api.get.mockResolvedValueOnce(response({ data: [employee('one')], total: 1, pageSize: 50 }))
      .mockResolvedValueOnce(response(history('one'))).mockReturnValueOnce(oldRate.promise)
      .mockResolvedValueOnce(response({ status: 'RESOLVED', value: '15.33', date: '2026-09-01', allowances: [{ values: { DPREIS: '4.00' }, source: { filename: 'Tarif ÜTZ.xlsx', raw: { DPREIS: '4.00', UNKNOWN_CODE: 'original' } } }] }));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    await button('Anzeigen').trigger('click');
    await flushPromises();
    const signal = mocks.api.get.mock.calls[2][1].signal;
    await wrapper.find('input[type="date"]').setValue('2026-09-01');
    expect(signal.aborted).toBe(true);
    oldRate.resolve(response({ status: 'RESOLVED', value: '999.99', date: '2026-01-01' }));
    await flushPromises();
    expect(wrapper.find('.tariff-value').exists()).toBe(false);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.tariff-value').text()).toBe('15,33 €');
    expect(wrapper.text()).toContain('UNKNOWN_CODE');
    expect(wrapper.text()).toContain('original');
    expect(mocks.api.get.mock.calls[3][1].params).toEqual({ date: '2026-09-01' });
  });

  it('shows unresolved employees and server errors without offering a guessed base rate', async () => {
    mocks.api.get.mockResolvedValueOnce(response({ data: [{ ...employee('missing'), employeeId: null, key: 'personal:100', matchStatus: 'MISSING' }], total: 1 }))
      .mockResolvedValueOnce(response({ employee: { employeeId: null, personalNr: '100', matchStatus: 'MISSING' }, assignments: [], allowances: [] }));
    wrapper = mount(TariffEmployees);
    await flushPromises();
    await button('Anzeigen').trigger('click');
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('eindeutigen Mitarbeiterzuordnung');
    mocks.api.get.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Nur für Admins.' } } });
    await button('Neu laden').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe('Nur für Admins.');
    expect(wrapper.find('table[aria-label="Mitarbeiter-Tarifzuordnungen"]').exists()).toBe(false);
  });
});

async function selectFourteenFiles() {
  wrapper.findAllComponents(AppFileDropzone).forEach((entry) => entry.vm.$emit('select', new File(['workbook'], 'same-name.xlsx')));
  await flushPromises();
}

describe('TariffImport', () => {
  it('keeps a preview with reversed employee interval warnings activatable', async () => {
    mocks.api.post.mockResolvedValueOnce(response(preview({ warningCount: 16, issues: [{ severity: 'WARNING', code: 'REVERSED_INTERVAL', table: 'employeeAssignments', message: 'Unwirksamer Zeitraum wird vollständig aufbewahrt.', row: 17 }] })));
    wrapper = mount(TariffImport);
    await flushPromises();
    await selectFourteenFiles();
    await button('Importvorschau erstellen').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('16 Hinweise');
    expect(wrapper.text()).toContain('Unwirksamer Zeitraum wird vollständig aufbewahrt.');
    expect(button('Geprüften Datenstand aktivieren').attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).not.toContain('wegen der angezeigten Fehler nicht aktiviert');
  });

  it('submits all fourteen explicit roles and preserves the reviewed active pointer during activation', async () => {
    mocks.api.get.mockResolvedValueOnce(response({ data: [], activeImportId: 'before' }))
      .mockResolvedValueOnce(response({ data: [], activeImportId: 'after' }))
      .mockResolvedValue(response({ data: [], activeImportId: 'draft' }));
    mocks.api.post.mockResolvedValueOnce(response(preview())).mockResolvedValueOnce(response({ activeImportId: 'draft', import: preview({ status: 'ACTIVE' }) }));
    wrapper = mount(TariffImport);
    await flushPromises();
    expect(button('Importvorschau erstellen').attributes('disabled')).toBeDefined();
    await selectFourteenFiles();
    await button('Importvorschau erstellen').trigger('click');
    await flushPromises();
    const form = mocks.api.post.mock.calls[0][1];
    expect([...form.keys()]).toEqual(tariffFileRoles.map((role) => role.key));
    expect(form.get('employeeGroups').name).toBe('same-name.xlsx');
    expect(form.get('payGroups').name).toBe('same-name.xlsx');
    await button('Geprüften Datenstand aktivieren').trigger('click');
    await flushPromises();
    expect(mocks.api.post.mock.calls[1][0]).toBe('/api/tariffs/imports/draft/activate');
    expect(mocks.api.post.mock.calls[1][1]).toEqual({ expectedActiveImportId: 'before' });
    expect(wrapper.emitted('activated')).toHaveLength(1);
    expect(button('Geprüften Datenstand aktivieren').attributes('disabled')).toBeDefined();
  });

  it('blocks invalid and already active previews and discards a preview when a file is replaced', async () => {
    mocks.api.post.mockResolvedValueOnce(response(preview({ status: 'INVALID', errorCount: 1, issues: [{ severity: 'ERROR', table: 'payGroups', message: 'Ungültige Entgeltgruppe', row: 9 }] })))
      .mockResolvedValueOnce(response(preview({ _id: 'before', duplicate: true })));
    wrapper = mount(TariffImport);
    await flushPromises();
    await selectFourteenFiles();
    await button('Importvorschau erstellen').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Ungültige Entgeltgruppe');
    expect(wrapper.text()).toContain('Zeile 9');
    expect(button('Geprüften Datenstand aktivieren').attributes('disabled')).toBeDefined();
    wrapper.findComponent(AppFileDropzone).vm.$emit('select', new File(['replacement'], 'fixed.xlsx'));
    await flushPromises();
    expect(wrapper.find('[aria-label="Importvorschau"]').exists()).toBe(false);
    await button('Importvorschau erstellen').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('bereits aktiv');
    expect(button('Geprüften Datenstand aktivieren').attributes('disabled')).toBeDefined();
    expect(mocks.api.post).toHaveBeenCalledTimes(2);
  });

  it('shows an activation conflict and does not emit success', async () => {
    mocks.api.post.mockResolvedValueOnce(response(preview()))
      .mockRejectedValueOnce({ response: { status: 409, data: { message: 'Der aktive Tarifstand wurde zwischenzeitlich geändert.' } } });
    wrapper = mount(TariffImport);
    await flushPromises();
    await selectFourteenFiles();
    await button('Importvorschau erstellen').trigger('click');
    await flushPromises();
    await button('Geprüften Datenstand aktivieren').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('zwischenzeitlich geändert');
    expect(wrapper.emitted('activated')).toBeUndefined();
  });
});
