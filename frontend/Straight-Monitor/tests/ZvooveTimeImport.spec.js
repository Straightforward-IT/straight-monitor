import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import Import from '@/components/payroll/ZvooveTimeImport.vue';
import Dropzone from '@/components/ui-elements/AppFileDropzone.vue';
const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn() }, auth: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
const preview = { id: 'year-1', year: 2026, status: 'PREVIEW', baseRevision: 4, counts: { vortraege: 2, workRows: 2, pauseRows: 1, unlocatedBreaks: 1, unresolved: 0, orphanRows: 0, editableProjections: 2 }, productiveHours: '15', pauseHours: '0.5', issues: [] };
let wrapper;
const button = text => wrapper.findAll('button').find(button => button.text() === text);
beforeEach(() => { vi.resetAllMocks(); mocks.auth = reactive({ user: { roles: ['ADMIN'] } }); mocks.api.get.mockResolvedValue({ data: { imports: [] } }); });
afterEach(() => wrapper?.unmount());
async function render() { wrapper = mount(Import); await flushPromises(); }
async function upload() {
  wrapper.findAllComponents(Dropzone)[0].vm.$emit('select', new File(['draft'], 'Stundenvortrag 2026.xlsx'));
  wrapper.findAllComponents(Dropzone)[1].vm.$emit('select', new File(['clock'], 'Stunduhr 2026.xlsx'));
  await flushPromises(); mocks.api.post.mockResolvedValueOnce({ data: preview });
  await button('Jahresimport prüfen').trigger('click'); await flushPromises();
}
describe('year time import', () => {
  it('does not load or show private import controls for non-admins', async () => {
    mocks.auth.user.roles = ['USER']; await render(); expect(mocks.api.get).not.toHaveBeenCalled(); expect(wrapper.findComponent(Dropzone).exists()).toBe(false);
  });
  it('sends explicitly assigned table roles and activates only the checked revision', async () => {
    await render(); await upload(); const form = mocks.api.post.mock.calls[0][1];
    expect(form.get('STUNDENVORTRAG').name).toBe('Stundenvortrag 2026.xlsx'); expect(form.get('STUNDUHR').name).toBe('Stunduhr 2026.xlsx');
    expect(wrapper.text()).toContain('Pausenzeilen'); expect(wrapper.text()).toContain('Arbeitsstunden');
    mocks.api.post.mockResolvedValueOnce({ data: { ...preview, status: 'ACTIVE' } });
    await button('Geprüften Jahresstand aktivieren').trigger('click'); await flushPromises();
    expect(mocks.api.post.mock.calls[1]).toEqual(['/api/payroll/time-imports/year-1/activate', { expectedRevision: 4 }]);
    expect(button('Geprüften Jahresstand aktivieren')).toBeUndefined();
  });
  it('blocks activation after conflicts and clears private data on access denial', async () => {
    await render(); await upload(); mocks.api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Stand geändert' } } });
    await button('Geprüften Jahresstand aktivieren').trigger('click'); await flushPromises();
    expect(button('Geprüften Jahresstand aktivieren').element.disabled).toBe(true);
    mocks.api.post.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Rolle entzogen' } } });
    await button('Jahresimport prüfen').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('Rolle entzogen'); expect(wrapper.findComponent(Dropzone).exists()).toBe(false);
  });
});
