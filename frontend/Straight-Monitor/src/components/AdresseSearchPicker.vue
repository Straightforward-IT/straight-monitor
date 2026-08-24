<template>
  <div class="address-picker" :class="{ 'is-filled': hasValue }">
    <div class="ap-head">
      <span class="ap-role">
        <font-awesome-icon :icon="['fas', 'location-dot']" />
        {{ label }}
      </span>
      <button v-if="removable" class="ap-remove" type="button" :aria-label="`${label} entfernen`" @click="emit('remove')">
        <font-awesome-icon :icon="['fas', 'xmark']" />
      </button>
    </div>

    <div v-if="hasValue" class="ap-selected">
      <div class="ap-marker">
        <font-awesome-icon :icon="['fas', selectedSourceIcon]" />
      </div>
      <div class="ap-selected-info">
        <div class="ap-name">{{ modelValue.name || formattedAddress(modelValue) || 'Adresse' }}</div>
        <div v-if="modelValue.name && formattedAddress(modelValue)" class="ap-address">{{ formattedAddress(modelValue) }}</div>
        <div class="ap-meta">
          <span v-if="modelValue.sourceType === 'einsatzort'" class="ap-badge ap-badge--site">Einsatzort</span>
          <span v-else class="ap-badge">Adresse</span>
          <span v-if="modelValue.customerRelated" class="ap-badge ap-badge--customer">Kunde</span>
        </div>
      </div>
      <button class="ap-change" type="button" aria-label="Adresse ändern" @click="clearSelection">
        <font-awesome-icon :icon="['fas', 'pen']" />
      </button>
    </div>

    <div v-else ref="rootEl" class="ap-search-wrap">
      <div class="ap-search-input">
        <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="ap-search-icon" />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          :placeholder="placeholder"
          @focus="openDropdown = true"
          @input="openDropdown = true"
        />
      </div>

      <div v-if="openDropdown" class="ap-dropdown">
        <div v-if="preferredOptions.length" class="ap-group">
          <div class="ap-group-label">
            <font-awesome-icon :icon="['fas', 'building']" /> Kundenbezogen
          </div>
          <button
            v-for="option in preferredOptions"
            :key="option.key"
            class="ap-result"
            type="button"
            @click="selectOption(option)"
          >
            <span class="ap-result-icon"><font-awesome-icon :icon="['fas', sourceIcon(option)]" /></span>
            <span class="ap-result-info">
              <span class="ap-result-name">{{ option.name }}</span>
              <span class="ap-result-sub">{{ formattedAddress(option) || 'Keine Anschrift hinterlegt' }}</span>
            </span>
            <span class="ap-badge" :class="{ 'ap-badge--site': option.sourceType === 'einsatzort' }">
              {{ option.sourceType === 'einsatzort' ? 'Einsatzort' : 'Adresse' }}
            </span>
          </button>
        </div>

        <div v-if="otherOptions.length" class="ap-group">
          <div class="ap-group-label">
            <font-awesome-icon :icon="['fas', 'map-location-dot']" /> Weitere Adressen
          </div>
          <button
            v-for="option in otherOptions"
            :key="option.key"
            class="ap-result"
            type="button"
            @click="selectOption(option)"
          >
            <span class="ap-result-icon"><font-awesome-icon :icon="['fas', sourceIcon(option)]" /></span>
            <span class="ap-result-info">
              <span class="ap-result-name">{{ option.name }}</span>
              <span class="ap-result-sub">{{ formattedAddress(option) || 'Keine Anschrift hinterlegt' }}</span>
            </span>
            <span class="ap-badge" :class="{ 'ap-badge--site': option.sourceType === 'einsatzort' }">
              {{ option.sourceType === 'einsatzort' ? 'Einsatzort' : 'Adresse' }}
            </span>
          </button>
        </div>

        <div v-if="!visibleOptions.length" class="ap-empty">
          {{ query ? 'Keine passende Adresse gefunden.' : 'Keine Adressen verfügbar.' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faBuilding,
  faLocationDot,
  faMagnifyingGlass,
  faMapLocationDot,
  faPen,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faBuilding, faLocationDot, faMagnifyingGlass, faMapLocationDot, faPen, faXmark);

const props = defineProps({
  // Selected shape: { sourceType, adresseId, einsatzortId, name, strasse, plz, ort, land, customerRelated }
  modelValue: { type: Object, default: null },
  adressen: { type: Array, default: () => [] },
  einsatzorte: { type: Array, default: () => [] },
  kundeId: { type: [String, Object], default: null },
  kundenNr: { type: [String, Number], default: null },
  label: { type: String, default: 'Adresse' },
  placeholder: { type: String, default: 'Adresse oder Einsatzort suchen...' },
  preferredSource: {
    type: String,
    default: 'einsatzort',
    validator: (value) => ['einsatzort', 'adresse', 'none'].includes(value),
  },
  limit: { type: Number, default: 12 },
  removable: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'select', 'remove']);
const rootEl = ref(null);
const inputEl = ref(null);
const query = ref('');
const openDropdown = ref(false);

const hasValue = computed(() => Boolean(
  props.modelValue?.adresseId
  || props.modelValue?.einsatzortId
  || props.modelValue?.name
  || formattedAddress(props.modelValue),
));
const selectedSourceIcon = computed(() => props.modelValue?.sourceType === 'einsatzort' ? 'map-location-dot' : 'location-dot');

function objectId(value) {
  return String(value?._id || value || '');
}

function isCustomerAddress(address) {
  if (address.customerRelated === true) return true;
  const optionKundenNr = String(address.knr ?? address.kundenNr ?? '').trim();
  return optionKundenNr && optionKundenNr === String(props.kundenNr ?? '').trim();
}

function isCustomerSite(site) {
  if (site.customerRelated === true) return true;
  return objectId(site.kunde) && objectId(site.kunde) === objectId(props.kundeId);
}

function normalizeAddress(address) {
  return {
    key: `adresse-${address._id || address.nummer}`,
    sourceType: 'adresse',
    adresseId: address._id || null,
    einsatzortId: null,
    nummer: address.nummer || null,
    name: address.name || [address.name1, address.name2].filter(Boolean).join(' ') || 'Adresse',
    strasse: address.strasse || '',
    plz: address.plz || '',
    ort: address.ort || '',
    land: address.land || '',
    customerRelated: isCustomerAddress(address),
  };
}

function normalizeSite(site) {
  const address = site.adresse || {};
  return {
    key: `einsatzort-${site._id}`,
    sourceType: 'einsatzort',
    adresseId: address._id || null,
    einsatzortId: site._id || null,
    nummer: address.nummer || null,
    name: site.bezeichnung || address.name || 'Einsatzort',
    strasse: address.strasse || '',
    plz: address.plz || '',
    ort: address.ort || '',
    land: address.land || '',
    customerRelated: isCustomerSite(site),
  };
}

const normalizedOptions = computed(() => [
  ...props.einsatzorte.filter((site) => site.isActive !== false).map(normalizeSite),
  ...props.adressen.filter((address) => address.isActive !== false).map(normalizeAddress),
]);

const visibleOptions = computed(() => {
  const search = query.value.trim().toLocaleLowerCase('de');
  const sourceRank = (option) => props.preferredSource === 'none' || option.sourceType === props.preferredSource ? 0 : 1;
  return normalizedOptions.value
    .filter((option) => !search || [option.name, option.strasse, option.plz, option.ort, option.land, option.nummer]
      .some((value) => String(value || '').toLocaleLowerCase('de').includes(search)))
    .sort((first, second) => Number(second.customerRelated) - Number(first.customerRelated)
      || sourceRank(first) - sourceRank(second)
      || first.name.localeCompare(second.name, 'de'))
    .slice(0, props.limit);
});

const preferredOptions = computed(() => visibleOptions.value.filter((option) => option.customerRelated));
const otherOptions = computed(() => visibleOptions.value.filter((option) => !option.customerRelated));

function formattedAddress(address = {}) {
  return [address.strasse, [address.plz, address.ort].filter(Boolean).join(' '), address.land]
    .filter(Boolean)
    .join(', ');
}

function sourceIcon(option) {
  return option.sourceType === 'einsatzort' ? 'map-location-dot' : 'location-dot';
}

function selectOption(option) {
  const { key, ...selected } = option;
  emit('update:modelValue', selected);
  emit('select', selected);
  query.value = '';
  openDropdown.value = false;
}

function clearSelection() {
  emit('update:modelValue', null);
  query.value = '';
  openDropdown.value = true;
  requestAnimationFrame(() => inputEl.value?.focus());
}

function onClickOutside(event) {
  if (rootEl.value && !rootEl.value.contains(event.target)) openDropdown.value = false;
}

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

<style scoped lang="scss">
.address-picker {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg, var(--surface));

  &.is-filled { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
}

.ap-head,
.ap-selected,
.ap-search-input,
.ap-result,
.ap-role,
.ap-meta,
.ap-group-label {
  display: flex;
  align-items: center;
}

.ap-head { justify-content: space-between; margin-bottom: 8px; }
.ap-role { gap: 6px; color: var(--primary); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
.ap-remove { padding: 2px 4px; border: 0; border-radius: 4px; background: none; color: var(--muted); cursor: pointer; }
.ap-remove:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.ap-selected { gap: 10px; }
.ap-marker { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--primary) 14%, var(--surface)); color: var(--primary); }
.ap-selected-info,
.ap-result-info { flex: 1; min-width: 0; }
.ap-name,
.ap-result-name { overflow: hidden; color: var(--text); font-size: 0.88rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.ap-address,
.ap-result-sub { overflow: hidden; margin-top: 2px; color: var(--muted); font-size: 0.74rem; text-overflow: ellipsis; white-space: nowrap; }
.ap-meta { gap: 5px; margin-top: 5px; }
.ap-change { display: grid; width: 28px; height: 28px; flex: 0 0 auto; place-items: center; border: 1px solid var(--border); border-radius: 6px; background: none; color: var(--muted); cursor: pointer; }
.ap-change:hover { border-color: var(--primary); color: var(--primary); }
.ap-search-wrap { position: relative; }
.ap-search-input { gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg, var(--surface)); }
.ap-search-icon { color: var(--muted); font-size: 0.8rem; }
.ap-search-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: 0.85rem; }
.ap-dropdown { position: absolute; z-index: 50; top: calc(100% + 4px); right: 0; left: 0; max-height: 340px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg, var(--surface)); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18); }
.ap-group { padding: 4px; }
.ap-group + .ap-group { border-top: 1px solid var(--border); }
.ap-group-label { gap: 6px; padding: 6px 8px 4px; color: var(--muted); font-size: 0.66rem; font-weight: 700; text-transform: uppercase; }
.ap-result { gap: 10px; width: 100%; padding: 8px; border: 0; border-radius: 6px; background: none; cursor: pointer; text-align: left; }
.ap-result:hover { background: var(--hover); }
.ap-result-icon { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border-radius: 6px; background: var(--hover); color: var(--primary); }
.ap-badge { flex: 0 0 auto; padding: 2px 7px; border-radius: 10px; background: var(--hover); color: var(--muted); font-size: 0.62rem; font-weight: 700; }
.ap-badge--site { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); }
.ap-badge--customer { background: color-mix(in srgb, #10b981 16%, transparent); color: #0f8a62; }
.ap-empty { padding: 16px; color: var(--muted); font-size: 0.78rem; text-align: center; }
</style>
