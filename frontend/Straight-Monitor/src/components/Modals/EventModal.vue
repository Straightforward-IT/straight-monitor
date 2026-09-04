<template>
  <ModalFrame
    :model-value="true"
    :title="modalTitle"
    subtitle="Disposition · Auftrag, Schichten und Personal in einem Ablauf"
    size="full"
    :minimizable="minimizable"
    :minimize-id="minimizeId"
    :minimize-title="minimizeTitle || modalTitle"
    :close-on-escape="closeOnEscape"
    :layer="layer"
    class="event-wizard-frame"
    style="--mf-max-width: min(1480px, 98vw); --mf-max-height: 96dvh; --mf-body-padding: 0; --mf-body-overflow: hidden"
    @close="emit('close')"
  >
    <template #actions>
      <span v-if="event" class="wizard-state" :class="event.auftStatus === 2 ? 'confirmed' : 'draft'">
        {{ event.auftStatus === 2 ? 'Bestätigt' : 'Entwurf' }} · #{{ event.auftragNr }}
      </span>
      <span v-if="statusMessage" class="save-state">{{ statusMessage }}</span>
    </template>

    <div v-if="loading && !event" class="wizard-loading">Auftrag wird geladen …</div>
    <div v-else class="wizard-shell">
      <nav class="wizard-steps" aria-label="Auftragsschritte">
        <button
          v-for="(step, index) in steps"
          :key="step.id"
          type="button"
          :disabled="!event && index > 0"
          :class="{ active: currentStep === index, done: event && index < Math.max(currentStep, event.wizardStep || 0) }"
          @click="goToStep(index)"
        >
          <span>{{ index + 1 }}</span>
          <div><strong>{{ step.label }}</strong><small>{{ step.hint }}</small></div>
        </button>
      </nav>

      <main class="wizard-content">
        <p v-if="errorMessage" class="wizard-error">{{ errorMessage }}</p>

        <section v-if="currentStep === 0" class="wizard-page">
          <header class="page-heading">
            <div><span class="eyebrow">Schritt 1</span><h3>Was soll disponiert werden?</h3><p>Die Kerndaten legen Zeitraum, Standort und Kundenkontext für alle weiteren Vorschläge fest.</p></div>
          </header>

          <div v-if="!event" class="order-type">
            <button type="button" :class="{ active: !form.isPseudo }" @click="form.isPseudo = false"><strong>Regulärer Auftrag</strong><small>Mit Kunde, eigener Auftragsnummer und Einsatzinformationen</small></button>
            <button type="button" :class="{ active: form.isPseudo }" @click="form.isPseudo = true"><strong>Pseudo-Auftrag</strong><small>Automatische 9er-Nummer, Kunde und Einsatzinfo optional</small></button>
          </div>

          <div class="form-grid order-grid">
            <label v-if="!form.isPseudo" class="field"><span>Auftragsnummer *</span><input v-model.number="form.auftragNr" type="number" :disabled="!!event" placeholder="z. B. 412345" /></label>
            <label class="field wide"><span>Titel *</span><input v-model.trim="form.eventTitel" type="text" placeholder="Worum geht es bei diesem Auftrag?" /></label>
            <label class="field"><span>Standort *</span><select v-model="form.locationV2" :disabled="!!event && event.auftStatus === 2"><option value="">Standort wählen</option><option v-for="location in locations" :key="location._id" :value="location._id">{{ location.shortName || location.nameFull }}</option></select></label>
            <label class="field"><span>Von *</span><input v-model="form.vonDatum" type="datetime-local" /></label>
            <label class="field"><span>Bis *</span><input v-model="form.bisDatum" type="datetime-local" /></label>
            <label class="field"><span>Bestelldatum</span><input v-model="form.bestDatum" type="date" /></label>
            <label class="field"><span>Referenz</span><input v-model.trim="form.referenz" type="text" placeholder="Bestellung, PO, Ansprechpartner …" /></label>
            <div class="field wide customer-field">
              <span>Kunde {{ form.isPseudo ? '(optional)' : '*' }}</span>
              <div v-if="selectedCustomer" class="selected-customer"><strong>{{ selectedCustomer.kundName }}</strong><span>{{ selectedCustomer.kuerzel || `Kunde ${selectedCustomer.kundenNr}` }}</span><button type="button" @click="selectCustomer(null)">Ändern</button></div>
              <KundeSearch v-else :location-v2="form.locationV2 || null" placeholder="Kunde nach Name, Nummer oder Kürzel suchen …" @select="selectCustomer" />
              <div v-if="recentCustomers.length" class="suggestion-row"><span>Zuletzt an diesem Standort</span><button v-for="customer in recentCustomers" :key="customer._id" type="button" @click="selectCustomer(customer)">{{ customer.kuerzel || customer.kundName }}</button></div>
            </div>
            <div class="field wide"><span>Labels</span><div class="label-editor"><span v-for="(label, index) in form.labels" :key="`${label.name}-${index}`" class="order-label" :style="{ '--label-color': label.color }">{{ label.name }}<button type="button" @click="form.labels.splice(index, 1)">×</button></span><input v-model.trim="labelDraft" maxlength="20" placeholder="Label hinzufügen" @keydown.enter.prevent="addLabel" /><button type="button" @click="addLabel">+</button></div></div>
          </div>
        </section>

        <section v-else-if="currentStep === 1" class="wizard-page">
          <header class="page-heading split"><div><span class="eyebrow">Schritt 2</span><h3>Wo findet der Einsatz statt?</h3><p>Die Adresse wird als stabiler Snapshot im Auftrag gespeichert.</p></div><button v-if="selectedCustomer" class="secondary-button" type="button" @click="showSiteModal = true">+ Einsatzort anlegen</button></header>
          <div v-if="selectedCustomer" class="site-layout">
            <div class="site-list">
              <button v-for="site in sites" :key="site._id" type="button" class="site-card" :class="{ active: form.einsatzort === site._id }" @click="selectSite(site)"><span class="site-pin">⌖</span><div><small>{{ recentSiteIds.has(site._id) ? 'Zuletzt verwendet' : 'Einsatzort' }}</small><strong>{{ site.bezeichnung }}</strong><span>{{ siteAddress(site) }}</span></div><b>{{ form.einsatzort === site._id ? '✓' : '›' }}</b></button>
              <p v-if="!sites.length" class="empty-state">Noch keine Einsatzorte für diesen Kunden vorhanden.</p>
            </div>
            <button type="button" class="one-off-toggle" :class="{ active: oneOffAddress }" @click="enableOneOffAddress"><span>＋</span><div><strong>Einmalige Auftragsadresse</strong><small>Nur für diesen Auftrag, ohne neuen Stammdaten-Einsatzort</small></div></button>
          </div>
          <div v-else class="empty-state prominent">{{ form.isPseudo ? 'Optional: Gib eine einmalige Adresse für den Pseudo-Auftrag ein.' : 'Bitte zuerst im Schritt „Auftrag“ einen Kunden auswählen.' }}</div>
          <div v-if="oneOffAddress || (!selectedCustomer && form.isPseudo)" class="address-panel">
            <h4>Einmalige Adresse</h4>
            <div class="form-grid"><label class="field wide"><span>Bezeichnung</span><input v-model.trim="form.eventLocation" /></label><label class="field wide"><span>Straße</span><input v-model.trim="form.eventStrasse" /></label><label class="field"><span>PLZ</span><input v-model.trim="form.eventPlz" /></label><label class="field"><span>Ort</span><input v-model.trim="form.eventOrt" /></label></div>
          </div>
          <EinsatzortFormModal v-if="showSiteModal" :kunden-nr="form.kundenNr" @close="showSiteModal = false" @saved="siteCreated" />
        </section>

        <section v-else-if="currentStep === 2" class="wizard-page shifts-page">
          <header class="page-heading split"><div><span class="eyebrow">Schritt 3</span><h3>Schichten & Einsatzinformationen</h3><p>Jede Schicht ist eigenständig planbar und erhält ihren eingefrorenen Informationstext.</p></div><button class="primary-button" type="button" @click="addShift">+ Schicht hinzufügen</button></header>
          <div v-if="recentShiftPatterns.length" class="pattern-strip"><span>Letzte Schichten übernehmen</span><button v-for="pattern in recentShiftPatterns.slice(0, 6)" :key="pattern._id" type="button" @click="addShiftFromPattern(pattern)">{{ pattern.bezeichnung || 'Schicht' }} · {{ shortTime(pattern.uhrzeitVon) }}</button></div>
          <div class="shift-stack">
            <article v-for="(shift, index) in shifts" :key="shift._id || shift._localId" class="shift-card">
              <header><div class="shift-number">{{ index + 1 }}</div><div><span>Schicht {{ index + 1 }}</span><strong>{{ shift.bezeichnung || 'Neue Schicht' }}</strong></div><div class="shift-actions"><button type="button" title="Duplizieren" @click="duplicateShift(shift)">Duplizieren</button><button type="button" title="Auf Folgetage wiederholen" @click="repeatShift(shift)">Wiederholen</button><button class="danger-link" type="button" @click="removeShift(shift)">Löschen</button></div></header>
              <div class="form-grid shift-grid">
                <label class="field wide"><span>Bezeichnung *</span><input v-model.trim="shift.bezeichnung" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Datum</span><input v-model="shift.datumVon" type="date" @input="syncShiftEndDate(shift)" /></label>
                <label class="field"><span>Bis Datum</span><input v-model="shift.datumBis" type="date" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Von</span><input v-model="shift.uhrzeitVon" type="time" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Bis</span><input v-model="shift.uhrzeitBis" type="time" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Bedarf</span><input v-model.number="shift.bedarf" type="number" min="0" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Garantiestunden</span><input v-model.number="shift.garantiestundenLohn" type="number" min="0" step="0.25" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Beruf</span><select v-model="shift.berufSchl" @change="classificationChanged(shift)"><option value="">Kein Beruf</option><option v-for="job in berufe" :key="job._id" :value="String(job.jobKey)">{{ job.jobKey }} · {{ job.designation }}</option></select></label>
                <label class="field"><span>Qualifikation</span><select v-model="shift.qualSchl" @change="classificationChanged(shift)"><option value="">Keine Qualifikation</option><option v-for="qualification in qualifikationen" :key="qualification._id" :value="String(qualification.qualificationKey)">{{ qualification.qualificationKey }} · {{ qualification.designation }}</option></select></label>
                <label class="field"><span>Treffpunkt-Zeit</span><input v-model="shift.treffpunkt" type="time" @input="markShiftDirty(shift)" /></label>
                <label class="field wide"><span>Treffpunkt-Ort</span><input v-model.trim="shift.treffpunktOrt" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Ansprechpartner</span><input v-model.trim="shift.ansprechpartnerName" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>Telefon</span><input v-model.trim="shift.ansprechpartnerTelefon" @input="markShiftDirty(shift)" /></label>
                <label class="field"><span>E-Mail</span><input v-model.trim="shift.ansprechpartnerEmail" type="email" @input="markShiftDirty(shift)" /></label>
              </div>
              <div class="info-editor-head"><div><span class="eyebrow">Public Monitor</span><h4>Einsatzinformationen</h4></div><div><span v-if="shift.einsatzinformation?.templateVersion" class="template-version">Snapshot V{{ shift.einsatzinformation.templateVersion }}</span><button v-if="shift._id" type="button" @click="applyLatestTemplate(shift)">Neueste Vorlage anwenden</button></div></div>
              <div v-if="shift.templateSuggestion" class="template-suggestion"><span>Für Beruf oder Qualifikation ist eine passendere Vorlage verfügbar.</span><button type="button" @click="applyResolvedTemplate(shift, true)">Passende Vorlage übernehmen?</button></div>
              <RichTextTemplateEditor :model-value="shift.infoSource" :textmarks="textmarks" :preview-html="shift.infoPreview" :unresolved="shift.infoUnresolved" @update:model-value="setShiftInformation(shift, $event)" @change="previewShiftInformation(shift)" />
              <footer><span>{{ shift._dirty ? 'Ungespeicherte Änderungen' : shift._id ? 'Gespeichert' : 'Noch nicht gespeichert' }}</span><button class="secondary-button" type="button" :disabled="savingShiftId === (shift._id || shift._localId)" @click="saveOneShift(shift)">{{ savingShiftId === (shift._id || shift._localId) ? 'Speichert …' : 'Schicht speichern' }}</button></footer>
            </article>
            <button v-if="!shifts.length" type="button" class="empty-shift" @click="addShift"><strong>Erste Schicht anlegen</strong><span>Zeiten, Bedarf, Beruf und Einsatzinformationen gemeinsam erfassen</span></button>
          </div>
        </section>

        <section v-else-if="currentStep === 3" class="wizard-page staffing-page">
          <header class="page-heading split"><div><span class="eyebrow">Schritt 4</span><h3>Personal planen</h3><p>Vorschläge verbinden Verfügbarkeit, fachliche Passung, Kundenhistorie und Standort.</p></div><label class="location-toggle"><input v-model="includeOtherLocations" type="checkbox" @change="loadCandidates" /> Weitere freigegebene Standorte</label></header>
          <div class="staffing-layout">
            <aside class="staff-shifts"><button v-for="shift in shifts" :key="shift._id" type="button" :class="{ active: selectedShiftId === shift._id }" @click="selectPlanningShift(shift)" @dragover.prevent @drop.prevent="dropCandidateOnShift(shift)"><span>{{ formatDate(shift.datumVon) }} · {{ shortTime(shift.uhrzeitVon) }}</span><strong>{{ shift.bezeichnung }}</strong><small>{{ assignmentsForShift(shift).length }} / {{ shift.bedarf || 0 }} eingeplant</small></button></aside>
            <div v-if="planningShift" class="candidate-panel" @dragover.prevent @drop="dropCandidate">
              <div class="planning-summary"><div><span>Aktive Schicht</span><strong>{{ planningShift.bezeichnung }}</strong><small>{{ formatDate(planningShift.datumVon) }} · {{ shortTime(planningShift.uhrzeitVon) }}–{{ shortTime(planningShift.uhrzeitBis) }}</small></div><b :class="{ full: assignmentsForShift(planningShift).length >= planningShift.bedarf }">{{ assignmentsForShift(planningShift).length }} / {{ planningShift.bedarf || 0 }}</b></div>
              <div v-if="currentAssignments.length" class="planned-strip"><article v-for="assignment in currentAssignments" :key="assignment._id"><div><strong>{{ assignment.mitarbeiterData ? `${assignment.mitarbeiterData.vorname} ${assignment.mitarbeiterData.nachname}` : `Personal ${assignment.personalNr}` }}</strong><small v-if="assignment.conflictOverride?.confirmed">Konflikt bestätigt: {{ assignment.conflictOverride.reason }}</small></div><button type="button" @click="removeAssignment(assignment)">Entfernen</button></article></div>
              <div class="candidate-toolbar"><div><button v-for="group in candidateGroups" :key="group.id" type="button" :class="{ active: candidateFilter === group.id }" @click="candidateFilter = group.id">{{ group.label }} <b>{{ group.count }}</b></button></div><button type="button" :disabled="!selectedCandidateIds.size" @click="assignSelectedCandidates">{{ selectedCandidateIds.size }} ausgewählte einplanen</button></div>
              <div v-if="candidateLoading" class="empty-state">Verfügbarkeiten und Konflikte werden geprüft …</div>
              <div v-else class="candidate-list">
                <article v-for="candidate in filteredCandidates" :key="candidate._id" class="candidate-card" :class="candidate.status" draggable="true" @dragstart="dragCandidateId = candidate._id"><input type="checkbox" :checked="selectedCandidateIds.has(candidate._id)" @change="toggleCandidate(candidate._id)" /><div class="candidate-avatar">{{ initials(candidate) }}</div><div class="candidate-body"><div><strong>{{ candidate.vorname }} {{ candidate.nachname }}</strong><span>{{ candidate.status === 'recommended' ? 'Empfohlen' : candidate.status === 'possible' ? 'Möglich' : 'Konflikt' }}</span></div><p><span v-for="reason in candidate.reasons" :key="reason">✓ {{ reason }}</span><span v-for="warning in candidate.warnings" :key="warning">△ {{ warning }}</span><span v-for="conflict in candidate.conflicts" :key="conflict.label" class="conflict">! {{ conflict.label }}</span></p><div class="mini-dispo"><i v-for="day in dispoDays" :key="day" :class="dispoTone(candidate, day)" :title="day">{{ day.slice(8) }}</i></div></div><button type="button" @click="assignCandidate(candidate)">Einplanen</button></article>
                <p v-if="!filteredCandidates.length" class="empty-state">Keine Mitarbeitenden in dieser Auswahl.</p>
              </div>
            </div>
            <div v-else class="empty-state prominent">Speichere zuerst mindestens eine Schicht.</div>
          </div>
        </section>

        <section v-else class="wizard-page review-page">
          <header class="page-heading"><div><span class="eyebrow">Schritt 5</span><h3>Prüfen & freigeben</h3><p>Offener Personalbedarf ist sichtbar, verhindert die Freigabe aber nicht.</p></div></header>
          <div class="review-grid">
            <article><span>Auftrag</span><h4>{{ form.eventTitel }}</h4><dl><div><dt>Nummer</dt><dd>#{{ event.auftragNr }}</dd></div><div><dt>Typ</dt><dd>{{ form.isPseudo ? 'Pseudo-Auftrag' : 'Regulär' }}</dd></div><div><dt>Kunde</dt><dd>{{ selectedCustomer?.kundName || 'Kein Kunde' }}</dd></div><div><dt>Zeitraum</dt><dd>{{ formatDateTime(form.vonDatum) }} – {{ formatDateTime(form.bisDatum) }}</dd></div></dl><button type="button" @click="currentStep = 0">Bearbeiten</button></article>
            <article><span>Einsatzort</span><h4>{{ form.eventLocation || selectedSite?.bezeichnung || 'Nicht gewählt' }}</h4><p>{{ [form.eventStrasse, [form.eventPlz, form.eventOrt].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}</p><button type="button" @click="currentStep = 1">Bearbeiten</button></article>
            <article class="wide"><span>Schichten & Besetzung</span><div class="review-shifts"><div v-for="shift in shifts" :key="shift._id"><strong>{{ shift.bezeichnung }}</strong><span>{{ formatDate(shift.datumVon) }} · {{ shortTime(shift.uhrzeitVon) }}–{{ shortTime(shift.uhrzeitBis) }}</span><b>{{ assignmentsForShift(shift).length }} / {{ shift.bedarf || 0 }}</b><small :class="{ invalid: !shift.infoSource || shift.infoUnresolved?.length }">{{ shift.infoSource ? shift.infoUnresolved?.length ? `${shift.infoUnresolved.length} Textmarke(n) ohne Wert` : 'Einsatzinformation vollständig' : form.isPseudo ? 'Ohne Einsatzinformation zulässig' : 'Einsatzinformation fehlt' }}</small></div></div><button type="button" @click="currentStep = 2">Schichten bearbeiten</button></article>
          </div>
          <div v-if="releaseErrors.length" class="release-errors"><strong>Vor der Freigabe noch prüfen</strong><button v-for="item in releaseErrors" :key="`${item.step}-${item.field}`" type="button" @click="currentStep = item.step"><span>Schritt {{ item.step + 1 }}</span>{{ item.message }}</button></div>
          <div class="release-callout"><div><span>Bereit für die Disposition?</span><strong>{{ openDemand }} offene Positionen</strong><small>Der Auftrag kann trotzdem bestätigt werden.</small></div><button class="release-button" type="button" :disabled="pending" @click="releaseOrder">Auftrag freigeben</button></div>
        </section>
      </main>

      <footer class="wizard-footer"><button type="button" class="text-button" :disabled="pending" @click="emit('close')">Schließen</button><span></span><button v-if="currentStep > 0" type="button" class="secondary-button" :disabled="pending" @click="currentStep--">Zurück</button><button type="button" class="secondary-button" :disabled="pending" @click="saveCurrentStep(false)">{{ pending ? 'Speichert …' : currentStep === 3 ? 'Planung speichern' : event ? 'Entwurf speichern' : 'Entwurf anlegen' }}</button><button v-if="currentStep < 4" type="button" class="primary-button" :disabled="pending" @click="saveCurrentStep(true)">{{ event || currentStep ? 'Speichern & weiter' : 'Entwurf anlegen & weiter' }}</button><button v-else type="button" class="primary-button" :disabled="pending" @click="releaseOrder">Auftrag freigeben</button></footer>
    </div>
  </ModalFrame>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import EinsatzortFormModal from '@/components/Modals/EinsatzortFormModal.vue';
import KundeSearch from '@/components/ui-elements/KundeSearch.vue';
import RichTextTemplateEditor from '@/components/ui-elements/RichTextTemplateEditor.vue';
import { useAuth } from '@/stores/auth';
import api from '@/utils/api';

const props = defineProps({
  auftragNr: { type: [String, Number], default: null },
  initialPseudo: { type: Boolean, default: false },
  initialLocationV2: { type: String, default: '' },
  minimizable: { type: Boolean, default: true },
  minimizeId: { type: String, default: '' },
  minimizeTitle: { type: String, default: '' },
  closeOnEscape: { type: Boolean, default: false },
  layer: { type: String, default: 'base' },
});
const emit = defineEmits(['close', 'updated']);
const auth = useAuth();
const steps = [
  { id: 'order', label: 'Auftrag', hint: 'Kerndaten' },
  { id: 'site', label: 'Einsatzort', hint: 'Adresse' },
  { id: 'shifts', label: 'Schichten', hint: 'Bedarf & Infos' },
  { id: 'staffing', label: 'Personal', hint: 'Verfügbarkeit' },
  { id: 'review', label: 'Prüfen', hint: 'Freigabe' },
];

const now = new Date();
const later = new Date(now.getTime() + 8 * 60 * 60 * 1000);
const toLocalDateTime = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toDate = value => value ? toLocalDateTime(value).slice(0, 10) : '';
const addDays = (value, count) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + count); return toDate(date); };

const event = ref(null);
const currentStep = ref(0);
const loading = ref(Boolean(props.auftragNr));
const pending = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');
const releaseErrors = ref([]);
const locations = ref([]);
const recentCustomers = ref([]);
const recentShiftPatterns = ref([]);
const sites = ref([]);
const recentSiteIds = ref(new Set());
const shifts = ref([]);
const assignments = ref([]);
const berufe = ref([]);
const qualifikationen = ref([]);
const placeholders = ref({});
const selectedCustomer = ref(null);
const oneOffAddress = ref(false);
const showSiteModal = ref(false);
const labelDraft = ref('');
const savingShiftId = ref(null);
const selectedShiftId = ref('');
const candidates = ref([]);
const candidateLoading = ref(false);
const candidateFilter = ref('recommended');
const selectedCandidateIds = ref(new Set());
const includeOtherLocations = ref(false);
const dragCandidateId = ref('');
const dispoEntries = ref([]);

const form = reactive({
  auftragNr: '', isPseudo: props.initialPseudo, eventTitel: '', locationV2: props.initialLocationV2 || auth.user?.locationV2?._id || auth.user?.locationV2 || '', kundenNr: null,
  vonDatum: toLocalDateTime(now), bisDatum: toLocalDateTime(later), bestDatum: toDate(now), referenz: '', labels: [], einsatzort: '', eventLocation: '', eventStrasse: '', eventPlz: '', eventOrt: '',
});
const modalTitle = computed(() => event.value ? `${event.value.eventTitel || 'Auftrag'} · #${event.value.auftragNr}` : 'Neuen Auftrag anlegen');
const selectedSite = computed(() => sites.value.find(site => site._id === form.einsatzort) || null);
const planningShift = computed(() => shifts.value.find(shift => shift._id === selectedShiftId.value) || shifts.value.find(shift => shift._id) || null);
const currentAssignments = computed(() => planningShift.value ? assignmentsForShift(planningShift.value) : []);
const candidateGroups = computed(() => ['recommended', 'possible', 'conflict'].map(id => ({ id, label: id === 'recommended' ? 'Empfohlen' : id === 'possible' ? 'Möglich' : 'Konflikte', count: candidates.value.filter(candidate => candidate.status === id).length })));
const filteredCandidates = computed(() => candidates.value.filter(candidate => candidate.status === candidateFilter.value));
const textmarks = computed(() => Object.entries(placeholders.value).map(([key, label]) => ({ key, label })));
const openDemand = computed(() => shifts.value.reduce((sum, shift) => sum + Math.max(0, Number(shift.bedarf || 0) - assignmentsForShift(shift).length), 0));
const dispoDays = computed(() => { const start = toDate(form.vonDatum); const end = toDate(form.bisDatum); if (!start || !end) return []; const days = []; for (let index = 0, day = start; day <= end && index < 10; index += 1, day = addDays(day, 1)) days.push(day); return days; });

function hydrate(data) {
  event.value = data;
  Object.assign(form, {
    auftragNr: data.auftragNr, isPseudo: Boolean(data.isPseudo), eventTitel: data.eventTitel || '', locationV2: String(data.locationV2?._id || data.locationV2 || ''), kundenNr: data.kundenNr ?? null,
    vonDatum: toLocalDateTime(data.vonDatum), bisDatum: toLocalDateTime(data.bisDatum), bestDatum: toDate(data.bestDatum), referenz: data.referenz || '', labels: [...(data.labels || [])], einsatzort: String(data.einsatzort?._id || data.einsatzort || ''),
    eventLocation: data.eventLocation || '', eventStrasse: data.eventStrasse || '', eventPlz: data.eventPlz || '', eventOrt: data.eventOrt || '',
  });
  selectedCustomer.value = data.kundeData || selectedCustomer.value;
  oneOffAddress.value = !data.einsatzort && Boolean(data.eventStrasse || data.eventPlz || data.eventOrt);
  shifts.value = (data.schichten || []).map(normalizeShift);
  assignments.value = data.einsaetze || [];
  selectedShiftId.value ||= shifts.value.find(shift => shift._id)?._id || '';
}
function normalizeShift(shift) {
  return { ...shift, datumVon: toDate(shift.datumVon), datumBis: toDate(shift.datumBis || shift.datumVon), berufSchl: shift.berufSchl ? String(shift.berufSchl) : '', qualSchl: shift.qualSchl ? String(shift.qualSchl) : '', infoSource: shift.infoSource ?? shift.einsatzinformation?.sourceHtml ?? '', infoPreview: shift.infoPreview ?? shift.einsatzinformation?.renderedHtml ?? '', infoUnresolved: shift.infoUnresolved ?? shift.einsatzinformation?.unresolvedPlaceholders ?? [], templateSuggestion: false, _dirty: shift._dirty ?? false };
}
function newShift(values = {}) {
  return normalizeShift({ _localId: `shift-${Date.now()}-${Math.random()}`, bezeichnung: '', datumVon: toDate(form.vonDatum), datumBis: toDate(form.vonDatum), uhrzeitVon: form.vonDatum.slice(11, 16), uhrzeitBis: form.bisDatum.slice(11, 16), bedarf: 1, garantiestundenLohn: 0, treffpunkt: '', treffpunktOrt: '', ansprechpartnerName: '', ansprechpartnerTelefon: '', ansprechpartnerEmail: '', ...values, einsatzinformation: values.einsatzinformation || {} , _dirty: true });
}
async function loadBaseData() {
  const [locationsResponse, jobsResponse, qualificationsResponse] = await Promise.all([api.get('/api/locations'), api.get('/api/import/berufe'), api.get('/api/import/qualifikationen')]);
  locations.value = locationsResponse.data || [];
  berufe.value = jobsResponse.data.data || [];
  qualifikationen.value = qualificationsResponse.data.data || [];
  if (!form.locationV2 && locations.value.length === 1) form.locationV2 = locations.value[0]._id;
}
async function loadDetails() {
  if (!props.auftragNr && !event.value?.auftragNr) return;
  loading.value = true;
  try { const { data } = await api.get(`/api/auftraege/${props.auftragNr || event.value.auftragNr}/details`); hydrate(data); await loadSites(); await Promise.all([loadRecentOptions(), loadDispoPreview(), loadPlaceholders()]); }
  catch (error) { errorMessage.value = error.response?.data?.message || 'Auftrag konnte nicht geladen werden.'; }
  finally { loading.value = false; }
}
async function loadRecentOptions() {
  if (!form.locationV2) return;
  try {
    const { data } = await api.get('/api/auftraege/recent-options', { params: { locationV2: form.locationV2, ...(form.kundenNr ? { kundenNr: form.kundenNr } : {}) } });
    recentCustomers.value = data.recentCustomers || [];
    recentShiftPatterns.value = data.recentShiftPatterns || [];
    recentSiteIds.value = new Set((data.recentEinsatzorte || []).map(site => site._id));
    if (data.recentEinsatzorte?.length) { const order = new Map(data.recentEinsatzorte.map((site, index) => [site._id, index])); sites.value.sort((a, b) => (order.get(a._id) ?? 999) - (order.get(b._id) ?? 999)); }
  } catch { recentCustomers.value = []; }
}
async function loadSites() {
  if (!form.kundenNr) { sites.value = []; return; }
  const { data } = await api.get(`/api/kunden/${form.kundenNr}/einsatzorte`);
  sites.value = (data || []).filter(site => site.isActive !== false);
}
async function loadPlaceholders() {
  if (!form.kundenNr) return;
  try { const { data } = await api.get(`/api/kunden/${form.kundenNr}/einsatzinformationen`); placeholders.value = data.placeholders || {}; }
  catch { placeholders.value = {}; }
}

async function selectCustomer(customer) {
  if (customer && selectedCustomer.value?._id === customer._id) return;
  selectedCustomer.value = customer;
  form.kundenNr = customer?.kundenNr ?? null;
  form.einsatzort = ''; oneOffAddress.value = false;
  Object.assign(form, { eventLocation: '', eventStrasse: '', eventPlz: '', eventOrt: '' });
  await Promise.all([loadSites(), loadRecentOptions(), loadPlaceholders()]);
  if (!customer) {
    shifts.value.forEach(shift => {
      if (!shift.einsatzinformation?.customized) {
        shift.infoSource = ''; shift.infoPreview = ''; shift.infoUnresolved = [];
        shift.einsatzinformation = { customized: false }; shift._applyLatestTemplate = true; shift._dirty = true;
      }
    });
    return;
  }
  await Promise.all(shifts.value.map(shift => classificationChanged(shift)));
}
async function selectSite(site) {
  form.einsatzort = site._id; oneOffAddress.value = false;
  Object.assign(form, { eventLocation: site.bezeichnung || site.adresse?.name || '', eventStrasse: site.adresse?.strasse || '', eventPlz: site.adresse?.plz || '', eventOrt: site.adresse?.ort || '' });
  await Promise.all(shifts.value.map(shift => classificationChanged(shift)));
}
async function enableOneOffAddress() { oneOffAddress.value = true; form.einsatzort = ''; await Promise.all(shifts.value.map(shift => classificationChanged(shift))); }
async function siteCreated(site) { showSiteModal.value = false; await loadSites(); selectSite(site); }
function siteAddress(site) { return [site.adresse?.strasse, [site.adresse?.plz, site.adresse?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Keine Adresse'; }
function addLabel() { if (!labelDraft.value || form.labels.some(label => label.name.toLowerCase() === labelDraft.value.toLowerCase())) return; form.labels.push({ name: labelDraft.value, color: '#2563eb' }); labelDraft.value = ''; }

function orderPayload(includeCreationFields = false) { return { ...(includeCreationFields ? { auftragNr: form.auftragNr, isPseudo: form.isPseudo } : {}), eventTitel: form.eventTitel, locationV2: form.locationV2, kundenNr: form.kundenNr, vonDatum: form.vonDatum, bisDatum: form.bisDatum, bestDatum: form.bestDatum || null, referenz: form.referenz, labels: form.labels }; }
async function saveOrder() {
  if (!form.eventTitel || !form.locationV2 || !form.vonDatum || !form.bisDatum || (!form.isPseudo && (!form.auftragNr || !form.kundenNr))) throw new Error('Bitte Titel, Standort, Zeitraum, Auftragsnummer und Kunde vollständig angeben.');
  const response = event.value
    ? await api.patch(`/api/auftraege/${event.value.auftragNr}`, orderPayload(false))
    : await api.post('/api/auftraege', orderPayload(true));
  if (event.value) Object.assign(event.value, response.data); else event.value = response.data;
  event.value.kundeData = selectedCustomer.value;
  form.auftragNr = event.value.auftragNr;
  await Promise.all(shifts.value.filter(shift => shift.infoSource).map(shift => previewShiftInformation(shift)));
  emitUpdated();
}
async function saveSite() {
  // Freie Step-Navigation darf keine geänderten Kunden- oder Standortdaten
  // mit einem veralteten serverseitigen Auftragskontext kombinieren.
  await saveOrder();
  if (!form.isPseudo && !form.einsatzort && !(form.eventStrasse && form.eventPlz && form.eventOrt)) throw new Error('Bitte einen Einsatzort oder eine vollständige einmalige Adresse wählen.');
  const { data } = await api.patch(`/api/auftraege/${event.value.auftragNr}`, { einsatzort: form.einsatzort || null, eventLocation: form.eventLocation, eventStrasse: form.eventStrasse, eventPlz: form.eventPlz, eventOrt: form.eventOrt, wizardStep: 1 });
  Object.assign(event.value, data); emitUpdated();
}

function addShift() { const shift = newShift(); shifts.value.push(shift); applyResolvedTemplate(shift); }
function addShiftFromPattern(pattern) { shifts.value.push(newShift({ ...pattern, _id: undefined, datumVon: toDate(form.vonDatum), datumBis: toDate(form.vonDatum), einsatzinformation: {} })); }
function duplicateShift(shift) { shifts.value.push(newShift({ ...shift, _id: undefined, _localId: undefined, bezeichnung: `${shift.bezeichnung} – Kopie`, einsatzinformation: {}, infoSource: shift.infoSource, infoPreview: shift.infoPreview, infoUnresolved: [...(shift.infoUnresolved || [])] })); }
function repeatShift(shift) { const count = Math.min(30, Math.max(1, Number(window.prompt('Für wie viele weitere Tage wiederholen?', '1')) || 0)); for (let day = 1; day <= count; day += 1) shifts.value.push(newShift({ ...shift, _id: undefined, _localId: undefined, datumVon: addDays(shift.datumVon, day), datumBis: addDays(shift.datumBis || shift.datumVon, day), einsatzinformation: {}, infoSource: shift.infoSource })); }
async function removeShift(shift) { if (shift._id && !window.confirm('Schicht und ihre Einplanungen löschen?')) return; if (shift._id) await api.delete(`/api/auftraege/${event.value.auftragNr}/schichten/${shift._id}`); shifts.value = shifts.value.filter(item => item !== shift); assignments.value = assignments.value.filter(item => String(item.schicht?._id || item.schicht) !== String(shift._id)); }
function markShiftDirty(shift) { shift._dirty = true; }
function syncShiftEndDate(shift) { if (!shift.datumBis || shift.datumBis < shift.datumVon) shift.datumBis = shift.datumVon; markShiftDirty(shift); previewShiftInformation(shift); }
function setShiftInformation(shift, value) { shift.infoSource = value; shift.einsatzinformation ||= {}; shift.einsatzinformation.customized = true; shift.templateSuggestion = false; markShiftDirty(shift); }
function jobId(shift) { return berufe.value.find(job => String(job.jobKey) === String(shift.berufSchl))?._id || null; }
function qualificationId(shift) { return qualifikationen.value.find(item => String(item.qualificationKey) === String(shift.qualSchl))?._id || null; }
function templateResolveParams(shift) { return form.einsatzort ? { einsatzortId: form.einsatzort, berufId: jobId(shift), qualifikationId: qualificationId(shift) } : {}; }
async function fetchResolvedTemplate(shift) {
  if (!form.kundenNr) return { template: null, resolution: null };
  const { data } = await api.get(`/api/kunden/${form.kundenNr}/einsatzinformationen/resolve`, { params: templateResolveParams(shift) });
  return data;
}
async function classificationChanged(shift) {
  markShiftDirty(shift);
  if (shift.einsatzinformation?.customized || shift.infoSource && !shift.einsatzinformation?.template) {
    try { const data = await fetchResolvedTemplate(shift); shift.templateSuggestion = Boolean(data.template); } catch { shift.templateSuggestion = false; }
    return previewShiftInformation(shift);
  }
  await applyResolvedTemplate(shift);
}
async function applyResolvedTemplate(shift, confirmed = false) {
  if (!form.kundenNr) return;
  try {
    const data = await fetchResolvedTemplate(shift);
    if (!data.template) {
      if (!shift.einsatzinformation?.customized) {
        shift.infoSource = ''; shift.infoPreview = ''; shift.infoUnresolved = [];
        shift.einsatzinformation = { customized: false }; shift.templateSuggestion = false;
        shift._applyLatestTemplate = true; shift._dirty = true;
      }
      return;
    }
    shift.infoSource = data.template.htmlTemplate;
    shift.einsatzinformation = { ...(shift.einsatzinformation || {}), template: data.template._id, templateVersion: data.template.version, resolution: data.resolution, customized: false };
    shift.templateSuggestion = false; shift._applyLatestTemplate = true; shift._dirty = true;
    await previewShiftInformation(shift);
    if (confirmed) statusMessage.value = 'Passende Vorlage übernommen';
  } catch { /* Eine fehlende Vorlage darf den Entwurf nicht blockieren. */ }
}
async function applyLatestTemplate(shift) { if (window.confirm('Den gespeicherten Snapshot ausdrücklich durch die aktuellste passende Vorlage ersetzen?')) await applyResolvedTemplate(shift, true); }
async function previewShiftInformation(shift) {
  if (!form.kundenNr || !shift.infoSource) { shift.infoPreview = ''; shift.infoUnresolved = []; return; }
  try {
    const { data } = await api.post(`/api/kunden/${form.kundenNr}/einsatzinformationen/preview`, { htmlTemplate: shift.infoSource, ...(form.einsatzort ? { einsatzortId: form.einsatzort, berufId: jobId(shift), qualifikationId: qualificationId(shift) } : {}), auftrag: { ...event.value, ...form }, schicht: shift, location: locations.value.find(location => location._id === form.locationV2) });
    shift.infoPreview = data.renderedHtml; shift.infoUnresolved = data.unresolvedPlaceholders || [];
  } catch (error) { errorMessage.value = error.response?.data?.message || 'Einsatzinformation enthält ungültige Inhalte.'; }
}
function shiftPayload(shift) { return { bezeichnung: shift.bezeichnung, datumVon: shift.datumVon, datumBis: shift.datumBis, uhrzeitVon: shift.uhrzeitVon, uhrzeitBis: shift.uhrzeitBis, bedarf: Number(shift.bedarf || 0), garantiestundenLohn: Number(shift.garantiestundenLohn || 0), berufSchl: shift.berufSchl || null, qualSchl: shift.qualSchl || null, treffpunkt: shift.treffpunkt || null, treffpunktOrt: shift.treffpunktOrt || '', ansprechpartnerName: shift.ansprechpartnerName || '', ansprechpartnerTelefon: shift.ansprechpartnerTelefon || '', ansprechpartnerEmail: shift.ansprechpartnerEmail || '', einsatzinformationSourceHtml: shift.infoSource || '', einsatzinformationCustomized: Boolean(shift.einsatzinformation?.customized), applyLatestTemplate: Boolean(shift._applyLatestTemplate) }; }
async function saveShift(shift, persistContext = true) {
  if (!shift.bezeichnung) throw new Error('Jede Schicht benötigt eine Bezeichnung.');
  savingShiftId.value = shift._id || shift._localId;
  try { if (persistContext) await saveSite(); const { data } = shift._id ? await api.patch(`/api/auftraege/${event.value.auftragNr}/schichten/${shift._id}`, shiftPayload(shift)) : await api.post(`/api/auftraege/${event.value.auftragNr}/schichten`, shiftPayload(shift)); Object.assign(shift, normalizeShift(data)); shift._applyLatestTemplate = false; }
  finally { savingShiftId.value = null; }
}
async function saveOneShift(shift) { errorMessage.value = ''; try { await saveShift(shift); statusMessage.value = 'Schicht gespeichert'; emitUpdated(); } catch (error) { errorMessage.value = error.response?.data?.message || error.message || 'Schicht konnte nicht gespeichert werden.'; } }
async function saveAllShifts() { await saveSite(); if (!shifts.value.length) throw new Error('Lege mindestens eine Schicht an.'); for (const shift of shifts.value) if (!shift._id || shift._dirty) await saveShift(shift, false); selectedShiftId.value ||= shifts.value[0]._id; emitUpdated(); }

function assignmentsForShift(shift) { return assignments.value.filter(assignment => String(assignment.schicht?._id || assignment.schicht || '') === String(shift._id) || (shift.idAuftragArbeitsschichten != null && assignment.idAuftragArbeitsschichten === shift.idAuftragArbeitsschichten)); }
async function selectPlanningShift(shift) { selectedShiftId.value = shift._id; selectedCandidateIds.value = new Set(); await loadCandidates(); }
async function loadCandidates() {
  if (!planningShift.value?._id) return;
  candidateLoading.value = true;
  try { const { data } = await api.get(`/api/auftraege/${event.value.auftragNr}/schichten/${planningShift.value._id}/candidates`, { params: { includeOtherLocations: includeOtherLocations.value } }); candidates.value = data.candidates || []; event.value.planningVersion = data.planningVersion; await loadDispoPreview(); }
  catch (error) { errorMessage.value = error.response?.data?.message || 'Mitarbeitervorschläge konnten nicht geladen werden.'; }
  finally { candidateLoading.value = false; }
}
async function validatePlanning() {
  await saveAllShifts();
  const { data } = await api.put(`/api/auftraege/${event.value.auftragNr}/planning`, {
    planningVersion: Number(event.value.planningVersion || 0),
    operations: [],
  });
  event.value.planningVersion = data.planningVersion;
  const existingById = new Map(assignments.value.map(assignment => [assignment._id, assignment]));
  assignments.value = (data.assignments || assignments.value).map(assignment => ({ ...existingById.get(assignment._id), ...assignment }));
}
async function loadDispoPreview() { if (!form.vonDatum || !form.bisDatum || !form.locationV2) return; try { const { data } = await api.get('/api/dispo', { params: { von: form.vonDatum, bis: form.bisDatum, locationV2: form.locationV2 } }); dispoEntries.value = data.eintraege || []; } catch { dispoEntries.value = []; } }
function toggleCandidate(id) { const next = new Set(selectedCandidateIds.value); next.has(id) ? next.delete(id) : next.add(id); selectedCandidateIds.value = next; }
async function assignCandidate(candidate, targetShift = planningShift.value) {
  if (!targetShift?._id) return;
  let conflictOverride;
  if (candidate.conflicts?.length) { const reason = window.prompt(`Konflikte:\n${candidate.conflicts.map(item => `• ${item.label}`).join('\n')}\n\nBegründung für die Einplanung:`); if (!reason?.trim()) return; conflictOverride = { confirmed: true, reason: reason.trim() }; }
  try { selectedShiftId.value = targetShift._id; await api.post(`/api/auftraege/${event.value.auftragNr}/einsaetze`, { mitarbeiterId: candidate._id, schichtId: targetShift._id, includeOtherLocations: includeOtherLocations.value, conflictOverride }); await loadDetails(); selectedShiftId.value = targetShift._id; await loadCandidates(); }
  catch (error) { errorMessage.value = error.response?.data?.message || 'Einplanung fehlgeschlagen.'; }
}
async function assignSelectedCandidates() {
  const operations = [];
  for (const id of selectedCandidateIds.value) {
    const candidate = candidates.value.find(item => item._id === id);
    if (!candidate) continue;
    let conflictOverride;
    if (candidate.conflicts?.length) {
      const reason = window.prompt(`Konflikte bei ${candidate.vorname} ${candidate.nachname}:\n${candidate.conflicts.map(item => `• ${item.label}`).join('\n')}\n\nBegründung für die Einplanung:`);
      if (!reason?.trim()) continue;
      conflictOverride = { confirmed: true, reason: reason.trim() };
    }
    operations.push({ type: 'assign', schichtId: planningShift.value._id, mitarbeiterId: candidate._id, conflictOverride });
  }
  if (!operations.length) return;
  errorMessage.value = '';
  try {
    const { data } = await api.put(`/api/auftraege/${event.value.auftragNr}/planning`, {
      planningVersion: Number(event.value.planningVersion || 0),
      includeOtherLocations: includeOtherLocations.value,
      operations,
    });
    event.value.planningVersion = data.planningVersion;
    await loadDetails();
    await loadCandidates();
  } catch (error) { errorMessage.value = error.response?.data?.message || 'Mehrfach-Einplanung fehlgeschlagen.'; }
  finally { selectedCandidateIds.value = new Set(); }
}
async function removeAssignment(assignment) { await api.delete(`/api/auftraege/${event.value.auftragNr}/einsaetze/${assignment._id}`); assignments.value = assignments.value.filter(item => item._id !== assignment._id); await loadCandidates(); }
function dropCandidate() { const candidate = candidates.value.find(item => item._id === dragCandidateId.value); dragCandidateId.value = ''; if (candidate) assignCandidate(candidate); }
async function dropCandidateOnShift(shift) {
  const candidateId = dragCandidateId.value;
  dragCandidateId.value = '';
  if (!candidateId) return;
  if (shift._id === planningShift.value?._id) {
    const candidate = candidates.value.find(item => item._id === candidateId);
    if (candidate) await assignCandidate(candidate, shift);
    return;
  }
  try {
    const { data } = await api.get(`/api/auftraege/${event.value.auftragNr}/schichten/${shift._id}/candidates`, { params: { includeOtherLocations: includeOtherLocations.value } });
    const candidate = (data.candidates || []).find(item => item._id === candidateId);
    if (!candidate) throw new Error('Mitarbeiter ist für diese Schicht nicht verfügbar.');
    event.value.planningVersion = data.planningVersion;
    await assignCandidate(candidate, shift);
  } catch (error) { errorMessage.value = error.response?.data?.message || error.message || 'Einplanung per Drag-and-drop fehlgeschlagen.'; }
}
function dispoTone(candidate, day) { const entries = [...(candidate.dispoEntries || []), ...dispoEntries.value].filter(entry => String(entry.mitarbeiter?._id || entry.mitarbeiter) === String(candidate._id) && toDate(entry.datumVon) <= day && toDate(entry.datumBis || entry.datumVon) >= day); if (entries.some(entry => entry.typ === 'abwesenheit' || entry.verfuegbarkeit === 'blocked')) return 'blocked'; if (entries.some(entry => entry._source === 'einsatz' || entry.verfuegbarkeit === 'eingeplant')) return 'planned'; if (entries.some(entry => entry.verfuegbarkeit === 'available')) return 'available'; return 'unknown'; }

async function saveCurrentStep(advance) {
  pending.value = true; errorMessage.value = ''; statusMessage.value = '';
  try {
    if (currentStep.value === 0) await saveOrder();
    else if (currentStep.value === 1) await saveSite();
    else if (currentStep.value === 2) await saveAllShifts();
    else if (currentStep.value === 3) await validatePlanning();
    else await saveAllShifts();
    if (advance && currentStep.value < 4) { currentStep.value += 1; await api.patch(`/api/auftraege/${event.value.auftragNr}`, { wizardStep: currentStep.value }); if (currentStep.value === 3) await loadCandidates(); }
    statusMessage.value = 'Entwurf gespeichert';
  } catch (error) { errorMessage.value = error.response?.data?.message || error.message || 'Speichern fehlgeschlagen.'; }
  finally { pending.value = false; }
}
async function releaseOrder() { pending.value = true; errorMessage.value = ''; releaseErrors.value = []; try { await saveAllShifts(); const { data } = await api.post(`/api/auftraege/${event.value.auftragNr}/release`); event.value.auftStatus = data.auftrag?.auftStatus || 2; statusMessage.value = 'Auftrag freigegeben'; emitUpdated(); } catch (error) { releaseErrors.value = error.response?.data?.errors || []; errorMessage.value = error.response?.data?.message || error.message || 'Freigabe fehlgeschlagen.'; } finally { pending.value = false; } }
async function goToStep(index) { if (!event.value && index > 0) return; currentStep.value = index; errorMessage.value = ''; if (index === 3) await loadCandidates(); }
function emitUpdated() {
  if (!event.value) return;
  event.value = {
    ...event.value,
    kundeData: selectedCustomer.value,
    schichten: shifts.value,
    einsaetze: assignments.value,
  };
  emit('updated', event.value);
}
function formatDate(value) { return value ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${toDate(value)}T12:00:00`)) : '—'; }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
function shortTime(value) { return String(value || '').slice(0, 5) || '—'; }
function initials(candidate) { return `${candidate.vorname?.[0] || ''}${candidate.nachname?.[0] || ''}`.toUpperCase(); }

watch(() => form.locationV2, loadRecentOptions);
onMounted(async () => { try { await loadBaseData(); if (props.auftragNr) await loadDetails(); else await loadRecentOptions(); } catch (error) { errorMessage.value = error.response?.data?.message || 'Grunddaten konnten nicht geladen werden.'; } finally { loading.value = false; } });
</script>

<style scoped>
.wizard-shell { display: grid; grid-template-rows: auto minmax(0,1fr) auto; height: min(84dvh, 920px); color: var(--text, #172033); background: #f5f7fb; }
.wizard-steps { display: grid; grid-template-columns: repeat(5,1fr); gap: 1px; padding: .65rem; border-bottom: 1px solid #dfe5ef; background: #fff; }
.wizard-steps button { display: flex; align-items: center; gap: .65rem; min-width: 0; padding: .65rem .75rem; border: 0; border-radius: 11px; color: #64748b; background: transparent; text-align: left; cursor: pointer; }
.wizard-steps button > span { display: grid; flex: 0 0 1.85rem; width: 1.85rem; height: 1.85rem; place-items: center; border: 1px solid #cbd5e1; border-radius: 50%; font-size: .78rem; font-weight: 800; }
.wizard-steps button div { display: grid; min-width: 0; }.wizard-steps small { overflow: hidden; font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }.wizard-steps button.active { color: #1d4ed8; background: #eff6ff; }.wizard-steps button.active > span { color: #fff; border-color: #2563eb; background: #2563eb; }.wizard-steps button.done > span { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
.wizard-content { overflow: auto; padding: clamp(1rem,2vw,2rem); }.wizard-page { width: min(1180px,100%); margin: 0 auto; }.page-heading { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1.35rem; }.page-heading h3 { margin: .16rem 0 .3rem; font-size: clamp(1.3rem,2vw,1.8rem); }.page-heading p { margin: 0; color: #64748b; }.page-heading.split { align-items: flex-end; }.eyebrow { color: #2563eb; font-size: .7rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.order-type { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin-bottom: 1rem; }.order-type button { display: grid; gap: .2rem; padding: 1rem; border: 1px solid #dbe2ec; border-radius: 14px; color: #475569; background: #fff; text-align: left; cursor: pointer; }.order-type button.active { color: #1d4ed8; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }.order-type small { color: #64748b; }
.form-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: .8rem; }.field { display: grid; align-content: start; gap: .35rem; min-width: 0; }.field.wide { grid-column: span 2; }.field > span { color: #64748b; font-size: .73rem; font-weight: 800; }.field input,.field select { box-sizing: border-box; width: 100%; min-height: 42px; padding: .58rem .68rem; border: 1px solid #d8dfeb; border-radius: 9px; outline: none; color: inherit; background: #fff; }.field input:focus,.field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }.order-grid { padding: 1.1rem; border: 1px solid #dfe5ef; border-radius: 16px; background: #fff; box-shadow: 0 12px 30px rgba(15,23,42,.04); }
.selected-customer { display: flex; align-items: center; gap: .6rem; min-height: 42px; padding: .45rem .7rem; border: 1px solid #bfdbfe; border-radius: 10px; background: #eff6ff; }.selected-customer span { color: #64748b; }.selected-customer button { margin-left: auto; border: 0; color: #1d4ed8; background: transparent; cursor: pointer; }.suggestion-row,.pattern-strip { display: flex; align-items: center; gap: .4rem; margin-top: .45rem; overflow-x: auto; }.suggestion-row > span,.pattern-strip > span { flex: 0 0 auto; color: #64748b; font-size: .7rem; font-weight: 800; }.suggestion-row button,.pattern-strip button { flex: 0 0 auto; padding: .32rem .55rem; border: 1px solid #dbe3ef; border-radius: 999px; color: #334155; background: #fff; cursor: pointer; }.label-editor { display: flex; align-items: center; flex-wrap: wrap; gap: .35rem; min-height: 42px; padding: .35rem; border: 1px solid #d8dfeb; border-radius: 9px; }.label-editor input { flex: 1; min-width: 140px; min-height: 30px; border: 0; }.label-editor > button { width: 30px; height: 30px; border: 0; border-radius: 7px; color: #fff; background: #2563eb; }.order-label { padding: .27rem .45rem; border: 1px solid var(--label-color); border-radius: 7px; color: var(--label-color); font-size: .77rem; font-weight: 700; }.order-label button { border: 0; color: inherit; background: transparent; }
.site-layout { display: grid; grid-template-columns: minmax(0,2fr) minmax(240px,1fr); gap: 1rem; }.site-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .65rem; }.site-card,.one-off-toggle { display: flex; align-items: center; gap: .8rem; padding: .9rem; border: 1px solid #dce3ed; border-radius: 14px; color: #334155; background: #fff; text-align: left; cursor: pointer; }.site-card.active,.one-off-toggle.active { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.09); }.site-card > div,.one-off-toggle > div { display: grid; gap: .16rem; min-width: 0; }.site-card small { color: #2563eb; font-size: .68rem; font-weight: 900; text-transform: uppercase; }.site-card span:not(.site-pin),.one-off-toggle small { overflow: hidden; color: #64748b; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }.site-card b { margin-left: auto; }.site-pin,.one-off-toggle > span { display: grid; flex: 0 0 2.2rem; width: 2.2rem; height: 2.2rem; place-items: center; border-radius: 10px; color: #2563eb; background: #eff6ff; }.address-panel { margin-top: 1rem; padding: 1rem; border: 1px solid #dce3ed; border-radius: 14px; background: #fff; }.address-panel h4 { margin: 0 0 .8rem; }
.primary-button,.secondary-button,.text-button,.release-button { min-height: 40px; padding: .58rem .85rem; border-radius: 9px; cursor: pointer; font-weight: 800; }.primary-button,.release-button { border: 1px solid #2563eb; color: #fff; background: #2563eb; }.secondary-button { border: 1px solid #cbd5e1; color: #334155; background: #fff; }.text-button { border: 0; color: #64748b; background: transparent; }
.pattern-strip { margin: -.5rem 0 1rem; }.shift-stack { display: grid; gap: 1rem; }.shift-card { overflow: hidden; border: 1px solid #dce3ed; border-radius: 16px; background: #fff; box-shadow: 0 10px 28px rgba(15,23,42,.04); }.shift-card > header { display: flex; align-items: center; gap: .7rem; padding: .8rem 1rem; border-bottom: 1px solid #e7ebf1; background: #fafcff; }.shift-number { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: 9px; color: #fff; background: #334155; font-weight: 900; }.shift-card > header > div:nth-child(2) { display: grid; }.shift-card > header span { color: #64748b; font-size: .68rem; text-transform: uppercase; }.shift-actions { display: flex; gap: .3rem; margin-left: auto; }.shift-actions button,.info-editor-head button { padding: .35rem .5rem; border: 1px solid #dbe3ee; border-radius: 7px; color: #475569; background: #fff; cursor: pointer; }.shift-actions .danger-link { color: #b91c1c; }.shift-grid { padding: 1rem; }.info-editor-head { display: flex; align-items: flex-end; justify-content: space-between; gap: .8rem; padding: .1rem 1rem .6rem; }.info-editor-head h4 { margin: .1rem 0 0; }.info-editor-head > div:last-child { display: flex; align-items: center; gap: .45rem; }.template-version { padding: .28rem .45rem; border-radius: 99px; color: #0369a1; background: #e0f2fe; font-size: .72rem; font-weight: 800; }.shift-card :deep(.rich-template-editor) { margin: 0 1rem; }.template-suggestion { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin: 0 1rem .6rem; padding: .55rem .7rem; border-radius: 9px; color: #92400e; background: #fffbeb; }.template-suggestion button { border: 0; color: #1d4ed8; background: transparent; font-weight: 800; }.shift-card > footer { display: flex; align-items: center; justify-content: flex-end; gap: .7rem; padding: .75rem 1rem; }.shift-card > footer span { margin-right: auto; color: #64748b; font-size: .76rem; }.empty-shift { display: grid; gap: .25rem; padding: 3rem; border: 2px dashed #bfdbfe; border-radius: 16px; color: #1d4ed8; background: #f8fbff; cursor: pointer; }.empty-shift span { color: #64748b; }
.staffing-layout { display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 1rem; }.staff-shifts { display: grid; align-content: start; gap: .45rem; }.staff-shifts button { display: grid; gap: .15rem; padding: .75rem; border: 1px solid #dce3ed; border-radius: 11px; color: #475569; background: #fff; text-align: left; }.staff-shifts button.active { color: #1d4ed8; border-color: #2563eb; }.staff-shifts span,.staff-shifts small { font-size: .72rem; }.candidate-panel { min-width: 0; }.planning-summary { display: flex; align-items: center; padding: 1rem; border-radius: 14px; color: #fff; background: linear-gradient(135deg,#1e3a8a,#2563eb); }.planning-summary > div { display: grid; }.planning-summary b { margin-left: auto; padding: .55rem .7rem; border-radius: 10px; background: rgba(255,255,255,.18); }.planning-summary b.full { background: #059669; }.planned-strip { display: flex; gap: .5rem; padding: .65rem 0; overflow-x: auto; }.planned-strip article { display: flex; align-items: center; gap: .6rem; flex: 0 0 auto; padding: .55rem .7rem; border: 1px solid #dce3ed; border-radius: 10px; background: #fff; }.planned-strip article div { display: grid; }.planned-strip small { color: #b45309; }.planned-strip button { border: 0; color: #b91c1c; background: transparent; }.candidate-toolbar { display: flex; align-items: center; justify-content: space-between; margin: .5rem 0; }.candidate-toolbar > div { display: flex; gap: .35rem; }.candidate-toolbar button { padding: .45rem .6rem; border: 1px solid #dbe3ed; border-radius: 8px; color: #475569; background: #fff; }.candidate-toolbar button.active { color: #1d4ed8; border-color: #2563eb; }.candidate-list { display: grid; gap: .5rem; }.candidate-card { display: flex; align-items: center; gap: .7rem; padding: .7rem; border: 1px solid #dce3ed; border-left: 4px solid #94a3b8; border-radius: 12px; background: #fff; }.candidate-card.recommended { border-left-color: #10b981; }.candidate-card.possible { border-left-color: #f59e0b; }.candidate-card.conflict { border-left-color: #ef4444; }.candidate-avatar { display: grid; flex: 0 0 2.3rem; width: 2.3rem; height: 2.3rem; place-items: center; border-radius: 50%; color: #fff; background: #334155; font-weight: 800; }.candidate-body { min-width: 0; flex: 1; }.candidate-body > div:first-child { display: flex; justify-content: space-between; }.candidate-body > div:first-child span { color: #64748b; font-size: .7rem; font-weight: 900; text-transform: uppercase; }.candidate-body p { display: flex; flex-wrap: wrap; gap: .28rem; margin: .3rem 0; }.candidate-body p span { padding: .18rem .35rem; border-radius: 5px; color: #047857; background: #ecfdf5; font-size: .7rem; }.candidate-body p .conflict { color: #b91c1c; background: #fef2f2; }.candidate-card > button { border: 0; color: #1d4ed8; background: transparent; font-weight: 800; }.mini-dispo { display: flex; gap: 2px; }.mini-dispo i { display: grid; width: 22px; height: 18px; place-items: center; border-radius: 3px; color: #64748b; background: #f1f5f9; font-size: .58rem; font-style: normal; }.mini-dispo i.available { color: #047857; background: #d1fae5; }.mini-dispo i.blocked { color: #b91c1c; background: #fee2e2; }.mini-dispo i.planned { color: #1d4ed8; background: #dbeafe; }.location-toggle { display: flex; align-items: center; gap: .45rem; color: #475569; font-size: .8rem; }
.review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }.review-grid > article { position: relative; padding: 1rem; border: 1px solid #dce3ed; border-radius: 14px; background: #fff; }.review-grid article.wide { grid-column: 1/-1; }.review-grid article > span { color: #2563eb; font-size: .68rem; font-weight: 900; text-transform: uppercase; }.review-grid h4 { margin: .25rem 0 .6rem; }.review-grid article > button { position: absolute; top: .7rem; right: .7rem; border: 0; color: #1d4ed8; background: transparent; }.review-grid dl { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; margin: 0; }.review-grid dl div { display: grid; }.review-grid dt { color: #64748b; font-size: .7rem; }.review-grid dd { margin: 0; }.review-shifts { display: grid; gap: .4rem; }.review-shifts > div { display: grid; grid-template-columns: 1.5fr 1fr auto 1.3fr; gap: .7rem; align-items: center; padding: .55rem; border-radius: 8px; background: #f8fafc; }.review-shifts small { color: #047857; }.review-shifts small.invalid { color: #b91c1c; }.release-errors { display: grid; gap: .35rem; margin-top: .8rem; padding: .8rem; border: 1px solid #fecaca; border-radius: 12px; background: #fff7f7; }.release-errors button { display: flex; gap: .5rem; border: 0; color: #b91c1c; background: transparent; text-align: left; }.release-errors button span { font-weight: 900; }.release-callout { display: flex; align-items: center; margin-top: 1rem; padding: 1rem; border-radius: 14px; color: #fff; background: #172554; }.release-callout > div { display: grid; }.release-callout .release-button { margin-left: auto; background: #10b981; border-color: #10b981; }
.wizard-footer { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; border-top: 1px solid #dfe5ef; background: #fff; }.wizard-footer > span { flex: 1; }.wizard-error { position: sticky; top: 0; z-index: 4; margin: 0 0 .8rem; padding: .65rem .8rem; border: 1px solid #fecaca; border-radius: 9px; color: #b91c1c; background: #fff1f2; }.wizard-state { padding: .3rem .55rem; border-radius: 99px; font-size: .75rem; font-weight: 900; }.wizard-state.draft { color: #92400e; background: #fef3c7; }.wizard-state.confirmed { color: #047857; background: #d1fae5; }.save-state { color: #64748b; font-size: .78rem; }.wizard-loading,.empty-state { padding: 2rem; color: #64748b; text-align: center; }.empty-state.prominent { border: 1px dashed #cbd5e1; border-radius: 14px; background: #fff; }
@media (max-width: 900px) { .wizard-steps button small { display: none; }.form-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.site-layout,.staffing-layout { grid-template-columns: 1fr; }.staff-shifts { grid-template-columns: repeat(2,1fr); }.review-shifts > div { grid-template-columns: 1fr auto; }.review-shifts > div span,.review-shifts > div small { grid-column: 1/-1; } }
@media (max-width: 600px) { .wizard-shell { height: 90dvh; }.wizard-steps { overflow-x: auto; grid-template-columns: repeat(5,minmax(72px,1fr)); }.wizard-steps button { justify-content: center; padding: .55rem; }.wizard-steps button div { display: none; }.wizard-content { padding: .8rem; }.form-grid,.site-list,.order-type,.review-grid { grid-template-columns: 1fr; }.field.wide,.review-grid article.wide { grid-column: auto; }.page-heading.split { align-items: flex-start; flex-direction: column; }.shift-actions { flex-wrap: wrap; }.shift-actions button { font-size: .68rem; }.candidate-toolbar { align-items: stretch; flex-direction: column; gap: .5rem; }.wizard-footer { overflow-x: auto; }.wizard-footer button { flex: 0 0 auto; }.release-callout { align-items: stretch; flex-direction: column; gap: .8rem; } }
</style>
