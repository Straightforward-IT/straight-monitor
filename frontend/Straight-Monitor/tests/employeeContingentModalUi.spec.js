import { afterEach, describe, expect, it } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { createModalDock, DockedModalHost, MinimizedModalDock, useDockedModals } from '@bleck-it/vue-modal-dock';
import { useEmployeeContingentModals } from '@/composables/useEmployeeContingentModals';
import HoverDataCardModal from '@/components/Modals/HoverDataCardModal.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';

const employee = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test' };
const october = { year: 2026, month: 10 };
const data = { employeeName: 'Ada Test', type: 'days-hours', title: 'KZF normal', workedDays: 5, dayLimit: 70,
  monthlyHours: 100, workedHours: 20, plannedHours: 10, hoursStatus: 'RESOLVED', eyebrow: 'Oktober 2026' };
let wrapper, manager, launcher;
let showLauncher;
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; });

async function render() {
  showLauncher = ref(true);
  const Launcher = defineComponent({ setup() { launcher = useEmployeeContingentModals(); return () => h('p', 'Dispo'); } });
  const Root = defineComponent({ setup() {
    manager = useDockedModals();
    return () => h('div', [showLauncher.value ? h(Launcher) : null, h(DockedModalHost), h(MinimizedModalDock)]);
  } });
  wrapper = mount(Root, { attachTo: document.body, global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } } });
  await flushPromises();
}

describe('employee contingent popout windows', () => {
  it('minimizes and restores the exact preview independently of the Dispo page, then removes it on close', async () => {
    await render();
    const record = launcher.openEmployeeContingent(employee, october, data);
    await flushPromises();
    const modal = wrapper.getComponent(HoverDataCardModal);
    const instanceId = modal.vm.$.uid;
    expect(modal.getComponent(HoverDataCard).props('data')).toEqual(data);
    expect(modal.getComponent(HoverDataCard).props('popout')).toBe(false);
    expect(modal.getComponent(HoverDataCard).props('inline')).toBe(true);
    await new DOMWrapper(document.body).get('button[aria-label^="Minimize Kontingent"]').trigger('click');
    expect(manager.get(record.id).status).toBe('minimized');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    showLauncher.value = false;
    await nextTick();
    await wrapper.get('button.vmd-dock__restore').trigger('click');
    await flushPromises();
    expect(manager.get(record.id).status).toBe('open');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(wrapper.getComponent(HoverDataCardModal).vm.$.uid).toBe(instanceId);
    expect(wrapper.getComponent(HoverDataCardModal).getComponent(HoverDataCard).props('data')).toEqual(data);
    await new DOMWrapper(document.body).get('button[aria-label="Schließen"]').trigger('click');
    expect(manager.get(record.id)).toBeUndefined();
  });

  it('reuses one window for the same employee and month while keeping different months distinct', async () => {
    await render();
    const first = launcher.openEmployeeContingent(employee, october, data);
    launcher.openEmployeeContingent(employee, october, { ...data, workedDays: 6 });
    await flushPromises();
    expect(manager.modals.value).toHaveLength(1);
    expect(manager.get(first.id).props.data.workedDays).toBe(6);
    launcher.openEmployeeContingent(employee, { year: 2026, month: 11 }, { ...data, eyebrow: 'November 2026' });
    await flushPromises();
    expect(manager.modals.value).toHaveLength(2);
    expect(manager.get(first.id).props.subtitle).toBe('Oktober 2026');
    expect(manager.modals.value[1].props.subtitle).toBe('November 2026');
  });
});
