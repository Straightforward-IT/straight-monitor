<template>
  <form
    class="quick-time"
    :class="{ 'quick-time--contained': contained }"
    :inert="busy || undefined"
    novalidate
    @submit.prevent="submit('save')"
  >
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
        <header
          class="quick-time__shift-header"
          role="button"
          tabindex="0"
          :aria-expanded="expandedGroups.has(group.key)"
          :aria-controls="`${instanceId}-${group.key}-entries`"
          @click="toggleGroup(group.key)"
          @keydown.enter.prevent="toggleGroup(group.key)"
          @keydown.space.prevent="toggleGroup(group.key)"
        >
          <div class="quick-time__shift-heading">
            <span class="quick-time__shift-icon"><FontAwesomeIcon :icon="faClock" /></span>
            <div>
              <h3>{{ group.schicht.bezeichnung || 'Schicht' }} <span>{{ group.rows.filter(row => row.analysis.complete).length }}/{{ group.rows.length }} erfasst · {{ formatHours(groupTotal(group)) }} Std.</span></h3>
              <p>
                {{ formatDate(group.schicht.datumVon) }}<template v-if="group.schicht.uhrzeitVon">
                  · {{ group.schicht.uhrzeitVon }}–{{ group.schicht.uhrzeitBis }}<span v-if="isOvernight(group.schicht.uhrzeitVon, group.schicht.uhrzeitBis)"> (+1 Tag)</span>
                </template>
              </p>
            </div>
          </div>
          <div class="quick-time__shift-actions">
            <button
              type="button"
              class="quick-time__text-button"
              :disabled="!group.rows[0]?.analysis.complete || !group.rows.slice(1).some(row => !row.locked)"
              @click.stop="copyFirst(group)"
            >
              <FontAwesomeIcon :icon="faCopy" /> Erste Zeile übertragen
            </button>
            <button
              type="button"
              class="quick-time__collapse-button"
              :aria-expanded="expandedGroups.has(group.key)"
              :aria-controls="`${instanceId}-${group.key}-entries`"
              :aria-label="`${group.schicht.bezeichnung || 'Schicht'} ${expandedGroups.has(group.key) ? 'minimieren' : 'erweitern'}`"
              @click.stop="toggleGroup(group.key)"
            >
              <FontAwesomeIcon :icon="expandedGroups.has(group.key) ? faChevronUp : faChevronDown" />
            </button>
          </div>
        </header>

        <div
          v-if="expandedGroups.has(group.key) && !group.rows.length"
          class="quick-time__empty"
        >
          Dieser Schicht sind noch keine Mitarbeiter zugeordnet.
        </div>
        <div
          v-else-if="expandedGroups.has(group.key)"
          :id="`${instanceId}-${group.key}-entries`"
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
                <tr :class="{ 'quick-time__row--error': row.analysis.errors.length, 'quick-time__row--warning': !row.analysis.errors.length && row.analysis.warnings.length, 'quick-time__row--dirty': row.dirty, 'quick-time__row--locked': row.locked }">
                  <th
                    scope="row"
                    class="quick-time__person"
                  >
                    <strong>{{ row.name }}</strong>
                    <span><span
                      class="quick-time__status-dot"
                      :class="statusClass(row)"
                    />{{ statusText(row) }}<span class="quick-time__person-number"> · {{ row.einsatz.personalNr }}</span></span>
                    <small v-if="row.einsatz.timeSubmission">MA: {{ row.einsatz.timeSubmission.start }}–{{ row.einsatz.timeSubmission.end }} · {{ formatHours(row.einsatz.timeSubmission.netMinutes) }} Std.</small>
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
                        :disabled="row.locked"
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
                        :disabled="row.locked"
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
                      :disabled="row.locked"
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
                      :disabled="row.locked"
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
                        :disabled="row.locked || !row.planned.start || !row.planned.end"
                        :title="`Soll-Zeiten übernehmen – ${row.name}`"
                        :aria-label="`Soll-Zeiten übernehmen – ${row.name}`"
                        @click="usePlanned([row])"
                      >
                        <FontAwesomeIcon :icon="faClock" />
                      </button>
                      <button
                        type="button"
                        :disabled="row.locked || !row.dirty"
                        :title="`Zurücksetzen – ${row.name}`"
                        :aria-label="`Zurücksetzen – ${row.name}`"
                        @click="resetRows([row])"
                      >
                        <FontAwesomeIcon :icon="faArrowRotateLeft" />
                      </button>
                      <button
                        type="button"
                        :disabled="row.locked || row.analysis.empty"
                        :title="`Zeile leeren – ${row.name}`"
                        :aria-label="`Zeile leeren – ${row.name}`"
                        @click="clearRow(row)"
                      >
                        <FontAwesomeIcon :icon="faXmark" />
                      </button>
                      <CustomTooltip
                        v-if="connected"
                        :text="row.locked ? 'Rücknahme aus der Stundenerfassung' : 'Übertragen in die Stundenerfassung'"
                      >
                        <button
                          type="button"
                          class="quick-time__transfer-action"
                          :class="{ 'quick-time__transfer-action--withdraw': row.locked }"
                          :disabled="!row.locked && (!row.analysis.complete || row.analysis.errors.length)"
                          :aria-label="row.locked ? 'Rücknahme aus der Stundenerfassung' : 'Übertragen in die Stundenerfassung'"
                          @click="submitRow(row)"
                        >
                          <FontAwesomeIcon :icon="row.locked ? faArrowLeft : faArrowRight" />
                        </button>
                      </CustomTooltip>
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
                  v-else-if="row.analysis.warnings.length"
                  class="quick-time__warning-row"
                >
                  <td colspan="7">
                    <p
                      :id="`${instanceId}-${row.key}-warning`"
                      role="status"
                    >
                      <FontAwesomeIcon :icon="faTriangleExclamation" /> {{ row.analysis.warnings.join(' ') }} Die Erfassung kann trotzdem gespeichert werden.
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
                              :disabled="row.locked"
                              :aria-label="`Pause ${index + 1} Beginn – ${row.name}`"
                              @input="message = ''"
                            >
                            <span aria-hidden="true">–</span>
                            <input
                              v-model="block.end"
                              type="time"
                              step="60"
                              :disabled="row.locked"
                              :aria-label="`Pause ${index + 1} Ende – ${row.name}`"
                              @input="message = ''"
                            >
                            <button
                              type="button"
                              class="quick-time__remove-break"
                              :disabled="row.locked || (!block.start && !block.end)"
                              :aria-label="`Pause ${index + 1} entfernen – ${row.name}`"
                              @click="clearBreak(row, index)"
                            >
                              <FontAwesomeIcon :icon="faXmark" />
                            </button>
                          </div>
                          <label class="quick-time__paid"><input
                            v-model="block.paid"
                            type="checkbox"
                            :disabled="row.locked"
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

    </div>
    <footer class="quick-time__footer">
      <div class="quick-time__bulk">
        <ToolbarButton
          variant="secondary"
          :disabled="!editableVisibleRows.length"
          @click="usePlanned(editableVisibleRows)"
        >
          <FontAwesomeIcon :icon="faClock" /> Sichtbare Soll-Zeiten übernehmen
        </ToolbarButton>
        <ToolbarButton
          variant="secondary"
          :disabled="!editableVisibleRows.some(row => row.dirty)"
          @click="resetRows(editableVisibleRows)"
        >
          <FontAwesomeIcon :icon="faArrowRotateLeft" /> Zurücksetzen
        </ToolbarButton>
      </div>
      <div class="quick-time__total">
        <span>Auftrag gesamt · {{ completeCount }}/{{ rows.length }} erfasst</span><strong>{{ formatHours(totalMinutes) }} <small>Std.</small></strong>
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
          <FontAwesomeIcon :icon="faCheck" /> {{ connected ? 'Entwurf speichern' : 'Übernehmen' }}
        </button>
        <button
          v-if="connected"
          type="button"
          class="quick-time__accept"
          :disabled="!canSubmit"
          @click="submit('release')"
        >
          An Zeitverwaltung übergeben
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
      <p
        v-else-if="warningCount"
        class="quick-time__footer-warning"
        role="status"
      >
        {{ warningCount }} {{ warningCount === 1 ? 'Eintrag enthält' : 'Einträge enthalten' }} einen Pausen- oder Arbeitszeit-Hinweis. Speichern bleibt möglich.
      </p>
    </footer>
  </form>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowLeft, faArrowRight, faArrowRotateLeft, faCheck, faChevronDown, faChevronUp, faCircleExclamation, faClock, faCopy, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import CustomTooltip from '@/components/CustomTooltip.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import { analyzeQuickEntry, buildQuickEntryGroups, createQuickEntry, employeeName, formatHours, plannedTimes } from '@/utils/stundenschnellerfassung';

const props = defineProps({
  contained: { type: Boolean, default: false },
  connected: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  showContext: { type: Boolean, default: true },
  auftrag: { type: Object, required: true },
  schichten: { type: Array, default: () => [] },
  einsaetze: { type: Array, default: () => [] },
  zeiten: { type: Array, default: () => [] },
  employeeSearch: { type: String, default: '' },
  submissionFilter: { type: String, default: 'all' },
});
const emit = defineEmits(['submit', 'cancel', 'dirty-change']);
const instanceId = `quick-time-${getCurrentInstance().uid}`;
const entries = ref({});
const baseline = ref({});
const expandedRows = ref(new Set());
const expandedGroups = ref(new Set());
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
  expandedRows.value = new Set();
  expandedGroups.value = new Set(sourceGroups.value.map(group => group.key));
  message.value = '';
}, { immediate: true });

const groups = computed(() => sourceGroups.value.map(group => ({
  ...group,
  rows: group.einsaetze.map(einsatz => {
    const key = String(einsatz._id);
    const entry = entries.value[key];
    const date = einsatz.detailDatumVon || group.schicht.datumVon || einsatz.datumVon;
    return { key, einsatz, entry, date, name: employeeName(einsatz), planned: plannedTimes(einsatz, group.schicht), analysis: analyzeQuickEntry(entry, props.connected && date ? String(date).slice(0, 10) : null), dirty: JSON.stringify(entry) !== JSON.stringify(baseline.value[key]), locked: props.connected && !!einsatz.timeReleased, submitted: !!einsatz.timeSubmitted };
  }),
})));
const rows = computed(() => groups.value.flatMap(group => group.rows));
const matchesFilters = row => (!props.employeeSearch || `${row.name} ${row.einsatz.mitarbeiterData?.vorname || ''} ${row.einsatz.mitarbeiterData?.nachname || ''} ${row.einsatz.personalNr || ''}`.toLocaleLowerCase('de-DE').includes(props.employeeSearch.trim().toLocaleLowerCase('de-DE')))
  && (props.submissionFilter === 'all' || (props.submissionFilter === 'submitted') === row.submitted);
const filteredGroups = computed(() => groups.value.map(group => ({ ...group, rows: group.rows.filter(matchesFilters) })).filter(group => group.rows.length));
const visibleGroups = computed(() => filteredGroups.value);
const visibleRows = computed(() => visibleGroups.value.flatMap(group => group.rows));
const editableVisibleRows = computed(() => visibleRows.value.filter(row => !row.locked));
const totalMinutes = computed(() => rows.value.reduce((sum, row) => sum + row.analysis.netMinutes, 0));
const completeCount = computed(() => rows.value.filter(row => row.analysis.complete).length);
const errorCount = computed(() => rows.value.filter(row => row.analysis.errors.length).length);
const warningCount = computed(() => rows.value.filter(row => row.analysis.warnings.length).length);
const dirtyCount = computed(() => rows.value.filter(row => row.dirty).length);
watch(dirtyCount, count => emit('dirty-change', count > 0));
const canSubmit = computed(() => !errorCount.value && (completeCount.value > 0 || rows.value.some(row => row.analysis.empty && row.dirty)));

function formatDate(value) {
  if (!value) return 'Datum offen';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function isOvernight(start, end) { return start && end && end < start; }
function groupTotal(group) { return group.rows.reduce((sum, row) => sum + row.analysis.netMinutes, 0); }
function statusClass(row) { return row.locked ? 'released' : row.analysis.errors.length ? 'error' : row.analysis.warnings.length ? 'warning' : row.dirty ? 'dirty' : row.analysis.complete ? 'complete' : 'empty'; }
function statusText(row) { return row.locked ? 'Übergeben' : row.analysis.errors.length ? 'Prüfen' : row.analysis.warnings.length ? 'Pause prüfen' : row.dirty ? 'Geändert' : row.einsatz.timeStatus || (row.analysis.complete ? 'Erfasst' : 'Offen'); }
function toggleGroup(key) {
  if (expandedGroups.value.has(key)) expandedGroups.value.delete(key);
  else expandedGroups.value.add(key);
}
function toggleBreaks(key) {
  if (expandedRows.value.has(key)) expandedRows.value.delete(key);
  else expandedRows.value.add(key);
}
function setMinutes(row, field, event) { row.entry[field] = event.target.value; message.value = ''; }
function clearBreak(row, index) {
  if (row.locked) return;
  row.entry.breaks[index] = { start: '', end: '', paid: false };
  message.value = '';
}
function clearRow(row) { if (!row.locked) entries.value[row.key] = createQuickEntry(row.einsatz); message.value = ''; }
function resetRows(targets) {
  targets.filter(row => !row.locked).forEach(row => { entries.value[row.key] = clone(baseline.value[row.key]); });
  message.value = 'Ausgangswerte wiederhergestellt.';
}
function usePlanned(targets) {
  let count = 0;
  targets.forEach(row => {
    if (row.locked || !row.planned.start || !row.planned.end) return;
    row.entry.start = row.planned.start;
    row.entry.end = row.planned.end;
    count++;
  });
  message.value = `Soll-Zeiten für ${count} ${count === 1 ? 'Einsatz' : 'Einsätze'} übernommen.`;
}
function copyFirst(group) {
  const first = group.rows[0];
  if (!first?.analysis.complete) return;
  const targets = group.rows.slice(1).filter(row => !row.locked);
  targets.forEach(row => { entries.value[row.key] = { ...clone(first.entry), einsatzId: row.key }; });
  message.value = `Zeiten und Pausen der ersten Zeile auf ${targets.length} weitere Einsätze in „${group.schicht.bezeichnung}“ übertragen.`;
}
function cancel() {
  if (props.connected) { emit('cancel'); return; }
  entries.value = clone(baseline.value);
  expandedRows.value = new Set();
  message.value = 'Änderungen verworfen.';
  emit('cancel');
}
function buildPayload(action, targetRows) {
  return {
    action,
    auftragNr: props.auftrag.auftragNr,
    entries: targetRows.filter(row => action === 'withdraw' || row.analysis.complete).map(row => ({
      ...clone(row.entry), personalNr: row.einsatz.personalNr, schicht: row.einsatz.schicht?._id || row.einsatz.schicht || null,
      dirty: row.dirty,
      datum: String(row.date || '').slice(0, 10), endDayOffset: row.analysis.overnight ? 1 : 0,
      breakMinutes: row.analysis.breakMinutes, paidBreakMinutes: row.analysis.paidBreakMinutes, netMinutes: row.analysis.netMinutes,
    })),
    clearedEinsatzIds: targetRows.filter(row => row.analysis.empty && row.dirty).map(row => row.key),
    totalMinutes: targetRows.reduce((sum, row) => sum + row.analysis.netMinutes, 0),
  };
}
function submitRow(row) {
  if (props.busy || (!row.locked && (!row.analysis.complete || row.analysis.errors.length))) return;
  emit('submit', buildPayload(row.locked ? 'withdraw' : 'release', [row]));
}
function submit(action = 'save') {
  if (!canSubmit.value || props.busy) return;
  const payload = buildPayload(action, rows.value);
  emit('submit', payload);
  if (props.connected) return; // Only refreshed server props acknowledge a successful save.
  baseline.value = clone(entries.value);
  message.value = `${payload.entries.length} Einsätze lokal übernommen · ${formatHours(totalMinutes.value)} Std.`;
}
</script>

<style scoped>
.quick-time { color: var(--text); font-size: 13px; min-width: 0; }
.quick-time--contained { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.quick-time--contained .quick-time__content { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.quick-time--contained > footer { flex-shrink: 0; }
.quick-time * { box-sizing: border-box; }
.quick-time__content { padding-top: 0; }
.quick-time__shift { margin: 0 16px 12px; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; background: var(--surface); }
.quick-time__shift-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 12px; background: color-mix(in srgb, var(--primary) 5%, var(--surface)); border-bottom: 1px solid var(--border); cursor: pointer; }
.quick-time__shift-header:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.quick-time__shift-heading { display: flex; align-items: center; gap: 11px; }
.quick-time__shift-icon { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border)); border-radius: 6px; color: var(--primary); background: var(--surface); }
.quick-time__shift-heading h3 { font-size: 13px; font-weight: 600; }
.quick-time__shift-heading h3 span { margin-left: 7px; font-size: 11px; font-weight: 400; color: var(--muted); }
.quick-time__shift-heading p { margin-top: 3px; font-size: 11px; color: var(--muted); }
.quick-time__shift-actions { display: flex; align-items: center; gap: 12px; }
.quick-time__text-button { display: inline-flex; gap: 7px; align-items: center; border: 0; padding: 6px 0; background: none; color: var(--muted); cursor: pointer; font-size: 11px; }
.quick-time__text-button:hover { color: var(--text); }
.quick-time__collapse-button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--muted); cursor: pointer; }
.quick-time__table-scroll { overflow-x: auto; }
.quick-time__table { width: 100%; border-collapse: collapse; text-align: left; font-variant-numeric: tabular-nums; }
.quick-time__table th, .quick-time__table td { padding: 9px 8px; vertical-align: top; }
.quick-time__table thead th { padding-top: 8px; padding-bottom: 8px; white-space: nowrap; font-size: 10px; font-weight: 500; color: var(--muted); background: var(--hover); border-bottom: 1px solid var(--border); }
.quick-time__table thead small { margin-left: 2px; opacity: .75; }
.quick-time__table tbody tr + tr > * { border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.quick-time__table th:first-child, .quick-time__table td:first-child { padding-left: 16px; }
.quick-time__person { min-width: 190px; }
.quick-time__person > strong { display: block; font-weight: 500; font-size: 12px; margin: 1px 0 6px; }
.quick-time__person > span { display: block; font-weight: 400; font-size: 10px; color: var(--muted); }
.quick-time__status-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--muted); margin: 0 5px 1px 0; }
.quick-time__status-dot.complete { background: #62b58f; }
.quick-time__status-dot.released { background: #4a8e70; }
.quick-time__status-dot.dirty { background: var(--primary); }
.quick-time__status-dot.error { background: #dc665e; }
.quick-time__status-dot.warning { background: #e6a447; }
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
.quick-time__row-actions .quick-time__transfer-action { border-color: color-mix(in srgb, var(--primary) 55%, var(--border)); color: var(--primary); }
.quick-time__row-actions .quick-time__transfer-action--withdraw { border-color: color-mix(in srgb, #4a8e70 55%, var(--border)); color: #4a8e70; }
.quick-time button:hover:not(:disabled) { border-color: var(--primary); }
.quick-time :is(input, select, button, [tabindex]):focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.quick-time button:disabled { opacity: .35; cursor: not-allowed; }
.quick-time__row--dirty .quick-time__person { box-shadow: inset 2px 0 var(--primary); }
.quick-time__row--error .quick-time__person { box-shadow: inset 2px 0 #dc665e; }
.quick-time__row--warning .quick-time__person { box-shadow: inset 2px 0 #e6a447; }
.quick-time__row--locked { background: color-mix(in srgb, #4a8e70 4%, var(--surface)); }
.quick-time__row--locked .quick-time__person { box-shadow: inset 2px 0 #4a8e70; }
.quick-time__error-row p { display: flex; align-items: center; gap: 8px; color: #c75048; font-size: 12px; }
.quick-time__warning-row p { display: flex; align-items: center; gap: 8px; color: #9a6417; font-size: 12px; }
.quick-time__error-row td, .quick-time__warning-row td { padding-top: 7px; padding-bottom: 10px; }
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
.quick-time__footer { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--surface); }
.quick-time__bulk, .quick-time__submit { display: flex; flex-wrap: wrap; gap: 8px; }
.quick-time__bulk :deep(button), .quick-time__submit :deep(button) { font-size: 11px; border-radius: 6px; padding: 7px 10px; }
.quick-time__total { margin-left: auto; text-align: right; }
.quick-time__total > span { display: block; color: var(--muted); font-size: 10px; }
.quick-time__total > strong { display: block; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
.quick-time__total small { font-size: 11px; font-weight: 400; color: var(--muted); }
.quick-time__accept { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--primary); background: var(--primary); color: #27221c; font-weight: 600; cursor: pointer; }
.quick-time__message, .quick-time__footer-error, .quick-time__footer-warning { flex-basis: 100%; font-size: 12px; color: var(--muted); }
.quick-time__footer-error { color: #c75048; }
.quick-time__footer-warning { color: #9a6417; }
.quick-time__empty { padding: 28px 24px; color: var(--muted); text-align: center; }
.quick-time__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .quick-time__shift { margin: 0 12px 14px; }
  .quick-time__shift-header { flex-wrap: wrap; gap: 7px; padding: 12px; }
  .quick-time__shift-actions { width: 100%; justify-content: space-between; }
  .quick-time__shift-heading h3 span { display: block; margin: 3px 0 0; }
  .quick-time__footer { padding: 16px; }
  .quick-time__bulk { width: 100%; }
  .quick-time__total { margin: 0 auto 0 0; }
}
</style>
