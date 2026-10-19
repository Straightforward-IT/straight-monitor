<template>
  <section class="zvoove-day-details" aria-label="Aufträge und Tagesdetails">
    <p v-if="!entries.length" class="zvoove-day-details__empty">Für diesen Tag liegt kein importierter Eintrag vor.</p>
    <article v-for="entry in entries" :key="entry.id" class="zvoove-day-entry" :class="`zvoove-day-entry--${entry.kind}`">
      <PayrollOrderDetails v-if="entry.kind === 'productive'" :entry="entry" />
      <h3 v-else>{{ importedEntryCode(entry) }} · {{ entry.label }}</h3>
      <component :is="entry.kind === 'productive' ? 'details' : 'div'" class="zvoove-day-entry__source" :class="{ 'zvoove-day-entry__source--collapsible': entry.kind === 'productive' }">
        <summary v-if="entry.kind === 'productive'">Importquelle und Buchungsdetails</summary>
        <dl>
        <div><dt>Stunden (Quellwert)</dt><dd>{{ entry.hours == null ? 'Kein Stundenwert' : `${formatImportedHours(entry.hours)} Std.` }}</dd></div>
        <div><dt>KB</dt><dd>{{ entry.kb || 'Leer · produktive Stunden' }}</dd></div>
        <div><dt>Lohnart</dt><dd>{{ entry.lohnartNummer || (entry.kind === 'productive' ? 'Noch nicht festgelegt' : entry.kind === 'marker' ? 'Tageskennzeichnung' : 'Zuordnung offen') }}</dd></div>
        <div><dt>Ursprüngliche Personalnummer</dt><dd>{{ entry.personalNr }}</dd></div>
        <div><dt>Datei</dt><dd>{{ entry.source?.filename || '—' }}</dd></div>
        <div><dt>Tabellenblatt / Zeile</dt><dd>{{ entry.source?.sheet || '—' }} / {{ entry.source?.row || '—' }}</dd></div>
        <template v-if="entry.booking">
          <div><dt>Auftrag</dt><dd>{{ entry.booking.auftragNr }}</dd></div>
          <div><dt>Arbeitszeit</dt><dd>{{ clock(entry.booking.start) }}–{{ clock(entry.booking.end) }}</dd></div>
          <div><dt>Pausendauer</dt><dd>{{ entry.booking.breakMinutes ?? 'Ungeklärt' }} Min.</dd></div>
          <div><dt>Pausenlage</dt><dd>{{ entry.booking.breakLocationKnown ? 'Intervalle vorhanden / keine Pause' : 'Nur Dauer bekannt' }}</dd></div>
          <div v-for="(pause, index) in entry.booking.breaks" :key="index"><dt>Pause {{ index + 1 }}</dt><dd>{{ clock(pause.start) }}–{{ clock(pause.end) }}</dd></div>
        </template>
        <div v-else><dt>Quellspalten</dt><dd>T{{ entry.source?.daySlot }} / KZ{{ entry.source?.daySlot }}</dd></div>
        </dl>
      </component>
      <p v-if="entry.kind === 'unresolved'" role="status">Das Kennzeichen bleibt erhalten. Eine eindeutige Lohnartzuordnung fehlt.</p>
    </article>
  </section>
</template>

<script setup>
import { formatImportedHours, importedEntryCode } from '@/utils/importedHours';
import PayrollOrderDetails from './PayrollOrderDetails.vue';
const clock = value => value ? new Date(value).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }) : 'Ungeklärt';
defineProps({ entries: { type: Array, default: () => [] } });
</script>

<style scoped>
.zvoove-day-details { display: grid; gap: 12px; min-width: 0; }
.zvoove-day-details__empty { margin: 0; color: var(--muted); font-size: 12px; }
.zvoove-day-entry { padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.zvoove-day-entry h3 { margin: 0 0 12px; font-size: 13px; }
.zvoove-day-entry dl { margin: 0; display: grid; gap: 10px; }
.zvoove-day-entry dl > div { display: grid; grid-template-columns: minmax(120px, 45%) minmax(0, 1fr); gap: 8px; font-size: 12px; }
.zvoove-day-entry dt { color: var(--muted); }.zvoove-day-entry dd { margin: 0; overflow-wrap: anywhere; }
.zvoove-day-entry--unresolved { border-color: var(--warning, #d7a34e); }
.zvoove-day-entry p { font-size: 12px; margin-bottom: 0; }
.zvoove-day-entry__source--collapsible { border-top: 1px solid var(--border); margin-top: 14px; padding-top: 12px; }
.zvoove-day-entry__source summary { cursor: pointer; color: var(--muted); font-size: 12px; }
.zvoove-day-entry__source[open] summary { margin-bottom: 12px; }
</style>
