import { defineAsyncComponent } from 'vue';
import { useDockedModals } from '@bleck-it/vue-modal-dock';

const AuftragModal = defineAsyncComponent(() => import('@/components/Modals/AuftragModal.vue'));

/** Open the shared order details, independently of the calendar or list route. */
export function useAuftragModals() {
  const dockedModals = useDockedModals();

  function openAuftrag(auftrag) {
    const auftragNr = String(auftrag?.auftragNr ?? auftrag ?? '').trim();
    if (!/^\d+$/.test(auftragNr)) throw new Error('Ein Auftragsfenster benötigt eine Auftragsnummer.');
    const id = `auftrag-details-${auftragNr}`;
    const existing = dockedModals.get(id);
    if (existing) { dockedModals.restore(id); return existing; }
    const title = auftrag.eventTitel ? `${auftrag.eventTitel} · #${auftragNr}` : `Auftrag #${auftragNr}`;
    return dockedModals.open({
      id, title, component: AuftragModal, icon: 'event',
      props: {
        modelValue: true, auftragNr, minimizable: true, minimizeId: id,
        onOrderLoaded: order => dockedModals.updateTitle(id, `${order.eventTitel || 'Auftrag'} · #${order.auftragNr}`),
        'onUpdate:modelValue': open => { if (!open) dockedModals.remove(id); },
      },
    });
  }

  return { openAuftrag };
}
