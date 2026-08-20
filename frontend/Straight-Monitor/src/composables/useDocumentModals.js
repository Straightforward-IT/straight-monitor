import { useDockedModals } from '@bleck-it/vue-modal-dock';
import DocumentCard from '@/components/Modals/DocumentCard.vue';
import { getDocumentModalTitle } from '@/utils/documentModalTitle';

function documentIdentity(document) {
  return document?._id ?? document?.id ?? document?.details?._id;
}

export function getDocumentModalId(document) {
  const identity = documentIdentity(document);
  if (identity === undefined || identity === null || String(identity).trim() === '') {
    throw new Error('Ein Dokument benötigt _id, id oder details._id.');
  }
  return `document-${String(identity)}`;
}

/**
 * Opens every report through the app-level dock host, independent of the page
 * that initiated it. The same document ID restores its existing instance;
 * different document IDs can remain open or minimized simultaneously.
 */
export function useDocumentModals() {
  const dockedModals = useDockedModals();

  function openDocument(document, options = {}) {
    const id = getDocumentModalId(document);
    const title = getDocumentModalTitle(document, options.eventTitle);

    return dockedModals.open({
      id,
      title,
      component: DocumentCard,
      props: {
        doc: document,
        filteredTeamleiter: options.filteredTeamleiter ?? null,
        filteredMitarbeiter: options.filteredMitarbeiter ?? null,
        minimizable: true,
        minimizeId: id,
        minimizeTitle: title,
        closeOnEscape: false,
        onClose: () => dockedModals.remove(id),
      },
    });
  }

  function closeDocument(documentOrId) {
    const id = typeof documentOrId === 'string'
      ? documentOrId
      : getDocumentModalId(documentOrId);
    return dockedModals.remove(id);
  }

  return { dockedModals, openDocument, closeDocument };
}
