<template>
  <DashboardWidget
    title="Office Besetzung"
    :icon="['fas', 'building']"
    title-link-to="/personal"
    :loading="loading"
  >
    <template #actions>
      <div
        class="office-date-nav"
        aria-label="Office-Datum auswählen"
      >
        <button
          type="button"
          class="office-date-nav__button"
          aria-label="Vorheriger Tag"
          title="Vorheriger Tag"
          @click="changeDate(-1)"
        >
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <DatePicker
          v-model="selectedDateValue"
          mode="day"
        >
          <template #default="{ toggle }">
            <button
              type="button"
              class="office-date-nav__label"
              aria-label="Datum auswählen"
              title="Datum auswählen"
              @click="toggle"
            >
              {{ dateLabel }}
            </button>
          </template>
        </DatePicker>
        <button
          type="button"
          class="office-date-nav__button"
          aria-label="Nächster Tag"
          title="Nächster Tag"
          @click="changeDate(1)"
        >
          <font-awesome-icon :icon="['fas', 'arrow-right']" />
        </button>
      </div>
    </template>

    <div class="office-groups">
      <section
        v-for="group in officeGroups"
        :key="group.key"
        class="office-group"
      >
        <h4 class="office-group__title">
          {{ group.label }}
        </h4>
        <ul class="office-list">
          <li
            v-for="entry in group.users"
            :key="entry._id"
            class="office-item"
          >
            <button
              type="button"
              class="office-user"
              :aria-label="`${employeeName(entry)} öffnen`"
              @click="profileEmployeeId = entry.mitarbeiter._id"
            >
              <img
                v-if="profilePictureUrls[entry.mitarbeiter._id]"
                :src="profilePictureUrls[entry.mitarbeiter._id]"
                :alt="`${employeeName(entry)} Profilbild`"
                class="office-user__avatar"
                @error="profilePictureUrls[entry.mitarbeiter._id] = ''"
              >
              <span
                v-else
                class="office-user__initials"
              >
                {{ initials(entry) }}
              </span>
              <span class="office-user__info">
                <span class="office-user__name">{{ employeeName(entry) }}</span>
                <span class="office-user__meta">
                  {{ entry.assignment?.uhrzeitVon || '--:--' }}<template v-if="entry.assignment?.uhrzeitBis">–{{ entry.assignment.uhrzeitBis }}</template>
                </span>
              </span>
            </button>
            <button
              type="button"
              class="office-actions"
              :aria-label="`${employeeName(entry)} Aktionen`"
              title="Aktionen"
              @click="openContextMenu(entry, $event)"
            >
              <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
            </button>
          </li>
        </ul>
      </section>
    </div>
    <div
      v-if="!loading && error"
      class="office-empty office-empty--error"
    >
      {{ error }}
    </div>
    <div
      v-else-if="!loading && !officeUsers.length"
      class="office-empty"
    >
      Heute ist niemand im Office eingeplant.
    </div>

    <EmployeeCardModal
      v-if="profileEmployeeId"
      :mitarbeiter-id="profileEmployeeId"
      @close="profileEmployeeId = null"
    />

    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      title="Mitarbeiter"
      @select="handleContextMenuAction"
      @close="closeContextMenu"
    />
  </DashboardWidget>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import DashboardWidget from './DashboardWidget.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import EmployeeCardModal from '@/components/Modals/EmployeeCardModal.vue';
import DatePicker from '@/components/ui-elements/DatePicker.vue';

const router = useRouter();
const officeUsers = ref([]);
const selectedDate = ref(toDateKey(new Date()));
const profilePictureUrls = ref({});
const loading = ref(true);
const error = ref('');
const profileEmployeeId = ref(null);
const selectedUser = ref(null);
const contextMenu = ref({ visible: false, x: 0, y: 0 });
const selectedDateValue = computed({
  get: () => parseDateKey(selectedDate.value),
  set: value => {
    selectedDate.value = toDateKey(value);
    void loadOfficeUsers();
  },
});

const contextMenuOptions = computed(() => {
  const options = [
    { label: 'Mitarbeiter öffnen', action: 'open-profile', icon: ['fas', 'user'] },
    { label: 'Personal öffnen', action: 'open-personal', icon: ['fas', 'people-line'] },
    { label: 'Auftrag öffnen', action: 'open-order', icon: ['fas', 'briefcase'] },
  ];
  const phone = selectedUser.value?.mitarbeiter?.telefon?.trim();
  if (phone) {
    options.splice(2, 0, {
      label: phone,
      action: 'dial-phone',
      icon: ['fas', 'phone'],
    });
  }
  return options;
});
const officeGroups = computed(() => {
  const groups = new Map();
  officeUsers.value.forEach((entry) => {
    const label = entry.locationV2?.shortName || 'Ohne Standort';
    const key = entry.locationV2?._id || label;
    if (!groups.has(key)) groups.set(key, { key, label, users: [] });
    groups.get(key).users.push(entry);
  });
  return [...groups.values()].sort((left, right) => {
    if (left.label === 'Ohne Standort') return 1;
    if (right.label === 'Ohne Standort') return -1;
    return left.label.localeCompare(right.label, 'de');
  });
});
const dateLabel = computed(() => {
  const today = toDateKey(new Date());
  if (selectedDate.value === today) return 'Heute';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(parseDateKey(selectedDate.value));
});

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function employeeName(entry) {
  const employee = entry.mitarbeiter;
  return [employee?.vorname, employee?.nachname].filter(Boolean).join(' ') || entry.name || entry.email;
}

function initials(entry) {
  return employeeName(entry)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function openContextMenu(entry, event) {
  selectedUser.value = entry;
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
  selectedUser.value = null;
}

function handleContextMenuAction(action) {
  const employeeId = selectedUser.value?.mitarbeiter?._id;
  const orderNumber = selectedUser.value?.assignment?.auftragNr;
  const phone = selectedUser.value?.mitarbeiter?.telefon;
  closeContextMenu();
  if (action === 'dial-phone') {
    dialPhone(phone);
    return;
  }
  if (action === 'open-order') {
    if (!orderNumber) return;
    router.push({
      path: '/auftraege',
      query: {
        auftragnr: String(orderNumber),
        focusDate: selectedDate.value,
      },
    });
    return;
  }
  if (!employeeId) return;
  if (action === 'open-profile') {
    profileEmployeeId.value = employeeId;
  } else if (action === 'open-personal') {
    router.push({ path: '/personal', query: { employeeId } });
  }
}

function dialPhone(value) {
  let phone = String(value || '').trim().replace(/[^\d+]/g, '');
  if (!phone) return;
  if (phone.startsWith('0') && !phone.startsWith('+')) {
    phone = `+49${phone.slice(1)}`;
  }
  window.location.href = `tel:${phone}`;
}

function changeDate(days) {
  const date = parseDateKey(selectedDate.value);
  date.setDate(date.getDate() + days);
  selectedDate.value = toDateKey(date);
  void loadOfficeUsers();
}

async function loadProfilePictures(users) {
  const entries = await Promise.all(
    users
      .filter(entry => entry.mitarbeiter?.profilbild)
      .map(async entry => {
        try {
          const { data } = await api.get(`/api/personal/mitarbeiter/${entry.mitarbeiter._id}/profilbild`);
          return [entry.mitarbeiter._id, data?.url || ''];
        } catch (_) {
          return [entry.mitarbeiter._id, ''];
        }
      })
  );
  profilePictureUrls.value = Object.fromEntries(entries);
}

async function loadOfficeUsers() {
  loading.value = true;
  try {
    const { data } = await api.get('/api/personal/office-besetzung', {
      params: { date: selectedDate.value },
    });
    officeUsers.value = Array.isArray(data) ? data : [];
    await loadProfilePictures(officeUsers.value);
  } catch (requestError) {
    error.value = requestError?.response?.data?.message || 'Die Office-Besetzung konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadOfficeUsers();
});
</script>

<style scoped lang="scss">
.office-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.office-group__title {
  margin: 0 0 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.office-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.office-date-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.office-date-nav__label {
  display: block;
  height: 24px;
  padding: 0 4px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  min-width: 50px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;

  &:hover, &:focus-visible {
    background: var(--hover);
    color: var(--primary);
  }
}

.office-date-nav__button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  &:hover, &:focus-visible {
    background: var(--hover);
    color: var(--primary);
  }
}

.office-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.office-user {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 1;
  min-width: 0;
  padding: 6px 4px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { background: var(--hover); }
}

.office-user__avatar,
.office-user__initials {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  object-fit: cover;
}

.office-user__initials {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
  font-size: 10px;
  font-weight: 700;
}

.office-user__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.office-user__name {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.office-user__meta {
  color: var(--muted);
  font-size: 10px;
}

.office-actions {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  &:hover, &:focus-visible {
    background: var(--hover);
    color: var(--primary);
  }
}

.office-empty {
  padding: 12px 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.office-empty--error { color: var(--danger, #dc3545); }
</style>
