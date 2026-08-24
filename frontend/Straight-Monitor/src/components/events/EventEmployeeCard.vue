<template>
  <article
    class="event-employee-card"
    :class="{ 'event-employee-card--draggable': draggable }"
    :draggable="draggable"
    @dragstart="emit('dragstart', $event)"
  >
    <div v-if="photoUrl" class="event-employee-card__avatar-wrap">
      <img class="event-employee-card__avatar" :src="photoUrl" alt="">
    </div>
    <div
      v-else
      class="event-employee-card__avatar event-employee-card__avatar--fallback"
      :style="{ '--avatar-hue': avatarHue }"
      aria-hidden="true"
    >
      {{ initials }}
    </div>

    <div class="event-employee-card__content">
      <strong class="event-employee-card__name">{{ fullName }}</strong>
      <div class="event-employee-card__meta">
        <span v-if="department" class="event-employee-card__pill">
          <font-awesome-icon icon="fa-solid fa-layer-group" />
          {{ department }}
        </span>
        <span v-if="persgruppeLabel" class="event-employee-card__pill">
          <font-awesome-icon icon="fa-solid fa-user" />
          {{ persgruppeLabel }}
        </span>
        <span
          class="event-employee-card__pill event-employee-card__pill--dispo"
          :class="`event-employee-card__pill--${dispoState.tone}`"
          :title="dispoState.title"
        >
          <font-awesome-icon :icon="dispoState.icon" />
          {{ dispoState.label }}
        </span>
      </div>
    </div>

    <div v-if="$slots.trailing" class="event-employee-card__trailing" @click.stop>
      <slot name="trailing" />
    </div>
  </article>
</template>

<script>
const photoCache = new Map();
</script>

<script setup>
import { computed, onMounted, ref, watchEffect } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faBan,
  faBriefcase,
  faCalendarCheck,
  faCheck,
  faClock,
  faLayerGroup,
  faMobileScreen,
  faPhone,
  faUmbrellaBeach,
  faUser,
  faUserClock,
  faUserDoctor,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useFlipAll } from '@/stores/flipAll';
import api from '@/utils/api';

library.add(
  faBan,
  faBriefcase,
  faCalendarCheck,
  faCheck,
  faClock,
  faLayerGroup,
  faMobileScreen,
  faPhone,
  faUmbrellaBeach,
  faUser,
  faUserClock,
  faUserDoctor,
);

const props = defineProps({
  employee: { type: Object, required: true },
  dispoEntries: { type: Array, default: () => [] },
  draggable: { type: Boolean, default: false },
});

const emit = defineEmits(['dragstart']);
const flip = useFlipAll();
const photoUrl = ref('');
const flipUser = computed(() => flip.getById(props.employee?.flip_id));

onMounted(() => {
  if (!flip.loaded) flip.fetchAll();
});

const fullName = computed(() => {
  const name = `${props.employee?.vorname || ''} ${props.employee?.nachname || ''}`.trim();
  return name || 'Unbekannter Mitarbeiter';
});

const initials = computed(() => {
  const first = props.employee?.vorname?.trim()?.[0] || '';
  const last = props.employee?.nachname?.trim()?.[0] || '';
  return `${first}${last}`.toUpperCase() || '–';
});

const avatarHue = computed(() => {
  const seed = String(props.employee?._id || fullName.value);
  return [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;
});

const department = computed(() => {
  const user = flipUser.value;
  const departmentAttribute = user?.attributes?.find?.(attribute =>
    ['department', 'abteilung', 'bereich'].includes(String(attribute?.name || '').toLocaleLowerCase('de'))
  );
  return user?.profile?.department || departmentAttribute?.value || 'Kein Bereich';
});

const persgruppeLabel = computed(() => {
  const labels = { 101: 'Festi', 110: 'KZF', 109: 'Mini', 106: 'Werkst.' };
  return labels[props.employee?.persgruppe] || 'Keine Persgruppe';
});

function entryLabel(entry) {
  if (entry.typ === 'planned' || entry._source === 'einsatz') {
    const assignment = entry.kuerzel || entry.schichtBezeichnung || entry.bezeichnung || entry.auftragNr;
    return assignment ? `Eingeplant: ${assignment}` : 'Eingeplant';
  }
  if (entry.verfuegbarkeit === 'eingeplant') return `Eingeplant${entry.kundeKuerzel ? `: ${entry.kundeKuerzel}` : ''}`;
  if (entry.verfuegbarkeit === 'blocked') return 'Gesperrt';
  if (entry.typ === 'abwesenheit') {
    return ({
      urlaub: 'Urlaub',
      krank: 'Krank',
      feiertag: 'Feiertag',
      ueberstunden: 'Überstundenabbau',
      sonstiges: 'Abwesend',
    })[entry.abwesenheitsKategorie] || 'Abwesend';
  }
  if (entry.verfuegbarkeit === 'partially') {
    const time = entry.zeitVon || entry.zeitBis
      ? ` (${entry.zeitVon || '…'}–${entry.zeitBis || '…'})`
      : '';
    return `Eingeschränkt${time}`;
  }
  if (entry.verfuegbarkeit === 'angefragt_tel') return 'Angefragt (Tel.)';
  if (entry.verfuegbarkeit === 'angefragt_flip') return 'Angefragt (Flip)';
  if (entry.verfuegbarkeit === 'available') return 'Verfügbar';
  return entry.text || 'Keine Angabe';
}

const dispoState = computed(() => {
  const entries = props.dispoEntries || [];
  const title = entries.length ? entries.map(entryLabel).join('\n') : 'Keine Dispo-Angabe für diesen Tag';
  const find = predicate => entries.find(predicate);

  let entry = find(item => item.typ === 'planned' || item._source === 'einsatz');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-briefcase', tone: 'planned', title };

  entry = find(item => item.verfuegbarkeit === 'eingeplant');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-calendar-check', tone: 'planned', title };

  entry = find(item => item.verfuegbarkeit === 'blocked');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-ban', tone: 'blocked', title };

  entry = find(item => item.typ === 'abwesenheit');
  if (entry) {
    const icon = entry.abwesenheitsKategorie === 'urlaub'
      ? 'fa-solid fa-umbrella-beach'
      : entry.abwesenheitsKategorie === 'krank'
        ? 'fa-solid fa-user-doctor'
        : 'fa-solid fa-ban';
    return { label: entryLabel(entry), icon, tone: 'blocked', title };
  }

  entry = find(item => item.verfuegbarkeit === 'partially');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-clock', tone: 'partial', title };

  entry = find(item => item.verfuegbarkeit === 'angefragt_tel');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-phone', tone: 'requested', title };

  entry = find(item => item.verfuegbarkeit === 'angefragt_flip');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-mobile-screen', tone: 'requested', title };

  entry = find(item => item.verfuegbarkeit === 'available');
  if (entry) return { label: entryLabel(entry), icon: 'fa-solid fa-check', tone: 'available', title };

  return { label: 'Keine Angabe', icon: 'fa-solid fa-user-clock', tone: 'neutral', title };
});

async function resolvePhoto(employee) {
  const employeeId = String(employee?._id || '');
  if (!employeeId) return '';
  if (photoCache.has(employeeId)) return photoCache.get(employeeId);

  const request = (async () => {
    if (flip.enablePhotos && employee.flip_id) {
      try {
        const flipUrl = await flip.ensurePhoto(employee.flip_id);
        if (flipUrl) return flipUrl;
      } catch (_) {
        // Continue with the R2 fallback below.
      }
    }
    if (employee.profilbild) {
      try {
        const response = await api.get(`/api/personal/mitarbeiter/${employeeId}/profilbild`);
        return response.data?.url || '';
      } catch (_) {
        return '';
      }
    }
    return '';
  })();

  photoCache.set(employeeId, request);
  const resolved = await request;
  photoCache.set(employeeId, resolved);
  return resolved;
}

watchEffect(async onCleanup => {
  let active = true;
  onCleanup(() => { active = false; });
  const resolved = await resolvePhoto(props.employee);
  if (active) photoUrl.value = resolved;
});
</script>

<style scoped lang="scss">
.event-employee-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
}

.event-employee-card--draggable { cursor: grab; }
.event-employee-card--draggable:active { cursor: grabbing; }

.event-employee-card__avatar-wrap,
.event-employee-card__avatar {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 6px;
}

.event-employee-card__avatar { object-fit: cover; }

.event-employee-card__avatar--fallback {
  display: grid;
  place-items: center;
  background: hsl(var(--avatar-hue) 34% 45%);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 750;
}

.event-employee-card__content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.event-employee-card__name {
  overflow: hidden;
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-employee-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.event-employee-card__pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--muted);
  font-size: 0.61rem;
  font-weight: 600;
  line-height: 1.25;

  svg { flex: 0 0 auto; font-size: 0.55rem; }
}

.event-employee-card__pill--dispo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-employee-card__pill--planned { background: color-mix(in srgb, #2563eb 12%, transparent); color: #2563eb; }
.event-employee-card__pill--blocked { background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
.event-employee-card__pill--partial { background: color-mix(in srgb, #d97706 12%, transparent); color: #b45309; }
.event-employee-card__pill--requested { background: color-mix(in srgb, #7c3aed 12%, transparent); color: #7c3aed; }
.event-employee-card__pill--available { background: color-mix(in srgb, #16803b 12%, transparent); color: #16803b; }

.event-employee-card__trailing {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
</style>
