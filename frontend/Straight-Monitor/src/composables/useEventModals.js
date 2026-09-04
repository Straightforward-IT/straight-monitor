import { useDockedModals } from '@bleck-it/vue-modal-dock';
import EventModal from '@/components/Modals/EventModal.vue';

function eventIdentity(event) {
  return event?.auftragNr;
}

export function getEventModalId(event) {
  const identity = eventIdentity(event);
  if (identity === undefined || identity === null || String(identity).trim() === '') {
    throw new Error('Ein Event benötigt eine auftragNr.');
  }
  return `event-${String(identity)}`;
}

export function useEventModals() {
  const dockedModals = useDockedModals();

  function openCreateEvent(options = {}) {
    const id = 'event-new';
    return dockedModals.open({
      id,
      title: options.initialPseudo ? 'Neuer Pseudo-Auftrag' : 'Neuer Auftrag',
      component: EventModal,
      props: {
        initialPseudo: Boolean(options.initialPseudo),
        initialLocationV2: options.initialLocationV2 || '',
        minimizable: true,
        minimizeId: id,
        minimizeTitle: options.initialPseudo ? 'Neuer Pseudo-Auftrag' : 'Neuer Auftrag',
        closeOnEscape: false,
        onUpdated: options.onUpdated,
        onClose: () => dockedModals.remove(id),
      },
    });
  }

  function openEvent(event, options = {}) {
    const id = getEventModalId(event);
    const title = String(event?.eventTitel || `Auftrag ${event.auftragNr}`);

    return dockedModals.open({
      id,
      title,
      component: EventModal,
      props: {
        auftragNr: event.auftragNr,
        minimizable: true,
        minimizeId: id,
        minimizeTitle: title,
        closeOnEscape: false,
        onUpdated: options.onUpdated,
        onClose: () => dockedModals.remove(id),
      },
    });
  }

  function closeEvent(eventOrId) {
    const id = typeof eventOrId === 'string' && eventOrId.startsWith('event-')
      ? eventOrId
      : getEventModalId(eventOrId);
    return dockedModals.remove(id);
  }

  return { dockedModals, openEvent, openCreateEvent, closeEvent };
}
