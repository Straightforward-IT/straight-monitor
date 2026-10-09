<template>
  <div class="pdf-document-preview">
    <div class="pdf-preview-toolbar" aria-label="PDF-Navigation">
      <span>{{ pageCount ? `${pageCount} ${pageCount === 1 ? 'Seite' : 'Seiten'}` : 'PDF wird geladen…' }}</span>
      <span class="pdf-preview-toolbar-spacer" />
      <AppIconButton
        variant="ghost"
        size="sm"
        label="Verkleinern"
        :disabled="zoom <= 0.5"
        @click="zoom = Math.max(0.5, zoom - 0.25)"
      >−</AppIconButton>
      <AppButton
        variant="ghost"
        size="sm"
        aria-label="An Breite anpassen"
        @click="zoom = 1"
      >{{ Math.round(zoom * 100) }} %</AppButton>
      <AppIconButton
        variant="ghost"
        size="sm"
        label="Vergrößern"
        :disabled="zoom >= 3"
        @click="zoom = Math.min(3, zoom + 0.25)"
      >+</AppIconButton>
    </div>
    <div ref="viewportElement" class="pdf-preview-viewport" :aria-busy="rendering">
      <p v-if="rendering" class="pdf-preview-loading" role="status">PDF wird geladen…</p>
      <div ref="pageElement" class="pdf-preview-pages" :style="{ visibility: rendering ? 'hidden' : 'visible' }" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const props = defineProps({
  blob: { type: Blob, required: true },
  initialZoom: { type: Number, default: 1 },
});
const emit = defineEmits(['ready', 'error']);
const pdf = shallowRef(null);
const pageCount = computed(() => pdf.value?.numPages || 0);
const zoom = ref(props.initialZoom);
const availableWidth = ref(800);
const viewportElement = ref(null);
const pageElement = ref(null);
const rendering = ref(true);
let resizeObserver;

watch(() => props.blob, async (blob, _, onCleanup) => {
  let cancelled = false;
  let task;
  onCleanup(() => {
    cancelled = true;
    if (task) void task.destroy();
  });
  pdf.value = null;
  zoom.value = props.initialZoom;
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

watch([pdf, zoom, availableWidth], async ([document, factor, width], _, onCleanup) => {
  let cancelled = false;
  const renderTasks = [];
  const textLayers = [];
  onCleanup(() => {
    cancelled = true;
    renderTasks.forEach(task => task.cancel());
    textLayers.forEach(layer => layer.cancel());
  });
  if (!document || !pageElement.value) return;
  rendering.value = true;
  try {
    pageElement.value.replaceChildren();
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.1, width / base.width) * factor;
      const viewport = page.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
      const pageContainer = window.document.createElement('div');
      pageContainer.className = 'pdf-preview-page';
      pageContainer.setAttribute('aria-label', `Seite ${number}`);
      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width * pixelRatio);
      canvas.height = Math.ceil(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('aria-hidden', 'true');
      pageContainer.appendChild(canvas);
      pageElement.value.appendChild(pageContainer);
      const renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      renderTasks.push(renderTask);
      await renderTask.promise;
      if (cancelled) return;

      const layer = window.document.createElement('div');
      layer.className = 'pdf-preview-text-layer';
      layer.style.setProperty('--total-scale-factor', String(scale));
      const textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
      textLayers.push(textLayer);
      pageContainer.appendChild(layer);
      void textLayer.render().catch(() => {});
    }
    rendering.value = false;
    emit('ready');
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

<style lang="scss">
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
.pdf-preview-pages { padding: 20px 0; }
.pdf-preview-page { position: relative; margin: 0 auto 20px; background: white; box-shadow: 0 2px 8px #0004; }
.pdf-preview-page canvas { display: block; }
/* PDF.js TextLayer supplies glyph positions; keep the selectable text over its canvas. */
.pdf-preview-page .pdf-preview-text-layer {
  position: absolute; inset: 0; overflow: clip; line-height: 1; text-align: initial; transform-origin: 0 0; text-size-adjust: none; forced-color-adjust: none;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}
.pdf-preview-page .pdf-preview-text-layer :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0 0; }
.pdf-preview-page .pdf-preview-text-layer .markedContent { display: contents; }
.pdf-preview-page .pdf-preview-text-layer > :not(.markedContent),
.pdf-preview-page .pdf-preview-text-layer .markedContent span:not(.markedContent) {
  --font-height: 0;
  --scale-x: 1;
  --rotate: 0deg;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}
.pdf-preview-page .pdf-preview-text-layer ::selection { background: #3399ff66; }
</style>
