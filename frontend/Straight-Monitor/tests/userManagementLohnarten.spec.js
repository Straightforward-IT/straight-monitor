import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import UserManagement from '@/components/UserManagement.vue';
import WageTypesTab from '@/components/payroll/WageTypesTab.vue';
import { formatSetting } from '@/utils/wageTypeSettings';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn() }, openCustomer: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { _id: 'admin-1', roles: ['ADMIN'] } }) }));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: mocks.openCustomer }) }));
const customer = { _id: 'customer-1', kuerzel: 'ABC', kundName: 'Testkunde', kundenNr: 123 };
const modelSource = readFileSync(resolve(process.cwd(), '../../api/models/Payroll/Lohnart.js'), 'utf8');
const legacyFields = [...modelSource.matchAll(/^  (\w+): \{ type: String/gm)].map(match => match[1]);
let records;
let details;
let wrapper;
const fixture = (id = 'lohnart-110', number = '110') => ({ _id: id, lohnartNummer: number, lohnartKurzzeichen: 'ÜTZ', lohnartBezeichnung: 'übertarifliche Zulage', berechnungsartCode: '2', fakturierungCode: '1', kb: '', kunden: [customer] });
const ids = () => wrapper.findAll('.lohn tbody td[data-field="lohnartNummer"]').map(cell => cell.text());
const activePanel = () => wrapper.get('.wage-detail [role="tabpanel"]:not([hidden])');
const select = async (number) => { await wrapper.get(`button[aria-label="Lohnart ${number} anzeigen"]`).trigger('click'); await flushPromises(); };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

beforeEach(() => {
  vi.clearAllMocks(); records = [fixture()]; details = new Map();
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/import/lohnarten') return Promise.resolve({ data: { success: true, data: records } });
    if (url.startsWith('/api/import/lohnarten/')) {
      const id = url.slice('/api/import/lohnarten/'.length);
      return Promise.resolve({ data: { success: true, data: details.get(id) || records.find(row => row._id === id) } });
    }
    return Promise.resolve({ data: ['/api/users/admin/all', '/api/locations', '/api/kunden', '/api/signatur-typen'].includes(url) ? [] : { data: [] } });
  });
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });
async function render(component = WageTypesTab) {
  wrapper = mount(component, { global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } } }); await flushPromises();
  if (component === UserManagement) { await wrapper.get('button[data-tab-id="lohn"]').trigger('click'); await flushPromises(); }
}

it('integrates the compact readonly overview and retains customer price links for normal hours', async () => {
  records = [fixture('normal', '100')]; await render(UserManagement);
  expect(wrapper.findAll('.lohn__table th').map(cell => cell.text().replace(' ↑', ''))).toEqual(['Nr.', 'Kürzel', 'Bezeichnung', 'KB', 'Berechnungsart', 'Konditionsbereitstellung', 'Kundenbezüge', 'Details']);
  expect(wrapper.get('.lohn td[data-field="berechnungsartCode"]').text()).toBe('2 · Stunden × Stundenlohn');
  expect(wrapper.get('.lohn td[data-field="fakturierungCode"]').text()).toBe('1 · Nur Lohn');
  await wrapper.get('.lohn__kunde-link').trigger('click'); expect(mocks.openCustomer).toHaveBeenCalledWith(customer, { initialTab: 'preise' });
  expect(wrapper.find('.wage-detail').exists()).toBe(false); expect(wrapper.text()).not.toContain('Löschen');
});

it('preserves every legacy raw value and all 129 source columns in the Herkunft tab', async () => {
  const row = { ...Object.fromEntries(legacyFields.map(field => [field, `${field}-Quellwert`])), _id: 'all-fields', lohnartNummer: '200', kunden: [] };
  const sourceColumns = Array.from({ length: 129 }, (_, index) => ({ index: index + 1, header: index < 2 ? 'Code für Berechnung' : `Quellspalte ${index}`, occurrence: index === 1 ? 2 : 1, value: index === 0 ? '2' : `Wert-${index}` }));
  records = [row]; details.set(row._id, { ...row, source: { filename: 'Lohnarten.xlsx', sheet: 'Tabelle1', row: 2, columns: sourceColumns } });
  await render(); await select('200'); await wrapper.get('.wage-detail button[data-tab-id="source"]').trigger('click');
  expect(activePanel().text()).toContain('Lohnarten.xlsx');
  for (const field of legacyFields) expect(activePanel().get(`[data-raw-field="${field}"] dd`).text()).toBe(row[field]);
  expect(activePanel().findAll('.wage-detail__source-table tbody tr')).toHaveLength(129);
  expect(activePanel().findAll('.wage-detail__source-table tbody tr')[1].text()).toContain('Code für Berechnung2Wert-1');
});

it('searches all raw model fields, average SP1/SP2 meanings and unknown codes without changing their values', async () => {
  const row = { ...Object.fromEntries(legacyFields.map(field => [field, `${field}-Quellwert`])), ...fixture('raw', '200'), durchschnittsspeicherCode: '1', durchschnittsspeicher2Code: '7' };
  records = [row, { _id: 'unknown', lohnartNummer: '201', berechnungsartCode: '99' }]; await render();
  const input = wrapper.get('input[aria-label="Lohnart suchen"]');
  // Single digit codes can also match a different wage number or an enum meaning.
  for (const field of legacyFields.filter(field => row[field])) { await input.setValue(`  ${row[field].toUpperCase()}  `); expect(ids(), field).toContain('200'); }
  await input.setValue('Subtraktion im Durchschnitt'); expect(ids()).toEqual(['200']);
  await input.setValue('Unbekannter Code'); expect(ids()).toEqual(['200', '201']);
  await input.setValue('keine-lohnart'); expect(wrapper.get('.lohn tbody td').attributes('colspan')).toBe('8'); expect(row.durchschnittsspeicher2Code).toBe('7');
});

it('keeps the earlier wide source accessible after a narrow partial import', async () => {
  details.set('lohnart-110', { ...fixture(), source: { filename: 'Teilimport.xlsx', sheet: 'Import', row: 2, columns: [{ index: 1, header: 'LOHNARTNR', occurrence: 1, value: 110 }] },
    sourceHistory: [{ filename: 'Lohnarten.xlsx', sheet: 'Tabelle1', row: 8, columns: Array.from({ length: 129 }, (_, index) => ({ index: index + 1, header: `Spalte ${index + 1}`, occurrence: 1, value: index })) }] });
  await render(); await select('110'); await wrapper.get('.wage-detail button[data-tab-id="source"]').trigger('click');
  expect(activePanel().text()).toContain('Teilimport.xlsx');
  expect(activePanel().get('.wage-detail__source-history summary').text()).toContain('Lohnarten.xlsx · Tabelle1 · Zeile 8 (129 Spalten)');
  expect(activePanel().get('.wage-detail__source-history').findAll('tbody tr')).toHaveLength(129);
  expect(activePanel().find('[data-raw-field="sourceHistory"]').exists()).toBe(false);
});

it('searches values and meanings without treating a common source citation as a record value', async () => {
  const metadata = { verrechnungCode: { status: 'missing', source: ['Bestätigung: 110 → 602'] } };
  records = [{ ...fixture(), codeMetadaten: metadata }, { ...fixture('other', '200'), lohnartKurzzeichen: 'NST', lohnartBezeichnung: 'Normalstunden', codeMetadaten: metadata }];
  await render(); await wrapper.get('input[aria-label="Lohnart suchen"]').setValue('110');
  expect(ids()).toEqual(['110']);
});

it('combines calculation, real zero provision, KB and unknown-code filters and resets them', async () => {
  records = [
    { _id: 'a', lohnartNummer: '200', berechnungsartCode: '2', fakturierungCode: '0', kb: 'Q', steuerartCode: '99' },
    { _id: 'b', lohnartNummer: '201', berechnungsartCode: '2', fakturierungCode: '1', kb: 'Q' },
    { _id: 'c', lohnartNummer: '202', berechnungsartCode: '2', fakturierungCode: '0', kb: '' },
    { _id: 'd', lohnartNummer: '203', berechnungsartCode: '0', fakturierungCode: '0', kb: 'Q' },
  ]; await render(); await wrapper.get('button[aria-label="Filter öffnen"]').trigger('click');
  await wrapper.get('select[aria-label="Berechnungsart filtern"]').setValue('2'); await wrapper.get('select[aria-label="Konditionsbereitstellung filtern"]').setValue('0');
  await wrapper.get('select[aria-label="Fehlzeitenkürzel filtern"]').setValue('present'); await wrapper.get('select[aria-label="Unbekannte Codes filtern"]').setValue('unknown');
  expect(ids()).toEqual(['200']); expect(wrapper.findAll('.tf-count')[0].text()).toBe('4');
  await wrapper.get('button[title="Filter zurücksetzen"]').trigger('click'); expect(ids()).toEqual(['200', '201', '202', '203']);
});

it('sorts numeric values in both directions with missing values last', async () => {
  records = ['', '10', '2', null].map((value, index) => ({ _id: `w-${index}`, lohnartNummer: String(200 + index), kb: value })); await render();
  const header = wrapper.get('th[data-field="kb"]'); await header.get('button').trigger('click');
  expect(wrapper.findAll('td[data-field="kb"]').map(cell => cell.text())).toEqual(['2', '10', '—', '—']); await header.get('button').trigger('click');
  expect(wrapper.findAll('td[data-field="kb"]').map(cell => cell.text())).toEqual(['10', '2', '—', '—']);
});

it('separates SP1/SP2 and independent hour flags and does not invent BG2', async () => {
  details.set('lohnart-110', { ...fixture(), durchschnittsspeicherCode: '1', durchschnittsspeicher2Code: '7', fuerGesamtstunden: 'Ja', inAuswertungenBeruecksichtigen: 'Nein', source: { columns: [{ index: 97, header: 'IBGSPALTESTD_SUB', occurrence: 1, value: 0 }] } });
  await render(); await select('110');
  expect(activePanel().get('[data-setting="durchschnittsspeicherCode"] dd').text()).toBe(formatSetting({ durchschnittsspeicherCode: '1' }, 'durchschnittsspeicherCode'));
  expect(activePanel().get('[data-setting="durchschnittsspeicher2Code"] dd').text()).toContain('7 · Subtraktion');
  await wrapper.get('.wage-detail button[data-tab-id="time"]').trigger('click'); expect(activePanel().get('[data-setting="fuerGesamtstunden"] dd').text()).toBe('Ja'); expect(activePanel().get('[data-setting="inAuswertungenBeruecksichtigen"] dd').text()).toBe('Nein');
  await wrapper.get('.wage-detail button[data-tab-id="accounting"]').trigger('click'); expect(activePanel().text()).toContain('BG2 wird nicht aus IBGSPALTESTD_SUB abgeleitet'); expect(wrapper.find('[data-setting="bg2Code"]').exists()).toBe(false);
});

it('shows 110 → 602 and opens the target in the same panel while preserving the selected tab', async () => {
  const target = { _id: 'lohnart-602', lohnartNummer: '602', lohnartBezeichnung: 'Verrechnung mit der übertariflichen Zulage' }; records.push(target);
  details.set('lohnart-110', { ...fixture(), verrechnungCode: '3', verrechnungslohnartNummer: '602', verrechnungsPrioritaet: '1', verrechnungsbezug: { targetNumber: '602', target, status: 'matched', code: '3', priority: '1' } });
  await render(); await select('110'); await wrapper.get('.wage-detail button[data-tab-id="tariff"]').trigger('click');
  expect(activePanel().text()).toContain('110 → 602'); expect(activePanel().get('[data-setting="verrechnungCode"] dd').text()).toBe('3 · ÜTZ'); expect(activePanel().get('[data-setting="verrechnungsPrioritaet"] dd').text()).toBe('1');
  await activePanel().get('.wage-detail__relation button').trigger('click'); await flushPromises(); expect(wrapper.get('.wage-detail .sp-panel__title').text()).toContain('602'); expect(wrapper.get('.wage-detail button[data-tab-id="tariff"]').attributes('aria-selected')).toBe('true');
  expect(mocks.api.get).toHaveBeenCalledWith('/api/import/lohnarten/lohnart-602', expect.any(Object));
});

it('shows missing offset targets as a concrete clarification without creating a position', async () => {
  details.set('lohnart-110', { ...fixture(), verrechnungslohnartNummer: '602', verrechnungsbezug: { targetNumber: '602', target: null, status: 'missing' } });
  await render(); await select('110'); await wrapper.get('.wage-detail button[data-tab-id="tariff"]').trigger('click'); expect(activePanel().text()).toContain('Ziel-Lohnart 602 fehlt'); expect(activePanel().find('.wage-detail__relation button').exists()).toBe(false);
});

it('keeps all customer condition rows separate by Lohn/Faktur/unknown usage with rule details and links', async () => {
  const base = { kunde: customer, regelArt: 'uhrzeit', abWert: '23', bisWert: '6', tage: { samstag: true }, zuschlagsProzent: 25, preisNr: '1', jeEinheit: 'tag', zvooveKonditionsId: '672571', nichtAutomatisch: false, branchenzuschlagAddieren: true };
  details.set('lohnart-110', { ...fixture(), kundenkonditionen: [ { ...base, _id: 'one', verwendung: 'F' }, { ...base, _id: 'two', verwendung: 'F' }, { ...base, _id: 'three', verwendung: 'L' }, { ...base, _id: 'four', verwendung: 'X' } ] });
  await render(); await select('110'); await wrapper.get('.wage-detail button[data-tab-id="conditions"]').trigger('click');
  expect(activePanel().get('[data-condition-group="F"]').findAll('article')).toHaveLength(2); expect(activePanel().get('[data-condition-group="L"]').findAll('article')).toHaveLength(1); expect(activePanel().get('[data-condition-group="unknown"]').text()).toContain('X · Ungeklärte Verwendung');
  const first = activePanel().get('[data-condition-group="F"] article'); expect(first.text()).toContain('Uhrzeit: 23 – 6'); expect(first.text()).toContain('25 %'); expect(first.text()).toContain('672571'); await first.get('button').trigger('click'); expect(mocks.openCustomer).toHaveBeenCalledWith(customer, { initialTab: 'preise' });
});

it('discards out-of-order detail responses and clears old information while loading', async () => {
  const slow = deferred(); const fast = fixture('fast', '602'); records.push(fast); const defaultGet = mocks.api.get.getMockImplementation();
  mocks.api.get.mockImplementation((url, options) => url === '/api/import/lohnarten/lohnart-110' ? slow.promise : defaultGet(url, options)); await render(); await wrapper.get('button[aria-label="Lohnart 110 anzeigen"]').trigger('click'); expect(wrapper.get('.wage-detail [role="status"]').text()).toContain('werden geladen');
  await select('602'); expect(wrapper.get('.wage-detail .sp-panel__title').text()).toContain('602'); slow.resolve({ data: { data: { ...fixture(), lohnartBezeichnung: 'VERALTETER DATENSATZ' } } }); await flushPromises(); expect(wrapper.get('.wage-detail .sp-panel__title').text()).toContain('602'); expect(wrapper.text()).not.toContain('VERALTETER DATENSATZ');
});

it('shows detail load failures, allows retry and keeps the selected detail tab', async () => {
  await render(); await select('110'); await wrapper.get('.wage-detail button[data-tab-id="source"]').trigger('click'); await wrapper.get('.wage-detail button[aria-label="Schließen"]').trigger('click'); mocks.api.get.mockRejectedValueOnce({ response: { data: { message: 'Details nicht verfügbar' } } });
  await select('110'); expect(wrapper.get('.wage-detail [role="alert"]').text()).toContain('Details nicht verfügbar'); await wrapper.get('.wage-detail [role="alert"] button').trigger('click'); await flushPromises(); expect(wrapper.find('.wage-detail [role="alert"]').exists()).toBe(false); expect(wrapper.get('.wage-detail button[data-tab-id="source"]').attributes('aria-selected')).toBe('true');
});
