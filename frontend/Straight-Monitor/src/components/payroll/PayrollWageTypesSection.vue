<template>
  <section class="payroll-wage-types" :aria-labelledby="`${tabsId}-title`">
    <header class="payroll-wage-types__header">
      <h2 :id="`${tabsId}-title`">Lohnarten</h2>
      <div class="payroll-wage-types__context">
        <span>Monat: {{ monthLabel }}</span>
        <span>Tag: {{ selectedDateLabel || 'Nicht ausgewählt' }}</span>
      </div>
    </header>
    <AppTabs
      v-model="activeTab"
      class="payroll-wage-types__tabs"
      :tabs="tabs"
      :id-prefix="tabsId"
      label="Lohnartenbereiche"
      size="sm"
      variant="compact"
      scroll-controls
    />
    <div
      v-for="tab in tabs"
      :id="tab.panelId"
      :key="tab.id"
      class="payroll-wage-types__panel"
      role="tabpanel"
      :aria-labelledby="`${tabsId}-${tab.id}`"
      :hidden="activeTab !== tab.id"
      tabindex="0"
    >
      <slot v-if="activeTab === tab.id" :tab="tab.id" :month="month" :selectedDate="selectedDate" />
    </div>
  </section>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';

const props = defineProps({
  month: { type: String, required: true },
  selectedDate: { type: String, default: '' },
});
const tabsId = `payroll-wage-types-${getCurrentInstance().uid}`;
const activeTab = ref('lohn-faktur');
const tabs = [
  { id: 'lohn-faktur', label: 'LOHN/FAKTUR' },
  { id: 'summe-lohn', label: 'SUMME LOHN' },
  { id: 'summe-faktur', label: 'SUMME FAKTUR' },
  { id: 'summe-ae-faktur-lohn', label: 'SUMME A./E.: FAKTUR/LOHN|' },
  { id: 'summe-faktur-lohn', label: 'SUMME: FAKTUR/LOHN' },
  { id: 'konditionsvereinbarungen', label: 'KONDITIONSVEREINBARUNGEN' },
  { id: 'fehlzeiten', label: 'FEHLZEITEN' },
  { id: 'abzuege-bezuege', label: 'ABZÜGE/BEZÜGE' },
  { id: 'monatliche-lohnarten', label: 'MONATLICHE LOHNARTEN' },
  { id: 'zusammenfassung', label: 'ZUSAMMENFASSUNG' },
].map(tab => ({ ...tab, panelId: `${tabsId}-panel-${tab.id}` }));

const monthLabel = computed(() => new Date(`${props.month}-01T12:00:00`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', month: 'long', year: 'numeric' }));
const selectedDateLabel = computed(() => props.selectedDate
  ? new Date(`${props.selectedDate}T12:00:00`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
</script>

<style scoped>
.payroll-wage-types { margin-top: 14px; min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.payroll-wage-types__header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; padding: 10px 12px; }
.payroll-wage-types__header h2 { margin: 0; font-size: 12px; font-weight: 600; }
.payroll-wage-types__context { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); font-size: 11px; }
.payroll-wage-types :deep(.payroll-wage-types__tabs) { padding: 6px 8px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.payroll-wage-types__panel { min-height: 100px; padding: 12px; font-size: 12px; }
.payroll-wage-types__panel:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
</style>
