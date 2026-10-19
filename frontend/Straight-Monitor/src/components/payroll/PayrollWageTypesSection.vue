<template>
  <section class="payroll-wage-types" :aria-labelledby="`${tabsId}-title`">
    <header class="payroll-wage-types__header">
      <h2 :id="`${tabsId}-title`">Lohnarten</h2>
      <div class="payroll-wage-types__context">
        <span>Monat: {{ monthLabel }}</span>
        <span>Tag: {{ selectedDateLabel || 'Nicht ausgewählt' }}</span>
        <AppButton v-if="selectedDate" variant="ghost" size="sm" @click="$emit('clearDay')">Monat anzeigen</AppButton>
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
      <slot v-if="activeTab === tab.id" :tab="tab.id" :month="month" :selectedDate="selectedDate">
        <p v-if="!hasAccess" class="payroll-wage-types__state">Eigene Lohnpositionen sind für ADMIN und PAYROLL verfügbar.</p>
        <p v-else-if="loading" role="status" class="payroll-wage-types__state">Eigene Positionen werden berechnet …</p>
        <p v-else-if="error" role="alert" class="payroll-wage-types__error">{{ error }}</p>
        <template v-else-if="positions">
          <p class="payroll-wage-types__legend"><span class="payroll-wage-types__lohn">L · Lohnseite</span><span class="payroll-wage-types__faktur" v-if="positions.allowedSides?.includes('F')">F · Fakturseite</span><span>Eigene Berechnung · {{ selectedDate ? 'ausgewählter Buchungstag' : 'gesamter Monat' }}</span></p>
          <template v-if="tab.id === 'konditionsvereinbarungen'">
            <div v-if="positions.conditions?.length" class="payroll-wage-types__scroll"><table><thead><tr><th>Kunde</th><th>Nr.</th><th>Lohnart</th><th>Verw.</th><th>Regel</th><th>Von</th><th>Bis</th><th>Zulage %</th><th>Preis €</th></tr></thead><tbody><tr v-for="condition in positions.conditions" :key="condition.id" :class="condition.side === 'L' ? 'payroll-wage-types__lohn' : 'payroll-wage-types__faktur'"><td>{{ condition.customerNumber }}</td><td>{{ condition.wageType }}</td><td>{{ condition.label }}</td><td>{{ condition.side }}</td><td>{{ condition.type === 'uhrzeit' ? 'Uhrzeit' : condition.type === 'stunden' ? 'Stunden' : 'Offen' }}</td><td>{{ condition.from ?? '—' }}</td><td>{{ condition.until ?? '—' }}</td><td>{{ formatPositionValue(condition.percent) }}</td><td>{{ formatPositionValue(condition.rate) }}</td></tr></tbody></table></div>
            <p v-else class="payroll-wage-types__state">Keine Kundenkonditionen für die Aufträge dieses Monats vorhanden.</p>
          </template>
          <p v-else-if="['abzuege-bezuege', 'monatliche-lohnarten'].includes(tab.id)" class="payroll-wage-types__state">Für diesen Bereich ist die eigene Berechnung noch nicht implementiert.</p>
          <PayrollPositionsTable v-else :rows="visibleRows" />
          <details v-if="visibleIssues.length" class="payroll-wage-types__issues"><summary>Offene Punkte ({{ visibleIssues.length }})</summary><ul><li v-for="(issue, index) in visibleIssues" :key="index">{{ issue.side }} · {{ issue.message }}</li></ul></details>
          <p class="payroll-wage-types__state payroll-wage-types__footnote">Gesamtstunden folgen dem Kennzeichen der Lohnart. ÜTZ und Zuschläge zählen dadurch nicht automatisch als weitere Arbeitszeit. Durchschnittsverfahren und offene Verrechnungen sind noch nicht bewertet.</p>
          <details class="payroll-wage-types__issues"><summary>Berechnungsannahmen</summary><p>Cent-Rundung je Position. Zuschlagsfenster beziehen sich auf den tatsächlichen Abschnittstag; gleichzeitig zutreffende Zuschläge werden addiert. Die Tagesauswahl zeigt die gesamte gebuchte Schicht einschließlich ihrer Abschnitte nach Mitternacht. Auftragsregeln liefern die Zuschlagssätze.</p></details>
        </template>
        <p v-else class="payroll-wage-types__state">Für diesen Monat liegt noch keine Berechnung vor.</p>
      </slot>
    </div>
  </section>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import PayrollPositionsTable from '@/components/payroll/PayrollPositionsTable.vue';
import { selectPositions, formatPositionValue } from '@/utils/payrollPositions';

const props = defineProps({
  month: { type: String, required: true },
  selectedDate: { type: String, default: '' },
  positions: { type: Object, default: null },
  loading: Boolean,
  error: { type: String, default: '' },
  hasAccess: Boolean,
});
defineEmits(['clearDay']);
const tabsId = `payroll-wage-types-${getCurrentInstance().uid}`;
const activeTab = ref('lohn-faktur');
const tabs = [
  { id: 'lohn-faktur', label: 'LOHN/FAKTUR' },
  { id: 'summe-lohn', label: 'SUMME LOHN' },
  { id: 'summe-faktur', label: 'SUMME FAKTUR' },
  { id: 'summe-ae-faktur-lohn', label: 'SUMME A./E.: FAKTUR/LOHN' },
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
const visibleRows = computed(() => selectPositions(props.positions, activeTab.value, props.selectedDate));
const visibleIssues = computed(() => [...new Map((props.positions?.issues || []).filter(issue => (!props.selectedDate || issue.date === props.selectedDate) && (activeTab.value !== 'summe-lohn' || issue.side === 'L') && (activeTab.value !== 'summe-faktur' || issue.side === 'F')).map(issue => [`${issue.side}:${issue.message}`, issue])).values()]);
</script>

<style scoped>
.payroll-wage-types { margin-top: 14px; min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.payroll-wage-types__header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; padding: 10px 12px; }
.payroll-wage-types__header h2 { margin: 0; font-size: 12px; font-weight: 600; }
.payroll-wage-types__context { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); font-size: 11px; }
.payroll-wage-types :deep(.payroll-wage-types__tabs) { padding: 6px 8px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.payroll-wage-types__panel { min-height: 100px; padding: 12px; font-size: 12px; }
.payroll-wage-types__panel:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.payroll-wage-types__legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; color: var(--muted); font-size: 11px; }
.payroll-wage-types__legend > span { padding: 4px 7px; border-radius: 4px; }
.payroll-wage-types__lohn { background: var(--payroll-wage-bg); color: var(--text); }
.payroll-wage-types__faktur { background: var(--payroll-invoice-bg); color: var(--text); }
.payroll-wage-types__state { color: var(--muted); font-size: 11px; margin: 0; }
.payroll-wage-types__footnote { margin-top: 10px; line-height: 1.5; }
.payroll-wage-types__error { color: var(--status-danger-text); margin: 0; }
.payroll-wage-types__issues { margin-top: 10px; font-size: 11px; color: var(--muted); }
.payroll-wage-types__scroll { overflow-x: auto; }
.payroll-wage-types__scroll table { min-width: 700px; width: 100%; border-collapse: collapse; font-size: 11px; }
.payroll-wage-types__scroll th, .payroll-wage-types__scroll td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
</style>
