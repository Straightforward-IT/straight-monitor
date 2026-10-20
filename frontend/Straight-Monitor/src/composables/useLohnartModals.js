import { defineAsyncComponent } from 'vue';
import { useDockedModals } from '@bleck-it/vue-modal-dock';

const LohnartModal = defineAsyncComponent(() => import('@/components/Modals/LohnartModal.vue'));

function identify(lohnart) {
  const record = lohnart && typeof lohnart === 'object' ? lohnart : null;
  const value = String(lohnart ?? '').trim();
  const number = String(record?.lohnartNummer ?? (!record && /^\d{1,12}$/.test(value) ? value : '')).trim();
  const id = String(record?._id ?? record?.id ?? (!record && !number ? value : '')).trim();
  if (!id && !number) throw new Error('Eine Lohnart benötigt eine Lohnartnummer oder Datensatz-ID.');
  return { id, number, record };
}

/** Open by number (100 / '100'), MongoDB ID, or a Lohnart master record. */
export function useLohnartModals() {
  const dockedModals = useDockedModals();

  function openLohnart(lohnart, { initialTab = 'calculation' } = {}) {
    const { id: lohnartId, number, record } = identify(lohnart);
    const id = number ? `lohnart-nummer-${number}` : `lohnart-id-${lohnartId}`;
    const existing = dockedModals.get(id) || dockedModals.modals.value.find(modal => modal.component === LohnartModal && lohnartId && modal.props?.lohnartId === lohnartId);
    if (existing) { dockedModals.restore(existing.id); return existing; }
    const title = number ? `Lohnart ${number}${record?.lohnartBezeichnung ? ` · ${record.lohnartBezeichnung}` : ''}` : 'Lohnartdetails';
    return dockedModals.open({
      id, title, component: LohnartModal, icon: 'document',
      props: {
        modelValue: true, lohnartId, lohnartNummer: number, selectedRecord: record, initialTab,
        minimizable: true, minimizeId: id,
        onTitleChange: value => dockedModals.updateTitle(id, value),
        'onUpdate:modelValue': open => { if (!open) dockedModals.remove(id); },
      },
    });
  }

  return { openLohnart };
}
