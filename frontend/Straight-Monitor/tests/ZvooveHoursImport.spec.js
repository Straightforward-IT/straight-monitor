import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import ZvooveHoursImport from '@/components/payroll/ZvooveHoursImport.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn() }, auth: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
const response = (data) => ({ data });
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const preview = (changes = {}) => ({
  id: 'preview-1', month: '2026-01', status: 'PREVIEW', valid: true, baseRevision: 4,
  filename: 'Januar.xlsx', counts: { rows: 3222, employees: 537, days: 20, productiveDays: 15, markers: 5 },
  changes: { added: 1, updated: 2, unchanged: 3219 }, issues: [], ...changes,
});
let wrapper;
const button = (label) => wrapper.findAll('button').find((entry) => entry.text() === label);
async function render() { wrapper = mount(ZvooveHoursImport); await flushPromises(); }
async function select(name = 'Januar.xlsx') {
  wrapper.findComponent(AppFileDropzone).vm.$emit('select', new File(['workbook'], name));
  await flushPromises();
}
async function readPreview(data = preview()) {
  mocks.api.post.mockResolvedValueOnce(response(data));
  await select();
  await button('Stundenimport prüfen').trigger('click');
  await flushPromises();
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = reactive({ user: { roles: ['ADMIN'] } });
  mocks.api.get.mockResolvedValue(response({ imports: [] }));
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });

describe('Zvoove hours import', () => {
  it('sends no private requests for non-admins', async () => {
    mocks.auth.user.roles = ['PAYROLL'];
    await render();
    expect(mocks.api.get).not.toHaveBeenCalled();
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(wrapper.findComponent(AppFileDropzone).exists()).toBe(false);
    expect(wrapper.text()).toContain('ausschließlich für Admins');
  });

  it('shows exact source headings, productive-hour semantics, validation errors and source rows', async () => {
    await render();
    await readPreview(preview({ status: 'INVALID', valid: false, issues: [
      { severity: 'ERROR', code: 'KW_MISMATCH', message: 'Die KW stimmt nicht mit der Monatswoche überein.', source: { filename: 'Januar.xlsx', sheet: 'Tabelle1', row: 42 } },
      { severity: 'WARNING', code: 'PERSONAL_UNKNOWN', message: 'Personalnummer 123 ist ungeklärt.' },
    ] }));
    expect(wrapper.text()).toContain('Stunden ohne Kennzeichen sind produktive Stunden');
    expect(wrapper.text()).toContain('PERSONALNR, JAHR, MONAT, WOCHE, KW, T1, T2, T3, T4, T5, T6, T7, KZ1, KZ2, KZ3, KZ4, KZ5, KZ6, KZ7, ERSTELLTAM, GEAENDERAM');
    expect(wrapper.text()).toContain('3222');
    expect(wrapper.text()).toContain('Wochenzeilen');
    expect(wrapper.text()).toContain('1 Fehler · 1 Hinweise');
    expect(wrapper.text()).toContain('Januar.xlsx · Tabelle1 · Zeile 42');
    expect(wrapper.text()).toContain('Personalnummer 123 ist ungeklärt');
    expect(button('Geprüfte Stunden aktivieren').element.disabled).toBe(true);
    expect(mocks.api.post.mock.calls[0][0]).toBe('/api/payroll/imports/preview');
    expect(mocks.api.post.mock.calls[0][1].get('file').name).toBe('Januar.xlsx');
  });

  it('allows warnings, activates the checked revision and refreshes history', async () => {
    await render();
    await readPreview(preview({ issues: [{ severity: 'WARNING', message: 'Unbekanntes KB bleibt markiert.' }] }));
    expect(button('Geprüfte Stunden aktivieren').element.disabled).toBe(false);
    const active = preview({ status: 'ACTIVE', revision: 5 });
    mocks.api.post.mockResolvedValueOnce(response(active));
    mocks.api.get.mockResolvedValueOnce(response({ imports: [active] }));
    await button('Geprüfte Stunden aktivieren').trigger('click');
    await flushPromises();
    expect(mocks.api.post.mock.calls[1][0]).toBe('/api/payroll/imports/preview-1/activate');
    expect(mocks.api.post.mock.calls[1][1]).toEqual({ expectedRevision: 4 });
    expect(wrapper.emitted('activated')[0]).toEqual([active]);
    expect(wrapper.text()).toContain('Dieser Import ist aktiviert');
    expect(button('Geprüfte Stunden aktivieren').element.disabled).toBe(true);
    expect(wrapper.find('table[aria-label="Frühere Stundenimporte"] tbody').text()).toContain('Januar 2026');
    expect(mocks.api.get).toHaveBeenCalledTimes(3);
  });

  it('blocks activation after a concurrent import changes the monthly revision', async () => {
    await render();
    await readPreview();
    mocks.api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Der aktive Monatsbestand wurde aktualisiert.' } } });
    await button('Geprüfte Stunden aktivieren').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Prüfe die Datei erneut');
    expect(wrapper.text()).toContain('Der aktive Monatsbestand wurde aktualisiert');
    expect(button('Geprüfte Stunden aktivieren').element.disabled).toBe(true);
    await select('Januar-korrigiert.xlsx');
    expect(wrapper.find('[aria-label="Stundenimport-Vorschau"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Der aktive Monatsbestand wurde aktualisiert');
  });

  it('distinguishes a previously activated import from the current monthly import without offering reactivation', async () => {
    const earlier = preview({ status: 'ACTIVE', isCurrent: false });
    mocks.api.get.mockResolvedValueOnce(response({ imports: [earlier] })).mockResolvedValueOnce(response(earlier));
    await render();
    expect(wrapper.find('table[aria-label="Frühere Stundenimporte"]').text()).toContain('Historisch aktiviert');
    await button('Prüfung anzeigen').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Der Monatsbestand wurde inzwischen erneut aktualisiert');
    expect(button('Geprüfte Stunden aktivieren').element.disabled).toBe(true);
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it('cancels an obsolete preview when the selected file changes and discards the old response', async () => {
    await render();
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    await select();
    await button('Stundenimport prüfen').trigger('click');
    const signal = mocks.api.post.mock.calls[0][2].signal;
    await select('Februar.xlsx');
    expect(signal.aborted).toBe(true);
    pending.resolve(response(preview()));
    await flushPromises();
    expect(wrapper.find('[aria-label="Stundenimport-Vorschau"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Februar.xlsx');
    expect(button('Stundenimport prüfen').element.disabled).toBe(false);
  });

  it('clears private details and cancels requests when the admin role is revoked', async () => {
    await render();
    await readPreview();
    const pending = deferred();
    mocks.api.get.mockReturnValueOnce(pending.promise);
    await button('Historie neu laden').trigger('click');
    const signal = mocks.api.get.mock.calls.at(-1)[1].signal;
    mocks.auth.user.roles = ['PAYROLL'];
    await flushPromises();
    expect(signal.aborted).toBe(true);
    pending.resolve(response({ imports: [preview()] }));
    await flushPromises();
    expect(wrapper.text()).not.toContain('Januar.xlsx');
    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).toContain('ausschließlich für Admins');
  });

  it('shows network failures and clears confidential data on server permission denial', async () => {
    mocks.api.get.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Historie nicht erreichbar.' } } });
    await render();
    expect(wrapper.find('[role="alert"]').text()).toBe('Historie nicht erreichbar.');
    mocks.api.get.mockResolvedValueOnce(response({ imports: [preview()] }));
    await button('Historie neu laden').trigger('click');
    await flushPromises();
    mocks.api.get.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Der Admin-Zugriff wurde entzogen.' } } });
    await button('Prüfung anzeigen').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Der Admin-Zugriff wurde entzogen');
    expect(wrapper.text()).not.toContain('Januar.xlsx');
    expect(wrapper.findComponent(AppFileDropzone).exists()).toBe(false);
  });
});
