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
        v-if="!rows.length"
        class="quick-time__empty"
      >
        Für diesen Auftrag sind noch keine Einsätze vorhanden.
      </div>
      <div
        v-else
        class="quick-time__table-scroll"
        tabindex="0"
        aria-label="Stundenschnellerfassung nach Einsatz"
      >
        <table class="quick-time__table">
          <caption class="quick-time__sr-only">
            Soll- und Ist-Zeiten je Einsatz und Mitarbeiter
          </caption>
          <thead>
            <tr>
              <th
                v-if="showPayrollLink"
                scope="col"
              >
                Einsatz / Mitarbeiter
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
              <th
                v-if="showPayrollLink"
                scope="col"
              >
                <span class="quick-time__sr-only">Stundenerfassung</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="row in visibleRows"
              :key="row.key"
            >
                <tr
                  class="quick-time__entry-row"
                  :class="{ 'quick-time__row--error': row.analysis.errors.length, 'quick-time__row--warning': !row.analysis.errors.length && row.analysis.warnings.length, 'quick-time__row--dirty': row.dirty, 'quick-time__row--locked': row.locked }"
                >
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
                  <td data-label="Soll-Zeiten">
                    <span class="quick-time__planned">{{ row.planned.start || '–' }}<span>–</span>{{ row.planned.end || '–' }}</span>
                    <small
                      v-if="isOvernight(row.planned.start, row.planned.end)"
                      class="quick-time__next-day"
                    >Ende am Folgetag</small>
                  </td>
                  <td data-label="Ist-Zeiten">
                    <div class="quick-time__time-pair">
                      <TimeSelect
                        v-model="row.entry.start"
                        compact
                        :aria-label="`Ist-Beginn – ${row.name}`"
                        :aria-invalid="row.analysis.errors.length ? 'true' : undefined"
                        :aria-describedby="row.analysis.errors.length ? `${instanceId}-${row.key}-error` : undefined"
                        :disabled="row.locked"
                        @update:model-value="message = ''"
                      />
                      <span aria-hidden="true">–</span>
                      <TimeSelect
                        v-model="row.entry.end"
                        compact
                        :aria-label="`Ist-Ende – ${row.name}`"
                        :aria-invalid="row.analysis.errors.length ? 'true' : undefined"
                        :aria-describedby="row.analysis.errors.length ? `${instanceId}-${row.key}-error` : undefined"
                        :disabled="row.locked"
                        @update:model-value="message = ''"
                      />
                    </div>
                    <small
                      v-if="row.analysis.overnight"
                      class="quick-time__next-day"
                    >Ende am Folgetag</small>
                  </td>
                  <td data-label="Pause">
                    <MinuteSelect
                      :model-value="row.analysis.usesBlocks ? row.analysis.breakMinutes : row.entry.breakMinutes"
                      compact
                      :readonly="row.analysis.usesBlocks"
                      :disabled="row.locked"
                      :aria-label="`Pause in Minuten – ${row.name}`"
                      @update:model-value="row.entry.breakMinutes = $event; message = ''"
                    />
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
                  <td data-label="Davon bezahlt">
                    <MinuteSelect
                      :model-value="row.analysis.usesBlocks ? row.analysis.paidBreakMinutes : row.entry.paidBreakMinutes"
                      compact
                      :readonly="row.analysis.usesBlocks"
                      :disabled="row.locked"
                      :aria-label="`Bezahlte Pause in Minuten – ${row.name}`"
                      @update:model-value="row.entry.paidBreakMinutes = $event; message = ''"
                    />
                  </td>
                  <td
                    class="quick-time__numeric"
                    data-label="Ist-Stunden"
                  >
                    <strong
                      class="quick-time__hours"
                      :class="{ 'quick-time__hours--empty': !row.analysis.complete }"
                    >{{ row.analysis.complete ? formatHours(row.analysis.netMinutes) : '–' }}</strong>
                  </td>
                  <td data-label="Aktionen">
                    <div class="quick-time__row-actions">
                      <CustomTooltip
                        :text="`Soll-Zeiten übernehmen – ${row.name}`"
                      >
                        <AppIconButton
                          size="sm"
                          variant="ghost"
                          :disabled="row.locked || !row.planned.start || !row.planned.end"
                          :label="`Soll-Zeiten übernehmen – ${row.name}`"
                          @click="usePlanned([row])"
                        >
                          <FontAwesomeIcon :icon="faClock" />
                        </AppIconButton>
                      </CustomTooltip>
                      <CustomTooltip
                        :text="`Zurücksetzen – ${row.name}`"
                      >
                        <AppIconButton
                          size="sm"
                          variant="ghost"
                          :disabled="row.locked || !row.dirty"
                          :label="`Zurücksetzen – ${row.name}`"
                          @click="resetRows([row])"
                        >
                          <FontAwesomeIcon :icon="faArrowRotateLeft" />
                        </AppIconButton>
                      </CustomTooltip>
                      <CustomTooltip
                        :text="`Zeile leeren – ${row.name}`"
                      >
                        <AppIconButton
                          size="sm"
                          variant="ghost"
                          :disabled="row.locked || row.analysis.empty"
                          :label="`Zeile leeren – ${row.name}`"
                          @click="clearRow(row)"
                        >
                          <FontAwesomeIcon :icon="faXmark" />
                        </AppIconButton>
                      </CustomTooltip>
                      <CustomTooltip
                        v-if="connected"
                        :text="row.locked ? 'Rücknahme aus der Stundenerfassung' : 'Übertragen in die Stundenerfassung'"
                      >
                        <AppIconButton
                          class="quick-time__transfer-action"
                          :class="{ 'quick-time__transfer-action--withdraw': row.locked }"
                          size="sm"
                          variant="outlined"
                          :disabled="!row.locked && (!row.analysis.complete || row.analysis.errors.length > 0)"
                          :label="row.locked ? 'Rücknahme aus der Stundenerfassung' : 'Übertragen in die Stundenerfassung'"
                          @click="submitRow(row)"
                        >
                          <FontAwesomeIcon :icon="row.locked ? faArrowLeft : faArrowRight" />
                        </AppIconButton>
                      </CustomTooltip>
                    </div>
                  </td>
                  <td
                    v-if="showPayrollLink"
                    data-label="Stundenerfassung"
                    class="quick-time__payroll-cell"
                  >
                    <CustomTooltip :text="`Stundenerfassung öffnen – ${row.name}`">
                      <AppIconButton
                        class="quick-time__payroll-link"
                        size="sm"
                        variant="ghost"
                        :label="`Stundenerfassung öffnen – ${row.name}`"
                        @click="openPayroll(row)"
                      >
                        <FontAwesomeIcon :icon="faArrowUpRightFromSquare" />
                      </AppIconButton>
                    </CustomTooltip>
                  </td>
                </tr>
                <tr
                  v-if="row.analysis.errors.length"
                  class="quick-time__error-row"
                >
                  <td :colspan="tableColumnCount">
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
                  <td :colspan="tableColumnCount">
                    <p
                      :id="`${instanceId}-${row.key}-warning`"
                      role="status"
                    >
                      <FontAwesomeIcon :icon="faTriangleExclamation" /> {{ row.analysis.warnings.join(' ') }} Die Erfassung kann trotzdem gespeichert werden.
                      <AppButton
                        v-if="row.analysis.minimumRestBreakMinutes > row.analysis.breakMinutes"
                        class="quick-time__apply-break"
                        size="sm"
                        variant="outlined"
                        :disabled="row.locked || row.analysis.usesBlocks"
                        :title="row.analysis.usesBlocks ? 'Zeitblöcke zuerst entfernen' : undefined"
                        @click="applyMinimumBreak(row)"
                      >
                        {{ row.analysis.minimumRestBreakMinutes }} Min. Pause eintragen
                      </AppButton>
                    </p>
                  </td>
                </tr>
                <tr
                  v-if="expandedRows.has(row.key)"
                  class="quick-time__details-row"
                >
                  <td :colspan="tableColumnCount">
                    <div
                      :id="`${instanceId}-${row.key}-breaks`"
                      class="quick-time__break-panel"
                    >
                      <div class="quick-time__break-grid">
                        <fieldset
                          v-for="(block, index) in row.entry.breaks"
                          :key="index"
                          class="quick-time__break-block"
                        >
                          <legend>Pause {{ index + 1 }}</legend>
                          <div class="quick-time__time-pair">
                            <TimeSelect
                              v-model="block.start"
                              compact
                              :disabled="row.locked"
                              :aria-label="`Pause ${index + 1} Beginn – ${row.name}`"
                              @update:model-value="message = ''"
                            />
                            <span aria-hidden="true">–</span>
                            <TimeSelect
                              v-model="block.end"
                              compact
                              :disabled="row.locked"
                              :aria-label="`Pause ${index + 1} Ende – ${row.name}`"
                              @update:model-value="message = ''"
                            />
                            <CustomTooltip
                              :text="`Pause ${index + 1} entfernen – ${row.name}`"
                            >
                              <AppIconButton
                                class="quick-time__remove-break"
                                size="sm"
                                variant="ghost"
                                :disabled="row.locked || (!block.start && !block.end)"
                                :label="`Pause ${index + 1} entfernen – ${row.name}`"
                                @click="clearBreak(row, index)"
                              >
                                <FontAwesomeIcon :icon="faXmark" />
                              </AppIconButton>
                            </CustomTooltip>
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
                Auftrag gesamt <span>{{ completeCount }} / {{ rows.length }} erfasst</span>
              </th><td class="quick-time__numeric">
                {{ formatHours(totalMinutes) }}
              </td><td v-if="showPayrollLink" /><td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <footer class="quick-time__footer">
      <div class="quick-time__bulk">
        <ToolbarButton
          variant="secondary"
          :disabled="!editableVisibleRows.length"
          @click="usePlanned(editableVisibleRows)"
        >
          Soll-Zeiten übernehmen
        </ToolbarButton>
        <ToolbarButton
          variant="secondary"
          :disabled="!editableVisibleRows.some(row => row.dirty)"
          @click="resetRows(editableVisibleRows)"
        >
          Zurücksetzen
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
        <AppButton
          type="submit"
          size="sm"
          :disabled="!canSubmit"
        >
          {{ connected ? 'Entwurf speichern' : 'Übernehmen' }}
        </AppButton>
        <AppButton
          v-if="connected"
          size="sm"
          :disabled="!canSubmit"
          @click="submit('release')"
        >
          Alle übertragen
        </AppButton>
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
import { faArrowLeft, faArrowRight, faArrowRotateLeft, faArrowUpRightFromSquare, faChevronDown, faChevronUp, faCircleExclamation, faClock, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import CustomTooltip from '@/components/CustomTooltip.vue';
import MinuteSelect from '@/components/ui-elements/MinuteSelect.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import TimeSelect from '@/components/ui-elements/TimeSelect.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import { analyzeQuickEntry, buildQuickEntryRows, createQuickEntry, employeeName, formatHours, plannedTimes } from '@/utils/stundenschnellerfassung';
import { useAuth } from '@/stores/auth';

const props = defineProps({
  contained: { type: Boolean, default: false },
  connected: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  showContext: { type: Boolean, default: true },
  auftrag: { type: Object, required: true },
  einsaetze: { type: Array, default: () => [] },
  zeiten: { type: Array, default: () => [] },
  employeeSearch: { type: String, default: '' },
  submissionFilter: { type: String, default: 'all' },
  showPayrollLink: { type: Boolean, default: false },
});
const emit = defineEmits(['submit', 'cancel', 'dirty-change', 'open-payroll']);
const auth = useAuth();
const instanceId = `quick-time-${getCurrentInstance().uid}`;
const entries = ref({});
const baseline = ref({});
const expandedRows = ref(new Set());
const message = ref('');
const clone = value => JSON.parse(JSON.stringify(value));
const sourceRows = computed(() => buildQuickEntryRows(props.auftrag, props.einsaetze));

watch(() => [props.auftrag.auftragNr, props.einsaetze, props.zeiten], () => {
  const next = {};
  for (const einsatz of sourceRows.value) {
    const key = String(einsatz._id);
    next[key] = createQuickEntry(einsatz, props.zeiten.find(entry => String(entry.einsatzId) === key));
  }
  entries.value = next;
  baseline.value = clone(next);
  expandedRows.value = new Set();
  message.value = '';
}, { immediate: true });

const rows = computed(() => sourceRows.value.map(einsatz => {
    const key = String(einsatz._id);
    const entry = entries.value[key];
    const date = einsatz.detailDatumVon || einsatz.datumVon;
    return { key, einsatz, entry, date, name: employeeName(einsatz, auth.employeeNameFormat), planned: plannedTimes(einsatz), analysis: analyzeQuickEntry(entry, props.connected && date ? String(date).slice(0, 10) : null), dirty: JSON.stringify(entry) !== JSON.stringify(baseline.value[key]), locked: props.connected && !!einsatz.timeReleased, submitted: !!einsatz.timeSubmitted };
}));
const matchesFilters = row => (!props.employeeSearch || `${row.name} ${row.einsatz.mitarbeiterData?.vorname || ''} ${row.einsatz.mitarbeiterData?.nachname || ''} ${row.einsatz.personalNr || ''}`.toLocaleLowerCase('de-DE').includes(props.employeeSearch.trim().toLocaleLowerCase('de-DE')))
  && (props.submissionFilter === 'all' || (props.submissionFilter === 'submitted') === row.submitted);
const visibleRows = computed(() => rows.value.filter(matchesFilters));
const editableVisibleRows = computed(() => visibleRows.value.filter(row => !row.locked));
const totalMinutes = computed(() => rows.value.reduce((sum, row) => sum + row.analysis.netMinutes, 0));
const completeCount = computed(() => rows.value.filter(row => row.analysis.complete).length);
const errorCount = computed(() => rows.value.filter(row => row.analysis.errors.length).length);
const warningCount = computed(() => rows.value.filter(row => row.analysis.warnings.length).length);
const dirtyCount = computed(() => rows.value.filter(row => row.dirty).length);
const tableColumnCount = computed(() => 7 + Number(props.showPayrollLink));
watch(dirtyCount, count => emit('dirty-change', count > 0));
const canSubmit = computed(() => !errorCount.value && (completeCount.value > 0 || rows.value.some(row => row.analysis.empty && row.dirty)));

function isOvernight(start, end) { return start && end && end < start; }
function statusClass(row) { return row.locked ? 'released' : row.analysis.errors.length ? 'error' : row.analysis.warnings.length ? 'warning' : row.dirty ? 'dirty' : row.analysis.complete ? 'complete' : 'empty'; }
function statusText(row) { return row.locked ? 'Übergeben' : row.analysis.errors.length ? 'Prüfen' : row.analysis.warnings.length ? 'Pause prüfen' : row.dirty ? 'Geändert' : row.einsatz.timeStatus || (row.analysis.complete ? 'Erfasst' : 'Offen'); }
function toggleBreaks(key) {
  if (expandedRows.value.has(key)) expandedRows.value.delete(key);
  else expandedRows.value.add(key);
}
function applyMinimumBreak(row) {
  if (row.locked || row.analysis.usesBlocks || !row.analysis.minimumRestBreakMinutes) return;
  row.entry.breakMinutes = row.analysis.minimumRestBreakMinutes;
  message.value = '';
}
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
function openPayroll(row) {
  const employeeId = row.einsatz.mitarbeiterData?._id;
  if (employeeId) emit('open-payroll', String(employeeId));
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
.quick-time { --quick-time-warning-text: color-mix(in srgb, var(--status-warning) 55%, var(--text)); color: var(--text); font-size: 12px; min-width: 0; }
.quick-time--contained { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.quick-time--contained .quick-time__content { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.quick-time--contained > footer { flex-shrink: 0; }
.quick-time * { box-sizing: border-box; }
.quick-time__content { padding-top: 0; }
.quick-time__shift { margin: 0 8px 6px; border: 1px solid var(--border); border-radius: 5px; overflow: hidden; background: var(--surface); }
.quick-time__shift-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 34px; padding: 5px 8px; background: color-mix(in srgb, var(--primary) 4%, var(--surface)); border-bottom: 1px solid var(--border); cursor: pointer; }
.quick-time__shift-header:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.quick-time__shift-heading { display: flex; align-items: center; min-width: 0; }
.quick-time__shift-heading h3 { font-size: 12px; font-weight: 600; line-height: 1.2; }
.quick-time__shift-heading h3 span { margin-left: 5px; font-size: 10px; font-weight: 400; color: var(--muted); }
.quick-time__shift-heading p { margin-top: 1px; font-size: 10px; color: var(--muted); line-height: 1.2; }
.quick-time__shift-actions { display: flex; align-items: center; gap: 4px; }
.quick-time__copy-button, .quick-time__collapse-button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--muted); cursor: pointer; font-size: 10px; }
.quick-time__table-scroll { overflow-x: auto; }
.quick-time__table { width: 100%; border-collapse: collapse; text-align: left; font-variant-numeric: tabular-nums; }
.quick-time__table th, .quick-time__table td { padding: 5px 6px; vertical-align: top; }
.quick-time__table thead th { padding-top: 5px; padding-bottom: 5px; white-space: nowrap; font-size: 9px; font-weight: 500; color: var(--muted); background: var(--hover); border-bottom: 1px solid var(--border); }
.quick-time__table thead small { margin-left: 2px; opacity: .75; }
.quick-time__table tbody tr + tr > * { border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.quick-time__table th:first-child, .quick-time__table td:first-child { padding-left: 10px; }
.quick-time__person { min-width: 170px; }
.quick-time__person > strong { display: block; font-weight: 500; font-size: 11px; margin: 0 0 3px; }
.quick-time__person > span { display: block; font-weight: 400; font-size: 9px; color: var(--muted); }
.quick-time__status-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--muted); margin: 0 5px 1px 0; }
.quick-time__status-dot.complete, .quick-time__status-dot.released { background: var(--status-success-text); }
.quick-time__status-dot.dirty { background: var(--primary); }
.quick-time__status-dot.error { background: var(--status-danger-text); }
.quick-time__status-dot.warning { background: var(--status-warning); }
.quick-time__planned { display: flex; gap: 4px; align-items: center; min-height: 26px; white-space: nowrap; color: var(--muted); font-size: 11px; }
.quick-time__planned > span { opacity: .5; }
.quick-time__time-pair { display: flex; align-items: center; gap: 3px; }
.quick-time__time-pair > span { color: var(--muted); }
.quick-time input[type='number'] { height: 26px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); font-family: inherit; font-size: 11px; font-variant-numeric: tabular-nums; padding: 2px 5px; }
.quick-time input[readonly] { background: var(--hover); color: var(--muted); }
.quick-time__minutes { width: 62px; text-align: right; }
.quick-time__next-day { display: block; margin-top: 2px; color: var(--muted); font-size: 9px; }
.quick-time__break-toggle { display: flex; align-items: center; gap: 4px; padding: 2px 0 0; border: 0; background: none; color: var(--muted); font-size: 9px; cursor: pointer; }
.quick-time__numeric { text-align: right; white-space: nowrap; }
.quick-time__hours { display: block; padding-top: 4px; font-size: 12px; font-weight: 600; }
.quick-time__hours--empty { color: var(--muted); font-weight: 400; }
.quick-time__row-actions { display: flex; gap: 3px; }
.quick-time__row-actions .app-icon-button, .quick-time__payroll-link, .quick-time__remove-break { --app-button-icon-size: 26px; min-height: 26px; font-size: 10px; }
.quick-time__row-actions .quick-time__transfer-action--withdraw { --app-button-border: var(--status-success-text); --app-button-color: var(--status-success-text); --action-accent-text: var(--status-success-text); }
.quick-time button:not(.app-button):hover:not(:disabled) { border-color: var(--primary); }
.quick-time :is(input, select, button:not(.app-button), [tabindex]):focus-visible { outline: 2px solid var(--control-focus-ring, var(--primary)); outline-offset: 2px; }
.quick-time button:not(.app-button):disabled { opacity: .35; cursor: not-allowed; }
.quick-time__row--dirty .quick-time__person { box-shadow: inset 2px 0 var(--primary); }
.quick-time__row--error .quick-time__person { box-shadow: inset 2px 0 var(--status-danger-text); }
.quick-time__row--warning .quick-time__person { box-shadow: inset 2px 0 var(--status-warning); }
.quick-time__row--locked { background: color-mix(in srgb, var(--status-success-text) 4%, var(--surface)); }
.quick-time__row--locked .quick-time__person { box-shadow: inset 2px 0 var(--status-success-text); }
.quick-time__error-row p { display: flex; align-items: center; gap: 6px; color: var(--status-danger-text); font-size: 10px; }
.quick-time__warning-row p { display: flex; align-items: center; gap: 6px; color: var(--quick-time-warning-text); font-size: 10px; }
.quick-time__apply-break { flex: 0 0 auto; min-height: 26px; font-size: 10px; }
.quick-time__error-row td, .quick-time__warning-row td { padding-top: 4px; padding-bottom: 6px; }
.quick-time__break-panel { padding: 0 0 3px; }
.quick-time__break-panel-heading { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; }
.quick-time__break-panel-heading strong { font-size: 11px; font-weight: 500; }
.quick-time__break-panel-heading span { color: var(--muted); font-size: 10px; }
.quick-time__details-row { background: var(--hover); }
.quick-time__break-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.quick-time__break-block { margin: 0; padding: 6px 8px; min-width: 0; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); }
.quick-time__break-block legend { padding: 0 3px; color: var(--muted); font-size: 10px; }
.quick-time__break-block .quick-time__time-pair :deep(.time-select) { width: 100%; min-width: 0; }
.quick-time__remove-break { flex: 0 0 26px; }
.quick-time__paid { display: flex; align-items: center; gap: 5px; margin-top: 5px; color: var(--muted); font-size: 10px; }
.quick-time__paid input { accent-color: var(--primary); }
.quick-time__table tfoot { border-top: 1px solid var(--border); background: var(--hover); }
.quick-time__table tfoot th, .quick-time__table tfoot td { font-size: 11px; font-weight: 600; }
.quick-time__table tfoot span { margin-left: 8px; font-size: 9px; font-weight: 400; color: var(--muted); }
.quick-time__footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px; border-top: 1px solid var(--border); background: var(--surface); }
.quick-time__bulk, .quick-time__submit { display: flex; flex-wrap: wrap; gap: 5px; }
.quick-time__bulk :deep(button), .quick-time__submit :deep(button) { min-height: 28px; font-size: 10px; border-radius: 4px; padding: 4px 8px; }
.quick-time__total { margin-left: auto; text-align: right; }
.quick-time__total > span { display: block; color: var(--muted); font-size: 9px; }
.quick-time__total > strong { display: block; font-size: 14px; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums; }
.quick-time__total small { font-size: 11px; font-weight: 400; color: var(--muted); }
.quick-time__message, .quick-time__footer-error, .quick-time__footer-warning { flex-basis: 100%; font-size: 10px; color: var(--muted); }
.quick-time__footer-error { color: var(--status-danger-text); }
.quick-time__footer-warning { color: var(--quick-time-warning-text); }
.quick-time__empty { padding: 16px; color: var(--muted); text-align: center; }
.quick-time__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .quick-time__content { padding: 0 6px 6px; }
  .quick-time__table-scroll { width: 100%; overflow: visible; }
  .quick-time__table, .quick-time__table tbody { display: block; width: 100%; }
  .quick-time__table thead, .quick-time__table tfoot { display: none; }
  .quick-time__entry-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; width: 100%; margin-top: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
  .quick-time__entry-row:has(+ :is(.quick-time__error-row, .quick-time__warning-row, .quick-time__details-row)) { border-radius: 6px 6px 0 0; }
  .quick-time__entry-row > th, .quick-time__entry-row > td { display: block; min-width: 0; padding: 0; border: 0 !important; }
  .quick-time__entry-row > td::before { content: attr(data-label); display: block; margin-bottom: 4px; color: var(--muted); font-size: 9px; font-weight: 500; }
  .quick-time__person { grid-column: 1 / -1; width: auto; padding: 0 0 8px !important; border-bottom: 1px solid var(--border) !important; }
  .quick-time__person > strong { font-size: 13px; }
  .quick-time__person > span { font-size: 10px; }
  .quick-time__entry-row > td[data-label='Ist-Zeiten'], .quick-time__entry-row > td[data-label='Aktionen'] { grid-column: 1 / -1; }
  .quick-time__payroll-cell { display: flex !important; flex-direction: column; align-items: flex-start; }
  .quick-time__entry-row > td[data-label='Ist-Zeiten'] .quick-time__time-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .quick-time__entry-row > td[data-label='Ist-Zeiten'] :deep(.time-select) { width: 100%; }
  .quick-time__entry-row :deep(.minute-select) { width: min(100%, 112px); }
  .quick-time__planned { min-height: 40px; font-size: 13px; }
  .quick-time__hours { padding-top: 9px; font-size: 15px; text-align: left; }
  .quick-time__break-toggle { min-height: 28px; font-size: 10px; }
  .quick-time__row-actions { justify-content: flex-end; gap: 7px; }
  .quick-time__row-actions .app-icon-button, .quick-time__payroll-link, .quick-time__remove-break { --app-button-icon-size: 40px; min-height: 40px; font-size: 13px; }
  .quick-time__error-row, .quick-time__warning-row, .quick-time__details-row { display: block; width: 100%; margin: -1px 0 0; border: 1px solid var(--border); border-top: 0; border-radius: 0 0 6px 6px; background: var(--surface); }
  .quick-time__error-row:has(+ .quick-time__details-row), .quick-time__warning-row:has(+ .quick-time__details-row) { border-radius: 0; }
  .quick-time__error-row > td, .quick-time__warning-row > td, .quick-time__details-row > td { display: block; width: 100%; padding: 8px 10px; border: 0 !important; }
  .quick-time__error-row p, .quick-time__warning-row p { align-items: flex-start; flex-wrap: wrap; line-height: 1.4; }
  .quick-time__apply-break { min-height: 36px; margin-left: 20px; }
  .quick-time__break-grid { grid-template-columns: 1fr; }
  .quick-time__break-block { padding: 8px; }
  .quick-time__break-block .quick-time__time-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; }
  .quick-time__break-block .quick-time__time-pair :deep(.time-select) { width: 100%; }
  .quick-time__paid { min-height: 32px; font-size: 12px; }
  .quick-time__footer { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 8px; }
  .quick-time__bulk, .quick-time__submit { display: flex; width: 100%; flex-wrap: wrap; }
  .quick-time__bulk > *, .quick-time__submit > * { flex: 1 1 120px; }
  .quick-time__bulk :deep(button), .quick-time__submit :deep(button) { width: 100%; min-height: 40px; font-size: 11px; justify-content: center; }
  .quick-time__total { display: flex; align-items: center; justify-content: space-between; width: 100%; margin: 0; text-align: left; }
  .quick-time__total > strong { font-size: 16px; }
}
</style>
