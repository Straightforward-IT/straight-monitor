<template>
  <div class="payroll-positions">
    <div v-if="rows.length" class="payroll-positions__scroll" tabindex="0" aria-label="Berechnete Lohn- und Fakturpositionen, horizontal scrollbar">
      <table>
        <thead><tr><th>Auftrag</th><th>Einsatzort</th><th>Nr.</th><th>Lohnarten-Bezeichnung</th><th>Tage</th><th>Stunden</th><th>Preis €</th><th>Zulage %</th><th>Betrag €</th><th>Verw.</th><th>Projekt / Job</th><th>Verrechnung / Hinweis</th></tr></thead>
        <tbody><tr v-for="row in rows" :key="row.id" :class="row.side === 'L' ? 'payroll-positions__wage' : 'payroll-positions__invoice'" :data-side="row.side" :data-wage-type="row.wageType || row.kb">
          <td>{{ row.auftragNr ?? '—' }}</td><td>{{ row.site || row.einsortNr || '—' }}</td><td>{{ row.wageType || row.kb || '—' }}</td>
          <td class="payroll-positions__name">{{ row.label }}<span v-if="row.countForTotalHours === true" class="payroll-positions__flag" title="Diese Lohnart zählt für Gesamtstunden">Gesamtstunden</span></td>
          <td class="number">{{ row.days }}</td><td class="number">{{ formatPositionHours(row) }}</td><td class="number">{{ formatPositionValue(row.rate) }}</td><td class="number">{{ formatPositionValue(row.percent) }}</td><td class="number">{{ formatPositionValue(row.amount) }}</td>
          <td><abbr :title="row.side === 'L' ? 'Lohnseite' : 'Fakturseite'">{{ row.side }}</abbr></td><td>{{ row.project || row.activity || '—' }}</td>
          <td class="payroll-positions__note"><span v-if="row.offset?.code && row.offset.code !== '0'">{{ row.offset.label || row.offset.code }}<template v-if="row.offset.target"> → {{ row.offset.target }}</template><template v-if="row.offset.priority"> · Priorität {{ row.offset.priority }}</template>. </span><span>{{ row.status === 'CALCULATED' ? 'Berechnet' : row.amount == null ? 'Berechnung offen' : 'Teilbewertung' }}</span><ul v-if="row.issues?.length"><li v-for="(issue, index) in row.issues" :key="index">{{ issue.message }}</li></ul></td>
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
const props = defineProps({ rows: { type: Array, default: () => [] } });
const summaries = computed(() => summarizePositions(props.rows));
</script>
<style scoped>
.payroll-positions { min-width: 0; }
.payroll-positions__scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 4px; }
.payroll-positions table { width: 100%; min-width: 1100px; border-collapse: collapse; font-size: 11px; }
.payroll-positions th { background: var(--hover); color: var(--muted); font-weight: 600; text-align: left; white-space: nowrap; }
.payroll-positions th, .payroll-positions td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.payroll-positions .number { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
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
