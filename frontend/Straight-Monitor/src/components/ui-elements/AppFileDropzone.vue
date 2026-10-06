<template>
  <label
    class="app-file-dropzone"
    :class="{ 'app-file-dropzone--active': dragging, 'app-file-dropzone--filled': !!file, 'app-file-dropzone--disabled': disabled }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input
      class="app-file-dropzone__input"
      type="file"
      :accept="accept"
      :aria-label="`${label}: Datei auswählen`"
      :disabled="disabled"
      @change="onChange"
    >
    <span class="app-file-dropzone__content">
      <i :class="file ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'" aria-hidden="true" />
      <span v-if="file" class="app-file-dropzone__filename" role="status">{{ file.name }}</span>
      <span v-else class="app-file-dropzone__copy">
        <strong v-if="prompt">{{ prompt }}</strong>
        <span v-else>Datei hier ablegen oder klicken</span>
        <span v-if="hint">{{ hint }}</span>
      </span>
    </span>
  </label>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['select']);
const dragging = ref(false);
const props = defineProps({
  label: { type: String, required: true },
  prompt: { type: String, default: '' },
  hint: { type: String, default: '' },
  file: { type: Object, default: null },
  accept: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

function onDragOver() {
  if (!props.disabled) dragging.value = true;
}

function onChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) emit('select', file);
}

function onDrop(event) {
  dragging.value = false;
  if (props.disabled) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) emit('select', file);
}
</script>

<style scoped>
.app-file-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 116px;
  box-sizing: border-box;
  padding: 30px 20px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  background: var(--bg-tertiary, var(--panel));
  color: var(--text);
  text-align: center;
  position: relative;
  cursor: pointer;
  transition: border-color .2s, background-color .2s;
}
.app-file-dropzone:hover:not(.app-file-dropzone--disabled),
.app-file-dropzone--active { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 2%, var(--bg-tertiary, var(--panel))); }
.app-file-dropzone--filled { border-style: solid; border-color: #4ade80; background: rgba(74, 222, 128, .05); }
.app-file-dropzone--disabled { opacity: .65; cursor: not-allowed; }
.app-file-dropzone:focus-within { outline: 2px solid var(--control-focus-ring, color-mix(in srgb, var(--primary) 42%, transparent)); outline-offset: 2px; }
.app-file-dropzone__content { display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; max-width: 100%; }
.app-file-dropzone__content i { font-size: 2rem; color: var(--muted); }
.app-file-dropzone--filled .app-file-dropzone__content i { color: #4ade80; }
.app-file-dropzone__copy { display: flex; flex-direction: column; gap: 2px; font-size: .9rem; color: var(--muted); }
.app-file-dropzone__filename { color: var(--text); font-size: .9rem; font-weight: 500; overflow-wrap: anywhere; }
.app-file-dropzone__input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
