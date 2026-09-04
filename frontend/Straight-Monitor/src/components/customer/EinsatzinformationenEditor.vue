<template>
  <section class="einsatzinfo-manager">
    <aside class="einsatzinfo-manager__nav">
      <div class="einsatzinfo-manager__nav-head">
        <strong>Vorlagenstruktur</strong>
        <button type="button" @click="newCustomerDefault">+ Kundendefault</button>
      </div>
      <button
        class="scope-card"
        :class="{ active: !form.einsatzortId }"
        type="button"
        @click="selectTemplate(customerDefault)"
      >
        <span>Allgemein</span>
        <strong>Kunden-Default</strong>
        <small>{{ customerDefault ? `Version ${customerDefault.version}` : 'Noch nicht angelegt' }}</small>
      </button>
      <div v-for="site in einsatzorte" :key="site._id" class="site-group">
        <button class="scope-card" :class="{ active: form.einsatzortId === site._id && !form.berufId && !form.qualifikationId }" type="button" @click="newSiteDefault(site)">
          <span>Einsatzort</span>
          <strong>{{ site.bezeichnung }}</strong>
          <small>{{ address(site) }}</small>
        </button>
        <button
          v-for="template in templatesForSite(site._id)"
          :key="template._id"
          class="variant-card"
          :class="{ active: form.id === template._id }"
          type="button"
          @click="selectTemplate(template)"
        >
          <strong>{{ template.name }}</strong>
          <small>{{ variantLabel(template) }} · V{{ template.version }}</small>
        </button>
        <button class="add-variant" type="button" @click="newVariant(site)">+ Variante für Beruf / Qualifikation</button>
      </div>
    </aside>

    <div class="einsatzinfo-manager__editor">
      <header>
        <div>
          <span class="eyebrow">{{ form.einsatzortId ? 'Einsatzort-Vorlage' : 'Kundenweite Vorlage' }}</span>
          <h4>{{ form.id ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}</h4>
        </div>
        <div class="header-actions">
          <button v-if="form.id" type="button" @click="copyTemplate">Kopie als Ausgangspunkt</button>
          <label><input v-model="form.isActive" type="checkbox" /> Aktiv</label>
        </div>
      </header>

      <div v-if="loading" class="manager-state">Vorlagen werden geladen …</div>
      <template v-else>
        <div class="form-grid">
          <label class="wide">Name<input v-model.trim="form.name" type="text" placeholder="z. B. Service Abendveranstaltung" /></label>
          <label v-if="form.copyMode">Ziel-Einsatzort
            <select v-model="form.einsatzortId"><option value="">Bitte wählen</option><option v-for="site in einsatzorte" :key="site._id" :value="site._id">{{ site.bezeichnung }}</option></select>
          </label>
          <label v-if="form.einsatzortId">Beruf
            <select v-model="form.berufId"><option value="">Alle Berufe</option><option v-for="job in berufe" :key="job._id" :value="job._id">{{ job.jobKey }} · {{ job.designation }}</option></select>
          </label>
          <label v-if="form.einsatzortId">Qualifikation
            <select v-model="form.qualifikationId"><option value="">Alle Qualifikationen</option><option v-for="qualification in qualifikationen" :key="qualification._id" :value="qualification._id">{{ qualification.qualificationKey }} · {{ qualification.designation }}</option></select>
          </label>
        </div>
        <RichTextTemplateEditor
          v-model="form.htmlTemplate"
          :textmarks="textmarks"
          :preview-html="preview.renderedHtml"
          :unresolved="preview.unresolvedPlaceholders"
          @change="loadPreview"
        />
        <p v-if="error" class="manager-error">{{ error }}</p>
        <footer>
          <button v-if="form.id" class="danger" type="button" :disabled="saving" @click="removeTemplate">Löschen</button>
          <span></span>
          <button type="button" :disabled="saving || !form.htmlTemplate || (form.copyMode && !form.einsatzortId)" @click="saveTemplate">{{ saving ? 'Speichert …' : 'Vorlage speichern' }}</button>
        </footer>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import api from '@/utils/api';
import RichTextTemplateEditor from '@/components/ui-elements/RichTextTemplateEditor.vue';

const props = defineProps({
  kundenNr: { type: [Number, String], required: true },
  einsatzorte: { type: Array, default: () => [] },
});

const templates = ref([]);
const placeholders = ref({});
const berufe = ref([]);
const qualifikationen = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const preview = reactive({ renderedHtml: '', unresolvedPlaceholders: [] });
const form = reactive({ id: null, name: '', htmlTemplate: '', einsatzortId: '', berufId: '', qualifikationId: '', isActive: true, copyMode: false });

const customerDefault = computed(() => templates.value.find(template => !template.einsatzort) || null);
const textmarks = computed(() => Object.entries(placeholders.value).map(([key, label]) => ({ key, label })));

function templatesForSite(siteId) {
  return templates.value.filter(template => String(template.einsatzort?._id || template.einsatzort) === String(siteId) && (template.beruf || template.qualifikation));
}
function address(site) { return [site.adresse?.strasse, [site.adresse?.plz, site.adresse?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Keine Adresse'; }
function variantLabel(template) { return [template.beruf?.designation, template.qualifikation?.designation].filter(Boolean).join(' + ') || 'Einsatzort-Default'; }
function resetForm(values = {}) {
  Object.assign(form, { id: null, name: '', htmlTemplate: '', einsatzortId: '', berufId: '', qualifikationId: '', isActive: true, copyMode: false }, values);
  Object.assign(preview, { renderedHtml: '', unresolvedPlaceholders: [] });
  error.value = '';
}
function selectTemplate(template) {
  if (!template) return resetForm();
  resetForm({
    id: template._id,
    name: template.name,
    htmlTemplate: template.htmlTemplate,
    einsatzortId: template.einsatzort?._id || template.einsatzort || '',
    berufId: template.beruf?._id || template.beruf || '',
    qualifikationId: template.qualifikation?._id || template.qualifikation || '',
    isActive: template.isActive !== false,
  });
  loadPreview();
}
function newCustomerDefault() { selectTemplate(customerDefault.value); }
function newSiteDefault(site) {
  const existing = templates.value.find(template => String(template.einsatzort?._id || template.einsatzort) === String(site._id) && !template.beruf && !template.qualifikation);
  if (existing) selectTemplate(existing);
  else resetForm({ einsatzortId: site._id, name: `${site.bezeichnung} · Default` });
}
function newVariant(site) { resetForm({ einsatzortId: site._id, name: `${site.bezeichnung} · Variante` }); }
function copyTemplate() { resetForm({ name: `${form.name} – Kopie`, htmlTemplate: form.htmlTemplate, einsatzortId: form.einsatzortId, copyMode: true }); loadPreview(); }

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [templateResponse, jobResponse, qualificationResponse] = await Promise.all([
      api.get(`/api/kunden/${props.kundenNr}/einsatzinformationen`),
      api.get('/api/import/berufe'),
      api.get('/api/import/qualifikationen'),
    ]);
    templates.value = templateResponse.data.templates || [];
    placeholders.value = templateResponse.data.placeholders || {};
    berufe.value = jobResponse.data.data || [];
    qualifikationen.value = qualificationResponse.data.data || [];
    selectTemplate(customerDefault.value);
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Einsatzinformationen konnten nicht geladen werden.';
  } finally { loading.value = false; }
}

async function loadPreview() {
  if (!form.htmlTemplate) return Object.assign(preview, { renderedHtml: '', unresolvedPlaceholders: [] });
  try {
    const { data } = await api.post(`/api/kunden/${props.kundenNr}/einsatzinformationen/preview`, {
      htmlTemplate: form.htmlTemplate,
      einsatzortId: form.einsatzortId || null,
      berufId: form.berufId || null,
      qualifikationId: form.qualifikationId || null,
    });
    Object.assign(preview, data);
    error.value = '';
  } catch (requestError) { error.value = requestError.response?.data?.message || 'Vorschau nicht möglich.'; }
}

async function saveTemplate() {
  saving.value = true;
  error.value = '';
  const payload = { name: form.name, htmlTemplate: form.htmlTemplate, einsatzortId: form.einsatzortId || null, berufId: form.berufId || null, qualifikationId: form.qualifikationId || null, isActive: form.isActive };
  try {
    const response = form.id
      ? await api.put(`/api/kunden/${props.kundenNr}/einsatzinformationen/${form.id}`, payload)
      : await api.post(`/api/kunden/${props.kundenNr}/einsatzinformationen`, payload);
    const saved = response.data.template;
    const index = templates.value.findIndex(template => template._id === saved._id);
    if (index >= 0) templates.value.splice(index, 1, saved); else templates.value.push(saved);
    selectTemplate(saved);
  } catch (requestError) {
    error.value = requestError.response?.data?.message || (requestError.response?.status === 409 ? 'Für diese Kombination existiert bereits eine Vorlage.' : 'Vorlage konnte nicht gespeichert werden.');
  } finally { saving.value = false; }
}

async function removeTemplate() {
  if (!form.id || !window.confirm('Diese Vorlage wirklich löschen? Bestehende Schichten behalten ihren Snapshot.')) return;
  try {
    await api.delete(`/api/kunden/${props.kundenNr}/einsatzinformationen/${form.id}`);
    templates.value = templates.value.filter(template => template._id !== form.id);
    resetForm();
  } catch (requestError) { error.value = requestError.response?.data?.message || 'Vorlage konnte nicht gelöscht werden.'; }
}

watch(() => props.kundenNr, load);
onMounted(load);
</script>

<style scoped>
.einsatzinfo-manager { display: grid; grid-template-columns: minmax(230px, .75fr) minmax(0, 2fr); min-height: 520px; border: 1px solid var(--color-border, #e2e8f0); border-radius: 16px; overflow: hidden; }
.einsatzinfo-manager__nav { padding: .8rem; overflow-y: auto; border-right: 1px solid var(--color-border, #e2e8f0); background: #f8fafc; }
.einsatzinfo-manager__nav-head, .einsatzinfo-manager__editor > header, .einsatzinfo-manager__editor footer { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.einsatzinfo-manager button { cursor: pointer; }
.einsatzinfo-manager__nav-head button, .add-variant { border: 0; color: #2563eb; background: transparent; font-weight: 700; }
.scope-card, .variant-card { display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: .18rem; margin-top: .55rem; padding: .7rem; border: 1px solid #dbe3ef; border-radius: 11px; color: #334155; background: #fff; text-align: left; }
.scope-card.active, .variant-card.active { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
.scope-card span { color: #64748b; font-size: .68rem; font-weight: 800; text-transform: uppercase; }
.scope-card small, .variant-card small { color: #64748b; }
.variant-card { margin-left: .75rem; width: calc(100% - .75rem); border-style: dashed; }
.add-variant { margin: .4rem 0 .3rem .75rem; font-size: .78rem; }
.einsatzinfo-manager__editor { padding: 1.1rem; overflow-y: auto; }
.einsatzinfo-manager__editor h4 { margin: .15rem 0 0; font-size: 1.2rem; }
.eyebrow { color: #2563eb; font-size: .7rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.header-actions { display: flex; align-items: center; gap: .65rem; }
.header-actions button { border: 1px solid #dbe3ef; border-radius: 8px; padding: .4rem .6rem; background: #fff; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin: 1rem 0; }
.form-grid label { display: grid; gap: .3rem; color: #475569; font-size: .78rem; font-weight: 800; }
.form-grid .wide { grid-column: 1 / -1; }
.form-grid input, .form-grid select { width: 100%; min-height: 40px; border: 1px solid #d8deea; border-radius: 9px; padding: .55rem; background: var(--color-surface, #fff); color: inherit; }
.einsatzinfo-manager__editor footer { margin-top: 1rem; }
.einsatzinfo-manager__editor footer button { border: 0; border-radius: 9px; padding: .65rem .9rem; color: #fff; background: #2563eb; font-weight: 800; }
.einsatzinfo-manager__editor footer .danger { color: #b91c1c; background: #fee2e2; }
.manager-error { color: #b91c1c; }.manager-state { padding: 3rem; text-align: center; color: #64748b; }
@media (max-width: 760px) { .einsatzinfo-manager { grid-template-columns: 1fr; }.einsatzinfo-manager__nav { max-height: 240px; border-right: 0; border-bottom: 1px solid #e2e8f0; }.form-grid { grid-template-columns: 1fr; } }
</style>
