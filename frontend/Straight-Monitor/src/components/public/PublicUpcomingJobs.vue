<template>
  <section class="upcoming-jobs">
    <p class="upcoming-jobs__hint">
      <span>ⓘ</span> Daten wie Uhrzeiten und Personallisten in dieser App sind nicht Live-Updated und können von denen in der Zvoove Work App abweichen.
    </p>
    <h2 class="upcoming-jobs__title">Nächste Jobs</h2>
    <button
      v-for="einsatz in upcomingEinsaetze"
      :key="einsatz._id"
      class="upcoming-jobs__card"
      type="button"
      @click="$emit('open-job', einsatz)"
    >
      <span class="upcoming-jobs__body">
        <span class="upcoming-jobs__header">
          <span class="upcoming-jobs__date">{{ formatShortDate(einsatz.datumVon) }}</span>
          <span v-if="einsatz.uhrzeitVon" class="upcoming-jobs__time">
            {{ formatTime(einsatz.uhrzeitVon) }}{{ einsatz.uhrzeitBis ? ` - ${formatTime(einsatz.uhrzeitBis)}` : '' }}
          </span>
          <span v-else class="upcoming-jobs__time upcoming-jobs__time--muted">Ganztags</span>
        </span>
        <strong class="upcoming-jobs__name">{{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `#${einsatz.auftragNr}` }}</strong>
        <span v-if="einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt" class="upcoming-jobs__location">
          <font-awesome-icon icon="fa-solid fa-location-dot" />
          {{ einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt }}
        </span>
      </span>
      <font-awesome-icon icon="fa-solid fa-chevron-right" class="upcoming-jobs__arrow" />
    </button>
    <p v-if="!upcomingEinsaetze.length" class="upcoming-jobs__empty">Keine bevorstehenden Jobs.</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faChevronRight, faLocationDot } from '@fortawesome/free-solid-svg-icons';

library.add(faChevronRight, faLocationDot);

defineEmits(['open-job']);

const props = defineProps({
  einsaetze: { type: Array, default: () => [] },
});

const upcomingEinsaetze = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return props.einsaetze
    .filter((einsatz) => {
      const end = new Date(einsatz.datumBis || einsatz.datumVon);
      end.setHours(23, 59, 59, 999);
      return end >= today;
    })
    .sort((left, right) => new Date(left.datumVon) - new Date(right.datumVon));
});

function formatTime(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
  const match = String(value).match(/\d{4} (\d{2}:\d{2}):\d{2}/);
  return match?.[1] || '';
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Heute';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
}
</script>

<style scoped>
.upcoming-jobs { margin: 1.4rem 0 1.5rem; }
.upcoming-jobs__hint { margin: 0 0 .75rem; color: var(--muted); font-size: .78rem; line-height: 1.5; }
.upcoming-jobs__hint span { margin-right: 4px; color: var(--primary); }
.upcoming-jobs__title { margin: 0 0 .75rem; padding-bottom: .5rem; border-bottom: 2px solid var(--border); color: var(--text); font-size: 1rem; font-weight: 600; }
.upcoming-jobs__card { display: flex; width: 100%; align-items: center; gap: .5rem; margin-bottom: .5rem; padding: .75rem .75rem .75rem 1rem; border: 0; border-left: 3px solid var(--primary); border-radius: 8px; background: var(--panel); color: var(--text); cursor: pointer; text-align: left; }
.upcoming-jobs__body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: .2rem; }
.upcoming-jobs__header { display: flex; align-items: baseline; gap: .4rem; }
.upcoming-jobs__date { color: var(--muted); font-size: .7rem; font-weight: 600; white-space: nowrap; }
.upcoming-jobs__time { color: var(--primary); font-size: .7rem; font-weight: 700; white-space: nowrap; }
.upcoming-jobs__time--muted { color: var(--muted); font-weight: 400; }
.upcoming-jobs__name { overflow: hidden; color: var(--text); font-size: .9rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.upcoming-jobs__location { display: flex; align-items: center; gap: .3rem; overflow: hidden; color: var(--muted); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.upcoming-jobs__arrow { flex: 0 0 auto; color: var(--muted); font-size: .75rem; }
.upcoming-jobs__empty { padding: .75rem 0; color: var(--muted); font-size: .875rem; text-align: center; }
</style>
