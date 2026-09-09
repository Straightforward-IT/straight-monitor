<template>
  <form
    class="quick-time"
    :class="{ 'quick-time--contained': contained }"
    novalidate
    @submit.prevent="submit"
  >
    <header class="quick-time__order">
      <div>
        <p class="quick-time__eyebrow">
          Auftrag #{{ auftrag.auftragNr }}
        </p>
        <h2>{{ auftrag.eventTitel || 'Stundenschnellerfassung' }}</h2>
        <p class="quick-time__location">
          {{ [auftrag.eventLocation, auftrag.eventOrt].filter(Boolean).join(' · ') }}
        </p>
      </div>
      <div class="quick-time__overview">
        <span><strong>{{ groups.length }}</strong> Schichten</span>
        <span><strong>{{ rows.length }}</strong> Einsätze</span>
        <span class="quick-time__overview-total"><strong>{{ formatHours(totalMinutes) }}</strong> Ist-Std.</span>
      </div>
    </header>

    <div class="quick-time__toolbar">
      <label class="quick-time__filter">
        Schicht
        <select
          v-model="selectedGroup"
          aria-label="Schicht"
        >
          <option value="all">Alle Schichten</option>
          <option
            v-for="group in groups"
            :key="group.key"
            :value="group.key"
          >{{ group.schicht.bezeichnung }} ({{ group.rows.length }})</option>
        </select>
      </label>
      <span class="quick-time__hint">{{ completeCount }} von {{ rows.length }} Einsätzen erfasst</span>
      <span
        v-if="dirtyCount"
        class="quick-time__dirty"
      >{{ dirtyCount }} geändert</span>
    </div>

    <div class="quick-time__content">
      <div
        v-if="!groups.length"
        class="quick-time__empty"
      >
        Für diesen Auftrag sind noch keine Schichten oder Einsätze vorhanden.
      </div>

      <section
        v-for="group in visibleGroups"
        :key="group.key"
        class="quick-time__shift"
      >
        <header class="quick-time__shift-header">
          <div class="quick-time__shift-heading">
            <span class="quick-time__shift-icon"><FontAwesomeIcon :icon="faClock" /></span>
            <div>
              <h3>{{ group.schicht.bezeichnung || 'Schicht' }} <span>{{ group.rows.length }} Mitarbeiter</span></h3>
              <p>
                {{ formatDate(group.schicht.datumVon) }}<template v-if="group.schicht.uhrzeitVon">
                  · {{ group.schicht.uhrzeitVon }}–{{ group.schicht.uhrzeitBis }}<span v-if="isOvernight(group.schicht.uhrzeitVon, group.schicht.uhrzeitBis)"> (+1 Tag)</span>
                </template>
              </p>
            </div>
          </div>
          <button
            type="button"
            class="quick-time__text-button"
            :disabled="!group.rows[0]?.analysis.complete || group.rows.length < 2"
            @click="copyFirst(group)"
          >
            <FontAwesomeIcon :icon="faCopy" /> Erste Zeile übertragen
          </button>
        </header>

        <div
          v-if="!group.rows.length"
          class="quick-time__empty"
        >
          Dieser Schicht sind noch keine Mitarbeiter zugeordnet.
        </div>
        <div
          v-else
          class="quick-time__table-scroll"
          tabindex="0"
          :aria-label="`Zeiterfassung ${group.schicht.bezeichnung}`"
        >
          <table class="quick-time__table">
            <caption class="quick-time__sr-only">
              Soll- und Ist-Zeiten für {{ group.schicht.bezeichnung }}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  Mitarbeiter
                </th>
                <th scope="col">
                  Soll-Zeiten
                </th>
                <th scope="col">
                  Ist-Zeiten
                </th>
                <th scope="col">
                  Pause <small>Min.</small>
                </th>
                <th scope="col">
                  Davon bezahlt <small>Min.</small>
                </th>
                <th
                  scope="col"
                  class="quick-time__numeric"
                >
                  Ist-Stunden
                </th>
                <th scope="col">
                  <span class="quick-time__sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="row in group.rows"
                :key="row.key"
              >
                <tr :class="{ 'quick-time__row--error': row.analysis.errors.length, 'quick-time__row--dirty': row.dirty }">
                  <th
                    scope="row"
                    class="quick-time__person"
                  >
                    <strong>{{ row.name }}</strong>
                    <span><span
                      class="quick-time__status-dot"
                      :class="statusClass(row)"
                    />{{ statusText(row) }}<span class="quick-time__person-number"> · {{ row.einsatz.personalNr }}</span></span>
                  </th>
                  <td>
                    <span class="quick-time__planned">{{ row.planned.start || '–' }}<span>–</span>{{ row.planned.end || '–' }}</span>
                    <small
                      v-if="isOvernight(row.planned.start, row.planned.end)"
                      class="quick-time__next-day"
                    >Ende am Folgetag</small>
                  </td>
                  <td>
                    <div class="quick-time__time-pair">
                      <input
                        v-model="row.entry.start"
                        type="time"
                        step="60"
                        :aria-label="`Ist-Beginn – ${row.name}`"
                        :aria-invalid="row.analysis.errors.length ? 'true' : undefined"
                        :aria-describedby="row.analysis.errors.length ? `${instanceId}-${row.key}-error` : undefined"
                        @input="message = ''"
                      >
                      <span aria-hidden="true">–</span>
                      <input
                        v-model="row.entry.end"
                        type="time"
                        step="60"
                        :aria-label="`Ist-Ende – ${row.name}`"
                        :aria-invalid="row.analysis.errors.length ? 'true' : undefined"
                        :aria-describedby="row.analysis.errors.length ? `${instanceId}-${row.key}-error` : undefined"
                        @input="message = ''"
                      >
                    </div>
                    <small
                      v-if="row.analysis.overnight"
                      class="quick-time__next-day"
                    >Ende am Folgetag</small>
                  </td>
                  <td>
                    <input
                      :value="row.analysis.usesBlocks ? row.analysis.breakMinutes : row.entry.breakMinutes"
                      type="number"
                      min="0"
                      step="1"
                      class="quick-time__minutes"
                      :readonly="row.analysis.usesBlocks"
                      :aria-label="`Pause in Minuten – ${row.name}`"
                      @input="setMinutes(row, 'breakMinutes', $event)"
                    >
                    <button
                      type="button"
                      class="quick-time__break-toggle"
                      :aria-expanded="expandedRows.has(row.key)"
                      :aria-controls="`${instanceId}-${row.key}-breaks`"
                      :aria-label="`Pausenblöcke – ${row.name}`"
                      @click="toggleBreaks(row.key)"
                    >
                      {{ row.analysis.usesBlocks ? 'Zeitblöcke' : 'Details' }} <FontAwesomeIcon :icon="expandedRows.has(row.key) ? faChevronUp : faChevronDown" />
                    </button>
                  </td>
                  <td>
                    <input
                      :value="row.analysis.usesBlocks ? row.analysis.paidBreakMinutes : row.entry.paidBreakMinutes"
                      type="number"
                      min="0"
                      step="1"
                      class="quick-time__minutes"
                      :readonly="row.analysis.usesBlocks"
                      :aria-label="`Bezahlte Pause in Minuten – ${row.name}`"
                      @input="setMinutes(row, 'paidBreakMinutes', $event)"
                    >
                  </td>
                  <td class="quick-time__numeric">
                    <strong
                      class="quick-time__hours"
                      :class="{ 'quick-time__hours--empty': !row.analysis.complete }"
                    >{{ row.analysis.complete ? formatHours(row.analysis.netMinutes) : '–' }}</strong>
                  </td>
                  <td>
                    <div class="quick-time__row-actions">
                      <button
                        type="button"
                        :disabled="!row.planned.start || !row.planned.end"
                        :title="`Soll-Zeiten übernehmen – ${row.name}`"
                        :aria-label="`Soll-Zeiten übernehmen – ${row.name}`"
                        @click="usePlanned([row])"
                      >
                        <FontAwesomeIcon :icon="faClock" />
                      </button>
                      <button
                        type="button"
                        :disabled="!row.dirty"
                        :title="`Zurücksetzen – ${row.name}`"
                        :aria-label="`Zurücksetzen – ${row.name}`"
                        @click="resetRows([row])"
                      >
                        <FontAwesomeIcon :icon="faArrowRotateLeft" />
                      </button>
                      <button
                        type="button"
                        :disabled="row.analysis.empty"
                        :title="`Zeile leeren – ${row.name}`"
                        :aria-label="`Zeile leeren – ${row.name}`"
                        @click="clearRow(row)"
                      >
                        <FontAwesomeIcon :icon="faXmark" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr
                  v-if="row.analysis.errors.length"
                  class="quick-time__error-row"
                >
                  <td colspan="7">
                    <p
                      :id="`${instanceId}-${row.key}-error`"
                      role="alert"
                    >
                      <FontAwesomeIcon :icon="faCircleExclamation" /> {{ row.analysis.errors.join(' ') }}
                    </p>
                  </td>
                </tr>
                <tr
                  v-if="expandedRows.has(row.key)"
                  class="quick-time__details-row"
                >
                  <td colspan="7">
                    <div
                      :id="`${instanceId}-${row.key}-breaks`"
                      class="quick-time__break-panel"
                    >
                      <div class="quick-time__break-panel-heading">
                        <strong>Pausen · {{ row.name }}</strong><span>Zeitblöcke ersetzen die Minutenangabe.</span>
                      </div>
                      <div class="quick-time__break-grid">
                        <fieldset
                          v-for="(block, index) in row.entry.breaks"
                          :key="index"
                          class="quick-time__break-block"
                        >
                          <legend>Pause {{ index + 1 }}</legend>
                          <div class="quick-time__time-pair">
                            <input
                              v-model="block.start"
                              type="time"
                              step="60"
                              :aria-label="`Pause ${index + 1} Beginn – ${row.name}`"
                              @input="message = ''"
                            >
                            <span aria-hidden="true">–</span>
                            <input
                              v-model="block.end"
                              type="time"
                              step="60"
                              :aria-label="`Pause ${index + 1} Ende – ${row.name}`"
                              @input="message = ''"
                            >
                            <button
                              type="button"
                              class="quick-time__remove-break"
                              :disabled="!block.start && !block.end"
                              :aria-label="`Pause ${index + 1} entfernen – ${row.name}`"
                              @click="clearBreak(row, index)"
                            >
                              <FontAwesomeIcon :icon="faXmark" />
                            </button>
                          </div>
                          <label class="quick-time__paid"><input
                            v-model="block.paid"
                            type="checkbox"
                            :aria-label="`Pause ${index + 1} bezahlt – ${row.name}`"
                            @change="message = ''"
                          > Bezahlt</label>
                        </fieldset>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  colspan="5"
                >
                  {{ group.schicht.bezeichnung }} gesamt <span>{{ group.rows.filter(row => row.analysis.complete).length }} / {{ group.rows.length }} erfasst</span>
                </th><td class="quick-time__numeric">
                  {{ formatHours(groupTotal(group)) }}
                </td><td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div class="quick-time__explanation">
        Ein Ende vor dem Beginn zählt als Folgetag. Bezahlte Pausen werden nicht von den Ist-Stunden abgezogen.
      </div>
    </div>
    <footer class="quick-time__footer">
      <div class="quick-time__bulk">
        <ToolbarButton
          variant="secondary"
          :disabled="!visibleRows.length"
          @click="usePlanned(visibleRows)"
        >
          <FontAwesomeIcon :icon="faClock" /> {{ selectedGroup === 'all' ? 'Alle Soll-Zeiten übernehmen' : 'Soll-Zeiten der Schicht' }}
        </ToolbarButton>
        <ToolbarButton
          variant="secondary"
          :disabled="!visibleRows.some(row => row.dirty)"
          @click="resetRows(visibleRows)"
        >
          <FontAwesomeIcon :icon="faArrowRotateLeft" /> Zurücksetzen
        </ToolbarButton>
      </div>
      <div class="quick-time__total">
        <span>Auftrag gesamt</span><strong>{{ formatHours(totalMinutes) }} <small>Std.</small></strong>
      </div>
      <div class="quick-time__submit">
        <ToolbarButton
          variant="secondary"
          @click="cancel"
        >
          Abbrechen
        </ToolbarButton>
        <button
          type="submit"
          class="quick-time__accept"
          :disabled="!canSubmit"
        >
          <FontAwesomeIcon :icon="faCheck" /> Übernehmen
        </button>
      </div>
      <p
        v-if="errorCount"
        class="quick-time__footer-error"
        role="status"
      >
        Bitte {{ errorCount }} fehlerhafte {{ errorCount === 1 ? 'Zeile' : 'Zeilen' }} prüfen. Die Summe enthält nur gültige Einträge.
      </p>
      <p
        v-else-if="message"
        class="quick-time__message"
        role="status"
      >
        {{ message }}
      </p>
    </footer>
  </form>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowRotateLeft, faCheck, faChevronDown, faChevronUp, faCircleExclamation, faClock, faCopy, faXmark } from '@fortawesome/free-solid-svg-icons';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import { analyzeQuickEntry, buildQuickEntryGroups, createQuickEntry, employeeName, formatHours, plannedTimes } from '@/utils/stundenschnellerfassung';

const props = defineProps({
  contained: { type: Boolean, default: false },
  auftrag: { type: Object, required: true },
  schichten: { type: Array, default: () => [] },
  einsaetze: { type: Array, default: () => [] },
  zeiten: { type: Array, default: () => [] },
});
const emit = defineEmits(['submit', 'cancel']);
const instanceId = `quick-time-${getCurrentInstance().uid}`;
const entries = ref({});
const baseline = ref({});
const selectedGroup = ref('all');
const expandedRows = ref(new Set());
const message = ref('');
const clone = value => JSON.parse(JSON.stringify(value));
const sourceGroups = computed(() => buildQuickEntryGroups(props.auftrag, props.schichten, props.einsaetze));

watch(() => [props.auftrag.auftragNr, props.schichten, props.einsaetze, props.zeiten], () => {
  const next = {};
  for (const einsatz of sourceGroups.value.flatMap(group => group.einsaetze)) {
    const key = String(einsatz._id);
    next[key] = createQuickEntry(einsatz, props.zeiten.find(entry => String(entry.einsatzId) === key));
  }
  entries.value = next;
  baseline.value = clone(next);
  selectedGroup.value = 'all';
  expandedRows.value = new Set();
  message.value = '';
}, { immediate: true });

const groups = computed(() => sourceGroups.value.map(group => ({
  ...group,
  rows: group.einsaetze.map(einsatz => {
    const key = String(einsatz._id);
    const entry = entries.value[key];
    return { key, einsatz, entry, date: einsatz.detailDatumVon || einsatz.datumVon || group.schicht.datumVon, name: employeeName(einsatz), planned: plannedTimes(einsatz, group.schicht), analysis: analyzeQuickEntry(entry), dirty: JSON.stringify(entry) !== JSON.stringify(baseline.value[key]) };
  }),
})));
const rows = computed(() => groups.value.flatMap(group => group.rows));
const visibleGroups = computed(() => selectedGroup.value === 'all' ? groups.value : groups.value.filter(group => group.key === selectedGroup.value));
const visibleRows = computed(() => visibleGroups.value.flatMap(group => group.rows));
const totalMinutes = computed(() => rows.value.reduce((sum, row) => sum + row.analysis.netMinutes, 0));
const completeCount = computed(() => rows.value.filter(row => row.analysis.complete).length);
const errorCount = computed(() => rows.value.filter(row => row.analysis.errors.length).length);
const dirtyCount = computed(() => rows.value.filter(row => row.dirty).length);
const canSubmit = computed(() => !errorCount.value && (completeCount.value > 0 || rows.value.some(row => row.analysis.empty && row.dirty)));

function formatDate(value) {
  if (!value) return 'Datum offen';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function isOvernight(start, end) { return start && end && end < start; }
function groupTotal(group) { return group.rows.reduce((sum, row) => sum + row.analysis.netMinutes, 0); }
function statusClass(row) { return row.analysis.errors.length ? 'error' : row.dirty ? 'dirty' : row.analysis.complete ? 'complete' : 'empty'; }
function statusText(row) { return row.analysis.errors.length ? 'Prüfen' : row.dirty ? 'Geändert' : row.analysis.complete ? 'Erfasst' : 'Offen'; }
function toggleBreaks(key) {
  if (expandedRows.value.has(key)) expandedRows.value.delete(key);
  else expandedRows.value.add(key);
}
function setMinutes(row, field, event) { row.entry[field] = event.target.value; message.value = ''; }
function clearBreak(row, index) {
  row.entry.breaks[index] = { start: '', end: '', paid: false };
  message.value = '';
}
function clearRow(row) { entries.value[row.key] = createQuickEntry(row.einsatz); message.value = ''; }
function resetRows(targets) {
  targets.forEach(row => { entries.value[row.key] = clone(baseline.value[row.key]); });
  message.value = 'Ausgangswerte wiederhergestellt.';
}
function usePlanned(targets) {
  let count = 0;
  targets.forEach(row => {
    if (!row.planned.start || !row.planned.end) return;
    row.entry.start = row.planned.start;
    row.entry.end = row.planned.end;
    count++;
  });
  message.value = `Soll-Zeiten für ${count} ${count === 1 ? 'Einsatz' : 'Einsätze'} übernommen.`;
}
function copyFirst(group) {
  const first = group.rows[0];
  if (!first?.analysis.complete) return;
  group.rows.slice(1).forEach(row => { entries.value[row.key] = { ...clone(first.entry), einsatzId: row.key }; });
  message.value = `Zeiten und Pausen der ersten Zeile auf ${group.rows.length - 1} weitere Einsätze in „${group.schicht.bezeichnung}“ übertragen.`;
}
function cancel() {
  entries.value = clone(baseline.value);
  expandedRows.value = new Set();
  message.value = 'Änderungen verworfen.';
  emit('cancel');
}
function submit() {
  if (!canSubmit.value) return;
  const payload = {
    auftragNr: props.auftrag.auftragNr,
    entries: rows.value.filter(row => row.analysis.complete).map(row => ({
      ...clone(row.entry), personalNr: row.einsatz.personalNr, schicht: row.einsatz.schicht?._id || row.einsatz.schicht || null,
      datum: String(row.date || '').slice(0, 10), endDayOffset: row.analysis.overnight ? 1 : 0,
      breakMinutes: row.analysis.breakMinutes, paidBreakMinutes: row.analysis.paidBreakMinutes, netMinutes: row.analysis.netMinutes,
    })),
    clearedEinsatzIds: rows.value.filter(row => row.analysis.empty && row.dirty).map(row => row.key),
    totalMinutes: totalMinutes.value,
  };
  emit('submit', payload);
  baseline.value = clone(entries.value);
  message.value = `${payload.entries.length} Einsätze lokal übernommen · ${formatHours(totalMinutes.value)} Std.`;
}
</script>

<style scoped>
.quick-time { color: var(--text); font-size: 13px; min-width: 0; }
.quick-time--contained { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.quick-time--contained .quick-time__content { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.quick-time--contained > :is(header, footer, .quick-time__toolbar) { flex-shrink: 0; }
.quick-time * { box-sizing: border-box; }
.quick-time__order { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
.quick-time__eyebrow { color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.quick-time h2 { margin: 5px 0; font-size: 22px; font-weight: 600; }
.quick-time__location { color: var(--muted); font-size: 12px; }
.quick-time__overview { display: flex; gap: 28px; text-align: right; }
.quick-time__overview > span { display: grid; gap: 3px; color: var(--muted); font-size: 11px; }
.quick-time__overview strong { color: var(--text); font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.quick-time__overview-total { padding-left: 26px; border-left: 1px solid var(--border); }
.quick-time__overview-total strong { color: var(--primary); }
.quick-time__toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 14px 24px; }
.quick-time__filter { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--muted); }
.quick-time__filter select { min-width: 190px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px; }
.quick-time__hint { font-size: 12px; color: var(--muted); }
.quick-time__dirty { margin-left: auto; font-size: 11px; color: var(--text); background: color-mix(in srgb, var(--primary) 16%, var(--surface)); padding: 4px 8px; border-radius: 5px; }
.quick-time__shift { margin: 0 24px 18px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); }
.quick-time__shift-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 16px; background: color-mix(in srgb, var(--primary) 5%, var(--surface)); border-bottom: 1px solid var(--border); }
.quick-time__shift-heading { display: flex; align-items: center; gap: 11px; }
.quick-time__shift-icon { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border)); border-radius: 7px; color: var(--primary); background: var(--surface); }
.quick-time__shift-heading h3 { font-size: 14px; font-weight: 600; }
.quick-time__shift-heading h3 span { margin-left: 7px; font-size: 11px; font-weight: 400; color: var(--muted); }
.quick-time__shift-heading p { margin-top: 3px; font-size: 11px; color: var(--muted); }
.quick-time__text-button { display: inline-flex; gap: 7px; align-items: center; border: 0; padding: 6px 0; background: none; color: var(--muted); cursor: pointer; font-size: 11px; }
.quick-time__text-button:hover { color: var(--text); }
.quick-time__table-scroll { overflow-x: auto; }
.quick-time__table { width: 100%; border-collapse: collapse; text-align: left; font-variant-numeric: tabular-nums; }
.quick-time__table th, .quick-time__table td { padding: 12px 10px; vertical-align: top; }
.quick-time__table thead th { padding-top: 10px; padding-bottom: 10px; white-space: nowrap; font-size: 11px; font-weight: 500; color: var(--muted); background: var(--hover); border-bottom: 1px solid var(--border); }
.quick-time__table thead small { margin-left: 2px; opacity: .75; }
.quick-time__table tbody tr + tr > * { border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.quick-time__table th:first-child, .quick-time__table td:first-child { padding-left: 16px; }
.quick-time__person { min-width: 190px; }
.quick-time__person > strong { display: block; font-weight: 500; font-size: 12px; margin: 1px 0 6px; }
.quick-time__person > span { display: block; font-weight: 400; font-size: 10px; color: var(--muted); }
.quick-time__status-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--muted); margin: 0 5px 1px 0; }
.quick-time__status-dot.complete { background: #62b58f; }
.quick-time__status-dot.dirty { background: var(--primary); }
.quick-time__status-dot.error { background: #dc665e; }
.quick-time__planned { display: flex; gap: 6px; align-items: center; min-height: 32px; white-space: nowrap; color: var(--muted); font-size: 12px; }
.quick-time__planned > span { opacity: .5; }
.quick-time__time-pair { display: flex; align-items: center; gap: 5px; }
.quick-time__time-pair > span { color: var(--muted); }
.quick-time input[type='time'], .quick-time input[type='number'] { height: 32px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--text); font-family: inherit; font-size: 12px; font-variant-numeric: tabular-nums; padding: 4px 7px; }
.quick-time input[type='time'] { width: 104px; }
.quick-time input[type='time']::-webkit-calendar-picker-indicator { width: 12px; margin-left: 0; opacity: .5; }
.quick-time input[readonly] { background: var(--hover); color: var(--muted); }
.quick-time__minutes { width: 72px; text-align: right; }
.quick-time__next-day { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }
.quick-time__break-toggle { display: flex; align-items: center; gap: 5px; padding: 4px 0 0; border: 0; background: none; color: var(--muted); font-size: 10px; cursor: pointer; }
.quick-time__numeric { text-align: right; white-space: nowrap; }
.quick-time__hours { display: block; padding-top: 7px; font-size: 14px; font-weight: 600; }
.quick-time__hours--empty { color: var(--muted); font-weight: 400; }
.quick-time__row-actions { display: flex; gap: 4px; padding-top: 1px; }
.quick-time__row-actions button, .quick-time__remove-break { display: grid; place-items: center; width: 28px; height: 30px; padding: 0; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--muted); cursor: pointer; }
.quick-time button:hover:not(:disabled) { border-color: var(--primary); }
.quick-time :is(input, select, button, [tabindex]):focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.quick-time button:disabled { opacity: .35; cursor: not-allowed; }
.quick-time__row--dirty .quick-time__person { box-shadow: inset 2px 0 var(--primary); }
.quick-time__row--error .quick-time__person { box-shadow: inset 2px 0 #dc665e; }
.quick-time__error-row p { display: flex; align-items: center; gap: 8px; color: #c75048; font-size: 12px; }
.quick-time__error-row td { padding-top: 7px; padding-bottom: 10px; }
.quick-time__break-panel { padding: 2px 0 6px; }
.quick-time__break-panel-heading { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; }
.quick-time__break-panel-heading strong { font-size: 12px; font-weight: 500; }
.quick-time__break-panel-heading span { color: var(--muted); font-size: 11px; }
.quick-time__details-row { background: var(--hover); }
.quick-time__break-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.quick-time__break-block { margin: 0; padding: 10px 12px; min-width: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.quick-time__break-block legend { padding: 0 4px; color: var(--muted); font-size: 11px; }
.quick-time__break-block .quick-time__time-pair input { width: 100%; min-width: 0; }
.quick-time__remove-break { flex: 0 0 24px; height: 28px; border: none; }
.quick-time__paid { display: flex; align-items: center; gap: 7px; margin-top: 9px; color: var(--muted); font-size: 11px; }
.quick-time__paid input { accent-color: var(--primary); }
.quick-time__table tfoot { border-top: 1px solid var(--border); background: var(--hover); }
.quick-time__table tfoot th, .quick-time__table tfoot td { font-size: 12px; font-weight: 600; }
.quick-time__table tfoot span { margin-left: 12px; font-size: 10px; font-weight: 400; color: var(--muted); }
.quick-time__explanation { padding: 0 24px 18px; font-size: 11px; color: var(--muted); }
.quick-time__footer { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 16px 24px; border-top: 1px solid var(--border); background: var(--surface); }
.quick-time__bulk, .quick-time__submit { display: flex; flex-wrap: wrap; gap: 8px; }
.quick-time__bulk :deep(button), .quick-time__submit :deep(button) { font-size: 12px; border-radius: 6px; padding: 9px 12px; }
.quick-time__total { margin-left: auto; text-align: right; }
.quick-time__total > span { display: block; color: var(--muted); font-size: 10px; }
.quick-time__total > strong { display: block; font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.quick-time__total small { font-size: 11px; font-weight: 400; color: var(--muted); }
.quick-time__accept { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--primary); background: var(--primary); color: #27221c; font-weight: 600; cursor: pointer; }
.quick-time__message, .quick-time__footer-error { flex-basis: 100%; font-size: 12px; color: var(--muted); }
.quick-time__footer-error { color: #c75048; }
.quick-time__empty { padding: 28px 24px; color: var(--muted); text-align: center; }
.quick-time__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .quick-time__order { align-items: flex-start; flex-direction: column; padding: 18px 16px; }
  .quick-time__overview { width: 100%; justify-content: space-between; text-align: left; }
  .quick-time__overview-total { padding-left: 20px; }
  .quick-time__toolbar { gap: 10px; padding: 12px 16px; }
  .quick-time__shift { margin: 0 12px 14px; }
  .quick-time__shift-header { flex-wrap: wrap; gap: 7px; padding: 12px; }
  .quick-time__shift-heading h3 span { display: block; margin: 3px 0 0; }
  .quick-time__footer { padding: 16px; }
  .quick-time__bulk { width: 100%; }
  .quick-time__total { margin: 0 auto 0 0; }
  .quick-time__explanation { padding: 0 16px 16px; line-height: 1.6; }
}
</style>
