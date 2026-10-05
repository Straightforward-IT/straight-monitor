import { defineAsyncComponent, onBeforeUnmount } from 'vue';
import { useDockedModals } from '@bleck-it/vue-modal-dock';

const ExportModal = defineAsyncComponent(() => import('@/components/ExportMitarbeiterModal.vue'));
const EmployeeEdit = defineAsyncComponent(() => import('@/components/Modals/HostedEmployeeEdit.vue'));
const ContactModal = defineAsyncComponent(() => import('@/components/Modals/KontaktAnlegenModal.vue'));
let exportId = 0;

export function useAdditionalModals() {
  const manager = useDockedModals();
  let ownerAlive = true;
  onBeforeUnmount(() => { ownerAlive = false; });

  function openExport(props) {
    const id = `employee-export-${++exportId}`;
    return manager.open({ id, title: props.filename || 'Excel-Liste', component: ExportModal,
      props: { ...props, onClose: () => manager.remove(id) } });
  }

  function openEmployeeEdit(mitarbeiter, nationalitaeten = []) {
    const id = `edit-mitarbeiter-${mitarbeiter._id}`;
    if (manager.get(id)) return manager.restore(id);
    return manager.open({ id, title: `${mitarbeiter.vorname || ''} ${mitarbeiter.nachname || ''} bearbeiten`.trim(),
      component: EmployeeEdit, props: { mitarbeiter, nationalitaeten } });
  }

  function openContact(props = {}, onCreated) {
    const id = `contact-new-${props.prefilledCompanyName || props.prefilledTeam || 'default'}`;
    if (manager.get(id)) return manager.restore(id);
    return manager.open({ id, title: 'Kontakt anlegen', component: ContactModal,
      props: { ...props,
        onClose: () => manager.remove(id),
        onCreated: contact => {
          manager.remove(id);
          if (ownerAlive) onCreated?.(contact);
        },
      } });
  }

  return { openExport, openEmployeeEdit, openContact };
}