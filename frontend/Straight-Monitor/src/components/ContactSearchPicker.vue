<template>
  <div class="contact-picker" :class="{ 'is-filled': hasValue }">
    <!-- Role header -->
    <div class="cp-head">
      <span class="cp-role">
        <font-awesome-icon :icon="['fas', 'user-pen']" />
        {{ roleName }}
      </span>
      <button v-if="removable" class="cp-remove" type="button" title="Unterzeichner entfernen" @click="$emit('remove')">
        <font-awesome-icon :icon="['fas', 'xmark']" />
      </button>
    </div>

    <!-- Selected state -->
    <div v-if="hasValue" class="cp-selected">
      <img v-if="profilePhotoUrl" class="cp-avatar cp-avatar--image" :src="profilePhotoUrl" alt="" />
      <div v-else class="cp-avatar" :style="avatarStyle">{{ initials }}</div>
      <div class="cp-selected-info">
        <button v-if="selectedEmployeeId" class="cp-name cp-name-link" type="button" @click="profileEmployeeId = selectedEmployeeId">
          {{ modelValue.name || '—' }}
        </button>
        <div v-else class="cp-name">{{ modelValue.name || '—' }}</div>
        <div class="cp-email">{{ modelValue.email || 'Keine E-Mail' }}</div>
      </div>
      <div class="cp-selected-actions">
        <button
          v-if="showDeliveryMethod"
          class="cp-embed-toggle"
          type="button"
          :title="modelValue.embedded ? 'Klicken: Per E-Mail senden' : 'Klicken: In der App unterschreiben'"
          @click="updateField('embedded', !modelValue.embedded)"
        >
          <span class="cp-toggle-side" :class="{ 'is-active': modelValue.embedded }">
            <font-awesome-icon :icon="['fas', 'mobile-screen']" />
            In-App
          </span>
          <span class="cp-toggle-side" :class="{ 'is-active': !modelValue.embedded }">
            <font-awesome-icon :icon="['fas', 'envelope']" />
            E-Mail
          </span>
        </button>
        <button v-if="!locked" class="cp-change" type="button" title="Ändern" @click="clearSelection">
          <font-awesome-icon :icon="['fas', 'pen']" />
        </button>
      </div>
    </div>

    <EmployeeCardModal
      v-if="profileEmployeeId"
      :mitarbeiter-id="profileEmployeeId"
      @close="profileEmployeeId = null"
    />

    <!-- Search state -->
    <div v-if="!hasValue && !locked" class="cp-search-wrap" ref="rootEl">
      <div class="cp-search-input">
        <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="cp-search-icon" />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          :placeholder="`${roleName} suchen oder eingeben…`"
          @focus="openSearch"
          @input="openSearch"
        />
      </div>

      <Teleport to="body">
      <div v-if="openDropdown" ref="dropdownEl" class="cp-dropdown" :style="dropdownStyle">
        <!-- Externe Kontakte (Graph) -->
        <div v-if="filteredContacts.length" class="cp-group">
          <div class="cp-group-label">
            <font-awesome-icon :icon="['fas', 'address-book']" /> Externe Kontakte
          </div>
          <button
            v-for="c in filteredContacts"
            :key="'g-' + c.id"
            class="cp-result"
            type="button"
            @click="selectContact(c)"
          >
            <div class="cp-avatar cp-avatar--sm" :style="colorFor(c.displayName)">{{ initialsOf(c.displayName) }}</div>
            <div class="cp-result-info">
              <div class="cp-result-name">{{ c.displayName || contactEmail(c) }}</div>
              <div class="cp-result-sub">{{ contactEmail(c) }}</div>
            </div>
            <span v-if="c.companyName" class="cp-badge cp-badge--company">{{ c.companyName }}</span>
          </button>
        </div>

        <!-- Mitarbeiter (intern) -->
        <div v-if="filteredMitarbeiter.length" class="cp-group">
          <div class="cp-group-label">
            <font-awesome-icon :icon="['fas', 'id-badge']" /> Mitarbeiter
          </div>
          <button
            v-for="m in filteredMitarbeiter"
            :key="'m-' + m._id"
            class="cp-result"
            type="button"
            @click="selectMitarbeiter(m)"
          >
            <div class="cp-avatar cp-avatar--sm" :style="colorFor(m.vorname + m.nachname)">
              {{ initialsOf(`${m.vorname} ${m.nachname}`) }}
            </div>
            <div class="cp-result-info">
              <div class="cp-result-name">{{ m.vorname }} {{ m.nachname }}</div>
              <div class="cp-result-sub">{{ m.email || 'Keine E-Mail' }}</div>
            </div>
            <span class="cp-badge cp-badge--intern">Intern</span>
          </button>
        </div>

        <!-- Manual entry -->
        <div class="cp-group cp-group--manual">
          <button class="cp-result cp-result--manual" type="button" @click="useManual">
            <div class="cp-avatar cp-avatar--sm cp-avatar--ghost">
              <font-awesome-icon :icon="['fas', 'keyboard']" />
            </div>
            <div class="cp-result-info">
              <div class="cp-result-name">Manuell eingeben</div>
              <div class="cp-result-sub">{{ query ? `„${query}" als E-Mail übernehmen` : 'Name & E-Mail selbst eingeben' }}</div>
            </div>
          </button>
        </div>

        <div v-if="!filteredContacts.length && !filteredMitarbeiter.length && !query" class="cp-empty">
          Tippe, um Kontakte zu durchsuchen…
        </div>
      </div>
      </Teleport>
    </div>

    <!-- Manual entry fields (shown when manual mode active but not yet filled) -->
    <div v-if="manualMode && !hasValue" class="cp-manual-fields">
      <input
        v-model="manualName"
        type="text"
        class="cp-manual-input"
        placeholder="Name"
        @change="syncManual"
        @keydown.enter.prevent="syncManual"
      />
      <input
        v-model="manualEmail"
        type="email"
        class="cp-manual-input"
        placeholder="E-Mail"
        @input="syncManual"
        @change="confirmManual"
        @keydown.enter.prevent="confirmManual"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faUserPen, faXmark, faMagnifyingGlass, faAddressBook, faIdBadge, faKeyboard, faPen, faMobileScreen, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import { useFlipAll } from '@/stores/flipAll';

const EmployeeCardModal = defineAsyncComponent(() => import('@/components/Modals/EmployeeCardModal.vue'));

library.add(faUserPen, faXmark, faMagnifyingGlass, faAddressBook, faIdBadge, faKeyboard, faPen, faMobileScreen, faEnvelope);

const props = defineProps({
  // Submitter object: { role, name, email, embedded }
  modelValue: { type: Object, required: true },
  roleName:   { type: String, default: 'Unterzeichner' },
  contacts:   { type: Array, default: () => [] },   // MS Graph contacts
  mitarbeiter:{ type: Array, default: () => [] },   // internal employees
  mitarbeiterId: { type: String, default: null },
  kuerzel:    { type: String, default: null },      // Kunde-Kürzel → prioritise matching contacts
  removable:  { type: Boolean, default: true },
  locked:     { type: Boolean, default: false },
  showDeliveryMethod: { type: Boolean, default: true },
  excludedEmails: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'remove', 'selected']);
const flip = useFlipAll();

const rootEl = ref(null);
const dropdownEl = ref(null);
const inputEl = ref(null);
const dropdownStyle = ref({});
const query = ref('');
const openDropdown = ref(false);
const manualMode = ref(false);
const manualName = ref('');
const manualEmail = ref('');
const profileEmployeeId = ref(null);
const profilePhotoUrl = ref('');

const hasValue = computed(() => !!(props.modelValue.name || props.modelValue.email));
const selectedMitarbeiter = computed(() => {
  const id = props.modelValue.mitarbeiterId || props.mitarbeiterId;
  if (id) return props.mitarbeiter.find(employee => employee._id === id) || null;
  const email = String(props.modelValue.email || '').trim().toLowerCase();
  return email
    ? props.mitarbeiter.find(employee => String(employee.email || '').trim().toLowerCase() === email) || null
    : null;
});
const selectedEmployeeId = computed(() => selectedMitarbeiter.value?._id || null);

watch(selectedMitarbeiter, async employee => {
  profilePhotoUrl.value = '';
  if (!employee?.flip_id || !flip.enablePhotos) return;
  await flip.fetchAll();
  const flipUser = flip.getById(employee.flip_id) || await flip.fetchFlipById(employee.flip_id);
  if (!flipUser?.profilbild) return;
  profilePhotoUrl.value = await flip.ensurePhoto(flipUser);
}, { immediate: true });

function updateDropdownPosition() {
  if (!rootEl.value) return;
  const rect = rootEl.value.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const opensUp = spaceBelow < 220 && rect.top > spaceBelow;
  dropdownStyle.value = {
    position: 'fixed',
    top: opensUp ? 'auto' : `${rect.bottom + 4}px`,
    bottom: opensUp ? `${window.innerHeight - rect.top + 4}px` : 'auto',
    left: `${rect.left}px`,
    right: 'auto',
    width: `${rect.width}px`,
  };
}

async function openSearch() {
  openDropdown.value = true;
  await nextTick();
  updateDropdownPosition();
}

const initials = computed(() => initialsOf(props.modelValue.name || props.modelValue.email || '?'));

const avatarStyle = computed(() => colorFor(props.modelValue.name || props.modelValue.email || ''));
const excludedEmailSet = computed(() => new Set(
  props.excludedEmails.map(email => String(email || '').trim().toLowerCase()).filter(Boolean)
));

function contactEmail(c) {
  return (c.emailAddresses && c.emailAddresses[0] && c.emailAddresses[0].address) || '';
}

function initialsOf(str) {
  const parts = String(str).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(str) {
  let hash = 0;
  for (let i = 0; i < String(str).length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { background: `hsl(${hue}, 45%, 45%)` };
}

const filteredContacts = computed(() => {
  const q = query.value.trim().toLowerCase();
  let list = props.contacts;
  // Prioritise contacts that belong to the linked Kunde (companyName === kuerzel)
  if (props.kuerzel) {
    const k = props.kuerzel.toLowerCase();
    list = [...list].sort((a, b) => {
      const am = (a.companyName || '').toLowerCase() === k ? 0 : 1;
      const bm = (b.companyName || '').toLowerCase() === k ? 0 : 1;
      return am - bm;
    });
  }
  if (q) {
    list = list.filter(c =>
      (c.displayName || '').toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      contactEmail(c).toLowerCase().includes(q)
    );
  }
  return list
    .filter(c => !excludedEmailSet.value.has(contactEmail(c).trim().toLowerCase()))
    .slice(0, 6);
});

const filteredMitarbeiter = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return props.mitarbeiter
    .filter(m =>
      `${m.vorname} ${m.nachname}`.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    )
    .filter(m => !excludedEmailSet.value.has(String(m.email || '').trim().toLowerCase()))
    .slice(0, 6);
});

function updateField(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value });
}

function selectContact(c) {
  const selected = {
    ...props.modelValue,
    name: c.displayName || '',
    email: contactEmail(c),
    embedded: false,
    mitarbeiterId: null,
  };
  emit('update:modelValue', selected);
  emit('selected', selected);
  reset();
}

function selectMitarbeiter(m) {
  const selected = {
    ...props.modelValue,
    name: `${m.vorname} ${m.nachname}`.trim(),
    email: m.email || '',
    mitarbeiterId: m._id,
    // preserve embedded state set by the role default; don't force true
  };
  emit('update:modelValue', selected);
  emit('selected', selected);
  reset();
}

function useManual() {
  manualMode.value = true;
  manualName.value = '';
  manualEmail.value = query.value;
  openDropdown.value = false;
}

function syncManual() {
  emit('update:modelValue', {
    ...props.modelValue,
    name: manualName.value,
    email: manualEmail.value,
  });
}

function confirmManual() {
  const selected = {
    ...props.modelValue,
    name: manualName.value,
    email: manualEmail.value,
  };
  emit('update:modelValue', selected);
  if (/\S+@\S+\.\S+/.test(manualEmail.value.trim())) emit('selected', selected);
}

function clearSelection() {
  emit('update:modelValue', { ...props.modelValue, name: '', email: '', mitarbeiterId: null });
  reset();
  manualMode.value = false;
}

function reset() {
  query.value = '';
  openDropdown.value = false;
  manualMode.value = false;
}

function onClickOutside(e) {
  if (rootEl.value && !rootEl.value.contains(e.target) && !dropdownEl.value?.contains(e.target)) {
    openDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  window.addEventListener('scroll', updateDropdownPosition, true);
  window.addEventListener('resize', updateDropdownPosition);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
});
</script>

<style scoped lang="scss">
.contact-picker {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--tile-bg, var(--surface));
  padding: 10px 12px;
  transition: border-color 0.2s;

  &.is-filled {
    border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
  }
}

.cp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cp-role {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 4px;
  &:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
}

/* Selected card */
.cp-selected {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-avatar {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 0.82rem;
  flex-shrink: 0;

  &--sm { width: 30px; height: 30px; border-radius: 7px; font-size: 0.7rem; }
  &--ghost { background: var(--hover) !important; color: var(--muted); }
  &--image { object-fit: cover; }
}

.cp-selected-info {
  flex: 1;
  min-width: 0;
}

.cp-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-name-link {
  display: block;
  width: fit-content;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  text-align: left;

  &:hover { color: var(--primary); text-decoration: underline; }
}

.cp-email {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-selected-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cp-embed-toggle {
  display: flex;
  align-items: center;
  background: var(--hover, rgba(255,255,255,0.07));
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2px;
  cursor: pointer;
  gap: 0;
  transition: border-color 0.15s;

  &:hover { border-color: var(--primary); }

  .cp-toggle-side {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 18px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--muted);
    transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    white-space: nowrap;

    &.is-active {
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
    }
  }
}

.cp-change {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  &:hover { color: var(--primary); border-color: var(--primary); }
}

/* Search */
.cp-search-wrap {
  position: relative;
}

.cp-search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg, var(--surface));

  .cp-search-icon { color: var(--muted); font-size: 0.8rem; }

  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font-size: 0.85rem;
    font-family: inherit;
  }
}

.cp-dropdown {
  position: fixed;
  z-index: 10050;
  background: var(--tile-bg, var(--surface));
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}

.cp-group {
  padding: 4px;
  &:not(:last-child) { border-bottom: 1px solid var(--border); }

  &--manual { background: color-mix(in srgb, var(--hover) 40%, transparent); }
}

.cp-group-label {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  padding: 6px 8px 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;

  &:hover { background: var(--hover); }
  &--manual:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
}

.cp-result-info { flex: 1; min-width: 0; }

.cp-result-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-result-sub {
  font-size: 0.74rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-badge {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;

  &--company {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
  }
  &--intern {
    background: color-mix(in srgb, #10b981 18%, transparent);
    color: #10b981;
  }
}

.cp-empty {
  padding: 14px;
  text-align: center;
  font-size: 0.78rem;
  color: var(--muted);
}

.cp-manual-fields {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.cp-manual-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg, var(--surface));
  color: var(--text);
  font-size: 0.83rem;
  font-family: inherit;
  outline: none;
  &:focus { border-color: var(--primary); }
}
</style>
