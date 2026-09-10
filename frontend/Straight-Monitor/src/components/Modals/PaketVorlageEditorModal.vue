<template>
  <ModalFrame
    v-if="modelValue"
    minimizable
    size="xl"
    subtitle="Paketvorlage"
    :title="isEditing ? 'Vorlage bearbeiten' : 'Neue Vorlage'"
    style="--mf-max-width: 920px; --mf-max-height: 88dvh; --mf-body-padding: 0; --mf-body-overflow: hidden"
    @close="close"
  >
    <div class="body">
      <label class="name-field">Name<input v-model="name" type="text" placeholder="z. B. Service-Paket" /></label>

      <div v-if="locations.length" class="location-editor">
        <nav class="location-tabs" role="tablist" aria-label="Standort auswählen">
          <button
            v-for="location in locations"
            :key="location._id"
            type="button"
            role="tab"
            :aria-selected="activeLocationId === location._id"
            :class="{ active: activeLocationId === location._id }"
            @click="activeLocationId = location._id"
          >{{ location.shortName || location.nameFull }}</button>
        </nav>

        <div v-if="activePackage" class="location-content">
          <div class="location-context">
            <b>{{ activeLocation?.nameFull }}</b>
            <span>{{ activePackage.sections.length }} {{ activePackage.sections.length === 1 ? 'Kategorie' : 'Kategorien' }}</span>
          </div>

          <section v-for="(section, sectionIndex) in activePackage.sections" :key="section.id" class="section-editor">
            <div class="section-heading">
              <input v-model="section.name" type="text" placeholder="Kategorie" />
              <button type="button" class="text-button" title="Kategorie entfernen" @click="activePackage.sections.splice(sectionIndex, 1)"><font-awesome-icon :icon="['fas', 'trash']" /></button>
            </div>
            <div v-for="(entry, entryIndex) in section.entries" :key="entry.id" class="entry-editor" :class="entryEditorClass(entry)">
              <label class="item-field">Artikel
                <select v-model="entry.item" @change="syncEntryOptions(entry)"><option value="">Artikel wählen</option><option v-for="item in catalogue" :key="item._id" :value="item._id">{{ item.bezeichnung }}</option></select>
              </label>
              <label class="toggle-field"><input v-model="entry.defaultSelected" type="checkbox" /> Standard an</label>
              <label>Menge<input v-model.number="entry.defaultQuantity" type="number" min="1" /></label>
              <label>Variation<select v-if="hasVariations(entry)" v-model="entry.variationMode"><option value="none">Keine</option><option value="fixed">Fest</option><option value="choose">Wählbar</option></select><span v-else class="option-label">Keine</span></label>
              <label v-if="hasVariations(entry) && entry.variationMode === 'fixed'">Auswahl<select v-model="entry.variationKey"><option value="">Variation wählen</option><option v-for="option in itemFor(entry)?.variationen || []" :key="option.key" :value="option.key">{{ option.label }}</option></select></label>
              <label>Größe<select v-if="hasGroessen(entry)" v-model="entry.groesseMode"><option value="none">Keine</option><option value="fixed">Fest</option><option value="choose">Wählbar</option></select><span v-else class="option-label">Keine</span></label>
              <label v-if="hasGroessen(entry) && entry.groesseMode === 'fixed'">Auswahl<select v-model="entry.groesseKey"><option value="">Größe wählen</option><option v-for="option in itemFor(entry)?.groessen || []" :key="option.key" :value="option.key">{{ option.label }}</option></select></label>
              <button type="button" class="text-button entry-remove" title="Zeile entfernen" @click="section.entries.splice(entryIndex, 1)"><font-awesome-icon :icon="['fas', 'trash']" /></button>
            </div>
            <button type="button" class="secondary add-row" @click="section.entries.push(newEntry())"><font-awesome-icon :icon="['fas', 'plus']" /> Artikel hinzufügen</button>
          </section>
          <button type="button" class="secondary add-section" @click="activePackage.sections.push(newSection())"><font-awesome-icon :icon="['fas', 'plus']" /> Kategorie hinzufügen</button>
        </div>
      </div>
      <p v-else class="empty-state">Standorte werden geladen ...</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <template #footer>
      <button type="button" class="secondary" @click="close">Abbrechen</button>
      <button type="button" class="primary" :disabled="saving || !canSave" @click="save"><font-awesome-icon :icon="['fas', saving ? 'spinner' : 'check']" :spin="saving" /> {{ isEditing ? 'Speichern' : 'Anlegen' }}</button>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faPlus, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import ModalFrame from '@/components/frames/ModalFrame.vue';

library.add(faCheck, faPlus, faSpinner, faTrash);
const props = defineProps({ modelValue: { type: Boolean, default: false }, template: { type: Object, default: null } });
const emit = defineEmits(['update:modelValue', 'created', 'updated']);
const locations = ref([]); const catalogue = ref([]); const name = ref(''); const locationPackages = ref([]); const activeLocationId = ref(''); const saving = ref(false); const error = ref('');
let entrySequence = 0; let sectionSequence = 0;
const newEntry = () => ({ id: `entry-${entrySequence += 1}`, item: '', defaultSelected: true, defaultQuantity: 1, variationMode: 'none', variationKey: null, groesseMode: 'none', groesseKey: null, sortOrder: 0, isActive: true });
const newSection = () => ({ id: `section-${sectionSequence += 1}`, name: '', entries: [newEntry()], sortOrder: 0, isActive: true });
const newLocationPackage = (locationId) => ({ location: String(locationId), sections: [newSection()] });
const isEditing = computed(() => Boolean(props.template?._id));
const activeLocation = computed(() => locations.value.find((location) => String(location._id) === String(activeLocationId.value)));
const activePackage = computed(() => locationPackages.value.find((locationPackage) => String(locationPackage.location) === String(activeLocationId.value)));
const canSave = computed(() => name.value.trim() && locationPackages.value.some((locationPackage) => locationPackage.sections.some((section) => section.name.trim() && section.entries.some((entry) => entry.item))));
const itemFor = (entry) => catalogue.value.find((item) => item._id === entry.item);
const hasVariations = (entry) => !entry.item || (itemFor(entry)?.variationen?.length || 0) > 0;
const hasGroessen = (entry) => !entry.item || (itemFor(entry)?.groessen?.length || 0) > 0;
const entryEditorClass = (entry) => ({
  'entry-editor--variation-fixed': entry.variationMode === 'fixed',
  'entry-editor--groesse-fixed': entry.groesseMode === 'fixed',
});
function syncEntryOptions(entry) {
  if (!hasVariations(entry)) { entry.variationMode = 'none'; entry.variationKey = null; }
  if (!hasGroessen(entry)) { entry.groesseMode = 'none'; entry.groesseKey = null; }
}
function close() { emit('update:modelValue', false); }
async function loadData() { const [locationsResponse, itemsResponse] = await Promise.all([api.get('/api/locations'), api.get('/api/inventory/items')]); locations.value = locationsResponse.data; catalogue.value = itemsResponse.data; }
function copySections(source = []) { return source.map((section, sectionIndex) => ({ id: `section-${sectionSequence += 1}`, name: section.name || '', sortOrder: section.sortOrder ?? sectionIndex, isActive: section.isActive !== false, entries: (section.entries || []).map((entry, entryIndex) => ({ id: `entry-${entrySequence += 1}`, item: String(entry.item?._id || entry.item || ''), defaultSelected: entry.defaultSelected !== false, defaultQuantity: entry.defaultQuantity || 1, variationMode: entry.variationMode || 'none', variationKey: entry.variationKey || null, groesseMode: entry.groesseMode || 'none', groesseKey: entry.groesseKey || null, sortOrder: entry.sortOrder ?? entryIndex, isActive: entry.isActive !== false })) })); }
function reset() { name.value = ''; locationPackages.value = []; activeLocationId.value = ''; error.value = ''; }
function populateTemplate(template) {
  name.value = template.name || '';
  const existingPackages = template.locationPackages || [];
  const legacyLocationIds = (template.allowedLocations?.length ? template.allowedLocations : locations.value).map((location) => String(location._id || location));
  locationPackages.value = locations.value.map((location) => {
    const saved = existingPackages.find((locationPackage) => String(locationPackage.location?._id || locationPackage.location) === String(location._id));
    return { location: String(location._id), sections: copySections(saved?.sections || (legacyLocationIds.includes(String(location._id)) ? template.sections : [])) };
  });
  activeLocationId.value = locations.value[0]?._id || '';
}
function initializeNewTemplate() { locationPackages.value = locations.value.map((location) => newLocationPackage(location._id)); activeLocationId.value = locations.value[0]?._id || ''; }
function cleanSections(sections) { return sections.filter((section) => section.name.trim()).map((section, sectionIndex) => ({ name: section.name.trim(), sortOrder: sectionIndex, isActive: section.isActive !== false, entries: section.entries.filter((entry) => entry.item).map((entry, entryIndex) => ({ item: entry.item, defaultSelected: entry.defaultSelected, defaultQuantity: entry.defaultQuantity, variationMode: entry.variationMode, variationKey: entry.variationKey, groesseMode: entry.groesseMode, groesseKey: entry.groesseKey, sortOrder: entryIndex, isActive: entry.isActive !== false })) })); }
async function save() {
  saving.value = true; error.value = '';
  try {
    const packages = locationPackages.value.map((locationPackage) => ({ location: locationPackage.location, sections: cleanSections(locationPackage.sections) }));
    const payload = { name: name.value.trim(), allowedLocations: packages.map((locationPackage) => locationPackage.location), locationPackages: packages, sections: [] };
    const { data } = isEditing.value ? await api.patch(`/api/paket-vorlagen/${props.template._id}`, payload) : await api.post('/api/paket-vorlagen', payload);
    emit(isEditing.value ? 'updated' : 'created', data); close();
  } catch (requestError) { error.value = requestError.response?.data?.message || `Paketvorlage konnte nicht ${isEditing.value ? 'gespeichert' : 'angelegt'} werden.`; } finally { saving.value = false; }
}
watch(() => props.modelValue, async (open) => { if (!open) return; reset(); try { await loadData(); if (props.template) populateTemplate(props.template); else initializeNewTemplate(); } catch { error.value = 'Artikel oder Standorte konnten nicht geladen werden.'; } }, { immediate: true });
</script>

<style scoped lang="scss">
.body { display: grid; flex: 1 1 auto; gap: 18px; min-height: 0; overflow: auto; padding: 20px 22px 24px; }
label { display: grid; gap: 4px; color: var(--muted); font-size: .67rem; font-weight: 700; }
input, select { min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 7px 8px; background: var(--surface, var(--tile-bg)); color: var(--text); font: inherit; font-size: .76rem; }
input:focus, select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 14%, transparent); }
.name-field input { font-size: .84rem; font-weight: 600; }
.location-editor { min-width: 0; }
.location-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 8px 14px 0; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--hover) 52%, transparent); }
.location-tabs button { flex: 0 0 auto; padding: 7px 10px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); cursor: pointer; font: inherit; font-size: .72rem; font-weight: 600; }
.location-tabs button:hover { color: var(--text); }.location-tabs button.active { border-bottom-color: var(--primary); color: var(--primary); }
.location-content { display: grid; gap: 12px; padding: 14px; }.location-context { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: .68rem; }.location-context b { color: var(--text); font-size: .76rem; }
.section-editor { display: grid; gap: 9px; padding: 12px; border: 1px solid var(--border); border-radius: 6px; }.section-heading { display: flex; gap: 8px; }.section-heading input { flex: 1; font-weight: 700; }
.entry-editor { display: grid; grid-template-columns: minmax(220px, 2fr) auto 72px minmax(120px, 1fr) minmax(120px, 1fr) 30px; align-items: end; gap: 7px; }.entry-editor--variation-fixed { grid-template-columns: minmax(170px, 1.45fr) auto 68px 104px minmax(120px, 1fr) minmax(120px, 1fr) 30px; }.entry-editor--groesse-fixed { grid-template-columns: minmax(170px, 1.45fr) auto 68px minmax(120px, 1fr) 104px minmax(120px, 1fr) 30px; }.entry-editor--variation-fixed.entry-editor--groesse-fixed { grid-template-columns: minmax(150px, 1.35fr) auto 68px 100px minmax(110px, 1fr) 100px minmax(110px, 1fr) 30px; }.item-field { min-width: 0; }.toggle-field { display: flex; align-items: center; gap: 5px; padding-bottom: 9px; white-space: nowrap; }.toggle-field input { padding: 0; accent-color: var(--primary); }
.option-label { display: flex; align-items: center; min-height: 32px; color: var(--muted); font-size: .76rem; }.text-button { display: grid; place-items: center; width: 30px; height: 34px; border: 0; border-radius: 5px; background: transparent; color: #c3423f; cursor: pointer; font: inherit; }.text-button:hover { background: color-mix(in srgb, #c3423f 10%, transparent); }.entry-remove { align-self: end; }
.secondary, .primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; padding: 7px 10px; font: inherit; font-size: .72rem; font-weight: 600; }.primary { border-color: var(--primary); background: var(--primary); color: #fff; }.add-row { justify-self: start; }.add-section { justify-self: start; }.error { margin: 0; color: #c3423f; font-size: .72rem; }.empty-state { margin: 0; color: var(--muted); font-size: .74rem; }button:disabled { cursor: not-allowed; opacity: .55; }
@media (max-width: 760px) { .body { padding: 16px; }.entry-editor { grid-template-columns: 1fr 1fr; }.item-field { grid-column: 1 / -1; }.toggle-field { padding-bottom: 0; }.entry-remove { justify-self: end; } }
</style>
