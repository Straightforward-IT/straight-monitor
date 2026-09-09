<template>
  <ModalFrame
    :model-value="modelValue"
    :title="displayName"
    :subtitle="`${format.label} · Dokumentvorschau`"
    size="full"
    layer="elevated"
    :minimizable="minimizable"
    :minimize-id="minimizeId"
    :minimize-title="displayName"
    :close-on-escape="!menuOpen"
    class="document-preview-modal"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <template #actions>
      <button
        ref="menuButton"
        type="button"
        class="document-preview-menu-button"
        aria-label="Dokumentaktionen"
        title="Dokumentaktionen"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <FontAwesomeIcon :icon="faEllipsisVertical" />
      </button>
    </template>

    <div v-if="actionError" class="document-preview-notice document-preview-notice--error" role="alert">{{ actionError }}</div>
    <div v-if="actionStatus" class="document-preview-notice" role="status">{{ actionStatus }}</div>
    <div v-if="notice" class="document-preview-notice" role="status">{{ notice }}</div>

    <div v-if="loading" class="document-preview-state" role="status">
      <FontAwesomeIcon :icon="faSpinner" spin />
      <p>Dokument wird geladen…</p>
    </div>
    <div v-else-if="error" class="document-preview-state" role="alert">
      <FontAwesomeIcon :icon="faFileCircleExclamation" />
      <p>{{ error }}</p>
      <button type="button" @click="retry++">Erneut versuchen</button>
    </div>
    <div v-else-if="format.kind === 'unsupported'" class="document-preview-state">
      <FontAwesomeIcon :icon="faFileCircleExclamation" />
      <h4>Keine Vorschau für dieses Dateiformat</h4>
      <p>Du kannst das Dokument herunterladen oder in einem neuen Tab öffnen.</p>
      <div class="document-preview-fallback-actions">
        <button type="button" :disabled="busy" @click="handleAction('download')">Herunterladen</button>
        <button type="button" :disabled="!canOpenTab" @click="handleAction('tab')">In neuem Tab öffnen</button>
      </div>
    </div>
    <PdfDocumentPreview
      v-else-if="format.kind === 'pdf' && blob"
      :blob="blob"
      @ready="renderReady = true"
      @error="previewFailed"
    />
    <iframe
      v-else-if="format.kind === 'pdf'"
      :key="previewUrl"
      :src="previewUrl"
      :title="`PDF-Vorschau: ${displayName}`"
      class="document-preview-pdf"
      referrerpolicy="no-referrer"
      @error="previewFailed"
    />
    <div v-else-if="format.kind === 'image'" ref="printContent" class="document-preview-image">
      <img :key="previewUrl" :src="previewUrl" :alt="displayName" referrerpolicy="no-referrer" @load="renderReady = true" @error="previewFailed" />
    </div>
    <div v-else-if="format.kind === 'video' || format.kind === 'audio'" class="document-preview-media">
      <video v-if="format.kind === 'video'" :key="previewUrl" :src="previewUrl" controls playsinline preload="metadata" @error="previewFailed" />
      <audio v-else :key="previewUrl" :src="previewUrl" controls preload="metadata" @error="previewFailed" />
    </div>
    <div v-else-if="format.kind === 'text'" ref="printContent" class="document-preview-text"><pre>{{ textContent }}</pre></div>
    <div v-else-if="format.kind === 'spreadsheet'" class="document-preview-workbook">
      <div class="document-preview-sheet-tabs" role="tablist" aria-label="Arbeitsblätter">
        <button
          v-for="(sheet, index) in sheets"
          :key="sheet.name"
          type="button"
          role="tab"
          :aria-selected="sheetIndex === index"
          @click="sheetIndex = index"
        >{{ sheet.name }}</button>
      </div>
      <p v-if="currentSheet?.truncated" class="document-preview-notice">Vorschau und Druck auf 500 Zeilen und 100 Spalten begrenzt. Der Download enthält die vollständige Datei.</p>
      <div ref="printContent" class="document-preview-table-scroll">
        <table v-if="currentSheet?.rows.length" class="document-preview-table">
          <caption>{{ currentSheet.name }}</caption>
          <tbody>
            <tr v-for="(row, rowIndex) in currentSheet.rows" :key="rowIndex">
              <th scope="row">{{ rowIndex + 1 }}</th>
              <td v-for="(cell, columnIndex) in row" :key="columnIndex">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="document-preview-empty-sheet">Dieses Arbeitsblatt ist leer.</p>
      </div>
    </div>

    <!-- Keep the menu in the frame's stacking context, including nested modals. -->
    <ContextMenu
      v-if="menuOpen"
      :x="0"
      :y="0"
      :anchor="menuButton"
      follow-anchor
      focus-on-open
      :width="240"
      :options="menuOptions"
      @close="closeMenu"
      @select="handleAction"
    />
  </ModalFrame>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faDownload, faEllipsisVertical, faFileCircleExclamation, faArrowUpRightFromSquare, faPrint, faSpinner } from '@fortawesome/free-solid-svg-icons';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import { exportElementToPdf } from '@/utils/htmlToPdfService';
import {
  documentFilename, documentFormat, fetchDocumentBlob, validateDocumentUrl, triggerDocumentDownload,
  worksheetPreview, MAX_TEXT_BYTES, MAX_WORKBOOK_BYTES, MAX_SHEET_ROWS,
} from '@/utils/documentPreview';

library.add(faDownload, faPrint, faArrowUpRightFromSquare);
const PdfDocumentPreview = defineAsyncComponent(() => import('@/components/ui-elements/PdfDocumentPreview.vue'));

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  /** A signed R2Service URL. */
  url: { type: String, default: '' },
  filename: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  /** ({ download, signal }) => a fresh signed R2Service URL. */
  resolveUrl: { type: Function, default: undefined },
  /** ({ signal }) => Blob, for existing authenticated download endpoints. */
  loadBlob: { type: Function, default: undefined },
  minimizable: { type: Boolean, default: false },
  minimizeId: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'close']);
const menuButton = ref(null);
const menuOpen = ref(false);
const printContent = ref(null);
const loading = ref(true);
const error = ref('');
const notice = ref('');
const actionError = ref('');
const actionStatus = ref('');
const busy = ref(false);
const renderReady = ref(false);
const sourceUrl = ref('');
const previewUrl = ref('');
const blob = shallowRef(null);
const format = ref(documentFormat(props.filename, props.mimeType));
const displayName = computed(() => props.filename || documentFilename(sourceUrl.value || props.url));
const textContent = ref('');
const sheets = shallowRef([]);
const sheetIndex = ref(0);
const currentSheet = computed(() => sheets.value[sheetIndex.value]);
const retry = ref(0);
let actionController;

const canOpenTab = computed(() => Boolean(sourceUrl.value || blob.value));
const canPrint = computed(() => !loading.value && !error.value && (
  (format.value.kind === 'pdf' && blob.value && renderReady.value)
  || (['image', 'text', 'spreadsheet'].includes(format.value.kind) && renderReady.value)
));
const menuOptions = computed(() => [
  { label: 'Herunterladen', action: 'download', icon: 'fa-solid fa-download', disabled: busy.value || (!blob.value && !sourceUrl.value && !props.resolveUrl) },
  { label: format.value.kind === 'spreadsheet' ? 'Arbeitsblatt drucken' : 'Drucken', action: 'print', icon: 'fa-solid fa-print', disabled: busy.value || !canPrint.value },
  { label: 'In neuem Tab öffnen', action: 'tab', icon: 'fa-solid fa-arrow-up-right-from-square', disabled: !canOpenTab.value },
]);

function closeMenu() {
  menuOpen.value = false;
  menuButton.value?.focus();
}

function previewFailed(message) {
  error.value = typeof message === 'string' ? message : 'Dieses Dokument konnte nicht dargestellt werden. Du kannst es über das Menü herunterladen oder in einem neuen Tab öffnen.';
  renderReady.value = false;
}

watch(
  () => [props.modelValue, props.url, props.resolveUrl, props.loadBlob, props.filename, props.mimeType, retry.value],
  async (_, __, onCleanup) => {
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl;
    onCleanup(() => {
      controller.abort();
      actionController?.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
    loading.value = true;
    error.value = notice.value = actionError.value = actionStatus.value = '';
    blob.value = null;
    sourceUrl.value = previewUrl.value = textContent.value = '';
    sheets.value = [];
    sheetIndex.value = 0;
    renderReady.value = menuOpen.value = false;
    format.value = documentFormat(props.filename || documentFilename(props.url), props.mimeType);
    if (!props.modelValue) return;

    try {
      if (props.resolveUrl || props.url) {
        const link = props.resolveUrl ? await props.resolveUrl({ download: false, signal }) : props.url;
        signal.throwIfAborted();
        if (!link) throw new Error('Kein Dokumentlink verfügbar.');
        sourceUrl.value = validateDocumentUrl(link);
        format.value = documentFormat(displayName.value, props.mimeType);
      }
      // Unknown files remain available through signed download/tab actions.
      if (format.value.kind === 'unsupported' && !props.loadBlob && sourceUrl.value) return;

      let content;
      try {
        content = props.loadBlob ? await props.loadBlob({ signal }) : await fetchDocumentBlob(sourceUrl.value, signal);
      } catch (requestError) {
        signal.throwIfAborted();
        // Native viewers can still display R2 files if the bucket disallows CORS reads.
        if (requestError instanceof TypeError && sourceUrl.value && ['pdf', 'image', 'audio', 'video'].includes(format.value.kind)) {
          previewUrl.value = sourceUrl.value;
          notice.value = format.value.kind === 'pdf'
            ? 'Direkte PDF-Vorschau. Zum Drucken die Druckfunktion innerhalb der PDF-Vorschau verwenden.'
            : 'Die Datei wird direkt aus der Ablage angezeigt.';
          return;
        }
        throw requestError;
      }
      signal.throwIfAborted();
      if (!(content instanceof Blob)) throw new Error('Die Dokumentquelle hat keine Datei zurückgegeben.');
      const contentType = content.type && content.type !== 'application/octet-stream' ? content.type : props.mimeType;
      format.value = documentFormat(displayName.value, contentType);
      content = content.slice(0, content.size, format.value.mime);
      blob.value = content;
      objectUrl = URL.createObjectURL(content);
      previewUrl.value = objectUrl;

      if (format.value.kind === 'text') {
        const text = await content.slice(0, MAX_TEXT_BYTES).text();
        signal.throwIfAborted();
        textContent.value = text;
        if (content.size > MAX_TEXT_BYTES) notice.value = 'Textvorschau und Druck sind auf 1 MB begrenzt. Der Download enthält die vollständige Datei.';
        renderReady.value = true;
      } else if (format.value.kind === 'spreadsheet') {
        if (content.size > MAX_WORKBOOK_BYTES) throw new Error('Diese Tabelle ist für die Vorschau zu groß (max. 25 MB). Bitte über das Menü herunterladen.');
        const [xlsx, buffer] = await Promise.all([import('xlsx'), content.arrayBuffer()]);
        signal.throwIfAborted();
        const workbook = xlsx.read(buffer, { type: 'array', sheetRows: MAX_SHEET_ROWS + 1, cellHTML: false, cellFormula: false });
        sheets.value = workbook.SheetNames.map(name => ({ name, ...worksheetPreview(workbook.Sheets[name], xlsx.utils) }));
        renderReady.value = true;
      }
    } catch (requestError) {
      if (!signal.aborted) error.value = requestError?.response?.data?.message || requestError.message || 'Dokument konnte nicht geladen werden.';
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  },
  { immediate: true },
);

async function handleAction(action) {
  actionError.value = '';
  if (action === 'tab') {
    if (!canOpenTab.value) return;
    // Separate URL lifetime: closing the modal must not invalidate a newly opened tab.
    // An SVG is safe in <img>, but executable when navigated to as a same-origin blob.
    const tabBlob = blob.value?.type === 'image/svg+xml' ? blob.value.slice(0, blob.value.size, 'text/plain') : blob.value;
    const tabUrl = tabBlob ? URL.createObjectURL(tabBlob) : sourceUrl.value;
    window.open(validateDocumentUrl(tabUrl), '_blank', 'noopener,noreferrer');
    if (tabBlob) setTimeout(() => URL.revokeObjectURL(tabUrl), 60_000);
    return;
  }
  if (busy.value || (action === 'print' && !canPrint.value)) return;
  busy.value = true;
  actionController = new AbortController();
  const { signal } = actionController;
  try {
    if (action === 'download') {
      if (blob.value) {
        const downloadUrl = URL.createObjectURL(blob.value);
        triggerDocumentDownload(downloadUrl, displayName.value);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      } else {
        const link = props.resolveUrl ? await props.resolveUrl({ download: true, signal }) : sourceUrl.value;
        signal.throwIfAborted();
        triggerDocumentDownload(link, displayName.value);
      }
    } else if (action === 'print') {
      if (format.value.kind === 'pdf') {
        actionStatus.value = 'Druck wird vorbereitet…';
        const { printPdfDocument } = await import('@/utils/printPdfDocument');
        signal.throwIfAborted();
        await printPdfDocument(blob.value, { title: displayName.value, signal, onProgress: message => { actionStatus.value = message; } });
      } else {
        await exportElementToPdf(printContent.value, {
          title: displayName.value,
          extraCss: '.document-preview-image img { max-width: 100%; max-height: 270mm; object-fit: contain; } .document-preview-text pre { white-space: pre-wrap; overflow-wrap: anywhere; color: #111; } .document-preview-table { font-size: 10px; color: #111; } .document-preview-table td, .document-preview-table th { border: 1px solid #ccc; padding: 4px; }',
        });
      }
    }
  } catch (requestError) {
    if (!signal.aborted) actionError.value = requestError?.response?.data?.message || requestError.message || 'Die Dokumentaktion ist fehlgeschlagen.';
  } finally {
    busy.value = false;
    actionStatus.value = '';
  }
}

onDeactivated(() => {
  menuOpen.value = false;
  actionController?.abort();
});
onBeforeUnmount(() => actionController?.abort());
</script>

<style scoped lang="scss">
:global(.document-preview-modal) {
  --mf-body-padding: 0;
  --mf-max-width: min(1440px, 96vw);
  --mf-max-height: 92dvh;
}
:global(.document-preview-modal .mf-title) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.document-preview-menu-button {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  color: var(--muted);
  cursor: pointer;
  &:hover, &:focus-visible { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
}
.document-preview-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 20px;
  text-align: center;
  color: var(--muted);
  > svg { font-size: 2rem; }
  p, h4 { margin: 0; }
}
.document-preview-fallback-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.document-preview-notice { flex-shrink: 0; margin: 0; padding: 10px 16px; font-size: 0.85rem; background: var(--tile-bg); border-bottom: 1px solid var(--border); }
.document-preview-notice--error { color: var(--danger, #c0392b); }
.document-preview-pdf { flex: 1; width: 100%; min-height: 0; border: 0; background: #525659; }
.document-preview-image, .document-preview-media {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 20px;
  background: color-mix(in srgb, var(--text) 6%, var(--tile-bg));
  img, video { max-width: 100%; max-height: 100%; object-fit: contain; }
  audio { width: min(600px, 100%); }
}
.document-preview-text { flex: 1; padding: 20px; overflow: auto; background: var(--tile-bg); }
.document-preview-text pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 0.9rem/1.6 ui-monospace, monospace; }
.document-preview-workbook { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.document-preview-sheet-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  overflow-x: auto;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  button { white-space: nowrap; }
  button[aria-selected="true"] { color: var(--primary); border-color: var(--primary); }
}
.document-preview-table-scroll { flex: 1; min-height: 0; overflow: auto; }
.document-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  caption { padding: 10px; text-align: left; font-weight: 600; }
  th, td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; min-width: 48px; }
  th { width: 44px; color: var(--muted); background: var(--tile-bg); }
}
.document-preview-empty-sheet { padding: 20px; color: var(--muted); }
@media (max-width: 600px) {
  :global(.document-preview-modal) { --mf-header-padding: 12px; --mf-overlay-padding: 8px; }
  .document-preview-image, .document-preview-media, .document-preview-text { padding: 12px; }
}
</style>
