<template>
  <PageLayout
    title="Stundenschnellerfassung"
    width="wide"
    content-variant="flush"
    class="quick-time-demo"
  >
    <template #actions>
      <ToolbarButton
        variant="secondary"
        @click="toggleTheme"
      >
        {{ isDark ? 'Helles Design' : 'Dunkles Design' }}
      </ToolbarButton>
      <ToolbarButton
        variant="secondary"
        @click="modalOpen = true"
      >
        Als Fenster öffnen
      </ToolbarButton>
    </template>
    <p class="quick-time-demo__intro">
      <span>Beispieldaten</span> Zeiten für einen Auftrag gesammelt erfassen und prüfen.
    </p>
    <div class="quick-time-demo__surface">
      <Stundenschnellerfassung
        v-bind="fixture"
        @submit="onSubmit"
      />
    </div>
    <p class="quick-time-demo__note">
      Frontend-Dummy · „Übernehmen“ hält die Eingaben nur lokal. Ein Neuladen setzt die Beispieldaten zurück.
    </p>
    <p
      v-if="lastSubmission"
      class="quick-time-demo__receipt"
      role="status"
    >
      Lokal übernommen: {{ lastSubmission.entries.length }} Einsätze · {{ formatHours(lastSubmission.totalMinutes) }} Std.
    </p>
    <StundenschnellerfassungModal
      v-if="modalOpen"
      v-model="modalOpen"
      v-bind="fixture"
      @submit="onSubmit"
    />
  </PageLayout>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue';
import PageLayout from '@/components/layout/PageLayout.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import Stundenschnellerfassung from '@/components/ui-elements/Stundenschnellerfassung.vue';
import StundenschnellerfassungModal from '@/components/Modals/StundenschnellerfassungModal.vue';
import { formatHours } from '@/utils/stundenschnellerfassung';
import { createStundenschnellerfassungDemo } from './stundenschnellerfassungDemo';

const fixture = ref(createStundenschnellerfassungDemo());
const modalOpen = ref(false);
const lastSubmission = ref(null);
function onSubmit(payload) {
  lastSubmission.value = payload;
  fixture.value = { ...fixture.value, zeiten: payload.entries };
}
const originalTheme = document.documentElement.getAttribute('data-theme');
const isDark = ref(originalTheme === 'dark');
function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
}
onBeforeUnmount(() => {
  if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', originalTheme);
});
</script>

<style scoped>
.quick-time-demo { padding: 18px 0; }
.quick-time-demo__intro { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0 0 8px; color: var(--muted); font-size: 13px; }
.quick-time-demo__intro > span { padding: 4px 8px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--muted); font-size: 10px; font-weight: 500; }
.quick-time-demo__surface { overflow: hidden; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); }
.quick-time-demo__note, .quick-time-demo__receipt { font-size: 12px; color: var(--muted); line-height: 1.6; }
.quick-time-demo__receipt { color: var(--text); }
@media (max-width: 760px) {
  .quick-time-demo { box-sizing: border-box; padding: 20px 12px; }
  .quick-time-demo :deep(.page-layout__actions) { flex-wrap: wrap; }
  .quick-time-demo :deep(.page-layout__header) { align-items: flex-start; flex-direction: column; }
}
</style>
