import { useDockedModals } from '@bleck-it/vue-modal-dock';
import TimeCaptureModal from '@/components/Modals/TimeCaptureModal.vue';

export function useTimeCaptureModals() {
  const dock = useDockedModals();
  function openTimeCapture({ auftragNr = null, employeeId = null, employeeName = '', preselectFirstOrder = true } = {}) {
    const id = auftragNr ? `time-capture-order-${auftragNr}` : `time-capture-employee-${employeeId}`;
    return dock.open({
      id, title: 'Stundenschnellerfassung', component: TimeCaptureModal,
      icon: 'time-capture',
      props: { modelValue: true, auftragNr, employeeId, employeeName, preselectFirstOrder, minimizeId: id,
        'onUpdate:modelValue': open => { if (!open) dock.remove(id); } },
    });
  }
  return { openTimeCapture };
}
