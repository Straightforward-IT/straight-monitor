<template>
  <section
    ref="root"
    class="time-management"
    aria-label="Zeitverwaltung"
    @click="onBoardClick"
    @contextmenu="onBoardContext"
    @pointermove="moveCursor"
    @pointerleave="cursor.visible = false"
  >
    <dl v-if="showContext" class="tm-context">
      <div><dt>Personalnummer</dt><dd>{{ employee.personalNr }}</dd></div>
      <div><dt>Mitarbeiter</dt><dd>{{ employee.name }}</dd></div>
      <div><dt>Monat / Jahr</dt><dd>{{ monthLabel }}</dd></div>
      <div><dt>Auftrag-Nr.</dt><dd>{{ selectedEntry?.auftragNr || '—' }}</dd></div>
      <div><dt>Kunde</dt><dd>{{ selectedEntry?.customerName || '—' }}</dd></div>
      <div><dt>Einsatzort</dt><dd>{{ selectedEntry?.location || '—' }}</dd></div>
      <div><dt>Tätigkeit</dt><dd>{{ selectedEntry?.activity || employee.employmentLabel }}</dd></div>
    </dl>

    <slot
      name="documents"
      :auftrag-nr="selectedEntry?.auftragNr || null"
    />

    <div class="tm-layout">
      <TimeMonthMatrix
        :month="month"
        :entries="workspace.data.entries"
        :selected-date="selectedDate"
      :held="held"
      @select-day="selectDay"
      @select-week="selectWeek"
      @change-type="changeEntryType"
      />
      <aside
        class="tm-information"
        aria-label="Zeitkonto und Monatsprognose"
      >
        <header class="tm-section-heading">
          <h2>Informationen</h2><span class="tm-live"><i /> Live-Berechnung</span>
        </header>
        <div class="tm-information__identity">
          <span>{{ employee.employmentLabel }}</span><span>Monatsstunden <strong>{{ formatMinutes(quota) }}</strong></span>
        </div>
        <HoverDataCard
          inline
          :data="cardData"
        />
        <button
          type="button"
          class="tm-bank"
          data-time-target="bank"
          :aria-label="'Zeitkonto · ' + formatMinutes(workspace.data.bankMinutes)"
        >
          <span class="tm-bank__heading"><strong>{{ saveEnabled ? 'Zeitkonto' : 'Zeitkonto · Vorschau' }}</strong><small>Stunden parken / zurückholen</small></span>
          <strong class="tm-bank__balance">{{ formatMinutes(workspace.data.bankMinutes) }}</strong>
          <span class="tm-bank__bottom">Gespeichert {{ formatMinutes(workspace.saved.bankMinutes) }} <b>{{ bankDifference > 0 ? '+' : '' }}{{ formatMinutes(bankDifference) }}</b></span>
        </button>
        <div class="tm-comparison">
          <span>Monatsprognose zum gespeicherten Stand</span><strong>{{ forecastDifference > 0 ? '+' : '' }}{{ formatMinutes(forecastDifference) }}</strong>
        </div>
      </aside>
    </div>

    <section
      class="tm-details"
      aria-label="Detailerfassung"
    >
      <header class="tm-section-heading">
        <h2>Detailerfassung</h2><span>{{ scopeLabel }}</span>
      </header>
      <div class="tm-detail-toolbar">
        <div
          class="tm-scope"
          aria-label="Zeitraum der Detailtabelle"
        >
          <button
            v-for="scope in detailScopes"
            :key="scope.id"
            type="button"
            :aria-pressed="detailScope === scope.id"
            @click="detailScope = scope.id"
          >
            {{ scope.label }}
          </button>
        </div>
        <button
          type="button"
          class="tm-button"
          :disabled="!!held || !!slider"
          @click="openEntry(selectedDate)"
        >
          <span aria-hidden="true">＋</span> Tageseintrag
        </button>
        <div class="tm-new-source">
          <button
            type="button"
            class="tm-source"
            data-time-target="new"
            aria-label="Neue Stunden sammeln"
          >
            <span aria-hidden="true">＋</span> Neue Stunden
          </button>
          <select
            v-model.number="newMinutes"
            aria-label="Neue Stunden pro voller Entnahme"
            title="Shift + Rechtsklick erzeugt diese Menge"
          >
            <option :value="60">
              Shift: 1 h
            </option><option :value="240">
              Shift: 4 h
            </option><option :value="480">
              Shift: 8 h
            </option><option :value="960">
              Shift: 16 h
            </option>
          </select>
        </div>
        <button
          type="button"
          class="tm-source tm-source--remove"
          data-time-target="remove"
          aria-label="Stunden entfernen"
        >
          <span aria-hidden="true">−</span> Entfernen <small>{{ formatMinutes(workspace.data.removedMinutes) }}</small>
        </button>
        <div
          class="tm-tools"
          aria-label="Alternative Eimer-Bedienung"
        >
          <button
            type="button"
            :aria-pressed="mode === 'collect'"
            @click="mode = 'collect'"
          >
            Sammeln
          </button>
          <button
            type="button"
            :aria-pressed="mode === 'drop'"
            @click="mode = 'drop'"
          >
            Ablegen
          </button>
          <button
            type="button"
            :aria-pressed="precision"
            title="Minutenwahl auch ohne gedrückte Taste öffnen"
            @click="precision = !precision"
          >
            Minuten
          </button>
        </div>
      </div>
      <nav
        class="tm-detail-tabs"
        aria-label="Detailansicht"
      >
        <button
          type="button"
          :aria-pressed="detailTab === 'entries'"
          @click="detailTab = 'entries'"
        >
          Schichten &amp; Zeiten <span>{{ scopedEntries.length }}</span>
        </button>
        <button
          type="button"
          :aria-pressed="detailTab === 'absences'"
          @click="detailTab = 'absences'"
        >
          Fehlzeiten <span>{{ scopedAbsences.length }}</span>
        </button>
        <button
          type="button"
          :aria-pressed="detailTab === 'history'"
          @click="detailTab = 'history'"
        >
          Änderungsprotokoll <span>{{ workspace.data.journal.length }}</span>
        </button>
        <span class="tm-save-state">{{ dirty ? 'Ungespeicherte Änderungen' : 'Gespeicherter Stand' }}</span>
      </nav>
      <div
        v-if="detailTab !== 'history'"
        class="tm-table-scroll"
        tabindex="0"
        aria-label="Schichtdetails, scrollbar"
      >
        <table class="tm-data-table">
          <thead>
            <tr>
              <th scope="col">
                Datum
              </th><th scope="col">
                KB
              </th><th scope="col">
                Auftrag
              </th><th scope="col">
                Kunde / Einsatzort
              </th><th scope="col">
                Schicht / Eintragsart
              </th><th
                scope="col"
                class="tm-numeric"
              >
                Erfasst
              </th><th
                scope="col"
                class="tm-numeric"
              >
                Aktuell
              </th><th
                scope="col"
                class="tm-numeric"
              >
                Änderung
              </th><th scope="col">
                Anrechnung
              </th><th scope="col">
                Quelle
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in visibleEntries"
              :key="entry.id"
              :data-entry-id="entry.id"
              :class="{ 'tm-row--selected': selectedEntryId === entry.id, 'tm-row--changed': entry.minutes !== entry.originalMinutes }"
              @click="selectEntry(entry)"
            >
              <td>
                <button
                  type="button"
                  class="tm-date-link"
                  :aria-label="entry.date + ' in der Detailtabelle anzeigen'"
                  @click.stop="selectDay(entry.date)"
                >
                  {{ shortDate(entry.date) }}
                </button>
              </td>
              <td>
                <span
                  class="tm-type"
                  :class="'tm-type--' + entry.kind"
                >{{ entry.code || (entry.kind === 'planned' ? 'PL' : 'P') }}</span>
              </td>
              <td>{{ entry.auftragNr || '—' }}</td>
              <td><span class="tm-location">{{ entry.location || '—' }}</span><small class="tm-customer">{{ entry.customerName || '' }}</small></td>
              <td class="tm-entry-label">
                {{ entry.label }}
              </td>
              <td class="tm-numeric">
                {{ formatMinutes(entry.originalMinutes) }}
              </td>
              <td class="tm-numeric">
                <button
                  type="button"
                  class="tm-table-time"
                  :data-time-target="entry.id"
                  :disabled="entry.kind === 'planned'"
                  :aria-label="entry.date + ' · ' + entry.label + ' · Stunden bearbeiten'"
                >
                  {{ formatMinutes(entry.minutes) }}
                </button>
              </td>
              <td class="tm-numeric tm-difference">
                {{ entry.minutes !== entry.originalMinutes ? (entry.minutes > entry.originalMinutes ? '+' : '') + formatMinutes(entry.minutes - entry.originalMinutes) : '—' }}
              </td>
              <td>{{ entry.kind === 'planned' ? 'Prognose' : entry.credited ? 'Monatsstunden' : 'Ohne Anrechnung' }}</td>
              <td class="tm-muted">
                {{ entry.source || 'Tageseintrag' }}
              </td>
            </tr>
            <tr v-if="!visibleEntries.length">
              <td
                colspan="10"
                class="tm-table-empty"
              >
                Keine {{ detailTab === 'absences' ? 'Fehlzeiten' : 'Einträge' }} in diesem Zeitraum. Über „Tageseintrag“ kannst du einen Eintrag anlegen.
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th
                colspan="5"
                scope="row"
              >
                {{ visibleEntries.length }} Einträge · Summe Ist-Zeit
              </th><td class="tm-numeric">
                {{ formatMinutes(visibleOriginalTotal) }}
              </td><td class="tm-numeric">
                <strong>{{ formatMinutes(visibleActualTotal) }}</strong>
              </td><td colspan="3">
                Geplante Zeit separat: {{ formatMinutes(visiblePlannedTotal) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <section
        v-else
        class="tm-history"
        aria-label="Änderungsprotokoll"
      >
        <p v-if="!workspace.data.journal.length">
          Noch keine Änderungen. Sammle Stunden aus den Kalenderfeldern oder der Spalte „Aktuell“ und lege sie im Zeitkonto ab.
        </p>
        <ol v-else>
          <li
            v-for="(change, index) in workspace.data.journal"
            :key="index"
          >
            <strong>{{ change.label }}</strong><span
              v-for="(transfer, transferIndex) in groupTransfers(change.transfers)"
              :key="transferIndex"
            >{{ formatMinutes(transfer.minutes) }} · {{ transfer.sourceLabel }} → {{ transfer.targetLabel }}</span>
          </li>
        </ol>
      </section>
    </section>
    <div class="tm-guide">
      <span><kbd>Rechtsklick</kbd> 1 h sammeln</span><span><kbd>Linksklick</kbd> 1 h ablegen</span><span><kbd>⇧ Shift</kbd> alles</span><span><kbd>⌘ / Ctrl</kbd> Minuten wählen</span><span><kbd>Esc</kbd> zurücklegen</span>
      <span class="tm-guide__note">Zeitkonto und Eimer sind außerhalb des Monatsstundens.</span>
    </div>

    <footer
      class="tm-bucket-bar"
      :class="{ 'tm-bucket-bar--filled': held }"
    >
      <HourBucket
        class="tm-bucket-bar__icon"
        :minutes="held"
      />
      <div class="tm-bucket-bar__content">
        <strong data-testid="bucket-total">{{ held ? `${formatMinutes(held)} im Eimer` : 'Dein Eimer ist leer' }}</strong><span>{{ held ? bucketOrigins : 'Rechtsklick auf eine Schicht oder das Zeitkonto, um Stunden zu sammeln.' }}</span>
      </div>
      <button
        v-if="held"
        type="button"
        class="tm-button"
        @click="cancel"
      >
        Alles zurücklegen <kbd>Esc</kbd>
      </button>
      <span
        class="tm-status"
        role="status"
        aria-live="polite"
      >{{ message }}</span>
      <div class="tm-actions">
        <button
          type="button"
          class="tm-button"
          :disabled="!workspace.history.length && !held"
          @click="undo"
        >
          ↶ Rückgängig
        </button>
        <button
          type="button"
          class="tm-button"
          :disabled="!dirty && !held"
          @click="revert"
        >
          Verwerfen
        </button>
        <button
          type="button"
          class="tm-button tm-button--primary"
          :disabled="!saveEnabled || !dirty || !!held || !!slider"
          :title="!saveEnabled ? 'Umbuchungen sind hier noch eine Vorschau' : held ? 'Zuerst den Eimer leeren oder Escape drücken' : 'Änderungen für diese Demo übernehmen'"
          @click="save"
        >
          {{ saveEnabled ? 'Demo speichern' : 'Umbuchungs-Vorschau' }}
        </button>
      </div>
    </footer>

    <TimeDayEntryModal
      v-if="entryDate"
      :month="month"
      :initial-date="entryDate"
      :employee-name="employee.name"
      :bank-minutes="workspace.data.bankMinutes"
      @close="entryDate = ''"
      @create="createEntry"
    />

    <Teleport to="body">
      <div
        v-if="cursor.visible && !slider && !entryDate"
        class="tm-cursor"
        :style="cursorStyle"
        aria-hidden="true"
      >
        <HourBucket :minutes="held" /><span>{{ cursor.label }}</span>
      </div>
      <section
        v-if="slider"
        ref="sliderElement"
        class="tm-minute-picker"
        :style="sliderStyle"
        role="dialog"
        aria-label="Minuten auswählen"
        @keydown.esc.stop.prevent="cancel"
      >
        <header>
          <span>{{ slider.operation === 'collect' ? 'Minuten sammeln' : 'Minuten ablegen' }}</span><button
            type="button"
            aria-label="Minutenwahl abbrechen"
            @click="slider = null"
          >
            ×
          </button>
        </header>
        <p>{{ slider.label }}</p>
        <strong>{{ formatMinutes(Number(slider.amount)) }}</strong>
        <input
          ref="rangeInput"
          v-model.number="slider.amount"
          type="range"
          min="0"
          :max="slider.max"
          step="1"
          aria-label="Minuten"
          :aria-valuetext="formatMinutes(Number(slider.amount))"
        >
        <div class="tm-minute-picker__scale">
          <span>0 min</span><span>{{ formatMinutes(slider.max) }}</span>
        </div>
        <label>Exakt<input
          v-model.number="slider.amount"
          type="number"
          min="0"
          :max="slider.max"
          step="1"
          aria-label="Exakte Minuten"
        > min</label>
        <p class="tm-minute-picker__help">
          {{ slider.modifier ? '⌘ / Ctrl loslassen, um die Auswahl zu übernehmen.' : 'Minuten wählen und übernehmen.' }} Escape legt die laufende Sammlung zurück.
        </p>
        <button
          type="button"
          class="tm-button tm-button--primary"
          @click="applySlider"
        >
          Übernehmen
        </button>
      </section>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';
import HourBucket from '@/components/ui-elements/HourBucket.vue';
import TimeMonthMatrix from '@/components/ui-elements/TimeMonthMatrix.vue';
import TimeDayEntryModal from '@/components/Modals/TimeDayEntryModal.vue';
import { addTimeEntry, bucketMinutes, cancelTime, changeTimeEntryType, collectTime, createTimeWorkspace, dropOnDay, dropTime,
  formatMinutes, hasTimeChanges, monthWeeks, revertTime, saveTime, sourceMinutes, targetLabel, timeTotals, undoTime } from '@/utils/timeManagement';

const props = defineProps({ employee: { type: Object, required: true }, month: { type: String, required: true }, initialData: { type: Object, required: true }, saveEnabled: { type: Boolean, default: true }, showContext: { type: Boolean, default: true } });
const emit = defineEmits(['save']);
// A workspace is an employee/month session. Remount with a key when either changes.
const workspace = reactive(createTimeWorkspace(props.initialData));
const root = ref(null);
const selectedDate = ref(props.initialData.entries[0]?.date || `${props.month}-01`);
const selectedEntryId = ref(props.initialData.entries[0]?.id || '');
const detailScope = ref('month');
const detailTab = ref('entries');
const detailScopes = [{ id: 'month', label: 'Monat' }, { id: 'week', label: 'Woche' }, { id: 'day', label: 'Tag' }];
const mode = ref('drop');
const precision = ref(false);
const newMinutes = ref(480);
const message = ref('Demo · Änderungen bleiben in dieser Sitzung.');
const entryDate = ref('');
const slider = ref(null);
const sliderElement = ref(null);
const rangeInput = ref(null);
const cursor = reactive({ visible: false, x: 0, y: 0, label: '' });
let entrySequence = 0;
const monthLabel = computed(() => new Date(`${props.month}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
const selectedEntry = computed(() => workspace.data.entries.find(entry => entry.id === selectedEntryId.value));
const selectedWeek = computed(() => monthWeeks(props.month).find(week => week.days.some(day => day.date === selectedDate.value)));
const scopeLabel = computed(() => detailTab.value === 'history' ? `Alle Änderungen · ${monthLabel.value}` : detailScope.value === 'month' ? monthLabel.value : detailScope.value === 'week' ? `KW ${selectedWeek.value?.number} · ${monthLabel.value}` : shortDate(selectedDate.value));
const scopedEntries = computed(() => workspace.data.entries.filter(entry => detailScope.value === 'month'
  || (detailScope.value === 'day' ? entry.date === selectedDate.value : selectedWeek.value?.days.some(day => day.date === entry.date)))
  .sort((a, b) => a.date.localeCompare(b.date)));
const scopedAbsences = computed(() => scopedEntries.value.filter(entry => ['vacation', 'sick', 'absence'].includes(entry.kind)));
const visibleEntries = computed(() => detailTab.value === 'absences' ? scopedAbsences.value : scopedEntries.value);
const visibleActualTotal = computed(() => visibleEntries.value.filter(entry => entry.kind !== 'planned').reduce((sum, entry) => sum + entry.minutes, 0));
const visibleOriginalTotal = computed(() => visibleEntries.value.filter(entry => entry.kind !== 'planned').reduce((sum, entry) => sum + entry.originalMinutes, 0));
const visiblePlannedTotal = computed(() => visibleEntries.value.filter(entry => entry.kind === 'planned').reduce((sum, entry) => sum + entry.minutes, 0));
const held = computed(() => bucketMinutes(workspace));
const dirty = computed(() => hasTimeChanges(workspace));
const totals = computed(() => timeTotals(workspace.data));
const quota = computed(() => Math.round(props.employee.monthlyHours * 60));
const forecastDifference = computed(() => totals.value.forecast - timeTotals(workspace.saved).forecast);
const bankDifference = computed(() => workspace.data.bankMinutes - workspace.saved.bankMinutes);
const bucketOrigins = computed(() => {
  const grouped = new Map();
  for (const lot of workspace.lots) grouped.set(lot.label, (grouped.get(lot.label) || 0) + lot.minutes);
  return [...grouped].map(([label, amount]) => `${formatMinutes(amount)} ${label}`).join(' · ');
});
const cursorStyle = computed(() => ({ left: `${Math.max(0, Math.min(cursor.x + 8, window.innerWidth - 108))}px`, top: `${Math.max(0, Math.min(cursor.y + 8, window.innerHeight - 120))}px` }));
const sliderStyle = computed(() => ({ left: `${slider.value?.x}px`, top: `${slider.value?.y}px` }));
const cardData = computed(() => {
  const t = totals.value;
  const free = Math.max(0, quota.value - t.forecast);
  const over = Math.max(0, t.forecast - quota.value);
  const segments = [
    { id: 'productive', label: 'Produktiv', value: t.productive / 60, color: '#7f98b0' },
    { id: 'absence', label: 'Fehlzeiten', value: t.absence / 60, color: '#a997d0' },
    { id: 'correction', label: 'Korrekturen', value: t.correction / 60, color: '#70b4af' },
    { id: 'planned', label: 'Geplant', value: t.planned / 60, color: 'var(--primary)' },
    { id: 'remaining', label: 'Frei', value: free / 60, color: '#62b58f' },
    { id: 'over', label: 'Über Kontingent', value: 0, color: '#dc665e' },
  ];
  return { employeeName: props.employee.name, eyebrow: monthLabel.value, title: 'Monatsstunden',
    metric: { value: t.forecast / 60, limit: quota.value / 60, unit: 'Std.' }, segments,
    sections: [{ label: 'Aktuelle Berechnung', rows: [
      { label: 'Produktive Ist-Zeit', value: formatMinutes(t.productive), segment: 'productive' },
      { label: 'Fehlzeiten angerechnet', value: formatMinutes(t.absence), segment: 'absence' },
      { label: 'Stundenkorrekturen', value: formatMinutes(t.correction), segment: 'correction' },
      { label: 'Geplante Schichten', value: formatMinutes(t.planned), segment: 'planned' },
    ] }, { rows: [
      { label: 'Voraussichtlich', value: formatMinutes(t.forecast), emphasis: true },
      { label: 'Monatsstunden', value: formatMinutes(quota.value) },
      { label: over ? 'Über Kontingent' : 'Noch frei', value: formatMinutes(over || free), segment: over ? 'over' : 'remaining', emphasis: true },
    ] }], note: held.value ? `${formatMinutes(held.value)} sind gerade im Eimer und noch keinem Ziel zugeordnet.` : 'Ist-Zeit + angerechnete Fehlzeiten + Korrekturen + Planung.' };
});
function shortDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function selectEntry(entry) { selectedEntryId.value = entry.id; selectedDate.value = entry.date; }
function selectDay(date) {
  selectedDate.value = date;
  selectedEntryId.value = workspace.data.entries.find(entry => entry.date === date)?.id || '';
  detailScope.value = 'day';
  detailTab.value = 'entries';
}
function selectWeek(date) { selectDay(date); detailScope.value = 'week'; }
function groupTransfers(transfers) {
  const grouped = new Map();
  for (const transfer of transfers) {
    const key = `${transfer.source}|${transfer.target}`;
    if (grouped.has(key)) grouped.get(key).minutes += transfer.minutes;
    else grouped.set(key, { ...transfer });
  }
  return [...grouped.values()];
}
function targetFrom(event) {
  const target = event.target.closest?.('[data-time-target]');
  return target && root.value?.contains(target) && !target.disabled ? target : null;
}
function moveCursor(event) {
  if (event.pointerType === 'touch') { cursor.visible = false; return; }
  const target = targetFrom(event);
  cursor.visible = !!target || held.value > 0;
  cursor.x = event.clientX;
  cursor.y = event.clientY;
  cursor.label = !target ? 'Ziel wählen' : event.shiftKey ? 'Alles bewegen' : held.value ? 'Links ablegen · rechts sammeln' : 'Rechts sammeln';
}
function onBoardClick(event) { handleTarget(event, mode.value); }
function onBoardContext(event) {
  // macOS Ctrl + primary click can be delivered as a contextmenu event.
  handleTarget(event, event.ctrlKey && event.button === 0 ? mode.value : 'collect');
}
function handleTarget(event, operation) {
  const target = targetFrom(event);
  if (!target) return;
  event.preventDefault();
  if (slider.value || entryDate.value) return;
  const id = target.dataset.timeTarget;
  const entry = workspace.data.entries.find(item => item.id === id);
  if (entry) selectEntry(entry);
  if (operation === 'drop' && !held.value && id.startsWith('day:')) { openEntry(id.slice(4)); return; }
  const max = operation === 'collect' ? sourceMinutes(workspace, id, newMinutes.value) : id === 'new' ? 0 : held.value;
  if (!max) {
    message.value = operation === 'collect' ? 'Hier sind keine Stunden zum Sammeln verfügbar.' : id === 'new' ? 'Neue Stunden sind eine Quelle. Wähle ein anderes Ziel.' : 'Der Eimer ist leer. Zuerst Stunden sammeln.';
    return;
  }
  if (event.metaKey || event.ctrlKey || precision.value) {
    const rect = target.getBoundingClientRect();
    slider.value = { id, operation, max, amount: Math.min(60, max), modifier: event.metaKey || event.ctrlKey,
      label: id.startsWith('day:') ? `${id.slice(12)}. ${monthLabel.value}` : targetLabel(workspace, id),
      x: Math.max(12, Math.min(event.clientX || rect.left, window.innerWidth - 312)),
      y: Math.max(12, Math.min(event.clientY || rect.top, window.innerHeight - 380)) };
    cursor.visible = false;
    nextTick(() => rangeInput.value?.focus({ preventScroll: true }));
    return;
  }
  moveMinutes(id, operation, event.shiftKey ? max : Math.min(60, max));
}
function moveMinutes(id, operation, amount) {
  const moved = operation === 'collect' ? collectTime(workspace, id, amount, newMinutes.value)
    : id.startsWith('day:') ? dropOnDay(workspace, id.slice(4), amount) : dropTime(workspace, id, amount);
  if (moved) message.value = `${formatMinutes(moved)} ${operation === 'collect' ? 'gesammelt' : 'abgelegt'}.`;
}
function applySlider() {
  const choice = slider.value;
  slider.value = null;
  if (!choice) return;
  const amount = Math.min(choice.max, Math.max(0, Math.round(Number(choice.amount) || 0)));
  if (amount) moveMinutes(choice.id, choice.operation, amount);
}
function cancel() {
  slider.value = null;
  message.value = cancelTime(workspace) ? 'Sammelaktion zurückgesetzt. Alle Stunden sind wieder an ihrem Ursprung.' : 'Minutenwahl abgebrochen.';
}
function undo() { slider.value = null; if (undoTime(workspace)) message.value = 'Letzte Aktion zurückgenommen.'; }
function revert() { slider.value = null; revertTime(workspace); message.value = 'Gespeicherter Stand wiederhergestellt.'; }
function save() {
  if (slider.value || !props.saveEnabled) return;
  const data = saveTime(workspace);
  if (!data) return;
  emit('save', { employeeId: props.employee.id, month: props.month, ...data });
  message.value = 'In dieser Demo-Sitzung gespeichert.';
}
function openEntry(date) { if (held.value || slider.value) return; cursor.visible = false; selectedDate.value = date; entryDate.value = date; }
function createEntry(entry) {
  if (addTimeEntry(workspace, { ...entry, id: `manual-${Date.now()}-${++entrySequence}` })) {
    entryDate.value = '';
    selectDay(entry.date);
    selectedEntryId.value = workspace.data.entries.at(-1).id;
    message.value = `${entry.label} angelegt · ${formatMinutes(entry.minutes)}.`;
  }
}
function changeEntryType({ entryId, code }) {
  if (changeTimeEntryType(workspace, entryId, code)) {
    selectEntry(workspace.data.entries.find(entry => entry.id === entryId));
    message.value = 'Eintragsart geändert. Die Stunden bleiben unverändert.';
  }
}
function onKeydown(event) {
  if (event.key === 'Escape' && !entryDate.value && (held.value || slider.value)) { event.preventDefault(); cancel(); }
}
function onKeyup(event) {
  if (slider.value?.modifier && ['Meta', 'Control'].includes(event.key) && !event.metaKey && !event.ctrlKey) applySlider();
}
function onBlur() { slider.value = null; cursor.visible = false; }
function onOutside(event) { if (slider.value && !sliderElement.value?.contains(event.target)) slider.value = null; }
function onScroll() { cursor.visible = false; }
function onResize() { slider.value = null; cursor.visible = false; }
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, true);
  document.addEventListener('pointerdown', onOutside);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('keyup', onKeyup);
  window.removeEventListener('blur', onBlur);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('scroll', onScroll, true);
  document.removeEventListener('pointerdown', onOutside);
});
</script>

<style scoped>
.time-management { --tm-blue: #7f98b0; --tm-purple: #a997d0; --tm-green: #62b58f; color: var(--text); font-size: 12px; line-height: 1.4; }
.time-management *, .tm-minute-picker * { box-sizing: border-box; }
.time-management button, .time-management input, .time-management select, .tm-minute-picker button, .tm-minute-picker input { font: inherit; }
.time-management button { color: inherit; }
.time-management button:disabled { cursor: default; opacity: .48; }
.time-management button:focus-visible, .time-management select:focus-visible, .tm-table-scroll:focus-visible, .tm-minute-picker input:focus-visible, .tm-minute-picker button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.tm-context { display: grid; grid-template-columns: 100px minmax(145px, 1.15fr) 140px 95px minmax(140px, 1.25fr) minmax(115px, 1fr) minmax(90px, .8fr); gap: 8px; margin: 0 0 14px; }
.tm-context > div { min-width: 0; }
.tm-context dt { margin-bottom: 4px; color: var(--muted); font-size: 10px; font-weight: 500; }
.tm-context dd { display: block; margin: 0; min-height: 30px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); font-size: 11px; font-weight: 500; overflow-wrap: anywhere; }
.tm-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 14px; align-items: stretch; margin-bottom: 14px; }
.tm-information { min-width: 0; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; align-self: start; }
.tm-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: color-mix(in srgb, var(--border) 18%, var(--surface)); border-bottom: 1px solid var(--border); }
.tm-section-heading h2 { font-size: 12px; font-weight: 600; margin: 0; }
.tm-section-heading > span { color: var(--muted); font-size: 10px; }
.tm-live { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 10px; }
.tm-live > i { width: 5px; height: 5px; border-radius: 50%; background: var(--tm-green); }
.tm-information__identity { display: flex; justify-content: space-between; gap: 8px; padding: 7px 12px; font-size: 10px; color: var(--muted); border-bottom: 1px solid var(--border); }
.tm-information__identity strong { color: var(--text); font-weight: 500; margin-left: 4px; }
.tm-information :deep(.hover-data-card--inline) { border: 0; border-radius: 0; font-size: 11px; line-height: 1.4; }
.tm-information :deep(.hover-data-card__header) { padding: 7px 12px; }
.tm-information :deep(.hover-data-card__employee-name) { font-size: 11px; }
.tm-information :deep(.hover-data-card__eyebrow) { font-size: 9px; }
.tm-information :deep(.hover-data-card__body) { grid-template-columns: 56px minmax(0, 1fr); padding: 10px 12px; gap: 12px; }
.tm-information :deep(.hover-data-card__chart strong) { font-size: 14px; }
.tm-information :deep(.hover-data-card__chart figcaption span) { font-size: 9px; }
.tm-information :deep(.hover-data-card__track) { width: 25px; min-height: 130px; }
.tm-information :deep(.hover-data-card__title) { font-size: 12px; }
.tm-information :deep(.hover-data-card__section) { margin-top: 7px; padding-top: 6px; }
.tm-information :deep(.hover-data-card__section h3) { font-size: 9px; margin-bottom: 3px; }
.tm-information :deep(.hover-data-card__row) { padding: 2px 0; gap: 6px; font-size: 11px; }
.tm-information :deep(.hover-data-card__note) { margin-top: 7px; font-size: 9px; }
.tm-bank { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; width: calc(100% - 20px); gap: 4px 10px; padding: 8px 10px; margin: 1px 10px 0; border: 1px solid color-mix(in srgb, var(--primary) 65%, var(--border)); border-radius: 4px; background: color-mix(in srgb, var(--primary) 13%, var(--surface)); text-align: left; cursor: pointer; }
.tm-bank:hover { box-shadow: 0 0 0 1px var(--primary); }
.tm-bank__heading { display: grid; gap: 2px; }
.tm-bank__heading > strong { font-size: 12px; font-weight: 600; }
.tm-bank__heading > small { font-size: 9px; color: var(--muted); }
.tm-bank__balance { font-size: 22px; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tm-bank__bottom { grid-column: 1 / -1; display: flex; justify-content: space-between; color: var(--muted); font-size: 9px; }
.tm-bank__bottom b { font-weight: 500; color: var(--text); }
.tm-comparison { display: flex; justify-content: space-between; gap: 7px; padding: 7px 11px; color: var(--muted); font-size: 9px; }
.tm-comparison strong { color: var(--text); font-weight: 500; white-space: nowrap; }
.tm-details { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: var(--surface); }
.tm-detail-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.tm-scope, .tm-tools { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: 4px; }
.tm-scope button, .tm-tools button { border: 0; border-radius: 3px; background: transparent; color: var(--muted); padding: 5px 8px; font-size: 10px; cursor: pointer; }
.tm-scope button[aria-pressed=true], .tm-tools button[aria-pressed=true] { background: color-mix(in srgb, var(--primary) 25%, var(--surface)); color: var(--text); font-weight: 500; }
.tm-tools { margin-left: auto; }
.tm-new-source { display: flex; align-items: center; border-left: 1px solid var(--border); padding-left: 10px; }
.tm-new-source select { background: var(--surface); border: 1px solid var(--border); border-radius: 3px; color: var(--muted); padding: 4px; font-size: 10px; }
.tm-source { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 28px; padding: 5px 7px; border: 1px solid transparent; border-radius: 4px; background: transparent; cursor: pointer; font-size: 10px; white-space: nowrap; }
.tm-source > span { font-size: 15px; }
.tm-source small { font-size: 9px; color: var(--muted); }
.tm-source:hover { background: var(--hover); border-color: var(--border); }
.tm-source--remove > span { color: #ce675f; }
.tm-detail-tabs { display: flex; align-items: stretch; gap: 3px; padding: 0 8px; border-bottom: 1px solid var(--border); background: var(--hover); overflow-x: auto; }
.tm-detail-tabs > button { padding: 9px 10px 8px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 11px; white-space: nowrap; cursor: pointer; }
.tm-detail-tabs > button[aria-pressed=true] { border-bottom-color: var(--primary); color: var(--text); background: var(--surface); font-weight: 500; }
.tm-detail-tabs > button > span { color: var(--muted); font-size: 9px; margin-left: 5px; }
.tm-save-state { align-self: center; margin-left: auto; padding: 0 8px; font-size: 9px; color: var(--muted); white-space: nowrap; }
.tm-table-scroll { min-height: 200px; max-height: 350px; overflow: auto; scrollbar-width: thin; }
.tm-data-table { width: 100%; min-width: 1040px; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
.tm-data-table th { font-weight: 500; }
.tm-data-table th, .tm-data-table td { text-align: left; padding: 7px 9px; border-right: 1px solid color-mix(in srgb, var(--border) 45%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.tm-data-table th:last-child, .tm-data-table td:last-child { border-right: 0; }
.tm-data-table thead { position: sticky; top: 0; z-index: 2; background: var(--hover); }
.tm-data-table thead th { font-size: 10px; white-space: nowrap; }
.tm-data-table tbody tr:nth-child(even) { background: color-mix(in srgb, var(--hover) 45%, var(--surface)); }
.tm-data-table tbody tr:hover { background: var(--hover); }
.tm-data-table tbody .tm-row--selected { background: color-mix(in srgb, var(--primary) 15%, var(--surface)); }
.tm-data-table tbody .tm-row--changed > td:first-child { box-shadow: inset 3px 0 0 var(--primary); }
.tm-data-table .tm-numeric { text-align: right; white-space: nowrap; }
.tm-data-table .tm-difference { color: var(--muted); font-size: 10px; }
.tm-data-table .tm-muted { color: var(--muted); font-size: 10px; }
.tm-date-link { padding: 0; border: 0; background: transparent; color: var(--text); cursor: pointer; white-space: nowrap; font-size: 10px; }
.tm-date-link:hover { text-decoration: underline; }
.tm-location { display: block; font-weight: 500; white-space: nowrap; }
.tm-customer { display: block; color: var(--muted); font-size: 9px; margin-top: 2px; }
.tm-entry-label { min-width: 155px; }
.tm-table-time { min-width: 74px; padding: 4px 6px; background: color-mix(in srgb, var(--tm-blue) 10%, var(--surface)); border: 1px solid var(--border); border-radius: 3px; text-align: right; font-weight: 500; cursor: pointer; }
.tm-table-time:hover:not(:disabled) { border-color: var(--primary); }
.tm-type { display: inline-block; min-width: 25px; padding: 3px 4px; background: color-mix(in srgb, var(--tm-blue) 20%, var(--surface)); border-radius: 3px; font-size: 9px; text-align: center; }
.tm-type--vacation { background: color-mix(in srgb, var(--tm-green) 20%, var(--surface)); }
.tm-type--sick, .tm-type--absence { background: color-mix(in srgb, var(--tm-purple) 20%, var(--surface)); }
.tm-type--planned { background: color-mix(in srgb, var(--primary) 20%, var(--surface)); }
.tm-data-table tfoot { position: sticky; bottom: 0; z-index: 1; background: var(--hover); }
.tm-data-table tfoot th, .tm-data-table tfoot td { font-size: 10px; padding-block: 9px; }
.tm-data-table tfoot strong { font-weight: 600; }
.tm-data-table .tm-table-empty { padding: 38px 16px; color: var(--muted); font-size: 12px; text-align: center; }
.tm-history { padding: 16px; min-height: 200px; max-height: 350px; overflow: auto; }
.tm-history p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
.tm-history ol { display: grid; gap: 12px; list-style: none; margin: 0; padding: 0; }
.tm-history li { display: grid; gap: 3px; padding-left: 12px; border-left: 2px solid var(--primary); font-size: 11px; }
.tm-history li > strong { font-weight: 500; }
.tm-history li > span { color: var(--muted); }
.tm-guide { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; padding: 10px 2px; color: var(--muted); font-size: 10px; }
.tm-guide__note { margin-left: auto; font-size: 9px; }
kbd { display: inline-block; padding: 1px 3px; margin-right: 3px; border: 1px solid var(--border); border-radius: 3px; font-family: inherit; font-size: 9px; color: var(--text); }
.tm-button { display: inline-flex; gap: 5px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 4px; padding: 6px 9px; background: var(--surface); color: var(--text); cursor: pointer; white-space: nowrap; font-size: 11px; }
.tm-button:hover:not(:disabled) { border-color: var(--primary); background: var(--hover); }
.tm-button--primary, .time-management .tm-button--primary { color: #2c2219; border-color: var(--primary); background: var(--primary); font-weight: 600; }
.tm-button--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--primary) 90%, #fff); }
.tm-bucket-bar { position: sticky; bottom: 8px; z-index: 20; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 0; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; background: var(--surface); box-shadow: 0 3px 16px #0000000b; }
.tm-bucket-bar--filled { border-color: var(--primary); }
.tm-bucket-bar__icon { width: 42px; height: 42px; flex: 0 0 auto; }
.tm-bucket-bar__content { display: grid; gap: 3px; flex: 1; min-width: 160px; }
.tm-bucket-bar__content > strong { font-size: 11px; font-weight: 600; }
.tm-bucket-bar__content > span { color: var(--muted); font-size: 9px; overflow-wrap: anywhere; max-width: 560px; }
.tm-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.tm-status { flex: 0 1 165px; text-align: right; font-size: 9px; color: var(--muted); }
.tm-cursor { position: fixed; z-index: 1700; pointer-events: none; width: 98px; color: var(--text); filter: drop-shadow(0 3px 4px #0002); }
.tm-cursor > svg { width: 86px; display: block; }
.tm-cursor > span { display: block; width: max-content; max-width: 98px; text-align: center; border: 1px solid var(--border); border-radius: 4px; padding: 3px 5px; background: var(--surface); color: var(--muted); font-size: 9px; }
.tm-minute-picker { position: fixed; z-index: 1800; box-sizing: border-box; width: 300px; max-width: calc(100vw - 24px); max-height: calc(100dvh - 24px); overflow: auto; padding: 16px; border: 1px solid var(--primary); border-radius: 12px; background: var(--surface); color: var(--text); box-shadow: 0 12px 40px #0003; font-size: 12px; }
.tm-minute-picker header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.tm-minute-picker header button { border: 0; background: transparent; color: var(--muted); padding: 0 3px; cursor: pointer; font-size: 20px; }
.tm-minute-picker p { color: var(--muted); margin: 8px 0 12px; }
.tm-minute-picker > strong { display: block; font-size: 30px; font-weight: 600; margin: 14px 0; font-variant-numeric: tabular-nums; }
.tm-minute-picker input[type=range] { width: 100%; accent-color: var(--primary); cursor: ew-resize; }
.tm-minute-picker__scale { display: flex; justify-content: space-between; color: var(--muted); font-size: 10px; }
.tm-minute-picker label { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.tm-minute-picker input[type=number] { width: 80px; border: 1px solid var(--border); border-radius: 4px; padding: 5px 8px; background: var(--surface); color: var(--text); }
.tm-minute-picker .tm-minute-picker__help { font-size: 10px; line-height: 1.6; margin: 16px 0 12px; }

[data-time-target]:not(:disabled) { cursor: pointer; }
@media (max-width: 1150px) {
  .tm-context { grid-template-columns: 100px minmax(150px, 1fr) 150px 100px; }
  .tm-context > div:nth-child(n+5) { grid-row: 2; }
  .tm-layout { grid-template-columns: minmax(0, 1fr) 330px; gap: 10px; }
  .tm-tools { margin-left: 0; }
  .tm-guide__note { width: 100%; margin: 0; }
  .tm-status { display: none; }
}
@media (max-width: 860px) {
  .tm-layout { grid-template-columns: 1fr; }
  .tm-information { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, .8fr); }
  .tm-information > .tm-section-heading { grid-column: 1 / -1; }
  .tm-information__identity { grid-column: 2; grid-row: 2; align-items: center; }
  .tm-information :deep(.hover-data-card--inline) { grid-column: 1; grid-row: 2 / 5; border-right: 1px solid var(--border); }
  .tm-bank { grid-column: 2; align-self: center; }
  .tm-comparison { grid-column: 2; }
  .tm-context { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .tm-context > div:nth-child(1) { grid-column: span 3; }
  .tm-context > div:nth-child(2) { grid-column: span 5; }
  .tm-context > div:nth-child(3) { grid-column: span 4; }
  .tm-context > div:nth-child(n+4) { grid-column: span 3; }
  .tm-context > div:nth-child(n+5) { grid-row: auto; }
  .tm-save-state { display: none; }
}
@media (max-width: 560px) {
  .tm-context { grid-template-columns: 1fr 1fr; gap: 6px; }
  .tm-context > div:nth-child(-n+2) { grid-column: auto; }
  .tm-context > div:nth-child(3) { grid-column: 1 / -1; }
  .tm-context > div:nth-child(n+4) { display: none; }
  .tm-context dd { min-height: 28px; padding-block: 5px; }
  .tm-layout { gap: 10px; }
  .tm-information { display: block; }
  .tm-information :deep(.hover-data-card--inline) { border: 0; }
  .tm-detail-toolbar { gap: 8px; padding: 8px; }
  .tm-new-source { padding: 0; border: 0; }
  .tm-detail-tabs > button { padding-inline: 7px; font-size: 10px; }
  .tm-table-scroll { max-height: 320px; }
  .tm-guide { gap: 6px 9px; font-size: 9px; }
  .tm-bucket-bar { gap: 6px; padding: 5px 8px; bottom: 4px; }
  .tm-bucket-bar__content > span { max-height: 28px; overflow: auto; }
  .tm-bucket-bar__icon { width: 34px; height: 34px; }
  .tm-actions { width: 100%; padding-top: 4px; border-top: 1px solid var(--border); }
  .tm-actions > button { flex: 1; }
}
</style>
