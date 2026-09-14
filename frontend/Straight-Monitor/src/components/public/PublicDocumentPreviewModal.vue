<template>
  <Teleport to="body">
    <section v-if="modelValue" class="public-document-preview" role="dialog" aria-modal="true" :aria-label="filename">
      <header class="public-document-preview__header">
        <button type="button" class="public-document-preview__icon" aria-label="Vorschau schließen" @click="close">
          <font-awesome-icon icon="fa-solid fa-times" />
        </button>
        <strong>{{ filename }}</strong>
        <button type="button" class="public-document-preview__icon" aria-label="Dokument herunterladen" :disabled="loading || !blob" @click="download">
          <font-awesome-icon icon="fa-solid fa-download" />
        </button>
      </header>

      <div v-if="loading" class="public-document-preview__state"><font-awesome-icon icon="fa-solid fa-spinner" spin /> Dokument wird geladen...</div>
      <div v-else-if="error" class="public-document-preview__state">
        <p>{{ error }}</p>
        <button type="button" @click="retry++">Erneut versuchen</button>
      </div>
      <PdfDocumentPreview v-else-if="format.kind === 'pdf' && blob" :blob="blob" @error="error = $event" />
      <div
        v-else-if="format.kind === 'image' && previewUrl"
        ref="imageViewport"
        class="public-document-preview__image-viewport"
        @pointerdown="startPan"
        @pointermove="pan"
        @pointerup="endPointer"
        @pointercancel="endPointer"
        @wheel.prevent="wheelZoom"
      >
        <img :src="previewUrl" :alt="filename" :style="imageStyle" draggable="false" />
        <div class="public-document-preview__image-controls">
          <button type="button" aria-label="Verkleinern" @click="setZoom(zoom - 0.25)">-</button>
          <button type="button" aria-label="Ansicht zurücksetzen" @click="resetImage">{{ Math.round(zoom * 100) }} %</button>
          <button type="button" aria-label="Vergrößern" @click="setZoom(zoom + 0.25)">+</button>
        </div>
      </div>
      <div v-else-if="previewUrl" class="public-document-preview__media">
        <video v-if="format.kind === 'video'" :src="previewUrl" controls playsinline />
        <audio v-else-if="format.kind === 'audio'" :src="previewUrl" controls />
        <p v-else>Für dieses Dateiformat steht keine Vorschau bereit.</p>
      </div>
    </section>
  </Teleport>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { documentFormat, triggerDocumentDownload } from '@/utils/documentPreview';

const PdfDocumentPreview = defineAsyncComponent(() => import('@/components/ui-elements/PdfDocumentPreview.vue'));
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filename: { type: String, required: true },
  mimeType: { type: String, default: '' },
  loadBlob: { type: Function, required: true },
});
const emit = defineEmits(['update:modelValue']);
const blob = shallowRef(null);
const previewUrl = ref('');
const loading = ref(false);
const error = ref('');
const retry = ref(0);
const format = computed(() => documentFormat(props.filename, props.mimeType));
const zoom = ref(1);
const panOffset = ref({ x: 0, y: 0 });
const imageStyle = computed(() => ({ transform: `translate(${panOffset.value.x}px, ${panOffset.value.y}px) scale(${zoom.value})` }));
let objectUrl = '';
let pointers = new Map();
let lastDistance = 0;
let dragStart = null;

function close() { emit('update:modelValue', false); }
function setZoom(value) { zoom.value = Math.min(3, Math.max(1, value)); }
function resetImage() { zoom.value = 1; panOffset.value = { x: 0, y: 0 }; }
function pointerDistance() {
  const [first, second] = [...pointers.values()];
  return Math.hypot(second.x - first.x, second.y - first.y);
}
function startPan(event) {
  event.currentTarget.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) lastDistance = pointerDistance();
  else dragStart = { x: event.clientX, y: event.clientY, offset: { ...panOffset.value } };
}
function pan(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const distance = pointerDistance();
    if (lastDistance) setZoom(zoom.value * (distance / lastDistance));
    lastDistance = distance;
  } else if (dragStart && zoom.value > 1) {
    panOffset.value = { x: dragStart.offset.x + event.clientX - dragStart.x, y: dragStart.offset.y + event.clientY - dragStart.y };
  }
}
function endPointer(event) {
  pointers.delete(event.pointerId);
  lastDistance = pointers.size === 2 ? pointerDistance() : 0;
  if (!pointers.size) dragStart = null;
}
function wheelZoom(event) { setZoom(zoom.value + (event.deltaY < 0 ? 0.15 : -0.15)); }
function download() {
  if (!blob.value) return;
  const url = URL.createObjectURL(blob.value);
  triggerDocumentDownload(url, props.filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

watch(() => [props.modelValue, props.filename, props.mimeType, retry.value], async (_, __, onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ''; }
  blob.value = null;
  previewUrl.value = '';
  resetImage();
  error.value = '';
  if (!props.modelValue) return;
  loading.value = true;
  try {
    const content = await props.loadBlob({ signal: controller.signal });
    if (!(content instanceof Blob)) throw new Error('Die Datei konnte nicht geladen werden.');
    blob.value = content;
    objectUrl = URL.createObjectURL(content);
    previewUrl.value = objectUrl;
  } catch (requestError) {
    if (!controller.signal.aborted) error.value = requestError?.response?.data?.message || requestError.message || 'Dokument konnte nicht geladen werden.';
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}, { immediate: true });

onBeforeUnmount(() => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
</script>

<style scoped>
.public-document-preview { position: fixed; inset: 0; z-index: 400; display: flex; flex-direction: column; background: var(--panel); overscroll-behavior: contain; }
.public-document-preview__header { display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; flex: 0 0 48px; align-items: center; gap: 4px; padding: env(safe-area-inset-top) 6px 0; border-bottom: 1px solid var(--border); }
.public-document-preview__header strong { overflow: hidden; color: var(--text); font-size: 0.82rem; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.public-document-preview__icon, .public-document-preview__image-controls button { display: grid; place-items: center; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.public-document-preview__icon { width: 40px; height: 40px; font-size: 1rem; }
.public-document-preview__icon:disabled { opacity: 0.4; }
.public-document-preview__state, .public-document-preview__media { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; color: var(--muted); text-align: center; }
.public-document-preview__state p { margin: 0; }
.public-document-preview__image-viewport { position: relative; flex: 1; min-height: 0; overflow: hidden; touch-action: none; background: #525659; }
.public-document-preview__image-viewport img { position: absolute; top: 50%; left: 50%; max-width: 100%; max-height: 100%; transform-origin: center; translate: -50% -50%; user-select: none; }
.public-document-preview__image-controls { position: absolute; right: 10px; bottom: max(10px, env(safe-area-inset-bottom)); display: flex; overflow: hidden; border: 1px solid #0003; border-radius: 6px; background: #fffc; }
.public-document-preview__image-controls button { min-width: 38px; height: 36px; border-right: 1px solid #0002; font-size: 0.85rem; }
.public-document-preview__image-controls button:last-child { border-right: 0; }
.public-document-preview__media video { width: 100%; max-height: 100%; }
</style>