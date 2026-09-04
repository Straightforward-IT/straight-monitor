<template>
  <div class="rich-template-editor" :class="{ 'rich-template-editor--invalid': unresolved.length }">
    <div class="rich-template-editor__toolbar" role="toolbar" aria-label="Text formatieren">
      <button type="button" title="Fett" @mousedown.prevent @click="command('bold')"><strong>B</strong></button>
      <button type="button" title="Kursiv" @mousedown.prevent @click="command('italic')"><em>I</em></button>
      <button type="button" title="Aufzählung" @mousedown.prevent @click="command('insertUnorderedList')">• Liste</button>
      <button type="button" title="Nummerierte Liste" @mousedown.prevent @click="command('insertOrderedList')">1. Liste</button>
      <button type="button" title="Link" @mousedown.prevent @click="insertLink">Link</button>
    </div>
    <div
      ref="editor"
      class="rich-template-editor__surface"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="placeholder"
      @focus="focused = true"
      @blur="onBlur"
      @input="emitValue"
    ></div>
    <div v-if="textmarks.length" class="rich-template-editor__marks" aria-label="Textmarken">
      <span>Textmarken</span>
      <button
        v-for="mark in textmarks"
        :key="mark.key || mark"
        type="button"
        :title="`{{${mark.key || mark}}}`"
        @mousedown.prevent
        @click="insertMark(mark.key || mark)"
      >
        + {{ mark.label || mark.key || mark }}
      </button>
    </div>
    <p v-if="unresolved.length" class="rich-template-editor__warning">
      Ohne Wert: {{ unresolved.join(', ') }}
    </p>
    <details v-if="previewHtml" class="rich-template-editor__preview" open>
      <summary>Vorschau</summary>
      <div v-html="previewHtml"></div>
    </details>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  textmarks: { type: Array, default: () => [] },
  previewHtml: { type: String, default: '' },
  unresolved: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Einsatzinformationen eingeben …' },
});
const emit = defineEmits(['update:modelValue', 'change']);
const editor = ref(null);
const focused = ref(false);

function syncEditor() {
  if (!editor.value || focused.value || editor.value.innerHTML === props.modelValue) return;
  editor.value.innerHTML = props.modelValue || '';
}

function emitValue() {
  const value = editor.value?.innerHTML || '';
  emit('update:modelValue', value);
}

function onBlur() {
  focused.value = false;
  emitValue();
  emit('change', editor.value?.innerHTML || '');
}

function command(name, value = null) {
  editor.value?.focus();
  document.execCommand(name, false, value);
  emitValue();
}

function insertLink() {
  const href = window.prompt('Link-Adresse (https://, mailto: oder tel:)');
  if (href) command('createLink', href);
}

function insertMark(key) {
  editor.value?.focus();
  document.execCommand('insertText', false, `{{${key}}}`);
  emitValue();
}

watch(() => props.modelValue, () => nextTick(syncEditor));
onMounted(syncEditor);
</script>

<style scoped>
.rich-template-editor { border: 1px solid var(--border); border-radius: 9px; overflow: hidden; color: var(--text); background: var(--surface); }
.rich-template-editor:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 14%, transparent); }
.rich-template-editor--invalid { border-color: #f59e0b; }
.rich-template-editor__toolbar { display: flex; flex-wrap: wrap; gap: .35rem; padding: .5rem; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 82%, var(--panel)); }
.rich-template-editor__toolbar button,
.rich-template-editor__marks button { border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); padding: .35rem .55rem; cursor: pointer; font: inherit; font-size: .78rem; }
.rich-template-editor__toolbar button:hover,
.rich-template-editor__marks button:hover { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, var(--surface)); }
.rich-template-editor__surface { min-height: 150px; padding: .85rem; outline: none; color: var(--text); background: var(--bg); line-height: 1.55; }
.rich-template-editor__surface:empty::before { content: attr(data-placeholder); color: var(--muted); pointer-events: none; }
.rich-template-editor__marks { display: flex; align-items: center; gap: .35rem; padding: .6rem; overflow-x: auto; border-top: 1px solid var(--border); background: var(--surface); }
.rich-template-editor__marks > span { color: var(--muted); font-size: .7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.rich-template-editor__marks button { flex: 0 0 auto; color: var(--primary); }
.rich-template-editor__warning { margin: 0; padding: .55rem .75rem; color: #b45309; background: color-mix(in srgb, #f59e0b 12%, var(--surface)); font-size: .82rem; }
.rich-template-editor__preview { padding: .7rem .8rem; border-top: 1px solid var(--border); background: var(--surface); }
.rich-template-editor__preview summary { color: var(--muted); cursor: pointer; font-size: .78rem; font-weight: 700; }
.rich-template-editor__preview > div { margin-top: .65rem; color: var(--text); }
.rich-template-editor__preview :deep(a) { color: var(--primary); }
</style>
