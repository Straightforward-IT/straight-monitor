<template>
  <div class="payroll-positions" :class="{ 'payroll-positions--summary': summary }">
    <div v-if="rows.length" class="payroll-positions__scroll" tabindex="0" aria-label="Berechnete Lohn- und Fakturpositionen, horizontal scrollbar">
      <table>
        <thead><tr><th v-if="!summary">Auftrag</th><th v-if="!summary">Einsatzort</th><th>{{ summary ? 'Lohnart-Nr.' : 'Nr.' }}</th><th>Lohnart-Bezeichnung</th><th v-if="!summary">Tage</th><th>Stunden</th><th>Preis €</th><th>Zulage %</th><th>Betrag €</th><th v-if="!summary">Verw.</th><th v-if="!summary">Projekt / Job</th><th v-if="!summary">Verrechnung / Hinweis</th></tr></thead>
        <tbody><tr v-for="row in rows" :key="row.id" :class="row.side === 'L' ? 'payroll-positions__wage' : 'payroll-positions__invoice'" :data-side="row.side" :data-wage-type="row.wageType || row.kb">
          <td v-if="!summary"><button v-if="row.auftragNr" type="button" class="payroll-positions__link" :aria-label="`Auftrag ${row.auftragNr} öffnen`" @click="openAuftrag(row.auftragNr)">{{ row.auftragNr }}</button><template v-else>—</template></td>
          <td v-if="!summary">{{ row.site || row.einsortNr || '—' }}</td>
          <td><button v-if="row.wageType" type="button" class="payroll-positions__link" :aria-label="`Lohnart ${row.wageType} öffnen`" @click="openLohnart(row.wageType)">{{ row.wageType }}</button><template v-else>{{ row.kb || '—' }}</template></td>
          <td class="payroll-positions__name">{{ row.label }}<span v-if="row.countForTotalHours === true" class="payroll-positions__flag" title="Diese Lohnart zählt für Gesamtstunden">Gesamtstunden</span></td>
          <td v-if="!summary" class="number">{{ row.days }}</td><td class="number">{{ formatPositionHours(row) }}</td><td class="number">{{ formatPositionValue(row.rate) }}</td><td class="number">{{ formatPositionValue(row.percent) }}</td><td class="number">{{ formatPositionValue(row.amount) }}</td>
          <td v-if="!summary"><abbr :title="row.side === 'L' ? 'Lohnseite' : 'Fakturseite'">{{ row.side }}</abbr></td><td v-if="!summary">{{ row.project || row.activity || '—' }}</td>
          <td v-if="!summary" class="payroll-positions__note"><span v-if="row.offset?.code && row.offset.code !== '0'">{{ row.offset.label || row.offset.code }}<template v-if="row.offset.target"> → {{ row.offset.target }}</template><template v-if="row.offset.priority"> · Priorität {{ row.offset.priority }}</template>. </span><span>{{ row.status === 'CALCULATED' ? 'Berechnet' : row.amount == null ? 'Berechnung offen' : 'Teilbewertung' }}</span><ul v-if="row.issues?.length"><li v-for="(issue, index) in row.issues" :key="index">{{ issue.message }}</li></ul></td>
        </tr></tbody>
      </table>
    </div>
    <p v-else class="payroll-positions__empty">Für diese Auswahl liegen keine Positionen vor.</p>
    <div v-if="summaries.length" class="payroll-positions__totals">
      <div v-for="summary in summaries" :key="summary.side" :class="summary.side === 'L' ? 'payroll-positions__wage' : 'payroll-positions__invoice'">
        <strong>{{ summary.side === 'L' ? 'Lohn' : 'Faktur' }}</strong><span>Gesamtstunden: {{ summary.hours }}<template v-if="!summary.hoursComplete"> · Stundenanrechnung offen</template></span>
        <span>{{ summary.amount == null ? 'Bewertete Positionen' : 'Summe' }}: {{ formatPositionValue(summary.amount ?? summary.partialAmount) }} €</span><span v-if="summary.pending">{{ summary.pending }} Positionen mit offener Bewertung</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { formatPositionHours, formatPositionValue, summarizePositions } from '@/utils/payrollPositions';
import { useAuftragModals } from '@/composables/useAuftragModals';
import { useLohnartModals } from '@/composables/useLohnartModals';
const props = defineProps({ rows: { type: Array, default: () => [] }, summary: Boolean });
const { openAuftrag } = useAuftragModals();
const { openLohnart } = useLohnartModals();
const summaries = computed(() => summarizePositions(props.rows));
</script>
<style scoped>
.payroll-positions { min-width: 0; }
.payroll-positions__scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 4px; }
.payroll-positions table { width: 100%; min-width: 1100px; border-collapse: collapse; font-size: 11px; }
.payroll-positions--summary table { min-width: 520px; }
.payroll-positions--summary .payroll-positions__name { min-width: 0; }
.payroll-positions th { background: var(--hover); color: var(--muted); font-weight: 600; text-align: left; white-space: nowrap; }
.payroll-positions th, .payroll-positions td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.payroll-positions .number { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.payroll-positions__link { border: 0; padding: 0; background: transparent; color: var(--primary); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.payroll-positions__link:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
.payroll-positions__wage { background: var(--payroll-wage-bg); color: var(--text); }
.payroll-positions__invoice { background: var(--payroll-invoice-bg); color: var(--text); }
.payroll-positions__wage > td:first-child { box-shadow: inset 3px 0 var(--payroll-wage-accent); }
.payroll-positions__invoice > td:first-child { box-shadow: inset 3px 0 var(--payroll-invoice-accent); }
.payroll-positions__name { min-width: 170px; }
.payroll-positions__flag { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; }
.payroll-positions__note { min-width: 200px; max-width: 360px; font-size: 10px; }
.payroll-positions__note ul { padding-left: 14px; margin: 3px 0 0; }
.payroll-positions__totals { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.payroll-positions__totals > div { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px; font-size: 11px; }
.payroll-positions__empty { color: var(--muted); margin: 0; }
</style>
