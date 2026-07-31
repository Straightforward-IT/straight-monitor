<template>
  <div class="shortcuts">
    <header class="shortcuts-header">
      <h4>Pakete</h4>
      <button class="close-btn" type="button" title="Schließen" @click="ui.close()">
        <font-awesome-icon :icon="['fas', 'xmark']" />
      </button>
    </header>

    <p v-if="loading" class="state">Vorlagen werden geladen…</p>
    <p v-else-if="error" class="state state--error">{{ error }}</p>
    <p v-else-if="!templates.length" class="state">Noch keine Paketvorlage angelegt.</p>

    <div class="actions">
      <div v-for="template in templates" :key="template._id" class="package-shortcut">
        <button type="button" class="s-btn" @click="selectedTemplate = template">
          <font-awesome-icon :icon="['fas', 'box-open']" />
          <span>{{ template.name }}</span>
        </button>
        <button type="button" class="package-edit" title="Paketvorlage bearbeiten" @click="openEdit(template)">
          <font-awesome-icon :icon="['fas', 'pen']" />
        </button>
      </div>
      <button type="button" class="s-btn s-btn--create" @click="openCreate">
        <font-awesome-icon :icon="['fas', 'plus']" />
        <span>Paket anlegen</span>
      </button>
    </div>

    <section class="activity-section" aria-labelledby="activity-heading">
      <div class="activity-section__header">
        <h4 id="activity-heading">Verlauf</h4>
        <span>{{ selectedLocationIds.length ? `${selectedLocationIds.length} Standort${selectedLocationIds.length === 1 ? '' : 'e'}` : 'Alle Standorte' }}</span>
      </div>
      <p v-if="activityLoading" class="activity-state">Wird geladen…</p>
      <p v-else-if="!activity.length" class="activity-state">Keine letzten Bestandsänderungen.</p>
      <ol v-else class="activity-list">
        <li v-for="entry in activity" :key="entry._id" class="activity-entry">
          <span class="activity-entry__type" :class="`activity-entry__type--${entry.art}`">
            <font-awesome-icon :icon="['fas', entry.art === 'entnahme' ? 'arrow-up' : 'arrow-down']" />
          </span>
          <div>
            <b>{{ activitySummary(entry) }}</b>
            <small>{{ activityMeta(entry) }}</small>
          </div>
        </li>
      </ol>
    </section>

    <PaketVorlageModal v-if="selectedTemplate" v-model="selectedTemplate" @booked="refreshTemplates" />
    <PaketVorlageEditorModal v-model="showEditor" :template="editingTemplate" @created="handleTemplateCreated" @updated="handleTemplateUpdated" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowDown, faArrowUp, faBoxOpen, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import { useUi } from '@/stores/ui';
import { useInventoryFilters } from '@/stores/inventoryFilters';
import PaketVorlageModal from '@/components/PaketVorlageModal.vue';
import PaketVorlageEditorModal from '@/components/PaketVorlageEditorModal.vue';

library.add(faArrowDown, faArrowUp, faBoxOpen, faPen, faPlus, faXmark);

const ui = useUi();
const { locationIds: selectedLocationIds } = storeToRefs(useInventoryFilters());
const templates = ref([]);
const selectedTemplate = ref(null);
const showEditor = ref(false);
const editingTemplate = ref(null);
const loading = ref(false);
const error = ref('');
const activity = ref([]);
const activityLoading = ref(false);

async function refreshTemplates() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/paket-vorlagen');
    templates.value = data;
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Paketvorlagen konnten nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

async function refreshActivity() {
  activityLoading.value = true;
  try {
    const { data } = await api.get('/api/inventory/activity', {
      params: { locationIds: selectedLocationIds.value.join(','), limit: 6 },
    });
    activity.value = data;
  } catch {
    activity.value = [];
  } finally {
    activityLoading.value = false;
  }
}

function activitySummary(entry) {
  if (entry.packageTemplateName) return entry.packageTemplateName;
  const items = entry.items || [];
  const visibleItems = items.slice(0, 2).map((item) => `${item.bezeichnung} × ${item.anzahl}`);
  return `${entry.art === 'entnahme' ? 'Entnahme' : 'Rückgabe'}: ${visibleItems.join(', ')}${items.length > 2 ? ` +${items.length - 2}` : ''}`;
}

function activityMeta(entry) {
  const location = entry.locationId?.shortName || entry.standort;
  const userName = entry.benutzerName || entry.benutzer?.name || entry.benutzerMail || 'Unbekannt';
  return `${location} · ${userName} · ${formatActivityTime(entry.timestamp)}`;
}

function formatActivityTime(timestamp) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function handleTemplateCreated(template) {
  templates.value = [...templates.value, template].sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

function handleTemplateUpdated(template) {
  const index = templates.value.findIndex((entry) => entry._id === template._id);
  if (index >= 0) templates.value[index] = template;
  else templates.value.push(template);
  templates.value.sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

function openCreate() {
  editingTemplate.value = null;
  showEditor.value = true;
}

function openEdit(template) {
  editingTemplate.value = template;
  showEditor.value = true;
}

watch(selectedLocationIds, refreshActivity, { deep: true });
onMounted(() => {
  refreshTemplates();
  refreshActivity();
});
</script>

<style scoped lang="scss">
.shortcuts { display: flex; flex-direction: column; gap: 8px; padding: 8px 6px; color: var(--text); }
.shortcuts-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; } h4 { margin: 0; font-size: 0.94rem; } .close-btn { display: none; border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 4px; }
.actions { display: grid; gap: 6px; } .package-shortcut { display: grid; grid-template-columns: 1fr 30px; gap: 4px; align-items: stretch; } .s-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); color: var(--text); cursor: pointer; font: inherit; font-size: 0.8rem; text-align: left; } .s-btn:hover { border-color: var(--primary); color: var(--primary); } .package-edit { display: grid; place-items: center; border: 1px solid var(--border); border-radius: 7px; background: transparent; color: var(--muted); cursor: pointer; } .package-edit:hover { border-color: var(--primary); color: var(--primary); } .s-btn--create { border-style: dashed; color: var(--primary); }
.state { margin: 4px 0; color: var(--muted); font-size: 0.78rem; line-height: 1.4; }.state--error { color: #c3423f; }
.activity-section { display: grid; gap: 7px; margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--border); }.activity-section__header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }.activity-section__header h4 { font-size: 0.84rem; }.activity-section__header span, .activity-state { color: var(--muted); font-size: 0.7rem; }.activity-state { margin: 0; }.activity-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }.activity-entry { display: grid; grid-template-columns: 22px 1fr; gap: 7px; align-items: start; }.activity-entry__type { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 5px; font-size: 0.65rem; }.activity-entry__type--entnahme { background: color-mix(in srgb, #c3423f 10%, var(--tile-bg)); color: #c3423f; }.activity-entry__type--zugabe { background: color-mix(in srgb, #368a5c 11%, var(--tile-bg)); color: #368a5c; }.activity-entry b { display: block; overflow: hidden; color: var(--text); font-size: 0.72rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }.activity-entry small { display: block; margin-top: 2px; color: var(--muted); font-size: 0.67rem; }
@media (max-width: 768px) { .close-btn { display: block; } }
</style>