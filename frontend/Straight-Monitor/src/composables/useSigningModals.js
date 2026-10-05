import { useDockedModals } from '@bleck-it/vue-modal-dock';
import DocuSealSigningModal from '@/components/Modals/DocuSealSigningModal.vue';

let sessionId = 0;

export function useSigningModals() {
  const manager = useDockedModals();
  function openSigning(session) {
    const id = `signing-session-${++sessionId}`;
    return manager.open({
      id,
      title: session.title || 'Dokument unterschreiben',
      component: DocuSealSigningModal,
      icon: 'signature',
      props: { ...session, onClose: () => manager.remove(id) },
    });
  }
  return { openSigning };
}