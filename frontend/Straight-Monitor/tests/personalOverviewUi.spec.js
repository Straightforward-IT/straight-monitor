import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MitarbeiterTab from '../src/components/MitarbeiterTab.vue';
import ExportMitarbeiterModal from '../src/components/ExportMitarbeiterModal.vue';

vi.mock('@/stores/flipAll', () => ({ useFlipAll: () => ({}) }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => ({
  berufe: [], qualifikationen: [], linkedUserIds: new Set(), populateMitarbeiterSkills: employee => employee,
}) }));
vi.mock('@/utils/mitarbeiterName', () => ({ useMitarbeiterNameFormatter: () => ({ formatName: employee => `${employee.vorname} ${employee.nachname}` }) }));

const Subject = {
  ...MitarbeiterTab,
  mounted() {},
  computed: {
    ...MitarbeiterTab.computed,
    filteredMitarbeitersSorted() { return this.mitarbeiters; },
  },
};

describe('personal overview shared selection actions', () => {
  it('selects the filtered employees, opens their export and clears the selection', async () => {
    const wrapper = mount(Subject, {
      global: { stubs: {
        Toolbar: { template: '<div><slot name="filter"/><slot/><slot name="bottom-actions"/></div>' },
        ToolbarFilter: true,
        MitarbeiterSearch: true,
        ToolbarPageControls: true,
        EmployeeCard: true,
        EmployeeCardModal: true,
        ExportMitarbeiterModal: true,
        ImageCropModal: true,
        'font-awesome-icon': true,
      } },
    });
    wrapper.vm.mitarbeiters = [
      { _id: 'employee-1', vorname: 'Jane', nachname: 'Doe' },
      { _id: 'employee-2', vorname: 'John', nachname: 'Doe' },
    ];
    wrapper.vm.loading.mitarbeiter = false;
    wrapper.vm.selectedMitarbeiterIds = new Set(['employee-1']);
    await wrapper.vm.$nextTick();

    const selectAll = wrapper.findAll('button').find(button => button.text().includes('Alle 2 auswählen'));
    expect(selectAll.classes()).toContain('app-button');
    await selectAll.trigger('click');
    expect(wrapper.vm.selectedMitarbeiterIds.size).toBe(2);
    await wrapper.findAll('button').find(button => button.text().includes('Exportieren')).trigger('click');
    expect(wrapper.getComponent(ExportMitarbeiterModal).props('mitarbeiterList')).toHaveLength(2);
    const selectionButton = wrapper.get('button.selection-count');
    expect(selectionButton.attributes('aria-label')).toBe('2 Mitarbeiter ausgewählt, Auswahl aufheben');
    expect(selectionButton.text()).toContain('2 ausgewählt');
    expect(selectionButton.find('font-awesome-icon-stub').attributes('icon')).toBe('fa-solid fa-times');
    await selectionButton.trigger('click');
    expect(wrapper.find('.selection-info').exists()).toBe(false);
    wrapper.unmount();
  });
});
