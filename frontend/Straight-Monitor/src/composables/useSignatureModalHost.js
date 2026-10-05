import { watch } from 'vue';
import { useDockedModals } from '@bleck-it/vue-modal-dock';
import { useSignaturModal } from '@/stores/signaturModal';
import SignaturNeuModal from '@/components/Modals/SignaturNeuModal.vue';

export function useSignatureModalHost() {
  const manager = useDockedModals();
  const store = useSignaturModal();
  watch(() => [store.open, store.requestVersion], ([open]) => {
    if (!open) {
      manager.remove('signature-new');
      return;
    }
    manager.open({
      id: 'signature-new',
      title: store.context.name || (store.context.draftId ? 'Entwurf bearbeiten' : 'Neue Signatur'),
      component: SignaturNeuModal,
      icon: 'signature',
      onRemove: () => store.closeModal(),
    });
  }, { immediate: true, flush: 'sync' });
}