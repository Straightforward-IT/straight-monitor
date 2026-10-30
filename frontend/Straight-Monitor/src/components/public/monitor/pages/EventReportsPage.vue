<template>
  <section class="public-monitor-page public-monitor-event-reports-page">
    <!-- ── DETAIL VIEW ─────────────────────────────── -->
    <template v-if="mode === 'detail' && selectedReport">
      <section class="job-hero compact">
        <span class="date-kicker">Event Report</span>
        <h2>{{ selectedReport.auftrag?.eventTitel || selectedReport.kunde || selectedReport.location || 'Event Report' }}</h2>
        <p>
          <template v-if="selectedReport.datum">{{ formatDate(selectedReport.datum) }}</template>
          <template v-if="selectedReport.datum && selectedReport.location"> · </template>
          <template v-if="selectedReport.location">{{ selectedReport.location }}</template>
        </p>
      </section>

      <section class="detail-list">
        <div v-if="selectedReport.datum" class="detail-row">
          <span>Datum</span>
          <strong>{{ formatDate(selectedReport.datum) }}</strong>
        </div>
        <div v-if="selectedReport.kunde" class="detail-row">
          <span>Kunde</span>
          <strong>{{ selectedReport.kunde }}</strong>
        </div>
        <div v-if="selectedReport.auftrag?.eventTitel" class="detail-row">
          <span>Event</span>
          <strong>{{ selectedReport.auftrag.eventTitel }}</strong>
        </div>
        <div v-if="selectedReport.auftrag?.eventLocation" class="detail-row">
          <span>Venue</span>
          <strong>{{ selectedReport.auftrag.eventLocation }}</strong>
        </div>
        <div v-if="selectedReport.auftrag?.eventStrasse" class="detail-row">
          <span>Adresse</span>
          <strong>
            {{ selectedReport.auftrag.eventStrasse }}<template v-if="selectedReport.auftrag.eventPlz || selectedReport.auftrag.eventOrt">, {{ selectedReport.auftrag.eventPlz }} {{ selectedReport.auftrag.eventOrt }}</template>
          </strong>
        </div>
        <div v-if="selectedReport.mitarbeiter_anzahl" class="detail-row">
          <span>Mitarbeiter</span>
          <strong>{{ selectedReport.mitarbeiter_anzahl }}</strong>
        </div>
      </section>

      <div class="er-detail-blocks">
        <section v-if="selectedReport.ausruestung_fehlt" class="er-detail-card er-detail-card--warning">
          <span class="er-detail-label">Ausrüstung fehlt</span>
          <p>{{ selectedReport.ausruestung_fehlt }}</p>
        </section>

        <section v-if="selectedReport.puenktlichkeit" class="er-detail-card">
          <span class="er-detail-label">Pünktlichkeit</span>
          <p>{{ selectedReport.puenktlichkeit }}</p>
        </section>

        <section v-if="selectedReport.erscheinungsbild" class="er-detail-card">
          <span class="er-detail-label">Erscheinungsbild</span>
          <p>{{ selectedReport.erscheinungsbild }}</p>
        </section>

        <section v-if="selectedReport.team" class="er-detail-card">
          <span class="er-detail-label">Team</span>
          <p>{{ selectedReport.team }}</p>
        </section>

        <section v-if="selectedReport.mitarbeiter_job" class="er-detail-card">
          <span class="er-detail-label">Mitarbeiter &amp; Job</span>
          <p>{{ selectedReport.mitarbeiter_job }}</p>
        </section>

        <section v-if="selectedReport.mitarbeiter_feedback?.length" class="er-detail-card">
          <span class="er-detail-label">Mitarbeiter &amp; Job</span>
          <div class="er-detail-ma-list">
            <div v-for="mf in selectedReport.mitarbeiter_feedback" :key="mf._id || mf.personalNr" class="er-detail-ma-item">
              <strong>{{ mf.name || `${mf.mitarbeiter?.vorname || ''} ${mf.mitarbeiter?.nachname || ''}`.trim() || '—' }}</strong>
              <p v-if="mf.text">{{ mf.text }}</p>
            </div>
          </div>
        </section>

        <section v-if="selectedReport.feedback_auftraggeber" class="er-detail-card">
          <span class="er-detail-label">Feedback Auftraggeber</span>
          <p>{{ selectedReport.feedback_auftraggeber }}</p>
        </section>

        <section v-if="selectedReport.sonstiges" class="er-detail-card">
          <span class="er-detail-label">Sonstiges</span>
          <p>{{ selectedReport.sonstiges }}</p>
        </section>

        <section v-if="selectedReport.attachments?.length" class="home-section">
          <div class="section-heading">
            <h3>Anhänge</h3>
            <span>{{ selectedReport.attachments.length }}</span>
          </div>
          <div class="document-list">
            <PublicListItem
              v-for="att in selectedReport.attachments"
              :key="att._id || att.key"
              :icon="openingAttachmentKey === (att._id || att.key) ? 'fa-solid fa-spinner' : isImageMime(att.contentType) ? 'fa-solid fa-image' : 'fa-solid fa-file'"
              :title="att.filename || 'Anhang'"
              :description="att.size ? formatFileSize(att.size) : 'Datei herunterladen'"
              @click="openSavedAttachment(selectedReport._id, att)"
            />
          </div>
        </section>

        <section v-if="selectedReport.comments?.length" class="home-section">
          <div class="section-heading">
            <h3>Kommentare</h3>
            <span>{{ selectedReport.comments.length }}</span>
          </div>
          <div class="er-detail-blocks">
            <div v-for="c in selectedReport.comments" :key="c._id" class="er-detail-card">
              <div class="er-comment-header">
                <strong>{{ c.authorName || 'Unbekannt' }}</strong>
                <span>{{ formatDate(c.date) }}</span>
              </div>
              <p>{{ c.text }}</p>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- ── FORM VIEW ───────────────────────────────── -->
    <form v-else-if="mode === 'form'" class="personal-data-form" @submit.prevent="submitReport">
      <section class="job-hero compact">
        <span class="date-kicker">Event Reports</span>
        <h2>Neuer Event Report</h2>
        <p>Dokumentiere den Ablauf, das Team und wichtiges Feedback zum Einsatz.</p>
      </section>

      <div class="segmented-control er-quick-actions">
        <button
          type="button"
          :class="{ active: !!form.notizen }"
          @click="showNotizModal = true"
        >
          <font-awesome-icon icon="fa-solid fa-comment" />
          {{ form.notizen ? 'Notizen bearbeiten' : 'Notizen hinzufügen' }}
        </button>
        <button
          type="button"
          :class="{ active: !!form.ausruestung_fehlt }"
          @click="showEquipmentModal = true"
        >
          <font-awesome-icon icon="fa-solid fa-toolbox" />
          {{ form.ausruestung_fehlt ? 'Ausrüstung fehlt ✓' : 'Ausrüstung fehlt?' }}
        </button>
      </div>

      <div v-if="form.notizen" class="er-quick-preview">
        <strong>Notizen:</strong> {{ form.notizen }}
      </div>
      <div v-if="form.ausruestung_fehlt" class="er-quick-preview er-quick-preview--warning">
        <strong>Fehlende Ausrüstung:</strong> {{ form.ausruestung_fehlt }}
      </div>

      <label>
        <span>Einsatz auswählen *</span>
        <select :value="selectedEinsatzId" required @change="onSelectEinsatz($event.target.value)">
          <option value="" disabled>— Einsatz wählen —</option>
          <option v-for="einsatz in selectableEinsaetze" :key="einsatz._id" :value="einsatz._id">
            {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `#${einsatz.auftragNr}` }} ({{ formatDate(einsatz.datumVon) }})
          </option>
        </select>
      </label>

      <div class="er-grid-two">
        <label>
          <span>Standort *</span>
          <input :value="form.location || 'Standort nicht verfügbar'" type="text" readonly class="readonly-input" />
        </label>
        <label>
          <span>Kunde *</span>
          <input v-model.trim="form.kunde" type="text" required />
        </label>
      </div>

      <div class="er-grid-two">
        <label>
          <span>Auftragnummer</span>
          <input v-model="form.auftragnummer" type="text" readonly class="readonly-input" />
        </label>
        <label>
          <span>Datum *</span>
          <input v-model="form.datum" type="date" required />
        </label>
      </div>

      <div class="er-grid-two">
        <label>
          <span>Teamleiter</span>
          <input :value="teamleiterName" type="text" readonly class="readonly-input" />
        </label>
        <label>
          <span>Mitarbeiter Anzahl</span>
          <input v-model="form.mitarbeiter_anzahl" type="text" inputmode="numeric" />
        </label>
      </div>

      <label>
        <span>Team</span>
        <textarea v-model="form.team" rows="4" placeholder="Wie hat das Team zusammengearbeitet?" />
      </label>

      <div class="er-ma-section">
        <span class="er-field-label">Mitarbeiter &amp; Job</span>

        <div v-if="availableMitarbeiter.length" class="segmented-control er-ma-chips">
          <button
            v-for="ma in availableMitarbeiter"
            :key="ma.personalNr"
            type="button"
            @click="addMitarbeiterRow(ma)"
          >
            + {{ maDisplayName(ma) }}
          </button>
        </div>

        <div v-if="mitarbeiterRows.length" class="er-ma-rows">
          <div v-for="row in mitarbeiterRows" :key="row.personalNr" class="er-ma-row">
            <div class="er-ma-row-header">
              <strong>{{ row.name }}</strong>
              <button type="button" class="er-ma-row-remove" aria-label="Entfernen" @click="removeMitarbeiterRow(row)">
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
            <textarea
              v-model="row.text"
              rows="2"
              placeholder="Pünktlichkeit, Erscheinungsbild, Arbeitsweise…"
            />
          </div>
        </div>

        <textarea
          v-if="!einsatzMitarbeiter.length"
          v-model="form.mitarbeiter_job"
          rows="3"
          placeholder="Wie haben die Mitarbeiter ihre Aufgaben erledigt?"
        />
      </div>

      <label>
        <span>Feedback Auftraggeber</span>
        <textarea v-model="form.feedback_auftraggeber" rows="4" placeholder="Was hat der Auftraggeber gesagt?" />
      </label>

      <label>
        <span>Sonstiges</span>
        <textarea v-model="form.sonstiges" rows="4" placeholder="Weitere Anmerkungen…" />
      </label>

      <div class="er-ma-section">
        <span class="er-field-label">Dateien / Fotos anhängen</span>
        <input
          ref="fileInputRef"
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          class="er-file-input-hidden"
          @change="onFilesSelected"
        />
        <button type="button" class="secondary-button wide" @click="triggerFileSelect">
          <font-awesome-icon icon="fa-solid fa-paperclip" />
          Datei oder Foto vom Gerät auswählen
        </button>

        <div v-if="selectedFiles.length" class="er-file-list">
          <div v-for="(item, idx) in selectedFiles" :key="item.id" class="er-file-item">
            <img v-if="item.previewUrl" :src="item.previewUrl" class="er-file-thumb" alt="" />
            <span v-else class="er-file-icon">
              <font-awesome-icon :icon="isImageMime(item.file.type) ? 'fa-solid fa-image' : 'fa-solid fa-file'" />
            </span>
            <span class="er-file-info">
              <strong>{{ item.file.name }}</strong>
              <small>{{ formatFileSize(item.file.size) }}</small>
            </span>
            <button type="button" class="er-ma-row-remove" aria-label="Datei entfernen" @click="removeSelectedFile(idx)">
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      </div>

      <p v-if="submitError" class="inline-message personal-data-error">{{ submitError }}</p>

      <div class="job-decision-actions">
        <button class="secondary-button" type="button" @click="$emit('cancel-form')">
          Abbrechen
        </button>
        <button class="primary-button" type="submit" :disabled="submitting || !selectedEinsatzId || !form.kunde || !form.datum">
          <font-awesome-icon :icon="submitting ? 'fa-solid fa-spinner' : 'fa-solid fa-paper-plane'" :spin="submitting" />
          {{ submitting ? 'Wird gesendet…' : 'Absenden' }}
        </button>
      </div>
    </form>

    <!-- ── LIST VIEW ───────────────────────────────── -->
    <template v-else>
      <section class="job-hero compact">
        <span class="date-kicker">Mein Profil</span>
        <h2>Event Reports</h2>
        <p>Erstelle Berichte zu deinen Einsätzen und sieh bereits eingereichte Event Reports ein.</p>
      </section>

      <div v-if="submitSuccess" class="status-panel er-success-banner">
        <font-awesome-icon icon="fa-solid fa-circle-check" />
        <strong>Dein Event Report wurde erfolgreich eingereicht.</strong>
      </div>

      <div class="sticky-action">
        <button class="primary-button wide" type="button" @click="$emit('open-new')">
          <font-awesome-icon icon="fa-solid fa-plus" />
          Neuer Event Report
        </button>
      </div>

      <section class="home-section">
        <div class="section-heading">
          <h3>Eingereichte Berichte</h3>
          <span>{{ sortedReports.length }}</span>
        </div>
        <div v-if="sortedReports.length" class="document-list">
          <PublicListItem
            v-for="report in sortedReports"
            :key="report._id || report.auftragnummer"
            icon="fa-solid fa-file-lines"
            :title="report.auftrag?.eventTitel || report.kunde || report.location || 'Event Report'"
            :description="getReportDescription(report)"
            @click="$emit('open-detail', report)"
          />
        </div>
        <PublicListItem
          v-else
          :clickable="false"
          :chevron="false"
          icon="fa-solid fa-file-lines"
          title="Noch keine Event Reports geschrieben"
          description="Erstelle deinen ersten Bericht über den Button oben."
        />
      </section>
    </template>

    <!-- Notizen Modal -->
    <PublicBottomSheet v-model="showNotizModal">
      <h3 class="er-modal-title">Notizen</h3>
      <textarea v-model="form.notizen" class="er-modal-textarea" placeholder="Notizen zu diesem Einsatz…" rows="5" autofocus />
      <div class="job-decision-actions">
        <button class="secondary-button" type="button" @click="showNotizModal = false">Schließen</button>
        <button class="primary-button" type="button" @click="showNotizModal = false">Speichern</button>
      </div>
    </PublicBottomSheet>

    <!-- Fehlende Ausrüstung Modal -->
    <PublicBottomSheet v-model="showEquipmentModal">
      <h3 class="er-modal-title">Fehlende Ausrüstung</h3>
      <textarea v-model="form.ausruestung_fehlt" class="er-modal-textarea" placeholder="Welche Ausrüstung hat gefehlt?" rows="4" autofocus />
      <div class="job-decision-actions">
        <button class="secondary-button" type="button" @click="showEquipmentModal = false">Schließen</button>
        <button class="primary-button" type="button" @click="showEquipmentModal = false">Speichern</button>
      </div>
    </PublicBottomSheet>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faComment,
  faDownload,
  faFile,
  faImage,
  faPaperclip,
  faToolbox,
} from '@fortawesome/free-solid-svg-icons';
import { showToast } from '@getflip/bridge';
import PublicBottomSheet from '@/components/public/PublicBottomSheet.vue';
import PublicListItem from '@/components/public/PublicListItem.vue';

library.add(faComment, faDownload, faFile, faImage, faPaperclip, faToolbox);

const props = defineProps({
  api: { type: [Object, Function], required: true },
  einsaetze: { type: Array, default: () => [] },
  email: { type: String, default: '' },
  mitarbeiter: { type: Object, required: true },
  mode: { type: String, default: 'list' }, // 'list' | 'detail' | 'form'
  prefillEinsatz: { type: Object, default: null },
  selectedReport: { type: Object, default: null },
  submitSuccess: { type: Boolean, default: false },
});

const emit = defineEmits(['cancel-form', 'open-detail', 'open-new', 'submitted']);

const selectedEinsatzId = ref('');
const submitting = ref(false);
const submitError = ref('');
const einsatzMitarbeiter = ref([]);
const mitarbeiterRows = ref([]);
const draftReady = ref(false);
const showNotizModal = ref(false);
const showEquipmentModal = ref(false);
const fileInputRef = ref(null);
const selectedFiles = ref([]);
const openingAttachmentKey = ref(null);

const form = reactive({
  location: '',
  locationV2: '',
  kunde: '',
  auftragnummer: '',
  datum: '',
  mitarbeiter_anzahl: '',
  puenktlichkeit: '',
  erscheinungsbild: '',
  team: '',
  mitarbeiter_job: '',
  feedback_auftraggeber: '',
  sonstiges: '',
  notizen: '',
  ausruestung_fehlt: '',
});

const teamleiterName = computed(() =>
  `${props.mitarbeiter?.vorname || ''} ${props.mitarbeiter?.nachname || ''}`.trim()
);

const sortedReports = computed(() =>
  [...(props.mitarbeiter?.eventreports || [])].sort(
    (a, b) => new Date(b.datum || b.createdAt || 0) - new Date(a.datum || a.createdAt || 0)
  )
);

const selectableEinsaetze = computed(() => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const reportedNrs = new Set(
    (props.mitarbeiter?.eventreports || [])
      .map((r) => (r?.auftragnummer ? String(r.auftragnummer) : null))
      .filter(Boolean)
  );

  const list = props.einsaetze.filter((e) => {
    if (!e.datumVon) return false;
    const d = new Date(e.datumVon);
    if (d < cutoff || d > endOfToday) return false;
    if (e.auftragNr && reportedNrs.has(String(e.auftragNr))) return false;
    return true;
  });

  if (
    props.prefillEinsatz &&
    !list.some((e) => String(e._id) === String(props.prefillEinsatz._id))
  ) {
    return [props.prefillEinsatz, ...list];
  }
  return list;
});

const availableMitarbeiter = computed(() =>
  einsatzMitarbeiter.value.filter(
    (ma) => !mitarbeiterRows.value.find((r) => r.personalNr === ma.personalNr)
  )
);

function maDisplayName(ma) {
  const first = ma.vorname || ma.bezeichnung || '';
  const last = ma.nachname || '';
  return `${first} ${last}`.trim();
}

function addMitarbeiterRow(ma) {
  mitarbeiterRows.value.push({
    personalNr: ma.personalNr,
    name: maDisplayName(ma),
    text: '',
  });
}

function removeMitarbeiterRow(row) {
  mitarbeiterRows.value = mitarbeiterRows.value.filter(
    (r) => r.personalNr !== row.personalNr
  );
}

function isImageMime(mime) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerFileSelect() {
  fileInputRef.value?.click();
}

function onFilesSelected(event) {
  const files = Array.from(event.target?.files || []);
  for (const file of files) {
    if (selectedFiles.value.length >= 10) break;
    const previewUrl = isImageMime(file.type) ? URL.createObjectURL(file) : null;
    selectedFiles.value.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl,
    });
  }
  if (event.target) event.target.value = '';
}

function removeSelectedFile(index) {
  const removed = selectedFiles.value.splice(index, 1)[0];
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
}

function clearSelectedFiles() {
  for (const item of selectedFiles.value) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
  selectedFiles.value = [];
  if (fileInputRef.value) fileInputRef.value.value = '';
}

async function openSavedAttachment(reportId, att) {
  const attId = att._id || att.key;
  if (!reportId || !attId || openingAttachmentKey.value) return;
  openingAttachmentKey.value = attId;
  try {
    const { data } = await props.api.get(
      `/api/public/eventreport/${reportId}/attachments/${encodeURIComponent(attId)}/download`,
      { params: { email: props.email } }
    );
    const url = data?.data?.url || data?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    alert('Anhang konnte nicht geöffnet werden.');
  } finally {
    openingAttachmentKey.value = null;
  }
}

onBeforeUnmount(clearSelectedFiles);

const draftUserId = computed(() =>
  String(props.mitarbeiter?.personalnr || props.email || 'u').toLowerCase()
);

function draftKeyFor(einsatzId) {
  return einsatzId ? `public_eventreport_draft_${draftUserId.value}_${einsatzId}` : null;
}

function draftKey() {
  return draftKeyFor(selectedEinsatzId.value);
}

function draftPayload() {
  return {
    selectedEinsatzId: selectedEinsatzId.value,
    form: { ...form },
    mitarbeiterRows: mitarbeiterRows.value,
    savedAt: new Date().toISOString(),
  };
}

function formHasUserContent() {
  return !!(
    form.team?.trim() ||
    form.feedback_auftraggeber?.trim() ||
    form.sonstiges?.trim() ||
    form.notizen?.trim() ||
    form.ausruestung_fehlt?.trim() ||
    form.puenktlichkeit?.trim() ||
    form.erscheinungsbild?.trim() ||
    form.mitarbeiter_job?.trim() ||
    mitarbeiterRows.value.some((r) => r.text?.trim())
  );
}

function flushCurrentDraft() {
  const key = draftKey();
  if (key && formHasUserContent()) {
    try {
      localStorage.setItem(key, JSON.stringify(draftPayload()));
    } catch {}
  }
}

function resetFormFields() {
  Object.keys(form).forEach((k) => {
    form[k] = '';
  });
  mitarbeiterRows.value = [];
  einsatzMitarbeiter.value = [];
  submitError.value = '';
  clearSelectedFiles();
}

async function rebuild(fn) {
  draftReady.value = false;
  try {
    await fn();
  } finally {
    await nextTick();
    draftReady.value = true;
  }
}

async function loadEinsatzMitarbeiter(auftragNr) {
  if (!auftragNr) return;
  mitarbeiterRows.value = [];
  try {
    const res = await props.api.get('/api/public/einsatz-mitarbeiter', {
      params: { auftragNr },
    });
    const all = [];
    const einsatzIdsByPersonalNr = new Map();
    (res.data || []).forEach((s) =>
      s.mitarbeiter?.forEach((ma) => {
        if (ma.einsatzId && ma.personalNr != null) {
          const list = einsatzIdsByPersonalNr.get(ma.personalNr) || [];
          list.push(String(ma.einsatzId));
          einsatzIdsByPersonalNr.set(ma.personalNr, list);
        }
        if (!all.find((m) => m.personalNr === ma.personalNr)) all.push(ma);
      })
    );
    einsatzMitarbeiter.value = all;
    if (all.length) form.mitarbeiter_anzahl = String(all.length);

    let noShowSet = new Set();
    try {
      const checkInRes = await props.api.get('/api/public/checkins', {
        params: { auftragNr },
      });
      (checkInRes.data?.noShow || []).forEach((key) => noShowSet.add(String(key)));
    } catch {}

    const prefilledRows = [];
    for (const ma of all) {
      const parts = [];
      const maEinsatzIds = einsatzIdsByPersonalNr.get(ma.personalNr) || [];
      const isNoShow =
        noShowSet.has(String(ma.personalNr)) ||
        maEinsatzIds.some((id) => noShowSet.has(id));
      if (isNoShow) parts.push('Nicht erschienen');
      try {
        const raw = localStorage.getItem(`maannot_${auftragNr}_${ma.personalNr}`);
        if (raw) {
          const ann = JSON.parse(raw);
          if (ann.verspaetung > 0) parts.push(`Verspätung: ${ann.verspaetung} min`);
        }
      } catch {}
      if (parts.length) {
        prefilledRows.push({
          personalNr: ma.personalNr,
          name: maDisplayName(ma),
          text: parts.join('\n'),
        });
      }
    }
    if (prefilledRows.length) {
      mitarbeiterRows.value = prefilledRows;
    }

    try {
      const jobNote = localStorage.getItem(`jobnote_${auftragNr}`);
      if (jobNote && jobNote.trim()) {
        form.notizen = jobNote.trim();
      }
    } catch {}
  } catch {
    einsatzMitarbeiter.value = [];
  }
}

async function prefillFromEinsatz(einsatz) {
  form.notizen = '';
  form.auftragnummer = String(einsatz.auftragNr || '');
  form.datum = einsatz.datumVon ? new Date(einsatz.datumVon).toISOString().split('T')[0] : '';
  const location = einsatz.auftrag?.locationV2;
  const orderLocation = {
    locationV2: location?._id ? String(location._id) : '',
    location: location?.nameFull || '',
  };
  Object.assign(form, orderLocation);
  form.kunde = einsatz.auftrag?.eventTitel || einsatz.bezeichnung || '';
  await loadEinsatzMitarbeiter(einsatz.auftragNr);
  return orderLocation;
}

async function applyEinsatz(einsatz) {
  selectedEinsatzId.value = einsatz._id;
  const orderLocation = await prefillFromEinsatz(einsatz);
  try {
    const raw = localStorage.getItem(draftKeyFor(einsatz._id));
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft?.form) {
        Object.assign(form, draft.form);
        if (Array.isArray(draft.mitarbeiterRows) && draft.mitarbeiterRows.length) {
          mitarbeiterRows.value = draft.mitarbeiterRows;
        }
      }
    }
  } catch {}
  Object.assign(form, orderLocation);
}

async function onSelectEinsatz(einsatzId) {
  const einsatz = selectableEinsaetze.value.find((e) => String(e._id) === String(einsatzId));
  if (!einsatz || String(einsatz._id) === String(selectedEinsatzId.value)) return;
  flushCurrentDraft();
  await rebuild(async () => {
    resetFormFields();
    await applyEinsatz(einsatz);
  });
}

watch(
  () => [props.mode, props.prefillEinsatz?._id],
  async ([mode]) => {
    if (mode !== 'form') return;
    await rebuild(async () => {
      resetFormFields();
      selectedEinsatzId.value = '';
      if (props.prefillEinsatz) {
        const target =
          selectableEinsaetze.value.find((e) => String(e._id) === String(props.prefillEinsatz._id)) ||
          props.prefillEinsatz;
        await applyEinsatz(target);
      }
    });
  },
  { immediate: true }
);

watch(
  [() => ({ ...form }), mitarbeiterRows, selectedEinsatzId],
  () => {
    if (!draftReady.value || props.mode !== 'form') return;
    const key = draftKey();
    if (key && formHasUserContent()) {
      try {
        localStorage.setItem(key, JSON.stringify(draftPayload()));
      } catch {}
    }
  },
  { deep: true }
);

watch(
  () => form.notizen,
  (val) => {
    if (!form.auftragnummer) return;
    try {
      if (val && val.trim()) {
        localStorage.setItem(`jobnote_${form.auftragnummer}`, val.trim());
      } else {
        localStorage.removeItem(`jobnote_${form.auftragnummer}`);
      }
    } catch {}
  }
);

async function submitReport() {
  if (submitting.value || !selectedEinsatzId.value) return;
  submitting.value = true;
  submitError.value = '';
  try {
    const feedbackPayload = mitarbeiterRows.value
      .filter((r) => r.text.trim())
      .map((r) => ({ personalNr: r.personalNr, name: r.name, text: r.text.trim() }));

    if (selectedFiles.value.length > 0) {
      const fd = new FormData();
      fd.append('location', form.location || '');
      fd.append('locationV2', form.locationV2 || '');
      fd.append('kunde', form.kunde || '');
      fd.append('auftragnummer', form.auftragnummer || '');
      fd.append('name_teamleiter', teamleiterName.value || '');
      fd.append('mitarbeiter_anzahl', form.mitarbeiter_anzahl || '');
      fd.append('datum', form.datum || '');
      fd.append('puenktlichkeit', form.puenktlichkeit || '');
      fd.append('erscheinungsbild', form.erscheinungsbild || '');
      fd.append('team', form.team || '');
      fd.append('mitarbeiter_job', !mitarbeiterRows.value.length ? form.mitarbeiter_job || '' : '');
      fd.append('mitarbeiter_feedback', JSON.stringify(feedbackPayload));
      fd.append('feedback_auftraggeber', form.feedback_auftraggeber || '');
      fd.append('sonstiges', form.sonstiges || '');
      fd.append('notizen', form.notizen || '');
      fd.append('ausruestung_fehlt', form.ausruestung_fehlt || '');
      fd.append('teamleiter_email', props.email || '');
      for (const item of selectedFiles.value) {
        fd.append('files', item.file);
      }
      await props.api.post('/api/public/eventreport', fd);
    } else {
      await props.api.post('/api/public/eventreport', {
        location: form.location,
        locationV2: form.locationV2,
        kunde: form.kunde,
        auftragnummer: form.auftragnummer,
        name_teamleiter: teamleiterName.value,
        mitarbeiter_anzahl: form.mitarbeiter_anzahl,
        datum: form.datum,
        puenktlichkeit: form.puenktlichkeit,
        erscheinungsbild: form.erscheinungsbild,
        team: form.team,
        mitarbeiter_job: !mitarbeiterRows.value.length ? form.mitarbeiter_job : '',
        mitarbeiter_feedback: feedbackPayload,
        feedback_auftraggeber: form.feedback_auftraggeber,
        sonstiges: form.sonstiges,
        notizen: form.notizen,
        ausruestung_fehlt: form.ausruestung_fehlt,
        teamleiter_email: props.email,
      });
    }

    const key = draftKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    clearSelectedFiles();
    emit('submitted');
    try {
      await showToast({ text: 'Event Report eingereicht!', intent: 'success', duration: 2500 });
    } catch {}
  } catch (err) {
    submitError.value = err.response?.data?.msg || err.message || 'Fehler beim Absenden.';
  } finally {
    submitting.value = false;
  }
}

function getReportDescription(report) {
  const parts = [];
  if (report.location) parts.push(report.location);
  const dateStr = formatDate(report.datum);
  if (dateStr && dateStr !== '—') parts.push(dateStr);
  return parts.join(' · ') || 'Event Report';
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }) === now.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })) {
    return 'Heute';
  }
  return dt.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
</script>

<style scoped>
.job-hero { padding:1rem 0 1.2rem; border-bottom:3px solid var(--primary); }
.job-hero.compact { padding-top:.35rem; }
.date-kicker { color:var(--primary); font-size:.72rem; font-weight:800; text-transform:uppercase; }
.job-hero h2 { margin:.35rem 0 .2rem; font-size:1.65rem; }
.job-hero p { color:var(--muted); }
.sticky-action { margin-top:1rem; }
.detail-list { margin-top:.4rem; }
.detail-row { display:grid; grid-template-columns:110px minmax(0,1fr); gap:1rem; padding:.75rem 0; border-bottom:1px solid var(--border); font-size:.82rem; }
.detail-row span { color:var(--muted); }
.section-heading > span { display:grid; width:24px; height:24px; place-items:center; border-radius:50%; background:var(--primary); color:white; font-size:.7rem; font-weight:700; }
.status-panel { display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:46px; padding:.5rem .85rem; border:1px solid var(--dev-green, #157f5b); border-radius:6px; color:var(--dev-green, #157f5b); font-size:.85rem; text-align:center; }
.er-success-banner { margin-top:1rem; }

.personal-data-form { display:grid; gap:.85rem; }
.personal-data-form > label,
.er-grid-two > label { display:grid; gap:.35rem; color:var(--muted); font-size:.78rem; }
.personal-data-form input,
.personal-data-form select,
.personal-data-form textarea {
  width:100%;
  box-sizing:border-box;
  padding:.65rem;
  border:1px solid var(--border);
  border-radius:4px;
  background:var(--surface);
  color:var(--text);
  font:inherit;
}
.personal-data-form input,
.personal-data-form select { min-height:44px; }
.personal-data-form textarea { resize:vertical; min-height:76px; }
.readonly-input { opacity:.75; cursor:default; }
.personal-data-error { color:var(--dev-red, #b84235); }

.er-grid-two { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }
@media (max-width:460px) {
  .er-grid-two { grid-template-columns:1fr; }
}

.segmented-control { display:flex; gap:.4rem; flex-wrap:wrap; }
.segmented-control button {
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  gap:.4rem;
  min-height:36px;
  padding:.45rem .75rem;
  border:1px solid var(--border);
  border-radius:6px;
  background:transparent;
  color:var(--muted);
  font-size:.78rem;
  font-weight:600;
  cursor:pointer;
}
.segmented-control button.active {
  border-color:var(--primary);
  color:var(--primary);
  background:color-mix(in srgb, var(--primary) 10%, transparent);
}

.er-quick-preview {
  padding:.65rem .8rem;
  border-left:3px solid var(--primary);
  background:var(--panel);
  color:var(--muted);
  font-size:.78rem;
  line-height:1.4;
  white-space:pre-wrap;
}
.er-quick-preview strong { color:var(--text); }
.er-quick-preview--warning { border-left-color:#c27a16; }

.er-ma-section { display:grid; gap:.5rem; }
.er-field-label { color:var(--muted); font-size:.78rem; }
.er-ma-rows { display:grid; gap:.65rem; }
.er-ma-row {
  display:grid;
  gap:.35rem;
}
.er-ma-row-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.5rem;
  font-size:.78rem;
  color:var(--muted);
}
.er-ma-row-header strong {
  color:var(--text);
  font-weight:600;
}
.er-ma-row-remove {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:26px;
  height:26px;
  border:0;
  border-radius:6px;
  background:transparent;
  color:var(--muted);
  cursor:pointer;
}
.er-ma-row-remove:hover { color:var(--dev-red, #b84235); }

.er-file-input-hidden { display:none; }
.er-file-list { display:grid; gap:.45rem; }
.er-file-item {
  display:flex;
  align-items:center;
  gap:.65rem;
  padding:.55rem .7rem;
  border:1px solid var(--border);
  border-radius:6px;
  background:var(--panel);
}
.er-file-thumb { width:36px; height:36px; border-radius:4px; object-fit:cover; flex-shrink:0; }
.er-file-icon {
  display:grid;
  width:36px;
  height:36px;
  place-items:center;
  border-radius:4px;
  background:var(--surface);
  color:var(--primary);
  flex-shrink:0;
}
.er-file-info { display:grid; flex:1; min-width:0; gap:.1rem; }
.er-file-info strong { font-size:.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.er-file-info small { color:var(--muted); font-size:.7rem; }

.er-detail-blocks { display:grid; gap:.75rem; margin-top:1rem; }
.er-detail-card {
  padding:.85rem 1rem;
  border:1px solid var(--border);
  border-radius:8px;
  background:var(--panel);
}
.er-detail-card--warning { border-left:3px solid #c27a16; }
.er-detail-label {
  display:block;
  margin-bottom:.35rem;
  color:var(--primary);
  font-size:.7rem;
  font-weight:800;
  text-transform:uppercase;
}
.er-detail-card p { margin:0; font-size:.84rem; line-height:1.5; white-space:pre-wrap; }
.er-detail-ma-list { display:grid; gap:.6rem; margin-top:.35rem; }
.er-detail-ma-item {
  padding-top:.55rem;
  border-top:1px solid var(--border);
}
.er-detail-ma-item:first-child { padding-top:0; border-top:0; }
.er-detail-ma-item strong { display:block; margin-bottom:.2rem; font-size:.82rem; }
.er-comment-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.5rem;
  margin-bottom:.3rem;
  font-size:.76rem;
}
.er-comment-header span { color:var(--muted); }

.job-decision-actions { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; margin-top:.4rem; }
.job-decision-actions button { width:100%; }

.er-modal-title { margin:0 0 .65rem; font-size:1.05rem; }
.er-modal-textarea {
  width:100%;
  box-sizing:border-box;
  margin-bottom:.75rem;
  padding:.65rem;
  border:1px solid var(--border);
  border-radius:6px;
  background:var(--surface);
  color:var(--text);
  font:inherit;
  resize:vertical;
}
</style>
