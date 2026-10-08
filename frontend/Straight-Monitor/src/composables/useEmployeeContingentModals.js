import { useDockedModals } from '@bleck-it/vue-modal-dock';
import HoverDataCardModal from '@/components/Modals/HoverDataCardModal.vue';

export function useEmployeeContingentModals() {
  const dockedModals = useDockedModals();

  function openEmployeeContingent(employee, { year, month }, data) {
    const id = `employee-contingent-${employee._id}-${year}-${month}`;
    const name = data.employeeName || [employee.vorname, employee.nachname].filter(Boolean).join(' ');
    const title = `Kontingent · ${name}`;
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return dockedModals.open({
      id,
      title: `${title} · ${monthLabel}`,
      component: HoverDataCardModal,
      icon: 'employee',
      props: {
        modelValue: true,
        minimizable: true,
        title,
        subtitle: monthLabel,
        data,
        'onUpdate:modelValue': open => { if (!open) dockedModals.remove(id); },
      },
    });
  }

  return { openEmployeeContingent };
}
