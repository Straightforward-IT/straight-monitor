import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import UserManagement from '@/components/UserManagement.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn() },
  openCustomer: vi.fn(),
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { _id: 'admin-1', roles: ['ADMIN'] } }) }));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: mocks.openCustomer }) }));

const modelSource = readFileSync(resolve(process.cwd(), '../../api/models/Payroll/Lohnart.js'), 'utf8');
const fields = [...modelSource.matchAll(/^  (\w+): \{ type: String/gm)].map(match => match[1]);
const importSource = readFileSync(resolve(process.cwd(), '../../api/routes/system/dataImportRoutes.js'), 'utf8');
const importColumns = importSource.split("router.post('/lohnart'")[1].split('const header =')[0];
const importedFields = [...importColumns.matchAll(/\['\w+', '(\w+)'\]/g)].map(match => match[1]);
const customer = { _id: 'customer-1', kuerzel: 'ABC', kundName: 'Testkunde', kundenNr: 123 };
const fixture = () => ({
  _id: 'lohnart-1',
  ...Object.fromEntries(fields.map(field => [field, `${field}-Quellwert`])),
  lohnartNummer: '200',
  kunden: [customer],
});
let records;
let wrapper;

beforeEach(() => {
  vi.clearAllMocks();
  records = [fixture()];
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    url === '/api/import/lohnarten' ? { success: true, data: records } :
      ['/api/users/admin/all', '/api/locations', '/api/kunden', '/api/signatur-typen'].includes(url) ? [] : { data: [] },
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

async function render() {
  wrapper = mount(UserManagement, {
    global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  await wrapper.get('button[data-tab-id="lohn"]').trigger('click');
}

it('displays every imported and stored Lohnart value without interpreting codes', async () => {
  await render();
  const headers = wrapper.findAll('.lohn th[data-field]').map(header => header.attributes('data-field'));
  expect(headers).toHaveLength(fields.length);
  expect(new Set(headers)).toEqual(new Set(fields));
  expect(importedFields).toHaveLength(24);
  expect(importedFields.every(field => headers.includes(field))).toBe(true);
  for (const field of fields) {
    expect(wrapper.get(`.lohn tbody td[data-field="${field}"]`).text()).toBe(records[0][field]);
  }
  expect(wrapper.findAll('.lohn tbody td')).toHaveLength(fields.length + 1);
  expect(wrapper.get('.lohn__zuschlag').text()).toBe(records[0].zuschlagsProzent);
  await wrapper.get('.lohn__kunde-link').trigger('click');
  expect(mocks.openCustomer).toHaveBeenCalledWith(customer, { initialTab: 'preise' });
});

it('searches all displayed fields, including previously hidden codes', async () => {
  await render();
  const input = wrapper.get('.lohn input[aria-label="Lohnart suchen"]');
  for (const field of fields) {
    await input.setValue(`  ${records[0][field].toUpperCase()}  `);
    expect(wrapper.findAll('.lohn tbody tr')).toHaveLength(1);
    expect(wrapper.get('.lohn tbody td[data-field="lohnartNummer"]').text()).toBe('200');
  }
  await input.setValue('not-a-lohnart-value');
  expect(wrapper.get('.lohn tbody td').attributes('colspan')).toBe(String(fields.length + 1));
  expect(wrapper.get('.lohn tbody').text()).toBe('Keine Lohnarten vorhanden.');
  await input.setValue('');
  expect(wrapper.findAll('.lohn tbody td[data-field]')).toHaveLength(fields.length);
});

it('sorts every value numerically in both directions', async () => {
  records = ['10', '2'].map(value => ({
    _id: `lohnart-${value}`,
    ...Object.fromEntries(fields.map(field => [field, value])),
    kunden: [],
  }));
  await render();
  for (const field of fields) {
    const header = wrapper.get(`.lohn th[data-field="${field}"]`);
    if (header.attributes('aria-sort') !== 'ascending') await header.get('button').trigger('click');
    expect(header.attributes('aria-sort')).toBe('ascending');
    expect(wrapper.findAll(`.lohn tbody td[data-field="${field}"]`).map(cell => cell.text())).toEqual(['2', '10']);
    await header.get('button').trigger('click');
    expect(header.attributes('aria-sort')).toBe('descending');
    expect(wrapper.findAll(`.lohn tbody td[data-field="${field}"]`).map(cell => cell.text())).toEqual(['10', '2']);
  }
});

it('shows missing values as dashes and preserves zero values and normal-hours styling', async () => {
  records = [{ _id: 'normalstunden', lohnartNummer: '100', steuerartCode: '', steuerSpezialCode: null, zuschlagsProzent: '0', fakturierungCode: 0, kunden: [customer] }];
  await render();
  for (const field of ['kb', 'steuerartCode', 'steuerSpezialCode']) {
    expect(wrapper.get(`.lohn tbody td[data-field="${field}"]`).text()).toBe('-');
  }
  for (const field of ['zuschlagsProzent', 'fakturierungCode']) {
    expect(wrapper.get(`.lohn tbody td[data-field="${field}"]`).text()).toBe('0');
  }
  expect(wrapper.find('.lohn__row--normalstunden').exists()).toBe(true);
  expect(wrapper.find('.lohn__kunde-link').exists()).toBe(false);
});

it('keeps empty values last in both sort directions', async () => {
  records = ['', '10', '2', null].map((value, index) => ({ _id: `lohnart-${index}`, lohnartNummer: String(200 + index), steuerartCode: value }));
  await render();
  const header = wrapper.get('.lohn th[data-field="steuerartCode"]');
  await header.get('button').trigger('click');
  expect(wrapper.findAll('.lohn tbody td[data-field="steuerartCode"]').map(cell => cell.text())).toEqual(['2', '10', '-', '-']);
  await header.get('button').trigger('click');
  expect(wrapper.findAll('.lohn tbody td[data-field="steuerartCode"]').map(cell => cell.text())).toEqual(['10', '2', '-', '-']);
});
