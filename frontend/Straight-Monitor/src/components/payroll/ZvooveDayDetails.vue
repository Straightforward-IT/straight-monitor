<template>
  <section class="zvoove-day-details" aria-label="Importdetails des Tages">
    <p v-if="!entries.length" class="zvoove-day-details__empty">Für diesen Tag liegt kein importierter Eintrag vor.</p>
    <article v-for="entry in entries" :key="entry.id" class="zvoove-day-entry" :class="`zvoove-day-entry--${entry.kind}`">
      <h3>{{ importedEntryCode(entry) }} · {{ entry.label }}</h3>
      <dl>
        <div><dt>Stunden (Quellwert)</dt><dd>{{ entry.hours == null ? 'Kein Stundenwert' : `${formatImportedHours(entry.hours)} Std.` }}</dd></div>
        <div><dt>KB</dt><dd>{{ entry.kb || 'Leer · produktive Stunden' }}</dd></div>
        <div><dt>Lohnart</dt><dd>{{ entry.lohnartNummer || (entry.kind === 'productive' ? 'Noch nicht festgelegt' : entry.kind === 'marker' ? 'Tageskennzeichnung' : 'Zuordnung offen') }}</dd></div>
        <div><dt>Ursprüngliche Personalnummer</dt><dd>{{ entry.personalNr }}</dd></div>
        <div><dt>Datei</dt><dd>{{ entry.source?.filename || '—' }}</dd></div>
        <div><dt>Tabellenblatt / Zeile</dt><dd>{{ entry.source?.sheet || '—' }} / {{ entry.source?.row || '—' }}</dd></div>
        <div><dt>Quellspalten</dt><dd>T{{ entry.source?.daySlot }} / KZ{{ entry.source?.daySlot }}</dd></div>
      </dl>
      <p v-if="entry.kind === 'unresolved'" role="status">Das Kennzeichen bleibt erhalten. Eine eindeutige Lohnartzuordnung fehlt.</p>
    </article>
  </section>
</template>

<script setup>
import { formatImportedHours, importedEntryCode } from '@/utils/importedHours';
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
</style>
