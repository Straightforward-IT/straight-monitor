<template>
  <section
    class="order-documents"
    aria-label="Dokumente zum Auftrag"
  >
    <header>
      <div><strong>{{ title }}</strong><span v-if="auftragNr">#{{ auftragNr }} · {{ documents.length }} Dokumente</span></div>
      <button
        type="button"
        :disabled="loading || !auftragNr"
        @click="load"
      >
        Aktualisieren
      </button>
    </header>
    <p v-if="!auftragNr">
      Eine Schicht auswählen, um ihre Auftragsdokumente zu sehen.
    </p>
    <p
      v-else-if="loading"
      role="status"
    >
      Dokumente werden geladen …
    </p>
    <p
      v-else-if="error"
      class="order-documents__error"
      role="alert"
    >
      {{ error }}
    </p>
    <p v-else-if="!documents.length">
      Für diesen Auftrag sind noch keine Dokumente verknüpft.
    </p>
    <ul v-else>
      <li
        v-for="document in documents"
        :key="document.id"
      >
        <button
          type="button"
          class="order-documents__item"
          :disabled="document.available === false"
          :title="document.available === false ? 'Die Datei ist noch nicht hinterlegt' : 'Im DocumentPreviewModal öffnen'"
          @click="open(document)"
        >
          <FontAwesomeIcon :icon="document.category === 'EventReport' ? faClipboardList : faFileLines" />
          <span><strong>{{ document.title }}</strong><small :class="{ 'order-documents__completed': document.completed }">{{ document.status }} · {{ dateText(document.date) }}</small></span>
          <FontAwesomeIcon
            :icon="faArrowUpRightFromSquare"
            class="order-documents__open"
          />
        </button>
      </li>
    </ul>
  </section>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowUpRightFromSquare, faClipboardList, faFileLines } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useDocumentPreviewModals } from '@/composables/useDocumentPreviewModals';
const props = defineProps({ auftragNr: { type: [Number, String], default: null }, items: { type: Array, default: null }, title: { type: String, default: 'Auftragsdokumente' } });
const { openDocumentPreview } = useDocumentPreviewModals();
const documents = ref([]), loading = ref(false), error = ref('');
let request = 0, controller;
const dateText = date => date ? new Date(date).toLocaleDateString('de-DE') : 'Datum offen';
async function load() {
  const current = ++request;
  controller?.abort(); controller = new AbortController();
  documents.value = []; error.value = ''; loading.value = false;
  if (!props.auftragNr) return;
  if (props.items) { documents.value = props.items; return; }
  loading.value = true;
  try {
    const { data } = await api.get(`/api/working-times/orders/${props.auftragNr}/documents`, { signal: controller.signal });
    if (current === request) documents.value = data.documents;
  } catch (failure) {
    if (current === request && failure.code !== 'ERR_CANCELED') error.value = failure?.response?.data?.message || 'Dokumente konnten nicht geladen werden.';
  } finally { if (current === request) loading.value = false; }
}
function open(document) {
  if (document.previewSource) { openDocumentPreview(document.previewSource); return; }
  // Capture the order now: changing the selected shift must not retarget an open preview.
  const order = props.auftragNr;
  const url = `/api/working-times/orders/${order}/documents/${document.kind}/${document.recordId}/preview`;
  const source = { id: `order-${order}-${document.id}`, filename: document.filename || `${document.title}.pdf`, mimeType: document.mimeType || 'application/pdf' };
  if (document.preview === 'pdf') {
    source.loadBlob = async ({ signal }) => {
      try { return (await api.get(url, { signal, responseType: 'blob' })).data; }
      catch (failure) {
        if (failure.response?.data instanceof Blob) {
          try { const body = JSON.parse(await failure.response.data.text()); throw new Error(body.message); }
          catch (parsed) { if (parsed instanceof SyntaxError) throw failure; throw parsed; }
        }
        throw failure;
      }
    };
  } else {
    source.resolveUrl = async ({ signal, download }) => (await api.get(url, { signal, params: { attachmentId: document.attachmentId, download: !!download } })).data.url;
  }
  openDocumentPreview(source);
}
watch(() => [props.auftragNr, props.items], load, { immediate: true });
onBeforeUnmount(() => { request++; controller?.abort(); });
</script>
<style scoped>
.order-documents { min-width: 0; color: var(--text); background: var(--surface); border-block: 1px solid var(--border); padding: 10px 16px; font-size: 12px; }
.order-documents header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.order-documents header > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; }
.order-documents header span, .order-documents p { color: var(--muted); font-size: 11px; }
.order-documents p { margin: 4px 0; }
.order-documents button { color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font: inherit; }
.order-documents header button { padding: 5px 8px; font-size: 10px; }
.order-documents ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 8px; overflow: auto; max-height: 116px; }
.order-documents li { display: flex; flex: 0 0 285px; min-width: 0; }
.order-documents__item { display: flex; align-items: center; gap: 10px; padding: 10px; text-align: left; width: 100%; }
.order-documents__item > svg { color: var(--primary); flex-shrink: 0; font-size: 16px; }
.order-documents__item > span { display: flex; flex: 1; flex-direction: column; gap: 5px; min-width: 0; }
.order-documents__item strong { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-documents__item small { color: var(--muted); font-size: 10px; }
.order-documents__item .order-documents__open { font-size: 10px; color: var(--muted); }
.order-documents__item .order-documents__completed { color: #42896c; }
.order-documents .order-documents__error { color: #c75048; }
.order-documents button:hover:not(:disabled) { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 7%, var(--surface)); }
.order-documents button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.order-documents button:disabled { opacity: .6; cursor: default; }
</style>
