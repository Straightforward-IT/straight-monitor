<template>
  <ModalFrame
    v-if="modelValue"
    minimizable
    size="xl"
    subtitle="Paketvorlage"
    :title="isEditing ? 'Vorlage bearbeiten' : 'Neue Vorlage'"
    style="--mf-max-width: 820px; --mf-max-height: 88dvh; --mf-body-padding: 0; --mf-body-overflow: hidden"
    @close="close"
  >
    <div class="body">
          <label>Name<input v-model="name" type="text" placeholder="z. B. Service-Paket" /></label>
          <section><div class="section-heading"><h4>Standorte</h4></div><div class="location-chips"><label v-for="location in locations" :key="location._id"><input v-model="allowedLocations" type="checkbox" :value="location._id" /> {{ location.shortName }} · {{ location.nameFull }}</label></div></section>
          <section v-for="(section, sectionIndex) in sections" :key="section.id" class="section-editor">
            <div class="section-heading"><input v-model="section.name" type="text" placeholder="Kategorie" /><button type="button" class="text-button" @click="sections.splice(sectionIndex, 1)">Entfernen</button></div>
            <div v-for="(entry, entryIndex) in section.entries" :key="entry.id" class="entry-editor">
              <select v-model="entry.item"><option value="">Artikel wählen</option><option v-for="item in catalogue" :key="item._id" :value="item._id">{{ item.bezeichnung }}</option></select>
              <label class="inline"><input v-model="entry.defaultSelected" type="checkbox" /> Standard an</label>
              <label>Menge<input v-model.number="entry.defaultQuantity" type="number" min="1" /></label>
              <label>Variation<select v-model="entry.variationMode"><option value="none">Keine</option><option value="fixed">Fest</option><option value="choose">Wählbar</option></select></label>
              <select v-if="entry.variationMode === 'fixed'" v-model="entry.variationKey"><option value="">Variation wählen</option><option v-for="option in itemFor(entry)?.variationen || []" :key="option.key" :value="option.key">{{ option.label }}</option></select>
              <label>Größe<select v-model="entry.groesseMode"><option value="none">Keine</option><option value="fixed">Fest</option><option value="choose">Wählbar</option></select></label>
              <select v-if="entry.groesseMode === 'fixed'" v-model="entry.groesseKey"><option value="">Größe wählen</option><option v-for="option in itemFor(entry)?.groessen || []" :key="option.key" :value="option.key">{{ option.label }}</option></select>
              <button type="button" class="text-button" @click="section.entries.splice(entryIndex, 1)">Zeile entfernen</button>
            </div>
            <button type="button" class="secondary" @click="section.entries.push(newEntry())"><font-awesome-icon :icon="['fas', 'plus']" /> Artikel hinzufügen</button>
          </section>
          <button type="button" class="secondary" @click="sections.push(newSection())"><font-awesome-icon :icon="['fas', 'plus']" /> Kategorie hinzufügen</button>
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
import { faCheck, faPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import ModalFrame from '@/components/frames/ModalFrame.vue';

library.add(faCheck, faPlus, faSpinner);
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  template: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'created', 'updated']);
const locations = ref([]); const catalogue = ref([]); const name = ref(''); const allowedLocations = ref([]); const sections = ref([]); const saving = ref(false); const error = ref('');
let entrySequence = 0; let sectionSequence = 0;
const newEntry = () => ({ id: `entry-${entrySequence += 1}`, item: '', defaultSelected: true, defaultQuantity: 1, variationMode: 'none', variationKey: null, groesseMode: 'none', groesseKey: null, sortOrder: 0, isActive: true });
const newSection = () => ({ id: `section-${sectionSequence += 1}`, name: '', entries: [newEntry()], sortOrder: sections.value.length, isActive: true });
const isEditing = computed(() => Boolean(props.template?._id));
const canSave = computed(() => name.value.trim() && sections.value.some((section) => section.name.trim() && section.entries.some((entry) => entry.item)));
const itemFor = (entry) => catalogue.value.find((item) => item._id === entry.item);
function close() { emit('update:modelValue', false); }
async function loadData() { const [locationsResponse, itemsResponse] = await Promise.all([api.get('/api/locations'), api.get('/api/inventory/items')]); locations.value = locationsResponse.data; catalogue.value = itemsResponse.data; }
function reset() { name.value = ''; allowedLocations.value = []; sections.value = [newSection()]; error.value = ''; }
function populateTemplate(template) {
  name.value = template.name || '';
  allowedLocations.value = (template.allowedLocations || []).map((location) => String(location._id || location));
  sections.value = (template.sections || []).map((section, sectionIndex) => ({
    id: `section-${sectionSequence += 1}`,
    name: section.name || '',
    sortOrder: section.sortOrder ?? sectionIndex,
    isActive: section.isActive !== false,
    entries: (section.entries || []).map((entry, entryIndex) => ({
      id: `entry-${entrySequence += 1}`,
      item: String(entry.item?._id || entry.item || ''),
      defaultSelected: entry.defaultSelected !== false,
      defaultQuantity: entry.defaultQuantity || 1,
      variationMode: entry.variationMode || 'none',
      variationKey: entry.variationKey || null,
      groesseMode: entry.groesseMode || 'none',
      groesseKey: entry.groesseKey || null,
      sortOrder: entry.sortOrder ?? entryIndex,
      isActive: entry.isActive !== false,
    })),
  }));
}
async function save() {
  saving.value = true; error.value = '';
  try {
    const payload = { name: name.value, allowedLocations: allowedLocations.value, sections: sections.value.filter((section) => section.name.trim()).map((section, sectionIndex) => ({ name: section.name, sortOrder: sectionIndex, isActive: section.isActive !== false, entries: section.entries.filter((entry) => entry.item).map((entry, entryIndex) => ({ item: entry.item, defaultSelected: entry.defaultSelected, defaultQuantity: entry.defaultQuantity, variationMode: entry.variationMode, variationKey: entry.variationKey, groesseMode: entry.groesseMode, groesseKey: entry.groesseKey, sortOrder: entryIndex, isActive: entry.isActive !== false })) })) };
    const { data } = isEditing.value
      ? await api.patch(`/api/paket-vorlagen/${props.template._id}`, payload)
      : await api.post('/api/paket-vorlagen', payload);
    emit(isEditing.value ? 'updated' : 'created', data); close();
  } catch (requestError) { error.value = requestError.response?.data?.message || `Paketvorlage konnte nicht ${isEditing.value ? 'gespeichert' : 'angelegt'} werden.`; } finally { saving.value = false; }
}
watch(() => props.modelValue, async (open) => { if (!open) return; reset(); try { await loadData(); if (props.template) populateTemplate(props.template); } catch { error.value = 'Artikel oder Standorte konnten nicht geladen werden.'; } }, { immediate: true });
</script>

<style scoped lang="scss">
.body { display: grid; gap: 16px; min-height: 0; overflow: auto; padding: 18px; }label { display: grid; gap: 5px; font-size: .76rem; font-weight: 600; }input, select { min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 8px; background: var(--surface, var(--tile-bg)); color: var(--text); font: inherit; }input:focus, select:focus { outline: none; border-color: var(--primary); }.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.section-heading h4 { margin: 0; font-size: .88rem; }.section-heading input { flex: 1; font-weight: 700; }.location-chips { display: flex; flex-wrap: wrap; gap: 7px; }.location-chips label { display: inline-flex; grid-auto-flow: column; align-items: center; gap: 5px; padding: 7px; border: 1px solid var(--border); border-radius: 6px; font-weight: 400; }.section-editor { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 7px; }.entry-editor { display: grid; grid-template-columns: minmax(150px, 1.3fr) auto 70px 110px minmax(100px, 1fr) 110px minmax(100px, 1fr) auto; align-items: end; gap: 7px; }.entry-editor label { font-size: .66rem; }.entry-editor .inline { display: flex; align-items: center; gap: 5px; padding-bottom: 8px; white-space: nowrap; }.entry-editor .inline input { padding: 0; }.text-button { border: 0; background: transparent; color: #c3423f; cursor: pointer; font: inherit; font-size: .72rem; }.secondary, .primary { border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; padding: 8px 11px; font: inherit; font-weight: 600; }.primary { border-color: var(--primary); background: var(--primary); color: #fff; }.error { margin: 0; color: #c3423f; font-size: .78rem; }button:disabled { cursor: not-allowed; opacity: .55; }@media (max-width: 760px) { .entry-editor { grid-template-columns: 1fr 1fr; } .entry-editor > select:first-child { grid-column: 1 / -1; } }
</style>
