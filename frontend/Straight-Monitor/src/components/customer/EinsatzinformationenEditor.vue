<template>
  <section class="einsatzinfo-manager">
    <aside class="einsatzinfo-manager__nav">
      <div class="einsatzinfo-manager__nav-head">
        <strong>Vorlagenstruktur</strong>
        <AppButton size="sm" variant="ghost" :disabled="saving" @click="newCustomerDefault">+ Kundendefault</AppButton>
      </div>
      <button
        class="scope-card"
        :class="{ active: !form.einsatzortId }"
        :aria-pressed="!form.einsatzortId"
        type="button"
        :disabled="saving"
        @click="selectTemplate(customerDefault)"
      >
        <span>Allgemein</span>
        <strong>Kunden-Default</strong>
        <small>{{ customerDefault ? `Version ${customerDefault.version}` : 'Noch nicht angelegt' }}</small>
      </button>
      <div v-for="site in einsatzorte" :key="site._id" class="site-group">
        <button class="scope-card" :class="{ active: form.einsatzortId === site._id && !form.berufId && !form.qualifikationId }" :aria-pressed="form.einsatzortId === site._id && !form.berufId && !form.qualifikationId" type="button" :disabled="saving" @click="newSiteDefault(site)">
          <span>Einsatzort</span>
          <strong>{{ site.bezeichnung }}</strong>
          <small>{{ address(site) }}</small>
        </button>
        <button
          v-for="template in templatesForSite(site._id)"
          :key="template._id"
          class="variant-card"
          :class="{ active: form.id === template._id }"
          :aria-pressed="form.id === template._id"
          type="button"
          :disabled="saving"
          @click="selectTemplate(template)"
        >
          <strong>{{ template.name }}</strong>
          <small>{{ variantLabel(template) }} · V{{ template.version }}</small>
        </button>
        <AppButton class="add-variant" size="sm" variant="ghost" :disabled="saving" @click="newVariant(site)">+ Variante für Beruf / Qualifikation</AppButton>
      </div>
    </aside>

    <div class="einsatzinfo-manager__editor">
      <header>
        <div>
          <span class="eyebrow">{{ form.einsatzortId ? 'Einsatzort-Vorlage' : 'Kundenweite Vorlage' }}</span>
          <h4>{{ form.id ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}</h4>
        </div>
        <div class="header-actions">
          <AppButton v-if="form.id" size="sm" variant="outlined" :disabled="saving" @click="copyTemplate">Kopie als Ausgangspunkt</AppButton>
          <label><input v-model="form.isActive" type="checkbox" :disabled="saving" /> Aktiv</label>
        </div>
      </header>

      <div v-if="loading" class="manager-state">Vorlagen werden geladen …</div>
      <template v-else>
        <div class="form-grid">
          <label class="wide">Name<AppTextInput v-model.trim="form.name" placeholder="z. B. Service Abendveranstaltung" :disabled="saving" /></label>
          <label v-if="form.copyMode">Ziel-Einsatzort
            <AppSelect v-model="form.einsatzortId" :disabled="saving"><option value="">Bitte wählen</option><option v-for="site in einsatzorte" :key="site._id" :value="site._id">{{ site.bezeichnung }}</option></AppSelect>
          </label>
          <label v-if="form.einsatzortId">Beruf
            <AppSelect v-model="form.berufId" :disabled="saving"><option value="">Alle Berufe</option><option v-for="job in berufe" :key="job._id" :value="job._id">{{ job.jobKey }} · {{ job.designation }}</option></AppSelect>
          </label>
          <label v-if="form.einsatzortId">Qualifikation
            <AppSelect v-model="form.qualifikationId" :disabled="saving"><option value="">Alle Qualifikationen</option><option v-for="qualification in qualifikationen" :key="qualification._id" :value="qualification._id">{{ qualification.qualificationKey }} · {{ qualification.designation }}</option></AppSelect>
          </label>
        </div>
        <RichTextTemplateEditor
          v-model="form.htmlTemplate"
          :textmarks="textmarks"
          :preview-html="preview.renderedHtml"
          :unresolved="preview.unresolvedPlaceholders"
          :disabled="saving"
          @change="loadPreview"
        />
        <p v-if="error" class="manager-error" role="alert">{{ error }}</p>
        <footer>
          <AppButton v-if="form.id" size="sm" variant="danger" :disabled="saving" @click="removeTemplate">Löschen</AppButton>
          <span></span>
          <AppButton size="sm" :loading="saving" :disabled="!form.htmlTemplate || (form.copyMode && !form.einsatzortId)" @click="saveTemplate">Vorlage speichern</AppButton>
        </footer>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import api from '@/utils/api';
import RichTextTemplateEditor from '@/components/ui-elements/RichTextTemplateEditor.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';

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
const form = reactive({ id: null, version: null, name: '', htmlTemplate: '', einsatzortId: '', berufId: '', qualifikationId: '', isActive: true, copyMode: false });

const customerDefault = computed(() => templates.value.find(template => !template.einsatzort) || null);
const textmarks = computed(() => Object.entries(placeholders.value).map(([key, label]) => ({ key, label })));

function templatesForSite(siteId) {
  return templates.value.filter(template => String(template.einsatzort?._id || template.einsatzort) === String(siteId) && (template.beruf || template.qualifikation));
}
function address(site) { return [site.adresse?.strasse, [site.adresse?.plz, site.adresse?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Keine Adresse'; }
function variantLabel(template) { return [template.beruf?.designation, template.qualifikation?.designation].filter(Boolean).join(' + ') || 'Einsatzort-Default'; }
function resetForm(values = {}) {
  Object.assign(form, { id: null, version: null, name: '', htmlTemplate: '', einsatzortId: '', berufId: '', qualifikationId: '', isActive: true, copyMode: false }, values);
  Object.assign(preview, { renderedHtml: '', unresolvedPlaceholders: [] });
  error.value = '';
}
function selectTemplate(template) {
  if (!template) return resetForm();
  resetForm({
    id: template._id,
    version: template.version,
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
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  const payload = { name: form.name, htmlTemplate: form.htmlTemplate, einsatzortId: form.einsatzortId || null, berufId: form.berufId || null, qualifikationId: form.qualifikationId || null, isActive: form.isActive, ...(form.id ? { expectedVersion: form.version } : {}) };
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
  if (saving.value || !form.id || !window.confirm('Diese Vorlage wirklich löschen? Bestehende Schichten behalten ihren Snapshot.')) return;
  saving.value = true;
  error.value = '';
  try {
    await api.delete(`/api/kunden/${props.kundenNr}/einsatzinformationen/${form.id}`);
    templates.value = templates.value.filter(template => template._id !== form.id);
    resetForm();
  } catch (requestError) { error.value = requestError.response?.data?.message || 'Vorlage konnte nicht gelöscht werden.'; }
  finally { saving.value = false; }
}

watch(() => props.kundenNr, load);
onMounted(load);
</script>

<style scoped>
.einsatzinfo-manager { display: grid; grid-template-columns: minmax(230px, .75fr) minmax(0, 2fr); min-height: 520px; overflow: hidden; border: 1px solid var(--border); border-radius: 9px; color: var(--text); background: var(--surface); }
.einsatzinfo-manager__nav { padding: .8rem; overflow-y: auto; border-right: 1px solid var(--border); background: var(--panel); }
.einsatzinfo-manager__nav-head, .einsatzinfo-manager__editor > header, .einsatzinfo-manager__editor footer { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.einsatzinfo-manager__nav-head button, .add-variant { white-space: normal; text-align: left; }
.scope-card, .variant-card { display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: .18rem; margin-top: .55rem; padding: .7rem; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface); text-align: left; }
.scope-card:hover, .variant-card:hover { border-color: color-mix(in srgb, var(--primary) 55%, var(--border)); }
.scope-card.active, .variant-card.active { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, var(--surface)); box-shadow: inset 0 0 0 1px var(--primary); }
.scope-card span { color: var(--action-accent-text); font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.scope-card small, .variant-card small { color: var(--muted); }
.variant-card { margin-left: .75rem; width: calc(100% - .75rem); border-style: dashed; }
.add-variant { margin: .4rem 0 .3rem .75rem; }
.scope-card:focus-visible, .variant-card:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
.scope-card:disabled, .variant-card:disabled { cursor: not-allowed; opacity: .7; }
.einsatzinfo-manager__editor { padding: 1.1rem; overflow-y: auto; }
.einsatzinfo-manager__editor h4 { margin: .15rem 0 0; font-size: 1.2rem; }
.eyebrow { color: var(--action-accent-text); font-size: .7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.header-actions { display: flex; align-items: center; gap: .65rem; }
.header-actions label { display: flex; align-items: center; gap: .35rem; color: var(--muted); font-size: .8rem; }
.header-actions input { accent-color: var(--primary); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin: 1rem 0; }
.form-grid label { display: grid; gap: .3rem; color: var(--muted); font-size: .74rem; font-weight: 700; }
.form-grid .wide { grid-column: 1 / -1; }
.form-grid :is(input, select) { width: 100%; min-height: 40px; }
.einsatzinfo-manager__editor footer { margin-top: 1rem; }
.manager-error { color: var(--status-danger-text); }.manager-state { padding: 3rem; text-align: center; color: var(--muted); }
@media (max-width: 760px) { .einsatzinfo-manager { grid-template-columns: 1fr; }.einsatzinfo-manager__nav { max-height: 240px; border-right: 0; border-bottom: 1px solid var(--border); }.form-grid { grid-template-columns: 1fr; } }
</style>
