<template>
  <PageLayout
    title="Zeitverwaltung"
    width="full"
    content-variant="flush"
    class="time-management-demo"
  >
    <template #actions>
      <span class="time-management-demo__badge">Frontend-Demo</span>
      <button
        type="button"
        @click="toggleTheme"
      >
        {{ isDark ? 'Helles Design' : 'Dunkles Design' }}
      </button>
      <button
        type="button"
        @click="resetDemo"
      >
        Demo zurücksetzen
      </button>
    </template>
    <TimeManagement
      :key="revision"
      :employee="timeManagementEmployee"
      :month="timeManagementMonth"
      :initial-data="fixture"
    >
      <template #documents="{ auftragNr }">
        <DemoOrderDocuments :auftrag-nr="auftragNr" />
      </template>
    </TimeManagement>
  </PageLayout>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue';
import PageLayout from '@/components/layout/PageLayout.vue';
import TimeManagement from '@/components/ui-elements/TimeManagement.vue';
import DemoOrderDocuments from './DemoOrderDocuments.vue';
import { timeManagementEmployee, timeManagementFixture, timeManagementMonth } from './timeManagementFixture';
const revision = ref(0);
const fixture = ref(timeManagementFixture());
const originalTheme = document.documentElement.getAttribute('data-theme');
const isDark = ref(originalTheme === 'dark');
function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
}
function resetDemo() { fixture.value = timeManagementFixture(); revision.value++; }
onBeforeUnmount(() => {
  if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', originalTheme);
});
</script>

<style scoped>
.time-management-demo { box-sizing: border-box; padding: 14px 16px; height: auto; gap: 12px; }
.time-management-demo :deep(.page-layout__heading h1) { font-size: 20px; }
.time-management-demo__badge { background: color-mix(in srgb, var(--primary) 18%, var(--surface)); color: var(--text); padding: 5px 8px; font-size: 10px; font-weight: 500; border-radius: 4px; }
.time-management-demo :deep(.page-layout__actions) { flex-wrap: wrap; }
.time-management-demo button { padding: 7px 9px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font-size: 11px; cursor: pointer; }
.time-management-demo button:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
@media (max-width: 700px) { .time-management-demo { padding: 14px 10px; } .time-management-demo :deep(.page-layout__header) { flex-wrap: wrap; } }
</style>
