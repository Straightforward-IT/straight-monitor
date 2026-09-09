import { defineAsyncComponent } from 'vue';
import { useDockedModals } from '@bleck-it/vue-modal-dock';
import { documentFilename } from '@/utils/documentPreview';

const DocumentPreviewModal = defineAsyncComponent(() => import('@/components/Modals/DocumentPreviewModal.vue'));
let previewId = 0;

/**
 * Open a signed R2 link, a refreshable link, or a file from an authenticated API.
 * openDocumentPreview(r2Url, { filename: 'Vertrag.pdf' });
 * openDocumentPreview({ id: file.key, filename: file.name, resolveUrl });
 * resolveUrl({ download, signal }) should call an existing authorized API that
 * uses R2Service.getSignedDownloadUrl. Keep storage credentials on the server.
 */
export function useDocumentPreviewModals() {
  const dockedModals = useDockedModals();

  function openDocumentPreview(source, options = {}) {
    const document = typeof source === 'string' ? { url: source, ...options } : source;
    if (!document || (!document.url && !document.resolveUrl && !document.loadBlob)) {
      throw new Error('Die Dokumentvorschau benötigt einen Link oder eine Ladefunktion.');
    }
    const id = `document-preview-${document.id || document.url || ++previewId}`;
    const filename = document.filename || documentFilename(document.url);
    return dockedModals.open({
      id,
      title: filename,
      component: DocumentPreviewModal,
      props: {
        url: document.url,
        resolveUrl: document.resolveUrl,
        loadBlob: document.loadBlob,
        mimeType: document.mimeType,
        filename,
        modelValue: true,
        minimizable: true,
        minimizeId: id,
        'onUpdate:modelValue': open => { if (!open) dockedModals.remove(id); },
      },
    });
  }

  return { openDocumentPreview };
}
