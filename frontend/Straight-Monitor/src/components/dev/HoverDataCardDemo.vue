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
        September 2026
      </template>
      <p class="hover-demo__hint">
        Mit der Maus über einen Eintrag fahren, per Tab fokussieren oder auf dem Touchscreen antippen.
      </p>
      <div class="hover-demo__examples">
        <HoverDataCard v-slot="{ triggerProps }">
          <button
            type="button"
            class="hover-demo__employee"
            v-bind="triggerProps"
          >
            <span
              class="hover-demo__avatar"
              aria-hidden="true"
            >MM</span>
            <span class="hover-demo__identity"><strong>Max Mustermann</strong><span>Teilzeit · Monatsübersicht</span></span>
            <span
              class="hover-demo__info"
              aria-hidden="true"
            >i</span>
          </button>
        </HoverDataCard>
        <HoverDataCard
          v-slot="{ triggerProps }"
          placement="bottom"
        >
          <button
            type="button"
            class="hover-demo__hours"
            v-bind="triggerProps"
          >
            105,25 / 108,25 Std.
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
.hover-demo__examples { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 0; }
.hover-demo__theme, .hover-demo__hours { padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.hover-demo__hours { color: var(--text); font-variant-numeric: tabular-nums; }
.hover-demo__employee { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); text-align: left; cursor: pointer; }
.hover-demo__employee:hover, .hover-demo__hours:hover, .hover-demo__theme:hover { border-color: var(--primary); background: var(--hover); }
.hover-demo button:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
.hover-demo__avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--primary) 18%, var(--surface)); font-size: 12px; font-weight: 600; }
.hover-demo__identity { display: grid; gap: 3px; }
.hover-demo__identity strong { font-size: 13px; font-weight: 600; }
.hover-demo__identity > span { font-size: 11px; color: var(--muted); }
.hover-demo__info { display: grid; place-items: center; width: 16px; height: 16px; margin-left: 14px; border: 1px solid var(--border); border-radius: 50%; color: var(--muted); font-size: 11px; font-weight: 600; }
@media (max-width: 600px) {
  .hover-demo { box-sizing: border-box; padding: 24px 16px; }
}
</style>
