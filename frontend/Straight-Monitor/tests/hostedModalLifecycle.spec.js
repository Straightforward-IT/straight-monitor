import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createRouter, createMemoryHistory, RouterView } from 'vue-router';
import { createModalDock, DockedModalHost, MinimizedModalDock, useDockedModals } from '@bleck-it/vue-modal-dock';
import { useAdditionalModals } from '@/composables/useAdditionalModals';
import LeadsTab from '@/components/LeadsTab.vue';
import LeadModal from '@/components/Modals/LeadModal.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import ExportMitarbeiterModal from '@/components/ExportMitarbeiterModal.vue';
import EditMitarbeiterDialog from '@/components/Modals/EditMitarbeiterDialog.vue';
import KontaktAnlegenModal from '@/components/Modals/KontaktAnlegenModal.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
  cache: { kunden: [], loadKunden: vi.fn(), updateOneMitarbeiter: vi.fn() },
  auth: { user: { name: 'Test', roles: ['ADMIN'] } },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

const employee = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test', personalnr: '1' };
const lead = { _id: 'lead-1', title: 'Organisation', stufe: 'neu', locationV2: 'hh', aktivitaeten: [], attachments: [] };
let wrapper;
let manager;
let launchers;
let router;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    url === '/api/leads' ? [lead] : url === '/api/leads/config' ? { quelleOptions: [] }
      : url === '/api/locations' ? [{ _id: 'hh', nameFull: 'Hamburg' }]
        : url.includes('nationalitaeten') ? { data: [] } : [] }));
  mocks.cache.loadKunden.mockResolvedValue();
  mocks.api.patch.mockImplementation((url, payload) => Promise.resolve({ data:
    url.startsWith('/api/leads/') ? { ...lead, ...payload }
      : { success: true, data: { ...employee, ...payload } } }));
});
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; });

async function render(leads = false) {
  const Launcher = defineComponent({ setup() {
    launchers = useAdditionalModals();
    return () => leads ? h(LeadsTab, { initialLeadId: lead._id }) : h('p', 'Launcher');
  } });
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: Launcher }, { path: '/other', component: { template: '<p>Other layout</p>' } },
  ] });
  await router.push('/');
  const Root = defineComponent({ setup() {
    manager = useDockedModals();
    return () => h('div', [h(RouterView), h(DockedModalHost), h(MinimizedModalDock)]);
  } });
  wrapper = mount(Root, { attachTo: document.body, global: { plugins: [router, createModalDock()], stubs: {
    'font-awesome-icon': true, CustomerSearch: true, ContactCard: true,
    RecordChronikDrawer: true, RecordChronikTimeline: true, RecordChronikComposer: true,
  } } });
  await flushPromises();
}

describe('globally hosted windows', () => {
  it.each(['export', 'edit', 'contact'])('keeps %s state after the launcher unmounts', async type => {
    await render();
    const created = vi.fn();
    if (type === 'export') launchers.openExport({ mitarbeiterList: [employee] });
    if (type === 'edit') launchers.openEmployeeEdit({ ...employee });
    if (type === 'contact') launchers.openContact({}, created);
    await flushPromises();
    const component = { export: ExportMitarbeiterModal, edit: EditMitarbeiterDialog, contact: KontaktAnlegenModal }[type];
    await vi.waitFor(() => expect(wrapper.findComponent(component).exists()).toBe(true));
    const instanceId = wrapper.getComponent(component).vm.$.uid;
    const record = manager.modals.value[0];
    if (type === 'export') await wrapper.get('[aria-label="Vorname entfernen"]').trigger('click');
    else await wrapper.getComponent(component).get('input').setValue('Unsaved');
    manager.minimize(record.id);
    await nextTick();
    await router.push('/other');
    await flushPromises();
    expect(manager.get(record.id).status).toBe('minimized');
    manager.restore(record.id);
    await nextTick();
    expect(wrapper.getComponent(component).vm.$.uid).toBe(instanceId);
    if (type === 'export') expect(wrapper.find('[aria-label="Vorname entfernen"]').exists()).toBe(false);
    else expect(wrapper.getComponent(component).get('input').element.value).toBe('Unsaved');
    if (type === 'contact') {
      wrapper.getComponent(component).vm.$emit('created', { id: 'contact' });
      await nextTick();
      expect(created).not.toHaveBeenCalled();
    } else manager.requestClose(record.id);
    expect(manager.get(record.id)).toBeUndefined();
  });

  it('saves an employee independently after closing the launching page', async () => {
    await render();
    launchers.openEmployeeEdit({ ...employee });
    await flushPromises();
    await router.push('/other');
    wrapper.getComponent(EditMitarbeiterDialog).vm.$emit('save', { ...employee, vorname: 'Updated' });
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/personal/mitarbeiter/employee-1', expect.objectContaining({ vorname: 'Updated' }));
    expect(mocks.cache.updateOneMitarbeiter).toHaveBeenCalledWith(expect.objectContaining({ vorname: 'Updated' }));
    expect(manager.modals.value).toHaveLength(0);
  });

  it('owns undocked lead state independently of the routed LeadsTab', async () => {
    await render(true);
    const page = wrapper.getComponent(LeadsTab);
    await page.get('input[aria-label="Organisation"]').setValue('Pending organisation');
    page.vm.handleSidebarAction('open-modal');
    await flushPromises();
    const record = manager.get('lead-lead-1');
    expect(record).toBeDefined();
    expect(record.icon).toBe('lead');
    const modal = wrapper.getComponent(LeadModal);
    const instanceId = modal.vm.$.uid;
    expect(modal.findAllComponents(ModalFrame).filter(frame => frame.props('modelValue'))).toHaveLength(1);
    expect(modal.getComponent(ModalFrame).props('minimizable')).toBe(true);
    manager.minimize(record.id);
    await nextTick();
    modal.getComponent(LeadsTab).vm.selectedLead.title = 'Renamed lead';
    await nextTick();
    expect(record.title).toBe('Renamed lead');
    expect(record.status).toBe('minimized');
    expect(record.icon).toBe('lead');
    await router.push('/other');
    await flushPromises();
    manager.restore(record.id);
    await nextTick();
    expect(wrapper.getComponent(LeadModal).vm.$.uid).toBe(instanceId);
    expect(wrapper.getComponent(LeadModal).get('input[aria-label="Organisation"]').element.value).toBe('Pending organisation');
    expect(record.props.canDock()).toBe(false);
    manager.requestClose(record.id);
    expect(manager.get(record.id)).toBeUndefined();
  });

  it('returns an undocked lead draft to the still-mounted side panel', async () => {
    await render(true);
    const page = wrapper.getComponent(LeadsTab);
    await page.get('input[aria-label="Organisation"]').setValue('Pending organisation');
    page.vm.handleSidebarAction('open-modal');
    await flushPromises();
    const modal = wrapper.getComponent(LeadModal);
    await modal.get('input[aria-label="Organisation"]').setValue('Updated draft');
    modal.getComponent(LeadsTab).vm.handleSidebarAction('open-panel');
    await nextTick();
    expect(manager.get('lead-lead-1')).toBeUndefined();
    expect(page.get('input[aria-label="Organisation"]').element.value).toBe('Updated draft');
  });
});
