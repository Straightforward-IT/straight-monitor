import { useDockedModals } from '@bleck-it/vue-modal-dock';
import ReisekostenModal from '@/components/Modals/ReisekostenModal.vue';

function modalIdentity({ docId, auftragNr }) {
  if (docId) return `reisekosten-${docId}`;
  if (auftragNr !== undefined && auftragNr !== null && String(auftragNr).trim()) {
    return `reisekosten-new-${auftragNr}`;
  }
  throw new Error('Eine Reisekostenabrechnung benötigt eine Dokument- oder Auftrags-ID.');
}

export function useReisekostenModals() {
  const dockedModals = useDockedModals();

  function openReisekosten({ auftragNr, docId = null, einsaetze = [], onSaved } = {}) {
    const id = modalIdentity({ docId, auftragNr });
    const title = auftragNr != null
      ? `Reisekosten · Auftrag ${auftragNr}`
      : 'Reisekostenabrechnung';

    return dockedModals.open({
      id,
      title,
      component: ReisekostenModal,
      props: {
        modelValue: true,
        auftragNr,
        docId,
        einsaetze,
        minimizeId: id,
        minimizeTitle: title,
        'onUpdate:modelValue': (open) => {
          if (!open) dockedModals.remove(id);
        },
        onSaved,
      },
    });
  }

  function closeReisekosten(options) {
    return dockedModals.remove(modalIdentity(options));
  }

  return { dockedModals, openReisekosten, closeReisekosten };
}
