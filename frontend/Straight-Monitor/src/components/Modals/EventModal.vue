<template>
  <ModalFrame
    :model-value="true"
    :title="modalTitle"
    subtitle="Event-Editor (Vorschau)"
    size="full"
    :minimizable="minimizable"
    :minimize-id="minimizeId"
    :minimize-title="minimizeTitle || modalTitle"
    :close-on-escape="closeOnEscape"
    :layer="layer"
    class="event-modal-frame"
    @close="emit('close')"
  >
    <template #actions>
      <span v-if="statusMessage" class="em-status">{{ statusMessage }}</span>
      <button
        type="button"
        class="em-icon-btn"
        title="Eventaktionen"
        aria-label="Eventaktionen"
        aria-haspopup="menu"
        :aria-expanded="actionMenu.open"
        @click.stop="openActionMenu"
      >
        <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
      </button>
      <ActionMenu
        :open="actionMenu.open"
        :x="actionMenu.x"
        :y="actionMenu.y"
        :width="190"
        title="Event"
        :items="actionMenuItems"
        :group-by="false"
        @close="closeActionMenu"
        @item-click="handleActionMenuItem"
      />
    </template>

    <div v-if="loading && !event" class="em-state">
      <font-awesome-icon icon="fa-solid fa-spinner" spin />
      Event wird geladen
    </div>

    <div v-else-if="loadError && !event" class="em-state em-state--error">
      <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
      <span>{{ loadError }}</span>
      <button type="button" class="em-button" @click="loadDetails">Erneut versuchen</button>
    </div>

    <div v-else-if="event" class="em-shell">
      <main class="em-main">
        <p v-if="mutationError" class="em-error">{{ mutationError }}</p>

        <section class="em-section">
          <div class="em-section-head">
            <div>
              <span class="em-eyebrow">Auftrag #{{ event.auftragNr }}</span>
              <h4>Eventdaten</h4>
            </div>
            <button
              type="button"
              class="em-button em-button--primary"
              :disabled="!!pending"
              @click="saveAuftrag"
            >
              <font-awesome-icon icon="fa-solid fa-floppy-disk" />
              Event speichern
            </button>
          </div>

          <div class="em-form-grid em-form-grid--event">
            <label class="em-field em-field--wide">
              <span>Titel</span>
              <input v-model.trim="auftragForm.eventTitel" type="text">
            </label>
            <label class="em-field">
              <span>Status</span>
              <select v-model.number="auftragForm.auftStatus">
                <option :value="1">Entwurf</option>
                <option :value="2">Bestätigt</option>
                <option :value="3">Abgeschlossen</option>
              </select>
            </label>
            <label class="em-field">
              <span>Aktiv</span>
              <select v-model.number="auftragForm.aktiv">
                <option :value="1">Aktiv</option>
                <option :value="0">Inaktiv</option>
              </select>
            </label>
            <label class="em-field">
              <span>Von</span>
              <input v-model="auftragForm.vonDatum" type="datetime-local">
            </label>
            <label class="em-field">
              <span>Bis</span>
              <input v-model="auftragForm.bisDatum" type="datetime-local">
            </label>
            <label class="em-field">
              <span>Bestelldatum</span>
              <input v-model="auftragForm.bestDatum" type="datetime-local">
            </label>
            <label class="em-field">
              <span>Angelegt am</span>
              <input v-model="auftragForm.dtAngelegtAm" type="datetime-local">
            </label>
            <div class="em-field em-field--wide">
              <span>Kunde</span>
              <div v-if="event.kundeData" class="em-current-selection">
                {{ event.kundeData.kundName }} · {{ event.kundeData.kundenNr }}
              </div>
              <KundeSearch
                v-model="selectedCustomerId"
                :location-v2="auftragForm.locationV2 || null"
                placeholder="Anderen Kunden auswählen…"
                @select="onCustomerSelect"
              />
            </div>
            <label class="em-field">
              <span>Standort</span>
              <select v-model="auftragForm.locationV2">
                <option value="">Kein Standort</option>
                <option v-for="location in locations" :key="location._id" :value="location._id">
                  {{ location.shortName || location.nameFull }}
                </option>
              </select>
            </label>
            <label class="em-field">
              <span>Geschäftsstelle</span>
              <input v-model.trim="auftragForm.geschSt" type="text">
            </label>
            <label class="em-field">
              <span>Eventlocation</span>
              <input v-model.trim="auftragForm.eventLocation" type="text">
            </label>
            <label class="em-field">
              <span>Straße</span>
              <input v-model.trim="auftragForm.eventStrasse" type="text">
            </label>
            <label class="em-field">
              <span>PLZ</span>
              <input v-model.trim="auftragForm.eventPlz" type="text">
            </label>
            <label class="em-field">
              <span>Ort</span>
              <input v-model.trim="auftragForm.eventOrt" type="text">
            </label>
            <label class="em-field">
              <span>Referenz</span>
              <input v-model.trim="auftragForm.referenz" type="text">
            </label>
            <label class="em-field">
              <span>Bediener</span>
              <input v-model.trim="auftragForm.bediener" type="text">
            </label>
          </div>

          <div class="em-label-editor">
            <span class="em-field-label">Labels</span>
            <div class="em-labels">
              <span
                v-for="(label, index) in auftragForm.labels"
                :key="`${label.name}-${index}`"
                class="em-label"
                :style="{ borderColor: label.color, color: label.color }"
              >
                {{ label.name }}
                <button type="button" title="Label entfernen" @click="removeLabel(index)">×</button>
              </span>
            </div>
            <div class="em-label-add">
              <input v-model.trim="newLabel.name" maxlength="20" type="text" placeholder="Neues Label">
              <input v-model="newLabel.color" type="color" title="Labelfarbe">
              <button type="button" class="em-button" :disabled="!newLabel.name" @click="addLabel">
                <font-awesome-icon icon="fa-solid fa-plus" />
                Hinzufügen
              </button>
            </div>
          </div>

          <details class="em-advanced">
            <summary>Teamleiter-Ausnahmen</summary>
            <div class="em-form-grid">
              <label class="em-field em-field--wide">
                <span>Ausgeschlossene Mitarbeiter-IDs</span>
                <textarea v-model="auftragForm.excludedTeamleiterText" rows="2" placeholder="Eine MongoDB-ID pro Zeile"></textarea>
              </label>
              <label class="em-field em-field--wide">
                <span>Status-Override Mitarbeiter-IDs</span>
                <textarea v-model="auftragForm.statusOverrideTeamleiterText" rows="2" placeholder="Eine MongoDB-ID pro Zeile"></textarea>
              </label>
            </div>
          </details>
        </section>

        <section class="em-section em-section--shifts">
          <div class="em-section-head">
            <div>
              <span class="em-eyebrow">Planung</span>
              <h4>Schichten und Einsätze</h4>
            </div>
            <span class="em-count">{{ event.einsaetze?.length || 0 }} Einsätze</span>
          </div>

          <p v-if="!eventSchichten.length" class="em-empty">Für diesen Auftrag sind keine Schichten vorhanden.</p>

          <article
            v-for="schicht in eventSchichten"
            :key="schicht.key"
            class="em-shift"
            :class="{
              'em-shift--drag-over': dragOverShiftId === schicht.meta.schichtId,
              'em-shift--orphan': !schicht.meta.schichtId,
            }"
            @dragenter.prevent="onShiftDragEnter($event, schicht)"
            @dragover.prevent="onShiftDragOver($event, schicht)"
            @dragleave="onShiftDragLeave($event, schicht)"
            @drop.prevent="dropOnShift($event, schicht)"
          >
            <details class="em-shift-details">
              <summary class="em-shift-head">
              <div>
                <h5>{{ schicht.meta.schichtBezeichnung || 'Unbenannte Schicht' }}</h5>
                <span>{{ schicht.meta.uhrzeitVon || '--:--' }}–{{ schicht.meta.uhrzeitBis || '--:--' }}</span>
              </div>
              <span class="em-coverage" :class="{ 'em-coverage--met': schicht.meta.bedarfMet }">
                {{ schicht.einsaetze.length }}/{{ schicht.meta.bedarf ?? '–' }}
              </span>
              </summary>

              <template v-if="shiftDrafts[schicht.meta.schichtId]">
                <div class="em-form-grid em-form-grid--shift">
                <label class="em-field em-field--wide">
                  <span>Bezeichnung</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].bezeichnung" type="text">
                </label>
                <label class="em-field">
                  <span>Datum von</span>
                  <input v-model="shiftDrafts[schicht.meta.schichtId].datumVon" type="date">
                </label>
                <label class="em-field">
                  <span>Datum bis</span>
                  <input v-model="shiftDrafts[schicht.meta.schichtId].datumBis" type="date">
                </label>
                <label class="em-field">
                  <span>Uhrzeit von</span>
                  <input v-model="shiftDrafts[schicht.meta.schichtId].uhrzeitVon" type="time">
                </label>
                <label class="em-field">
                  <span>Uhrzeit bis</span>
                  <input v-model="shiftDrafts[schicht.meta.schichtId].uhrzeitBis" type="time">
                </label>
                <label class="em-field">
                  <span>Bedarf</span>
                  <input v-model.number="shiftDrafts[schicht.meta.schichtId].bedarf" min="0" type="number">
                </label>
                <label class="em-field">
                  <span>Garantiestunden Lohn</span>
                  <input v-model.number="shiftDrafts[schicht.meta.schichtId].garantiestundenLohn" min="0" step="0.25" type="number">
                </label>
                <label class="em-field">
                  <span>Typ</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].typ" type="text">
                </label>
                <label class="em-field">
                  <span>Ende offen</span>
                  <select v-model.number="shiftDrafts[schicht.meta.schichtId].endeOffen">
                    <option :value="0">Nein</option>
                    <option :value="1">Ja</option>
                  </select>
                </label>
                <label class="em-field">
                  <span>Treffpunktzeit</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].treffpunkt" type="text">
                </label>
                <label class="em-field">
                  <span>Treffpunktort</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].treffpunktOrt" type="text">
                </label>
                <label class="em-field">
                  <span>Ansprechpartner</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].ansprechpartnerName" type="text">
                </label>
                <label class="em-field">
                  <span>Telefon</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].ansprechpartnerTelefon" type="tel">
                </label>
                <label class="em-field em-field--wide">
                  <span>E-Mail</span>
                  <input v-model.trim="shiftDrafts[schicht.meta.schichtId].ansprechpartnerEmail" type="email">
                </label>
                </div>
                <div class="em-shift-actions">
                  <span v-if="!schicht.meta.schichtId" class="em-hint">Importierte Schicht-ID fehlt; Bearbeitung und Drop sind gesperrt.</span>
                  <button
                    v-else
                    type="button"
                    class="em-button"
                    :disabled="!!pending"
                    @click="saveSchicht(schicht)"
                  >
                    <font-awesome-icon icon="fa-solid fa-floppy-disk" />
                    Schicht speichern
                  </button>
                </div>
              </template>
            </details>

            <div class="em-assignment-list">
              <div
                v-for="einsatz in schicht.einsaetze"
                :key="einsatz._id"
                class="em-assignment"
              >
                <EventEmployeeCard
                  :employee="einsatz.mitarbeiterData || fallbackEmployee(einsatz)"
                  :dispo-entries="dispoEntriesForEmployee(einsatz.mitarbeiterData, schicht.meta.datumVon || event.vonDatum)"
                  draggable
                  @dragstart="startEinsatzDrag($event, einsatz)"
                >
                  <template #trailing>
                    <span class="em-assignment-time">{{ einsatz.uhrzeitVon || '--:--' }}–{{ einsatz.uhrzeitBis || '--:--' }}</span>
                    <button
                      type="button"
                      class="em-icon-btn em-icon-btn--danger"
                      title="Einsatz entfernen"
                      :disabled="!!pending"
                      @click="removeEinsatz(einsatz)"
                    >
                      <font-awesome-icon icon="fa-solid fa-trash" />
                    </button>
                  </template>
                </EventEmployeeCard>

                <details v-if="einsatzDrafts[einsatz._id]" class="em-assignment-editor">
                  <summary>Einsatz bearbeiten</summary>
                  <div class="em-form-grid em-form-grid--assignment">
                    <div class="em-field em-field--wide">
                      <span>Mitarbeiter ersetzen</span>
                      <MitarbeiterSearch
                        v-model="einsatzDrafts[einsatz._id].mitarbeiterId"
                        placeholder="Anderen Mitarbeiter auswählen…"
                        @select="ma => onAssignmentEmployeeSelect(einsatz._id, ma)"
                      />
                    </div>
                    <label class="em-field">
                      <span>Berufsschlüssel</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].berufSchl" type="text">
                    </label>
                    <label class="em-field">
                      <span>Qualifikationsschlüssel</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].qualSchl" type="text">
                    </label>
                    <label class="em-field em-field--wide">
                      <span>Bezeichnung</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].bezeichnung" type="text">
                    </label>
                    <label class="em-field">
                      <span>Datum von</span>
                      <input v-model="einsatzDrafts[einsatz._id].datumVon" type="datetime-local">
                    </label>
                    <label class="em-field">
                      <span>Datum bis</span>
                      <input v-model="einsatzDrafts[einsatz._id].datumBis" type="datetime-local">
                    </label>
                    <label class="em-field">
                      <span>Detail von</span>
                      <input v-model="einsatzDrafts[einsatz._id].detailDatumVon" type="datetime-local">
                    </label>
                    <label class="em-field">
                      <span>Detail bis</span>
                      <input v-model="einsatzDrafts[einsatz._id].detailDatumBis" type="datetime-local">
                    </label>
                    <label class="em-field">
                      <span>Uhrzeit von</span>
                      <input v-model="einsatzDrafts[einsatz._id].uhrzeitVon" type="time">
                    </label>
                    <label class="em-field">
                      <span>Uhrzeit bis</span>
                      <input v-model="einsatzDrafts[einsatz._id].uhrzeitBis" type="time">
                    </label>
                    <label class="em-field">
                      <span>Typ</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].typ" type="text">
                    </label>
                    <label class="em-field">
                      <span>Bedarf</span>
                      <input v-model.number="einsatzDrafts[einsatz._id].bedarf" min="0" type="number">
                    </label>
                    <label class="em-field">
                      <span>Garantiestunden Lohn</span>
                      <input v-model.number="einsatzDrafts[einsatz._id].garantiestundenLohn" min="0" step="0.25" type="number">
                    </label>
                    <label class="em-field">
                      <span>Ende offen</span>
                      <select v-model.number="einsatzDrafts[einsatz._id].endeOffen">
                        <option :value="0">Nein</option>
                        <option :value="1">Ja</option>
                      </select>
                    </label>
                    <label class="em-field">
                      <span>Treffpunktzeit</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].treffpunkt" type="text">
                    </label>
                    <label class="em-field">
                      <span>Treffpunktort</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].treffpunktOrt" type="text">
                    </label>
                    <label class="em-field">
                      <span>Ansprechpartner</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].ansprechpartnerName" type="text">
                    </label>
                    <label class="em-field">
                      <span>Telefon</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].ansprechpartnerTelefon" type="tel">
                    </label>
                    <label class="em-field em-field--wide">
                      <span>E-Mail</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].ansprechpartnerEmail" type="email">
                    </label>
                    <label class="em-field">
                      <span>Protokoll-Bediener</span>
                      <input v-model.trim="einsatzDrafts[einsatz._id].cProtBediener" type="text">
                    </label>
                    <label class="em-field">
                      <span>Protokoll-Datum</span>
                      <input v-model="einsatzDrafts[einsatz._id].dtProtDatum" type="datetime-local">
                    </label>
                  </div>
                  <button
                    type="button"
                    class="em-button"
                    :disabled="!!pending"
                    @click="saveEinsatz(einsatz)"
                  >
                    <font-awesome-icon icon="fa-solid fa-floppy-disk" />
                    Einsatz speichern
                  </button>
                </details>
              </div>

              <div v-if="!schicht.einsaetze.length" class="em-drop-empty">
                Mitarbeiter hierher ziehen
              </div>
              <div v-else class="em-drop-hint">Weitere Mitarbeiter hierher ziehen oder Einsätze zwischen Schichten verschieben</div>
            </div>
          </article>
        </section>
      </main>

      <aside class="em-employee-panel">
        <div class="em-panel-head">
          <span class="em-eyebrow">Personal</span>
          <h4>Mitarbeitersuche</h4>
          <p>Mitarbeiter auswählen und in eine Schicht ziehen.</p>
        </div>
        <MitarbeiterSearch
          v-model="employeePool"
          multiple
          placeholder="Name oder Personalnummer…"
        />
        <div class="em-employee-pool">
          <EventEmployeeCard
            v-for="mitarbeiter in employeePool"
            :key="mitarbeiter._id"
            :employee="mitarbeiter"
            :dispo-entries="dispoEntriesForEmployee(mitarbeiter, event.vonDatum)"
            draggable
            @dragstart="startEmployeeDrag($event, mitarbeiter)"
          />
          <p v-if="!employeePool.length" class="em-empty em-empty--compact">
            Suchergebnisse erscheinen nach der Auswahl hier als Drag-Quelle.
          </p>
        </div>
      </aside>
    </div>
  </ModalFrame>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faEllipsisVertical,
  faFloppyDisk,
  faPlus,
  faRotateRight,
  faSpinner,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import EventEmployeeCard from '@/components/events/EventEmployeeCard.vue';
import ActionMenu from '@/components/ui-elements/ActionMenu.vue';
import KundeSearch from '@/components/ui-elements/KundeSearch.vue';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import api from '@/utils/api';
import { buildEventSchichten } from '@/utils/eventSchichten';

library.add(
  faEllipsisVertical,
  faFloppyDisk,
  faPlus,
  faRotateRight,
  faSpinner,
  faTrash,
  faTriangleExclamation,
);

const props = defineProps({
  auftragNr: { type: [String, Number], required: true },
  minimizable: { type: Boolean, default: true },
  minimizeId: { type: String, default: '' },
  minimizeTitle: { type: String, default: '' },
  closeOnEscape: { type: Boolean, default: false },
  layer: { type: String, default: 'base' },
  onUpdated: { type: Function, default: undefined },
});

const emit = defineEmits(['close', 'updated']);
const event = ref(null);
const locations = ref([]);
const loading = ref(false);
const loadError = ref('');
const mutationError = ref('');
const statusMessage = ref('');
const pending = ref('');
const dragOverShiftId = ref(null);
const employeePool = ref([]);
const dispoEntries = ref([]);
const selectedCustomerId = ref(null);
const shiftDrafts = ref({});
const einsatzDrafts = ref({});
const newLabel = reactive({ name: '', color: '#0f766e' });
const actionMenu = reactive({ open: false, x: 0, y: 0 });
const actionMenuItems = computed(() => [{
  id: 'reload',
  label: loading.value ? 'Wird neu geladen…' : 'Neu laden',
  icon: 'fa-solid fa-rotate-right',
  disabled: loading.value || !!pending.value,
}]);

const auftragForm = reactive({
  geschSt: '',
  locationV2: '',
  kundenNr: null,
  eventTitel: '',
  bediener: '',
  dtAngelegtAm: '',
  bestDatum: '',
  vonDatum: '',
  bisDatum: '',
  eventStrasse: '',
  eventPlz: '',
  eventOrt: '',
  eventLocation: '',
  aktiv: 1,
  auftStatus: 1,
  referenz: '',
  labels: [],
  excludedTeamleiterText: '',
  statusOverrideTeamleiterText: '',
});

const modalTitle = computed(() => event.value?.eventTitel || `Auftrag ${props.auftragNr}`);
const eventSchichten = computed(() => buildEventSchichten(event.value));

function openActionMenu(clickEvent) {
  const rect = clickEvent.currentTarget.getBoundingClientRect();
  actionMenu.x = rect.right - 190;
  actionMenu.y = rect.bottom + 6;
  actionMenu.open = true;
}

function closeActionMenu() {
  actionMenu.open = false;
}

function handleActionMenuItem({ item }) {
  if (item.id === 'reload') loadDetails();
}

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLocalDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nullable(value) {
  return value === '' || value === undefined ? null : value;
}

function idListToText(ids) {
  return (ids || []).map(id => String(id?._id || id)).join('\n');
}

function textToIdList(value) {
  return String(value || '').split(/[\s,;]+/).map(id => id.trim()).filter(Boolean);
}

function hydrateDrafts(data) {
  Object.assign(auftragForm, {
    geschSt: data.geschSt || '',
    locationV2: String(data.locationV2?._id || data.locationV2 || ''),
    kundenNr: data.kundenNr ?? null,
    eventTitel: data.eventTitel || '',
    bediener: data.bediener || '',
    dtAngelegtAm: toLocalDateTime(data.dtAngelegtAm),
    bestDatum: toLocalDateTime(data.bestDatum),
    vonDatum: toLocalDateTime(data.vonDatum),
    bisDatum: toLocalDateTime(data.bisDatum),
    eventStrasse: data.eventStrasse || '',
    eventPlz: data.eventPlz || '',
    eventOrt: data.eventOrt || '',
    eventLocation: data.eventLocation || '',
    aktiv: data.aktiv ?? 1,
    auftStatus: data.auftStatus ?? 1,
    referenz: data.referenz || '',
    labels: (data.labels || []).map(label => ({ name: label.name, color: label.color })),
    excludedTeamleiterText: idListToText(data.excludedTeamleiter),
    statusOverrideTeamleiterText: idListToText(data.statusOverrideTeamleiter),
  });

  shiftDrafts.value = Object.fromEntries((data.schichten || []).map(schicht => [schicht._id, {
    bezeichnung: schicht.bezeichnung || '',
    treffpunkt: schicht.treffpunkt || '',
    treffpunktOrt: schicht.treffpunktOrt || '',
    ansprechpartnerName: schicht.ansprechpartnerName || '',
    ansprechpartnerTelefon: schicht.ansprechpartnerTelefon || '',
    ansprechpartnerEmail: schicht.ansprechpartnerEmail || '',
    datumVon: toLocalDate(schicht.datumVon),
    datumBis: toLocalDate(schicht.datumBis),
    uhrzeitVon: schicht.uhrzeitVon || '',
    uhrzeitBis: schicht.uhrzeitBis || '',
    typ: schicht.typ || '',
    bedarf: schicht.bedarf ?? null,
    garantiestundenLohn: schicht.garantiestundenLohn ?? null,
    endeOffen: schicht.endeOffen ?? 0,
  }]));

  einsatzDrafts.value = Object.fromEntries((data.einsaetze || []).map(einsatz => [einsatz._id, {
    mitarbeiterId: null,
    berufSchl: einsatz.berufSchl || '',
    qualSchl: einsatz.qualSchl || '',
    bezeichnung: einsatz.bezeichnung || '',
    datumVon: toLocalDateTime(einsatz.datumVon),
    datumBis: toLocalDateTime(einsatz.datumBis),
    cProtBediener: einsatz.cProtBediener || '',
    dtProtDatum: toLocalDateTime(einsatz.dtProtDatum),
    detailDatumVon: toLocalDateTime(einsatz.detailDatumVon),
    detailDatumBis: toLocalDateTime(einsatz.detailDatumBis),
    uhrzeitVon: einsatz.uhrzeitVon || '',
    uhrzeitBis: einsatz.uhrzeitBis || '',
    typ: einsatz.typ || '',
    bedarf: einsatz.bedarf ?? null,
    garantiestundenLohn: einsatz.garantiestundenLohn ?? null,
    endeOffen: einsatz.endeOffen ?? 0,
    treffpunkt: einsatz.treffpunkt || '',
    treffpunktOrt: einsatz.treffpunktOrt || '',
    ansprechpartnerName: einsatz.ansprechpartnerName || '',
    ansprechpartnerTelefon: einsatz.ansprechpartnerTelefon || '',
    ansprechpartnerEmail: einsatz.ansprechpartnerEmail || '',
  }]));
}

async function loadDetails(showLoading = true) {
  if (showLoading) loading.value = true;
  loadError.value = '';
  try {
    const requests = [api.get(`/api/auftraege/${props.auftragNr}/details`)];
    if (!locations.value.length) requests.push(api.get('/api/locations'));
    const [detailsResponse, locationsResponse] = await Promise.all(requests);
    event.value = detailsResponse.data;
    if (locationsResponse) locations.value = locationsResponse.data || [];
    selectedCustomerId.value = null;
    hydrateDrafts(event.value);
    await loadDispo(event.value);
  } catch (error) {
    loadError.value = error.response?.data?.message || 'Eventdetails konnten nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

function localDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function loadDispo(eventData) {
  const fallbackDate = eventData.schichten?.find(schicht => schicht.datumVon)?.datumVon;
  const von = localDateKey(eventData.vonDatum || fallbackDate);
  const bis = localDateKey(eventData.bisDatum || eventData.vonDatum || fallbackDate);
  if (!von) {
    dispoEntries.value = [];
    return;
  }

  try {
    const response = await api.get('/api/dispo', { params: { von, bis: bis || von } });
    dispoEntries.value = response.data?.eintraege || [];
  } catch (_) {
    dispoEntries.value = [];
  }
}

function dispoEntriesForEmployee(mitarbeiter, dayValue) {
  const employeeId = mitarbeiter?._id;
  const day = localDateKey(dayValue);
  if (!employeeId || !day) return [];

  const dayStart = new Date(`${day}T00:00:00`);
  const dayEnd = new Date(`${day}T23:59:59.999`);
  return dispoEntries.value.filter(entry => {
    if (String(entry.mitarbeiter?._id || entry.mitarbeiter) !== String(employeeId)) return false;
    const entryStart = new Date(entry.datumVon);
    const entryEnd = new Date(entry.datumBis || entry.datumVon);
    return entryStart <= dayEnd && entryEnd >= dayStart;
  });
}

function fallbackEmployee(einsatz) {
  return {
    _id: `personal-${einsatz.personalNr || einsatz._id}`,
    vorname: 'Unbekannter',
    nachname: 'Mitarbeiter',
  };
}

async function runMutation(key, request, successMessage) {
  pending.value = key;
  mutationError.value = '';
  statusMessage.value = '';
  try {
    await request();
    await loadDetails(false);
    statusMessage.value = successMessage;
    emit('updated', event.value);
    props.onUpdated?.(event.value);
  } catch (error) {
    mutationError.value = error.response?.data?.message || 'Änderung konnte nicht gespeichert werden.';
  } finally {
    pending.value = '';
  }
}

function onCustomerSelect(customer) {
  if (customer) auftragForm.kundenNr = customer.kundenNr;
}

function addLabel() {
  if (!newLabel.name) return;
  auftragForm.labels.push({ name: newLabel.name.slice(0, 20), color: newLabel.color });
  newLabel.name = '';
}

function removeLabel(index) {
  auftragForm.labels.splice(index, 1);
}

function saveAuftrag() {
  const payload = {
    geschSt: auftragForm.geschSt,
    locationV2: nullable(auftragForm.locationV2),
    kundenNr: nullable(auftragForm.kundenNr),
    eventTitel: auftragForm.eventTitel,
    bediener: auftragForm.bediener,
    dtAngelegtAm: nullable(auftragForm.dtAngelegtAm),
    bestDatum: nullable(auftragForm.bestDatum),
    vonDatum: nullable(auftragForm.vonDatum),
    bisDatum: nullable(auftragForm.bisDatum),
    eventStrasse: auftragForm.eventStrasse,
    eventPlz: auftragForm.eventPlz,
    eventOrt: auftragForm.eventOrt,
    eventLocation: auftragForm.eventLocation,
    aktiv: auftragForm.aktiv,
    auftStatus: auftragForm.auftStatus,
    referenz: auftragForm.referenz,
    labels: auftragForm.labels,
    excludedTeamleiter: textToIdList(auftragForm.excludedTeamleiterText),
    statusOverrideTeamleiter: textToIdList(auftragForm.statusOverrideTeamleiterText),
  };
  return runMutation(
    'auftrag',
    () => api.patch(`/api/auftraege/${props.auftragNr}`, payload),
    'Event gespeichert',
  );
}

function saveSchicht(schicht) {
  const draft = shiftDrafts.value[schicht.meta.schichtId];
  if (!draft) return;
  const payload = {
    ...draft,
    datumVon: nullable(draft.datumVon),
    datumBis: nullable(draft.datumBis),
    bedarf: nullable(draft.bedarf),
    garantiestundenLohn: nullable(draft.garantiestundenLohn),
  };
  return runMutation(
    `schicht-${schicht.meta.schichtId}`,
    () => api.patch(`/api/auftraege/${props.auftragNr}/schichten/${schicht.meta.schichtId}`, payload),
    'Schicht gespeichert',
  );
}

function onAssignmentEmployeeSelect(einsatzId, mitarbeiter) {
  einsatzDrafts.value[einsatzId].mitarbeiterId = mitarbeiter?._id || null;
}

function saveEinsatz(einsatz) {
  const draft = einsatzDrafts.value[einsatz._id];
  if (!draft) return;
  const payload = {
    ...draft,
    datumVon: nullable(draft.datumVon),
    datumBis: nullable(draft.datumBis),
    dtProtDatum: nullable(draft.dtProtDatum),
    detailDatumVon: nullable(draft.detailDatumVon),
    detailDatumBis: nullable(draft.detailDatumBis),
    bedarf: nullable(draft.bedarf),
    garantiestundenLohn: nullable(draft.garantiestundenLohn),
  };
  if (!payload.mitarbeiterId) delete payload.mitarbeiterId;
  return runMutation(
    `einsatz-${einsatz._id}`,
    () => api.patch(`/api/auftraege/${props.auftragNr}/einsaetze/${einsatz._id}`, payload),
    'Einsatz gespeichert',
  );
}

function employeeName(einsatz) {
  const mitarbeiter = einsatz.mitarbeiterData;
  return mitarbeiter ? `${mitarbeiter.vorname || ''} ${mitarbeiter.nachname || ''}`.trim() : 'Unbekannter Mitarbeiter';
}

function startEmployeeDrag(dragEvent, mitarbeiter) {
  dragEvent.dataTransfer.effectAllowed = 'copy';
  dragEvent.dataTransfer.setData('application/x-straight-monitor-mitarbeiter', JSON.stringify(mitarbeiter));
  dragEvent.dataTransfer.setData('application/json', JSON.stringify(mitarbeiter));
}

function startEinsatzDrag(dragEvent, einsatz) {
  dragEvent.dataTransfer.effectAllowed = 'move';
  dragEvent.dataTransfer.setData('application/x-straight-monitor-einsatz', JSON.stringify({
    _id: einsatz._id,
    idAuftragArbeitsschichten: einsatz.idAuftragArbeitsschichten,
  }));
}

function hasSupportedPayload(dragEvent) {
  const types = Array.from(dragEvent.dataTransfer?.types || []);
  return types.includes('application/x-straight-monitor-mitarbeiter')
    || types.includes('application/x-straight-monitor-einsatz')
    || types.includes('application/json');
}

function onShiftDragEnter(dragEvent, schicht) {
  if (schicht.meta.schichtId && hasSupportedPayload(dragEvent)) dragOverShiftId.value = schicht.meta.schichtId;
}

function onShiftDragOver(dragEvent, schicht) {
  if (!schicht.meta.schichtId || !hasSupportedPayload(dragEvent)) return;
  dragEvent.dataTransfer.dropEffect = dragEvent.dataTransfer.types.includes('application/x-straight-monitor-einsatz') ? 'move' : 'copy';
  dragOverShiftId.value = schicht.meta.schichtId;
}

function onShiftDragLeave(dragEvent, schicht) {
  if (dragEvent.currentTarget.contains(dragEvent.relatedTarget)) return;
  if (dragOverShiftId.value === schicht.meta.schichtId) dragOverShiftId.value = null;
}

function dropOnShift(dropEvent, schicht) {
  dragOverShiftId.value = null;
  if (!schicht.meta.schichtId) return;

  const einsatzPayload = dropEvent.dataTransfer?.getData('application/x-straight-monitor-einsatz');
  if (einsatzPayload) {
    const einsatz = JSON.parse(einsatzPayload);
    if (String(einsatz.idAuftragArbeitsschichten) === String(schicht.meta.idAuftragArbeitsschichten)) return;
    return runMutation(
      `move-${einsatz._id}`,
      () => api.patch(`/api/auftraege/${props.auftragNr}/einsaetze/${einsatz._id}`, {
        idAuftragArbeitsschichten: schicht.meta.idAuftragArbeitsschichten,
      }),
      'Einsatz verschoben',
    );
  }

  const employeePayload = dropEvent.dataTransfer?.getData('application/x-straight-monitor-mitarbeiter')
    || dropEvent.dataTransfer?.getData('application/json');
  if (!employeePayload) return;
  const mitarbeiter = JSON.parse(employeePayload);
  if (!mitarbeiter?._id) return;
  return runMutation(
    `assign-${mitarbeiter._id}`,
    () => api.post(`/api/auftraege/${props.auftragNr}/einsaetze`, {
      mitarbeiterId: mitarbeiter._id,
      schichtId: schicht.meta.schichtId,
    }),
    'Mitarbeiter eingeplant',
  );
}

function removeEinsatz(einsatz) {
  const name = employeeName(einsatz);
  if (!window.confirm(`${name} aus dieser Schicht entfernen?`)) return;
  return runMutation(
    `delete-${einsatz._id}`,
    () => api.delete(`/api/auftraege/${props.auftragNr}/einsaetze/${einsatz._id}`),
    'Einsatz entfernt',
  );
}

watch(() => props.auftragNr, () => loadDetails());
onMounted(loadDetails);
</script>

<style scoped lang="scss">
.event-modal-frame {
  --mf-max-width: min(1500px, 98vw);
  --mf-max-height: 95dvh;
  --mf-body-padding: 0;
  --mf-body-overflow: hidden;
}

.event-modal-frame :deep(.mf-body) {
  overflow: hidden;
}

.em-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  flex: 1;
  min-height: 0;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--panel) 70%, transparent) 1px, transparent 1px) 0 0 / 24px 24px,
    var(--bg);
}

.em-main {
  min-width: 0;
  overflow-y: auto;
  padding: 20px 24px 40px;
}

.em-employee-panel {
  min-width: 0;
  overflow-y: auto;
  padding: 20px;
  border-left: 1px solid var(--border);
  background: var(--panel);
}

.em-panel-head {
  margin-bottom: 16px;

  h4 { margin: 2px 0 4px; font-size: 1rem; }
  p { margin: 0; color: var(--muted); font-size: 0.78rem; line-height: 1.45; }
}

.em-warning,
.em-error {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 0 0 16px;
  padding: 10px 12px;
  border-left: 3px solid #d97706;
  background: color-mix(in srgb, #f59e0b 10%, var(--panel));
  color: var(--text);
  font-size: 0.8rem;
  line-height: 1.45;
}

.em-error {
  border-left-color: #dc2626;
  background: color-mix(in srgb, #ef4444 10%, var(--panel));
  color: #dc2626;
}

.em-section {
  padding: 0 0 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.em-section--shifts { border-bottom: 0; margin-bottom: 0; }

.em-section-head,
.em-shift-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.em-section-head {
  margin-bottom: 16px;

  h4 { margin: 2px 0 0; font-size: 1.02rem; }
}

.em-eyebrow,
.em-field > span,
.em-field-label {
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.em-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.em-form-grid--event { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.em-form-grid--shift { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.em-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.em-field--wide { grid-column: span 2; }

.em-field input,
.em-field select,
.em-field textarea,
.em-label-add input:not([type="color"]) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--tile-bg);
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  outline: none;

  &:focus { border-color: var(--primary); }
}

.em-current-selection {
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 600;
}

.em-label-editor { margin-top: 16px; }
.em-labels { display: flex; flex-wrap: wrap; gap: 6px; margin: 7px 0; }
.em-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border: 1px solid;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;

  button { border: 0; padding: 0; background: none; color: inherit; cursor: pointer; }
}

.em-label-add { display: flex; align-items: center; gap: 7px; max-width: 520px; }
.em-label-add input[type="color"] { width: 32px; height: 30px; padding: 2px; border: 1px solid var(--border); background: var(--tile-bg); }

.em-advanced,
.em-assignment-editor {
  margin-top: 14px;

  summary { color: var(--muted); font-size: 0.76rem; font-weight: 700; cursor: pointer; }
  &[open] summary { margin-bottom: 12px; }
}

.em-shift {
  margin-bottom: 14px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.em-shift-details { margin: 0; }

.em-shift-details > summary {
  list-style: none;
}

.em-shift-details > summary::-webkit-details-marker { display: none; }

.em-shift--drag-over {
  border-color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary);
}

.em-shift--orphan { border-style: dashed; }

.em-shift-head {
  position: relative;
  padding: 8px 38px 8px 12px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--hover) 55%, var(--panel));
  cursor: pointer;

  &::after {
    position: absolute;
    top: 50%;
    right: 14px;
    width: 7px;
    height: 7px;
    border-right: 1.5px solid var(--muted);
    border-bottom: 1.5px solid var(--muted);
    content: '';
    transform: translateY(-65%) rotate(45deg);
    transition: transform 0.15s ease;
  }

  h5 { margin: 0 0 2px; font-size: 0.86rem; }
  span { color: var(--muted); font-size: 0.72rem; }
}

.em-shift-details[open] .em-shift-head::after {
  transform: translateY(-35%) rotate(225deg);
}

.em-coverage {
  padding: 3px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, #dc2626 10%, transparent);
  color: #dc2626 !important;
  font-weight: 800;
}

.em-coverage--met { background: color-mix(in srgb, #16a34a 10%, transparent); color: #16803b !important; }
.em-form-grid--shift { padding: 12px; }
.em-shift-actions { display: flex; justify-content: flex-end; align-items: center; padding: 0 12px 12px; }
.em-hint { margin-right: auto; color: #b45309; font-size: 0.72rem; }

.em-assignment-list { border-top: 1px solid var(--border); }
.em-assignment { padding: 8px 12px; border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent); }
.em-assignment:last-of-type { border-bottom: 0; }
.em-assignment-time { color: var(--muted); font-size: 0.68rem; }
.em-assignment-editor { padding: 0 0 4px 46px; }
.em-assignment-editor .em-button { margin-top: 12px; }
.em-drop-empty,
.em-drop-hint { padding: 11px 12px; color: var(--muted); text-align: center; font-size: 0.72rem; }
.em-drop-empty { background: color-mix(in srgb, var(--primary) 5%, transparent); }
.em-drop-hint { border-top: 1px dashed var(--border); }

.em-employee-pool { display: flex; flex-direction: column; gap: 7px; margin-top: 14px; }

.em-button,
.em-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--tile-bg);
  color: var(--text);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;

  &:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.em-button--primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.em-button--primary:hover:not(:disabled) { color: #fff; filter: brightness(0.96); }
.em-icon-btn { width: 30px; padding: 0; }
.em-icon-btn--danger:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; }
.em-status { color: #16803b; font-size: 0.72rem; font-weight: 700; }
.em-count { color: var(--muted); font-size: 0.74rem; }

.em-state,
.em-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 240px;
  color: var(--muted);
  font-size: 0.84rem;
}

.em-state--error { color: #dc2626; flex-direction: column; }
.em-empty--compact { min-height: 120px; padding: 10px; text-align: center; line-height: 1.5; }

@media (max-width: 1100px) {
  .em-shell { grid-template-columns: 1fr; overflow-y: auto; }
  .em-main { overflow: visible; }
  .em-employee-panel { order: -1; overflow: visible; border-left: 0; border-bottom: 1px solid var(--border); }
  .em-form-grid--event,
  .em-form-grid--shift { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .em-main,
  .em-employee-panel { padding: 14px; }
  .em-form-grid,
  .em-form-grid--event,
  .em-form-grid--shift { grid-template-columns: 1fr; }
  .em-field--wide { grid-column: span 1; }
  .em-section-head { align-items: flex-start; flex-direction: column; }
  .em-label-add { align-items: stretch; flex-wrap: wrap; }
}
</style>