<template>
  <section class="public-monitor-page public-monitor-profile-tab">
    <section class="profile-intro" :class="profileRankClass">
      <span class="profile-avatar-ring"><img v-if="profileImageUrl" :src="profileImageUrl" class="profile-avatar profile-avatar--large" alt="" /><span v-else class="profile-avatar profile-avatar--large">{{ initials }}</span></span>
      <div><h2>Profil <TlBadge v-if="isTeamleiter" /></h2><strong class="profile-name">{{ vorname }}</strong></div><button :class="['rank-test-button', `profile-rank--${nextProfileRank}`]" type="button" title="Nächsten Rang-Stil testen" @click="$emit('cycle-rank')"><font-awesome-icon icon="fa-solid fa-flask" />Rang testen</button>
    </section>
    <div class="settings-list">
      <PublicListItem icon="fa-solid fa-user" title="Meine Daten" description="Hier kannst du dein Profil bearbeiten" @click="$emit('open-personal-data')" />
      <PublicListItem icon="fa-solid fa-folder-open" title="Dokumente" :description="`${missingDocumentCount} offen · Unterlagen und Abrechnungen`" @click="$emit('open-documents')" />
      <template v-if="isTeamleiter">
        <PublicListItem icon="fa-solid fa-file-lines" title="Event Reports" description="Berichte erstellen und verwalten" @click="$emit('open-event-reports')" />
        <PublicListItem icon="fa-solid fa-clipboard-check" title="Laufzettel ausfüllen" description="Evaluierungen bearbeiten" :badge="openLaufzettelCount || null" @click="$emit('open-evaluations')" />
      </template>
      <PublicListItem :icon="themeIsDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'" title="Darstellung" :description="themeIsDark ? 'Dunkler Modus aktiv' : 'Heller Modus aktiv'" @click="$emit('open-appearance')" />
      <PublicListItem icon="fa-solid fa-rotate-left" title="Prototyp zurücksetzen" description="Alle lokalen Demo-Zustände löschen" @click="$emit('reset')" />
    </div>
    <p v-if="resetMessage" class="inline-message">{{ resetMessage }}</p>
  </section>
</template>

<script setup>
import TlBadge from '@/components/ui-elements/TlBadge.vue';
import PublicListItem from '@/components/public/PublicListItem.vue';

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

defineEmits(['cycle-rank', 'open-appearance', 'open-documents', 'open-evaluations', 'open-event-reports', 'open-personal-data', 'reset']);
</script>
