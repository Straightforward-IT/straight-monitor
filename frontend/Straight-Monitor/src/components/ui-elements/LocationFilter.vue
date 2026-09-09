<template>
  <div class="location-filter" role="group" aria-label="Standort">
    <FilterChip
      v-if="allowAll"
      :active="!modelValue"
      @click="select(null)"
    >Alle Standorte</FilterChip>
    <FilterChip
      v-for="location in availableLocations"
      :key="location._id"
      class="location-filter__chip"
      :active="String(modelValue) === String(location._id)"
      :style="{ '--location-color': location.color || '#6b7280' }"
      @click="select(String(location._id))"
    >{{ location.shortName || location.nameFull }}</FilterChip>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '@/utils/api';
import FilterChip from '@/components/ui-elements/FilterChip.vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  locations: { type: Array, default: null },
  allowAll: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue', 'change']);
const loadedLocations = ref([]);

const availableLocations = computed(() => props.locations || loadedLocations.value);

function select(locationId) {
  const nextLocationId = String(props.modelValue || '') === String(locationId || '') ? null : locationId;
  const location = availableLocations.value.find((item) => String(item._id) === String(nextLocationId)) || null;
  emit('update:modelValue', nextLocationId);
  emit('change', location);
}

onMounted(async () => {
  if (props.locations) return;
  try {
    const { data } = await api.get('/api/locations');
    loadedLocations.value = (data || []).filter((location) => location.isActive !== false);
  } catch {
    loadedLocations.value = [];
  }
});
</script>

<style scoped>
.location-filter {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}

.location-filter__chip {
  --brand: var(--location-color);
  --filter-chip-accent: var(--location-color);
}
</style>