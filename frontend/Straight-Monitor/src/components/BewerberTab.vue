<template>
  <section class="bewerber-tab">
    <Toolbar>
      <ToolbarFilter
        v-model="filterExpanded"
        :active-count="selectedLocationKey ? 1 : 0"
        @reset="loadSections()"
      >
        <FilterGroup label="Standort">
          <LocationFilter
            :model-value="selectedLocationKey"
            :locations="locations"
            :allow-all="false"
            @update:model-value="selectLocation"
          />
        </FilterGroup>
      </ToolbarFilter>
    </Toolbar>

    <p v-if="loading" class="bewerber-tab__state">Asana-Bereiche werden geladen …</p>
    <p v-else-if="error" class="bewerber-tab__state bewerber-tab__state--error">{{ error }}</p>
    <p v-else-if="!columns.length" class="bewerber-tab__state">Für diesen Standort sind keine Asana-Bereiche vorhanden.</p>
    <WorkflowBoard
      v-else
      class="bewerber-tab__board"
      :records="[]"
      :columns="columns"
      stage-key="sectionId"
      record-key="gid"
      drag-group="bewerber-board"
      aria-label="Bewerber-Board nach Asana-Bereichen"
      :show-empty-state="false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '@/utils/api';
import FilterGroup from '@/components/FilterGroup.vue';
import LocationFilter from '@/components/ui-elements/LocationFilter.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import WorkflowBoard from '@/components/workflow/WorkflowBoard.vue';

defineProps({
  initialApplicantId: { type: String, default: '' },
});

const SECTION_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#f97316', '#22c55e', '#ef4444', '#a855f7'];

const locations = ref([]);
const selectedLocationKey = ref(null);
const filterExpanded = ref(false);
const sections = ref([]);
const loading = ref(false);
const error = ref('');

const columns = computed(() => sections.value.map((section, index) => ({
  id: section.gid,
  label: section.name || 'Unbenannter Bereich',
  color: SECTION_COLORS[index % SECTION_COLORS.length],
})));

async function loadSections(teamKey = null) {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/bewerber/asana-sections', {
      params: teamKey ? { teamKey } : {},
    });
    const board = data?.data || {};
    locations.value = board.locations || [];
    selectedLocationKey.value = board.selectedLocationKey || null;
    sections.value = board.sections || [];
  } catch (requestError) {
    sections.value = [];
    error.value = requestError.response?.data?.message || 'Asana-Bereiche konnten nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

function selectLocation(locationKey) {
  if (!locationKey || locationKey === selectedLocationKey.value) return;
  loadSections(locationKey);
}

onMounted(() => loadSections());
</script>

<style scoped lang="scss">
.bewerber-tab { display: flex; flex-direction: column; min-height: 600px; }
.bewerber-tab__board { flex: 1; min-height: 420px; padding: 0; }
.bewerber-tab__state { color: var(--muted); margin: 0; padding: 40px 0; text-align: center; }
.bewerber-tab__state--error { color: var(--danger, #b91c1c); }
</style>
