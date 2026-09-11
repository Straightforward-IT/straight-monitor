<template>
  <PageLayout
    title="Hover-Karte"
    content-variant="flush"
    class="hover-demo"
  >
    <template #actions>
      <button
        type="button"
        class="hover-demo__theme"
        @click="togglePreviewTheme"
      >
        {{ isDark ? 'Helles Design' : 'Dunkles Design' }}
      </button>
    </template>

    <p class="hover-demo__intro">
      Eine kompakte Monatsübersicht, direkt am Element.
    </p>
    <InformationCard>
      <template #legend>
        Komponentenvorschau · Beispieldaten
      </template>
      <template #title>
        Drei Arbeitsverhältnistypen · September 2026
      </template>
      <p class="hover-demo__hint">
        Mit der Maus über einen Eintrag fahren, per Tab fokussieren oder auf dem Touchscreen antippen.
      </p>
      <div class="hover-demo__examples">
        <HoverDataCard
          v-for="card in cards"
          :key="card.type"
          v-slot="{ triggerProps }"
          :data="card"
        >
          <button
            type="button"
            class="hover-demo__employee"
            v-bind="triggerProps"
          >
            <span
              class="hover-demo__avatar"
              aria-hidden="true"
            >{{ card.initials }}</span>
            <span class="hover-demo__identity"><strong>{{ card.employeeName }}</strong><span>{{ card.title }}</span></span>
            <span
              class="hover-demo__info"
              aria-hidden="true"
            >i</span>
          </button>
        </HoverDataCard>
      </div>
    </InformationCard>
    <p class="hover-demo__hint">
      Die Karte bleibt beim Überfahren geöffnet. Mit Escape lässt sie sich schließen.
    </p>
  </PageLayout>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue';
import PageLayout from '@/components/layout/PageLayout.vue';
import InformationCard from '@/components/ui-elements/InformationCard.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';

// Preview both themes without changing the user's saved preference.
const originalTheme = document.documentElement.getAttribute('data-theme');
const isDark = ref(originalTheme === 'dark');
const cards = [
  {
    type: 'hours', initials: 'MM', eyebrow: 'September 2026', employeeName: 'Max Mustermann', title: 'Stundenbezogen beschäftigt',
    monthlyHours: 108.25, workedHours: 11.25, plannedHours: 94, hourlyRate: 16,
  },
  {
    type: 'days', initials: 'LS', eyebrow: 'September 2026', employeeName: 'Leonie Sommer', title: 'Kurzfristig beschäftigt',
    workedDays: 18, plannedDays: 7, dayLimit: 70,
  },
  {
    type: 'earnings', initials: 'JK', eyebrow: 'September 2026', employeeName: 'Jonas Klein', title: 'Geringfügig beschäftigt',
    workedHours: 12.5, plannedHours: 26.5, hourlyRate: 13.9, earningsLimit: 603,
  },
];
function togglePreviewTheme() {
  isDark.value = !isDark.value;
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
}
onBeforeUnmount(() => {
  if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', originalTheme);
});
</script>

<style scoped>
.hover-demo { max-width: 840px; padding-top: 40px; }
.hover-demo__intro { margin: -6px 0 20px; color: var(--muted); font-size: 14px; }
.hover-demo__hint { color: var(--muted); font-size: 12px; line-height: 1.6; }
.hover-demo__examples { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 24px 0; }
.hover-demo__theme { padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.hover-demo__employee { display: flex; align-items: center; min-width: 0; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); text-align: left; cursor: pointer; }
.hover-demo__employee:hover, .hover-demo__theme:hover { border-color: var(--primary); background: var(--hover); }
.hover-demo button:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
.hover-demo__avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--primary) 18%, var(--surface)); font-size: 12px; font-weight: 600; }
.hover-demo__identity { display: grid; min-width: 0; gap: 3px; }
.hover-demo__identity strong { font-size: 13px; font-weight: 600; }
.hover-demo__identity > span { overflow: hidden; font-size: 11px; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.hover-demo__info { display: grid; flex: 0 0 auto; place-items: center; width: 16px; height: 16px; margin-left: auto; border: 1px solid var(--border); border-radius: 50%; color: var(--muted); font-size: 11px; font-weight: 600; }
@media (max-width: 800px) { .hover-demo__examples { grid-template-columns: 1fr; } }
@media (max-width: 600px) {
  .hover-demo { box-sizing: border-box; padding: 24px 16px; }
}
</style>
