<template>
  <div class="pdf-document-preview">
    <div class="pdf-preview-toolbar" aria-label="PDF-Navigation">
      <button type="button" :disabled="pageNumber <= 1 || !pdf" aria-label="Vorherige Seite" @click="pageNumber--">‹</button>
      <label>Seite <input :value="pageNumber" type="number" min="1" :max="pageCount" :disabled="!pdf" aria-label="Seite" @change="goToPage($event.target)" /></label>
      <span>von {{ pageCount || '…' }}</span>
      <button type="button" :disabled="pageNumber >= pageCount || !pdf" aria-label="Nächste Seite" @click="pageNumber++">›</button>
      <span class="pdf-preview-toolbar-spacer" />
      <button type="button" :disabled="zoom <= 0.5" aria-label="Verkleinern" @click="zoom = Math.max(0.5, zoom - 0.25)">−</button>
      <button type="button" aria-label="An Breite anpassen" @click="zoom = 1">{{ Math.round(zoom * 100) }} %</button>
      <button type="button" :disabled="zoom >= 3" aria-label="Vergrößern" @click="zoom = Math.min(3, zoom + 0.25)">+</button>
    </div>
    <div ref="viewportElement" class="pdf-preview-viewport" :aria-busy="rendering">
      <p v-if="rendering" class="pdf-preview-loading" role="status">PDF-Seite wird geladen…</p>
      <div ref="pageElement" class="pdf-preview-page" :style="{ visibility: rendering ? 'hidden' : 'visible' }" :aria-label="`Seite ${pageNumber}`" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const props = defineProps({ blob: { type: Blob, required: true } });
const emit = defineEmits(['ready', 'error']);
const pdf = shallowRef(null);
const pageNumber = ref(1);
const pageCount = computed(() => pdf.value?.numPages || 0);
const zoom = ref(1);
const availableWidth = ref(800);
const viewportElement = ref(null);
const pageElement = ref(null);
const rendering = ref(true);
let resizeObserver;

function goToPage(input) {
  pageNumber.value = Math.max(1, Math.min(pageCount.value, Number(input.value) || 1));
  input.value = pageNumber.value;
}

watch(() => props.blob, async (blob, _, onCleanup) => {
  let cancelled = false;
  let task;
  onCleanup(() => {
    cancelled = true;
    if (task) void task.destroy();
  });
  pdf.value = null;
  pageNumber.value = 1;
  zoom.value = 1;
  rendering.value = true;
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    if (cancelled) return;
    task = pdfjs.getDocument({ data, isEvalSupported: false });
    const document = await task.promise;
    if (!cancelled) pdf.value = document;
  } catch (error) {
    if (!cancelled) emit('error', error.name === 'PasswordException'
      ? 'Dieses PDF ist passwortgeschützt. Bitte herunterladen und mit einem PDF-Programm öffnen.'
      : 'Das PDF konnte nicht gelesen werden. Bitte erneut laden oder herunterladen.');
  }
}, { immediate: true });

watch([pdf, pageNumber, zoom, availableWidth], async ([document, number, factor, width], _, onCleanup) => {
  let cancelled = false;
  let renderTask;
  let textLayer;
  onCleanup(() => {
    cancelled = true;
    renderTask?.cancel();
    textLayer?.cancel();
  });
  if (!document || !pageElement.value) return;
  rendering.value = true;
  try {
    const page = await document.getPage(number);
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.1, width / base.width) * factor;
    const viewport = page.getViewport({ scale });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
    // Each render owns a separate canvas, so fast page/zoom changes cannot race.
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.setAttribute('aria-hidden', 'true');
    renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
    await renderTask.promise;
    if (cancelled) return;
    pageElement.value.style.width = `${viewport.width}px`;
    pageElement.value.style.height = `${viewport.height}px`;
    pageElement.value.replaceChildren(canvas);
    rendering.value = false;
    emit('ready');

    // Text extraction can stall on malformed PDFs; it must not block the visual preview.
    const layer = window.document.createElement('div');
    layer.className = 'pdf-preview-text-layer';
    layer.style.setProperty('--total-scale-factor', String(scale));
    textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
    await textLayer.render();
    if (cancelled) return;
    pageElement.value.appendChild(layer);
  } catch (error) {
    if (!cancelled && rendering.value) emit('error', 'Die PDF-Seite konnte nicht dargestellt werden. Bitte erneut laden oder herunterladen.');
  }
}, { flush: 'post' });

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width > 0) availableWidth.value = Math.max(100, entry.contentRect.width - 40);
  });
  resizeObserver.observe(viewportElement.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style scoped lang="scss">
.pdf-document-preview { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.pdf-preview-toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 0.85rem;
  button { min-width: 30px; padding: 4px 8px; }
  input { width: 58px; margin-left: 4px; padding: 4px; border: 1px solid var(--border); border-radius: 4px; background: var(--tile-bg); color: var(--text); }
  label { white-space: nowrap; }
}
.pdf-preview-toolbar-spacer { flex: 1; }
.pdf-preview-viewport { position: relative; flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; background: #525659; }
.pdf-preview-loading { position: absolute; inset: 0 0 auto; padding: 28px; text-align: center; color: #fff; }
.pdf-preview-page { position: relative; margin: 20px auto; background: white; box-shadow: 0 2px 8px #0004; }
.pdf-preview-page :deep(canvas) { display: block; }
/* PDF.js TextLayer supplies glyph positions; keep the selectable text over its canvas. */
.pdf-preview-page :deep(.pdf-preview-text-layer) {
  position: absolute; inset: 0; overflow: clip; line-height: 1; text-align: initial; transform-origin: 0 0; text-size-adjust: none; forced-color-adjust: none;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}
.pdf-preview-page :deep(.pdf-preview-text-layer :is(span, br)) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0 0; }
.pdf-preview-page :deep(.pdf-preview-text-layer .markedContent) { display: contents; }
.pdf-preview-page :deep(.pdf-preview-text-layer > :not(.markedContent)),
.pdf-preview-page :deep(.pdf-preview-text-layer .markedContent span:not(.markedContent)) {
  --font-height: 0;
  --scale-x: 1;
  --rotate: 0deg;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}
.pdf-preview-page :deep(.pdf-preview-text-layer ::selection) { background: #3399ff66; }
</style>
