<template>
  <section class="mail-template-manager">
    <aside class="mail-template-manager__nav">
      <div class="nav-heading">
        <span>E-Mail-Vorlagen</span>
        <small>Kundenspezifische Ansprache</small>
      </div>
      <button
        v-for="template in templates"
        :key="template.type"
        type="button"
        class="template-card"
        :class="{ active: form.type === template.type }"
        @click="selectTemplate(template)"
      >
        <span class="template-icon"><font-awesome-icon :icon="['fas', 'file-signature']" /></span>
        <span>
          <strong>{{ template.label }}</strong>
          <small>{{ template.isDefault ? 'System-Default' : `Kundenvariante · V${template.version}` }}</small>
        </span>
      </button>
      <p class="nav-note">Weitere E-Mail-Anlässe können später in derselben Struktur ergänzt werden.</p>
    </aside>

    <div class="mail-template-manager__editor">
      <header class="editor-heading">
        <div>
          <span class="eyebrow">{{ form.isDefault ? 'Zentrale Vorlage' : 'Kundenspezifische Vorlage' }}</span>
          <h4>{{ form.label || 'E-Mail-Vorlage' }}</h4>
          <p>{{ form.description }}</p>
        </div>
        <span class="source-badge" :class="{ custom: !form.isDefault }">
          {{ form.isDefault ? 'Default aktiv' : 'Individuell' }}
        </span>
      </header>

      <div v-if="loading" class="manager-state">E-Mail-Vorlagen werden geladen …</div>
      <template v-else-if="form.type">
        <label class="subject-field">
          <span>Betreff</span>
          <input ref="subjectInput" v-model="form.subjectTemplate" type="text" maxlength="300" @blur="loadPreview" />
        </label>
        <div class="subject-marks" aria-label="Textmarken für den Betreff">
          <span>In Betreff einfügen</span>
          <button v-for="mark in textmarks" :key="mark.key" type="button" @click="insertSubjectMark(mark.key)">
            + {{ mark.label }}
          </button>
        </div>

        <RichTextTemplateEditor
          v-model="form.htmlTemplate"
          :textmarks="textmarks"
          :preview-html="preview.renderedHtml"
          :unresolved="preview.unresolvedPlaceholders"
          placeholder="E-Mail-Text eingeben …"
          @change="loadPreview"
        />

        <div v-if="preview.subject" class="subject-preview">
          <span>Vorschau Betreff</span>
          <strong>{{ preview.subject }}</strong>
        </div>
        <p v-if="error" class="manager-error">{{ error }}</p>

        <footer>
          <ToolbarButton
            v-if="!form.isDefault"
            variant="outlined"
            :disabled="saving"
            @click="resetToDefault"
          >
            Auf System-Default zurücksetzen
          </ToolbarButton>
          <span></span>
          <ToolbarButton :disabled="saving || !form.subjectTemplate || !form.htmlTemplate" @click="saveTemplate">
            {{ saving ? 'Speichert …' : (form.isDefault ? 'Für diesen Kunden anpassen' : 'Änderungen speichern') }}
          </ToolbarButton>
        </footer>
      </template>
      <p v-else class="manager-error manager-error--standalone">
        {{ error || 'Für diesen Kunden stehen derzeit keine E-Mail-Vorlagen zur Verfügung.' }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import api from '@/utils/api';
import RichTextTemplateEditor from '@/components/ui-elements/RichTextTemplateEditor.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';

const props = defineProps({
  kundenNr: { type: [Number, String], required: true },
});

const templates = ref([]);
const placeholders = ref({});
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const preview = reactive({ subject: '', renderedHtml: '', unresolvedPlaceholders: [] });
const subjectInput = ref(null);
const form = reactive({
  type: '', label: '', description: '', subjectTemplate: '', htmlTemplate: '', version: null, isDefault: true,
});

const textmarks = computed(() => Object.entries(placeholders.value).map(([key, label]) => ({ key, label })));

async function insertSubjectMark(key) {
  const input = subjectInput.value;
  const mark = `{{${key}}}`;
  const start = input?.selectionStart ?? form.subjectTemplate.length;
  const end = input?.selectionEnd ?? start;
  form.subjectTemplate = `${form.subjectTemplate.slice(0, start)}${mark}${form.subjectTemplate.slice(end)}`;
  await nextTick();
  input?.focus();
  input?.setSelectionRange(start + mark.length, start + mark.length);
}

function selectTemplate(template) {
  if (!template) return;
  Object.assign(form, {
    type: template.type,
    label: template.label,
    description: template.description,
    subjectTemplate: template.subjectTemplate,
    htmlTemplate: template.htmlTemplate,
    version: template.version,
    isDefault: template.isDefault !== false,
  });
  Object.assign(preview, { subject: '', renderedHtml: '', unresolvedPlaceholders: [] });
  error.value = '';
  loadPreview();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/api/kunden/${props.kundenNr}/email-vorlagen`);
    templates.value = data.templates || [];
    placeholders.value = data.placeholders || {};
    selectTemplate(templates.value[0]);
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'E-Mail-Vorlagen konnten nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

async function loadPreview() {
  if (!form.type || !form.subjectTemplate || !form.htmlTemplate) return;
  try {
    const { data } = await api.post(`/api/kunden/${props.kundenNr}/email-vorlagen/preview`, {
      type: form.type,
      subjectTemplate: form.subjectTemplate,
      htmlTemplate: form.htmlTemplate,
    });
    Object.assign(preview, data);
    error.value = '';
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Vorschau konnte nicht erstellt werden.';
  }
}

async function saveTemplate() {
  saving.value = true;
  error.value = '';
  try {
    const { data } = await api.put(`/api/kunden/${props.kundenNr}/email-vorlagen/${form.type}`, {
      subjectTemplate: form.subjectTemplate,
      htmlTemplate: form.htmlTemplate,
      ...(!form.isDefault ? { expectedVersion: form.version } : {}),
    });
    const saved = data.template;
    const index = templates.value.findIndex((template) => template.type === saved.type);
    if (index >= 0) templates.value.splice(index, 1, saved);
    selectTemplate(saved);
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'E-Mail-Vorlage konnte nicht gespeichert werden.';
  } finally {
    saving.value = false;
  }
}

async function resetToDefault() {
  if (!window.confirm('Kundenspezifische Vorlage entfernen und wieder den System-Default verwenden?')) return;
  saving.value = true;
  error.value = '';
  try {
    const { data } = await api.delete(`/api/kunden/${props.kundenNr}/email-vorlagen/${form.type}`);
    const restored = data.template;
    const index = templates.value.findIndex((template) => template.type === restored.type);
    if (index >= 0) templates.value.splice(index, 1, restored);
    selectTemplate(restored);
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'System-Default konnte nicht wiederhergestellt werden.';
  } finally {
    saving.value = false;
  }
}

watch(() => props.kundenNr, load);
onMounted(load);
</script>

<style scoped>
.mail-template-manager { display: grid; grid-template-columns: minmax(245px,.75fr) minmax(0,2fr); min-height: 520px; overflow: hidden; border: 1px solid var(--border); border-radius: 9px; color: var(--text); background: var(--surface); }
.mail-template-manager__nav { padding: .8rem; border-right: 1px solid var(--border); background: var(--panel); }
.nav-heading { display: grid; gap: .1rem; margin-bottom: .65rem; }
.nav-heading small,.nav-note,.editor-heading p { color: var(--muted); }
.template-card { display: flex; width: 100%; align-items: center; gap: .7rem; padding: .75rem; border: 1px solid var(--border); border-radius: 9px; color: var(--text); background: var(--surface); text-align: left; cursor: pointer; }
.template-card:hover { border-color: color-mix(in srgb,var(--primary) 55%,var(--border)); }
.template-card.active { border-color: var(--primary); background: color-mix(in srgb,var(--primary) 6%,var(--surface)); box-shadow: inset 0 0 0 1px var(--primary); }
.template-card > span:last-child { display: grid; gap: .2rem; }
.template-card small { color: var(--muted); }
.template-icon { display: grid; flex: 0 0 2.15rem; width: 2.15rem; height: 2.15rem; place-items: center; border-radius: 8px; color: var(--primary); background: color-mix(in srgb,var(--primary) 12%,var(--surface)); }
.nav-note { margin: 1rem .2rem 0; font-size: .75rem; line-height: 1.45; }
.mail-template-manager__editor { min-width: 0; padding: 1.1rem; overflow-y: auto; }
.editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.editor-heading h4 { margin: .15rem 0 .25rem; font-size: 1.2rem; }
.editor-heading p { max-width: 680px; margin: 0; font-size: .82rem; }
.eyebrow { color: var(--primary); font-size: .7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.source-badge { flex: 0 0 auto; padding: .3rem .5rem; border-radius: 99px; color: var(--muted); background: var(--hover); font-size: .72rem; font-weight: 700; }
.source-badge.custom { color: #368a5c; background: color-mix(in srgb,#368a5c 13%,var(--surface)); }
.subject-field { display: grid; gap: .35rem; margin: 1rem 0 .75rem; color: var(--muted); font-size: .74rem; font-weight: 700; }
.subject-field input { min-height: 42px; padding: .6rem .7rem; border: 1px solid var(--border); border-radius: 8px; outline: none; color: var(--text); background: var(--bg); font: inherit; }
.subject-field input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb,var(--primary) 14%,transparent); }
.subject-marks { display:flex; align-items:center; gap:.35rem; margin:-.2rem 0 .75rem; overflow-x:auto; padding-bottom:.2rem; }
.subject-marks > span { flex:0 0 auto; color:var(--muted); font-size:.68rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.subject-marks button { flex:0 0 auto; padding:.28rem .45rem; border:1px solid var(--border); border-radius:7px; color:var(--primary); background:var(--surface); cursor:pointer; font-size:.72rem; }
.subject-marks button:hover { border-color:var(--primary); background:color-mix(in srgb,var(--primary) 6%,var(--surface)); }
.subject-preview { display: grid; gap: .2rem; margin-top: .75rem; padding: .7rem .8rem; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); }
.subject-preview span { color: var(--muted); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.mail-template-manager__editor footer { display: flex; align-items: center; gap: .6rem; margin-top: 1rem; }
.mail-template-manager__editor footer > span { flex: 1; }
.manager-state { padding: 3rem; color: var(--muted); text-align: center; }
.manager-error { color: #e6584f; }
.manager-error--standalone { margin:1rem 0; padding:.8rem; border:1px solid color-mix(in srgb,#e6584f 40%,var(--border)); border-radius:8px; background:color-mix(in srgb,#e6584f 7%,var(--surface)); }
@media (max-width:760px) { .mail-template-manager { grid-template-columns:1fr; }.mail-template-manager__nav { border-right:0; border-bottom:1px solid var(--border); }.editor-heading { flex-direction:column; }.mail-template-manager__editor footer { align-items:stretch; flex-direction:column; }.mail-template-manager__editor footer > span { display:none; }.mail-template-manager__editor footer :deep(.toolbar-btn) { width:100%; justify-content:center; } }
</style>
