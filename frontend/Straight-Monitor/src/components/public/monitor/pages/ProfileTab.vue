<template>
  <section class="public-monitor-page public-monitor-profile-tab">
    <section class="profile-intro" :class="profileRankClass">
      <span class="profile-avatar-ring"><img v-if="profileImageUrl" :src="profileImageUrl" class="profile-avatar profile-avatar--large" alt="" /><span v-else class="profile-avatar profile-avatar--large">{{ initials }}</span></span>
      <div><h2>Profil <TlBadge v-if="isTeamleiter" /></h2><strong class="profile-name">{{ vorname }}</strong></div><button :class="['rank-test-button', `profile-rank--${nextProfileRank}`]" type="button" title="Nächsten Rang-Stil testen" @click="$emit('cycle-rank')"><font-awesome-icon icon="fa-solid fa-flask" />Rang testen</button>
    </section>
    <div class="settings-list"><button type="button" @click="$emit('open-documents')"><font-awesome-icon icon="fa-solid fa-folder-open" /><span><strong>Dokumente</strong><small>{{ missingDocumentCount }} offen · Unterlagen und Abrechnungen</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><template v-if="isTeamleiter"><button type="button" @click="$emit('open-event-reports')"><font-awesome-icon icon="fa-solid fa-file-lines" /><span><strong>Event Reports</strong><small>Berichte erstellen und verwalten</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><button class="teamleiter-evaluations" type="button" @click="$emit('open-evaluations')"><font-awesome-icon icon="fa-solid fa-clipboard-check" /><span><strong>Laufzettel ausfüllen</strong><small>Evaluierungen bearbeiten</small></span><i v-if="openLaufzettelCount" class="profile-count-badge">{{ openLaufzettelCount }}</i><font-awesome-icon icon="fa-solid fa-chevron-right" /></button></template><button type="button" @click="$emit('open-appearance')"><font-awesome-icon :icon="themeIsDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'" /><span><strong>Darstellung</strong><small>{{ themeIsDark ? 'Dunkler Modus aktiv' : 'Heller Modus aktiv' }}</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><button type="button" @click="$emit('reset')"><font-awesome-icon icon="fa-solid fa-rotate-left" /><span><strong>Prototyp zurücksetzen</strong><small>Alle lokalen Demo-Zustände löschen</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button></div>
    <p v-if="resetMessage" class="inline-message">{{ resetMessage }}</p>
  </section>
</template>

<script setup>
import TlBadge from '@/components/ui-elements/TlBadge.vue';

defineProps({
  initials: { type: String, default: '' },
  isTeamleiter: { type: Boolean, default: false },
  missingDocumentCount: { type: Number, default: 0 },
  nextProfileRank: { type: String, default: 'none' },
  openLaufzettelCount: { type: Number, default: 0 },
  profileImageUrl: { type: String, default: '' },
  profileRankClass: { type: String, default: '' },
  resetMessage: { type: String, default: '' },
  themeIsDark: { type: Boolean, default: false },
  vorname: { type: String, default: '' },
});

defineEmits(['cycle-rank', 'open-appearance', 'open-documents', 'open-evaluations', 'open-event-reports', 'reset']);
</script>
