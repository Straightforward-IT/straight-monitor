import { useDockedModals } from '@bleck-it/vue-modal-dock';
import TimeCaptureModal from '@/components/Modals/TimeCaptureModal.vue';

export function useTimeCaptureModals() {
  const dock = useDockedModals();
  function openTimeCapture({ auftragNr = null, employeeId = null } = {}) {
    const id = auftragNr ? `time-capture-order-${auftragNr}` : `time-capture-employee-${employeeId}`;
    return dock.open({
      id, title: 'Stundenschnellerfassung', component: TimeCaptureModal,
      props: { modelValue: true, auftragNr, employeeId, minimizeId: id,
        'onUpdate:modelValue': open => { if (!open) dock.remove(id); } },
    });
  }
  return { openTimeCapture };
}
