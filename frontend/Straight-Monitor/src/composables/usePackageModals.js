import { useDockedModals } from '@bleck-it/vue-modal-dock';
import PaketVorlageModal from '@/components/Modals/PaketVorlageModal.vue';
import PaketVorlageEditorModal from '@/components/Modals/PaketVorlageEditorModal.vue';

function templateIdentity(template) {
  return template?._id ?? template?.id;
}

export function usePackageModals() {
  const dockedModals = useDockedModals();

  function openPackage(template, { onBooked } = {}) {
    const identity = templateIdentity(template);
    if (!identity) throw new Error('Eine Paketvorlage benötigt eine ID.');

    const id = `inventory-package-${identity}`;
    const title = String(template?.name || 'Paket');

    return dockedModals.open({
      id,
      title,
      component: PaketVorlageModal,
      props: {
        modelValue: template,
        minimizeId: id,
        minimizeTitle: title,
        'onUpdate:modelValue': (value) => {
          if (!value) dockedModals.remove(id);
        },
        onBooked,
      },
    });
  }

  function openPackageEditor(template = null, { onCreated, onUpdated } = {}) {
    const identity = templateIdentity(template);
    const id = identity
      ? `inventory-package-template-${identity}`
      : 'inventory-package-template-new';
    const title = identity
      ? `Vorlage · ${template.name || 'Paket'}`
      : 'Neue Paketvorlage';

    return dockedModals.open({
      id,
      title,
      component: PaketVorlageEditorModal,
      props: {
        modelValue: true,
        template,
        minimizeId: id,
        minimizeTitle: title,
        'onUpdate:modelValue': (open) => {
          if (!open) dockedModals.remove(id);
        },
        onCreated,
        onUpdated,
      },
    });
  }

  return { openPackage, openPackageEditor };
}
