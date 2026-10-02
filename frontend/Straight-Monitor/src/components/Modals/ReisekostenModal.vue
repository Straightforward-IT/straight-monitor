<template>
  <ModalFrame
    :model-value="modelValue"
    :title="isEditing ? 'Reisekostenabrechnung bearbeiten' : 'Reisekostenabrechnung'"
    subtitle="Einsatzdokument"
    size="lg"
    minimizable
    :show-close="!interactionBusy"
    :close-on-backdrop="!interactionBusy"
    :close-on-escape="!interactionBusy"
    :minimize-id="minimizeId"
    :minimize-title="minimizeTitle || defaultMinimizeTitle"
    class="reisekosten-modal"
    @close="close"
  >

        <!-- Step breadcrumb -->
        <nav class="rk-steps">
          <button
            v-for="(s, i) in steps"
            :key="s.key"
            class="rk-step"
            :class="{ active: currentStep === i, done: currentStep > i, reachable: i <= maxReachableStep }"
            type="button"
            :disabled="interactionBusy || i > maxReachableStep"
            :aria-current="currentStep === i ? 'step' : undefined"
            @click="i <= maxReachableStep && (currentStep = i)"
          >
            <span class="rk-step-num">
              <font-awesome-icon v-if="currentStep > i" :icon="['fas', 'check']" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="rk-step-label">{{ s.label }}</span>
          </button>
        </nav>

        <div v-if="loading" class="dialog__body dialog__body--center" role="status">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lade…
        </div>

        <div v-else class="dialog__body" :inert="interactionBusy">
          <!-- ───────── STEP 1: Grunddaten ───────── -->
          <section v-show="currentStep === 0" class="rk-section">
            <div v-if="!isEditing" class="rk-block">
              <div class="section-heading"><h4>Mitarbeiter</h4></div>
              <select v-model="selectedPersonalNr" @change="onMitarbeiterChange">
                <option value="">— Mitarbeiter wählen —</option>
                <option v-for="m in mitarbeiterOptions" :key="m.personalNr" :value="m.personalNr">
                  {{ m.label }}
                </option>
              </select>
            </div>

            <div class="rk-block">
              <div class="section-heading"><h4>Grunddaten</h4></div>
              <div class="base-grid">
                <label>Name, Vorname<AppTextInput :model-value="`${form.kopf.name}${form.kopf.vorname ? ', ' + form.kopf.vorname : ''}`" disabled /></label>
                <label>Firma<AppTextInput v-model="form.kopf.firma" /></label>
                <label>Zweck der Reise<AppTextInput v-model="form.kopf.zweck" /></label>
                <label>Nummernschild<AppTextInput v-model="form.kopf.nummernschild" placeholder="z. B. HH-AB 123" /></label>
                <label>Fahrt erfolgte mit
                  <select v-model="form.kopf.transportmittel">
                    <option value="dienstwagen">Dienstwagen</option>
                    <option value="privatpkw">Privat-PKW</option>
                    <option value="mietwagen">Mietwagen</option>
                    <option value="bahn">Bahn</option>
                    <option value="flugzeug">Flugzeug</option>
                  </select>
                </label>
                <label>Ort (Unterschrift)<AppTextInput v-model="form.ort" placeholder="z. B. Hamburg" /></label>
                <label>Reisebeginn (Datum)<input v-model="form.kopf.reisebeginn" type="date" /></label>
                <label>Reiseende (Datum)<input v-model="form.kopf.reiseende" type="date" /></label>
                <label>Gesamtdauer (Tage)<AppTextInput v-model.number="form.kopf.tage" type="number" min="0" /></label>
                <label>Gesamtdauer (Stunden)<AppTextInput v-model="form.kopf.stunden" /></label>
              </div>
            </div>
          </section>

          <!-- ───────── STEP 2: Reisedaten ───────── -->
          <section v-show="currentStep === 1" class="rk-section">
            <div class="rk-block">
              <div class="section-heading">
                <h4>Reisedaten <span>Fahrtstrecke — erscheint als eigene Seite im Dokument</span></h4>
                <AppButton variant="outlined" size="sm" class="add-btn" @click="addReiseRow"><font-awesome-icon :icon="['fas','plus']" /> Fahrt</AppButton>
              </div>
              <p v-if="!form.reisedaten.length" class="rk-hint">Noch keine Fahrten. Füge Start, Ziel, Datum und Kilometer hinzu.</p>
              <div v-for="(row, i) in form.reisedaten" :key="'r'+i" class="reise-row">
                <label class="mini">Datum<input v-model="row.datum" type="date" /></label>
                <label class="mini">Start<AddressAutocomplete v-model="row.start" placeholder="Startadresse" :local-suggestions="addressSuggestions" :search-suggestions="searchAddressSuggestions" :disabled="interactionBusy" /></label>
                <label class="mini">Ziel<AddressAutocomplete v-model="row.ziel" placeholder="Zieladresse" :local-suggestions="addressSuggestions" :search-suggestions="searchAddressSuggestions" :disabled="interactionBusy" /></label>
                <label class="mini">km<AppTextInput v-model.number="row.kilometer" type="number" step="0.1" min="0" /></label>
                <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`Fahrt ${i + 1} entfernen`" @click="form.reisedaten.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
              </div>
              <div v-if="form.reisedaten.length" class="reise-total">
                <span>Gesamt</span><b>{{ reiseKmTotal.toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} km</b>
              </div>
            </div>
          </section>

          <!-- ───────── STEP 3: Kostendaten ───────── -->
          <section v-show="currentStep === 2" class="rk-section">
            <div class="rk-block rk-block--highlight">
              <div class="section-heading">
                <AppButton variant="outlined" size="sm" class="add-btn" @click="addKmRow"><font-awesome-icon :icon="['fas','plus']" /> Zeile</AppButton>
              </div>
              <p v-if="!form.kilometerpauschale.length" class="rk-hint">Fahrten unter „Reisedaten“ erzeugen hier automatisch je eine Zeile.</p>
              <template v-for="(row, i) in form.kilometerpauschale" :key="row._reiseId ? 'auto'+row._reiseId : 'km'+i">
                <!-- Trip-linked row: Start & Ziel come from the Fahrt -->
                <div v-if="row._reiseId" class="betrag-row betrag-row--linked km-linked">
                  <label class="mini">Start<AppTextInput :model-value="row.start" placeholder="Startadresse" disabled /></label>
                  <label class="mini">Ziel<AppTextInput :model-value="row.ziel" placeholder="Zieladresse" disabled /></label>
                  <label class="mini">Kilometer<AppTextInput v-model.number="row.kilometer" type="number" step="1" min="0" disabled /></label>
                  <label class="mini">€ / km<AppTextInput v-model.number="row.satzEur" type="number" step="0.01" min="0" /></label>
                  <span class="row-total">{{ centToStr(kmGesamt(row)) }} €</span>
                </div>
                <!-- Manually added row -->
                <div v-else class="betrag-row">
                  <AppTextInput v-model="row.bezeichnung" :aria-label="`Kilometerpauschale ${i + 1} Bezeichnung`" placeholder="Bezeichnung" />
                  <label class="mini">Kilometer<AppTextInput v-model.number="row.kilometer" type="number" step="1" min="0" /></label>
                  <label class="mini">€ / km<AppTextInput v-model.number="row.satzEur" type="number" step="0.01" min="0" /></label>
                  <span class="row-total">{{ centToStr(kmGesamt(row)) }} €</span>
                  <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`Kilometerpauschale ${i + 1} entfernen`" @click="form.kilometerpauschale.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
                </div>
              </template>
            </div>

            <!-- Fahrtkosten -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Fahrtkosten <span>Einzelnachweis mit Anlagen</span></h4>
                <AppButton variant="outlined" size="sm" class="add-btn" @click="addBetragRow('fahrtkosten')"><font-awesome-icon :icon="['fas','plus']" /> Zeile</AppButton>
              </div>
              <div v-for="(row, i) in form.fahrtkosten" :key="'f'+i" class="betrag-row betrag-row--simple">
                <AppTextInput v-model="row.bezeichnung" :aria-label="`Fahrtkosten ${i + 1} Bezeichnung`" placeholder="Bezeichnung" />
                <label class="mini">Betrag €<AppTextInput v-model.number="row.betragEur" :aria-label="`Fahrtkosten ${i + 1} Betrag in Euro`" type="number" step="0.01" min="0" /></label>
                <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`Fahrtkosten ${i + 1} entfernen`" @click="form.fahrtkosten.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
              </div>
            </div>

            <!-- Übernachtungskosten -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Übernachtungskosten <span>ohne Frühstück</span></h4>
                <AppButton variant="outlined" size="sm" class="add-btn" @click="addBetragRow('uebernachtung')"><font-awesome-icon :icon="['fas','plus']" /> Zeile</AppButton>
              </div>
              <div v-for="(row, i) in form.uebernachtung" :key="'u'+i" class="betrag-row betrag-row--simple">
                <AppTextInput v-model="row.bezeichnung" :aria-label="`Übernachtungskosten ${i + 1} Bezeichnung`" placeholder="Bezeichnung" />
                <label class="mini">Betrag €<AppTextInput v-model.number="row.betragEur" :aria-label="`Übernachtungskosten ${i + 1} Betrag in Euro`" type="number" step="0.01" min="0" /></label>
                <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`Übernachtungskosten ${i + 1} entfernen`" @click="form.uebernachtung.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
              </div>
            </div>

            <!-- Pauschalbeträge -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Pauschalbeträge für Arbeitnehmer</h4>
              </div>
              <div class="pauschal-subsection">
                <div class="section-heading">
                  <h5>Übernachtungspauschale</h5>
                  <AppButton variant="outlined" size="sm" class="add-btn" @click="addPauschUeber"><font-awesome-icon :icon="['fas','plus']" /> Übernachtung</AppButton>
                </div>
                <div v-for="(row, i) in form.pauschalen.uebernachtungen" :key="'pu'+i" class="betrag-row betrag-row--simple">
                  <span class="row-label">Übernachtung</span>
                  <label class="mini">Betrag €<AppTextInput v-model.number="row.betragEur" :aria-label="`Übernachtungspauschale ${i + 1} Betrag in Euro`" type="number" step="0.01" min="0" /></label>
                  <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`Übernachtungspauschale ${i + 1} entfernen`" @click="form.pauschalen.uebernachtungen.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
                </div>
              </div>
              <div class="pauschal-subsection pauschal-subsection--abwesenheit">
                <h5>Abwesenheitspauschalen</h5>
                <div v-for="tag in tagKeys" :key="tag.key" class="betrag-row betrag-row--simple">
                  <span class="row-label">{{ tag.label }}</span>
                  <label class="mini">Betrag €<AppTextInput v-model.number="form.pauschalen[tag.key].betragEur" :aria-label="`${tag.label} Betrag in Euro`" type="number" step="0.01" min="0" /></label>
                </div>
              </div>
            </div>

            <!-- Nebenkosten -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Nebenkosten</h4>
                <AppButton variant="outlined" size="sm" class="add-btn" @click="addBetragRow('nebenkosten')"><font-awesome-icon :icon="['fas','plus']" /> Zeile</AppButton>
              </div>
              <div v-for="(row, i) in form.nebenkosten" :key="'n'+i" class="betrag-row betrag-row--simple">
                <AppTextInput v-model="row.bezeichnung" :aria-label="`Nebenkosten ${i + 1} Bezeichnung`" placeholder="Bezeichnung" />
                <label class="mini">Betrag €<AppTextInput v-model.number="row.betragEur" :aria-label="`Nebenkosten ${i + 1} Betrag in Euro`" type="number" step="0.01" min="0" /></label>
                <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`Nebenkosten ${i + 1} entfernen`" @click="form.nebenkosten.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
              </div>
            </div>

            <!-- Summen -->
            <div class="rk-block rk-summen">
              <div class="summen-row"><span>Vorschuß</span><label class="mini"><AppTextInput v-model.number="form.vorschussEur" aria-label="Vorschuss in Euro" type="number" step="0.01" min="0" /> €</label></div>
              <div class="summen-row"><span>Reisekosten brutto</span><b>{{ centToStr(summen.bruttoCent) }} €</b></div>
              <div class="summen-row"><span>Enthaltene Vorsteuer</span><b>{{ centToStr(summen.vorsteuerGesamtCent) }} €</b></div>
              <div class="summen-row"><span>Reisekosten netto</span><b>{{ centToStr(summen.nettoCent) }} €</b></div>
              <div class="summen-row summen-row--total"><span>Auszuzahlender Betrag</span><b>{{ centToStr(summen.auszuzahlenCent) }} €</b></div>
            </div>
          </section>

          <!-- ───────── STEP 4: Anhänge ───────── -->
          <section v-show="currentStep === 3" class="rk-section">
            <div class="rk-block">
              <div class="section-heading">
                <h4>Belege / Anlagen <span>werden an das Signatur-Dokument angehängt</span></h4>
              </div>
              <div v-for="a in anlagen" :key="a.key" class="anlage-row">
                <font-awesome-icon :icon="['fas', a.contentType && a.contentType.includes('pdf') ? 'file-pdf' : 'file-image']" />
                <span class="anlage-name">{{ a.filename }}</span>
                <AppIconButton variant="ghost" size="sm" class="del-btn" :label="`${a.filename} entfernen`" :loading="deletingAnlageKey === a.key" @click="deleteAnlage(a)"><font-awesome-icon :icon="['fas','xmark']" /></AppIconButton>
              </div>
              <AppButton variant="outlined" size="sm" class="anlage-upload" :disabled="interactionBusy" :loading="uploadingAnlage" @click="anlageInput?.click()">
                <font-awesome-icon :icon="['fas','upload']" /> Belege hinzufügen (Bild / PDF)
              </AppButton>
              <input ref="anlageInput" type="file" multiple accept="image/*,application/pdf" hidden :disabled="interactionBusy" aria-label="Belege auswählen" @change="uploadAnlagen" />
            </div>
          </section>
        </div>

        <template #footer>
          <div class="dialog__footer">
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <AppButton v-if="currentStep > 0" variant="secondary" :disabled="interactionBusy" @click="currentStep--">
            <font-awesome-icon :icon="['fas','arrow-left']" /> Zurück
          </AppButton>
          <AppButton v-else variant="secondary" :disabled="interactionBusy" @click="close">Abbrechen</AppButton>

          <AppButton variant="secondary" :disabled="interactionBusy" :loading="activeAction === 'preview'" @click="preview">
            <font-awesome-icon :icon="['fas','eye']" /> Vorschau
          </AppButton>

          <AppButton variant="secondary" :disabled="interactionBusy || !canSave" :loading="activeAction === 'save'" @click="save(false)">
            <font-awesome-icon :icon="['fas','floppy-disk']" /> Speichern
          </AppButton>

          <AppButton v-if="currentStep < steps.length - 1" :disabled="interactionBusy || !canAdvance" @click="currentStep++">
            Weiter <font-awesome-icon :icon="['fas','arrow-right']" />
          </AppButton>
          <AppButton v-else :disabled="interactionBusy || !canSave" :loading="activeAction === 'sign'" @click="save(true)">
            <font-awesome-icon :icon="['fas','file-signature']" /> Speichern & signieren
          </AppButton>
          </div>
        </template>
  </ModalFrame>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faSpinner, faXmark, faPlus, faEye, faFloppyDisk, faFileSignature, faUpload, faFilePdf, faFileImage, faArrowLeft, faArrowRight, faLink } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import { computeSummen, centToStr, kmGesamtCent, pauschalGesamtCent, eurToCent, centToEur } from '@/utils/reisekostenCalc';
import AddressAutocomplete from '@/components/ui-elements/AddressAutocomplete.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';

library.add(faCheck, faSpinner, faXmark, faPlus, faEye, faFloppyDisk, faFileSignature, faUpload, faFilePdf, faFileImage, faArrowLeft, faArrowRight, faLink);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  auftragNr: { type: [Number, String], default: null },
  docId: { type: String, default: null },
  einsaetze: { type: Array, default: () => [] },
  minimizeId: { type: String, default: 'reisekosten' },
  minimizeTitle: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const steps = [
  { key: 'grund', label: 'Grunddaten' },
  { key: 'reise', label: 'Reisedaten' },
  { key: 'kosten', label: 'Kostendaten' },
  { key: 'anlagen', label: 'Anhänge' },
];
const currentStep = ref(0);

const loading = ref(false);
const busy = ref(false);
const error = ref('');
const selectedPersonalNr = ref('');
const anlagen = ref([]);
const uploadingAnlage = ref(false);
const deletingAnlageKey = ref(null);
const activeAction = ref('');
const anlageInput = ref(null);
const serverAddressSuggestions = ref([]);
// Local id: starts from prop, set after the first (auto-)save so the doc can be edited/attached to.
const localDocId = ref(props.docId);

const tagKeys = [
  { key: 'tage24', label: 'Abwesenheit ≥ 24 Std' },
  { key: 'tage14', label: 'Abwesenheit ≥ 14 Std' },
  { key: 'tage8', label: 'Abwesenheit ≥ 8 Std' },
];

const isEditing = computed(() => !!localDocId.value);
const interactionBusy = computed(() => loading.value || busy.value || uploadingAnlage.value || deletingAnlageKey.value !== null);
const defaultMinimizeTitle = computed(() =>
  props.auftragNr != null
    ? `Reisekosten · Auftrag ${props.auftragNr}`
    : 'Reisekostenabrechnung'
);
const canSave = computed(() => !!form.kopf.name || !!selectedPersonalNr.value);
// Step 1 requires a chosen Mitarbeiter; later steps are always reachable afterwards.
const canAdvance = computed(() => currentStep.value !== 0 || canSave.value);
const maxReachableStep = computed(() => (canSave.value ? steps.length - 1 : 0));

const mitarbeiterOptions = computed(() => {
  const seen = new Map();
  for (const e of props.einsaetze || []) {
    if (e.personalNr == null || seen.has(e.personalNr)) continue;
    const md = e.mitarbeiterData;
    seen.set(e.personalNr, {
      personalNr: e.personalNr,
      label: md ? `${md.vorname} ${md.nachname}` : `Personalnr. ${e.personalNr}`,
    });
  }
  return [...seen.values()];
});

function emptyForm() {
  return {
    kopf: {
      titel: '', name: '', vorname: '', firma: 'H. & P. Straightforward GmbH', zweck: '',
      reiseziel: '', start: '', ziel: '', reisebeginn: '', reiseende: '', transportmittel: 'privatpkw',
      tage: 0, stunden: '', nummernschild: '', kostenstelle: '',
    },
    fahrtkosten: [],
    kilometerpauschale: [],
    uebernachtung: [],
    pauschalen: {
      uebernachtungen: [],
      tage24: { betragEur: 0 },
      tage14: { betragEur: 0 },
      tage8: { betragEur: 0 },
    },
    nebenkosten: [],
    reisedaten: [],
    vorschussEur: 0,
    ort: '',
  };
}
const form = reactive(emptyForm());

// ── Edit-unit ↔ cents conversion ──────────────────────────────────────────
function betragRowToCents(r) {
  return { bezeichnung: r.bezeichnung || '', bemessungCent: 0, betragCent: eurToCent(r.betragEur), prozent: 0 };
}
function kmRowToCents(r) {
  return { bezeichnung: r.bezeichnung || '', start: r.start || '', ziel: r.ziel || '', kilometer: Number(r.kilometer) || 0, satzCent: eurToCent(r.satzEur) };
}
function pauschRowToCents(r) {
  return { anzahl: 1, tage: 0, satzCent: eurToCent(r.betragEur) };
}

/** Build the cents-based document (for preview, save, totals). */
function toDoc() {
  return {
    auftragNr: props.auftragNr != null ? Number(props.auftragNr) : null,
    personalNr: selectedPersonalNr.value ? Number(selectedPersonalNr.value) : (form.personalNr ?? null),
    kopf: {
      ...form.kopf,
      reisebeginn: form.kopf.reisebeginn || null,
      reiseende: form.kopf.reiseende || null,
    },
    fahrtkosten: form.fahrtkosten.map(betragRowToCents),
    kilometerpauschale: form.kilometerpauschale.map(kmRowToCents),
    uebernachtung: form.uebernachtung.map(betragRowToCents),
    pauschalen: {
      uebernachtungen: form.pauschalen.uebernachtungen.map(pauschRowToCents),
      tage24: pauschRowToCents(form.pauschalen.tage24),
      tage14: pauschRowToCents(form.pauschalen.tage14),
      tage8: pauschRowToCents(form.pauschalen.tage8),
    },
    nebenkosten: form.nebenkosten.map(betragRowToCents),
    reisedaten: form.reisedaten.map((r) => ({ datum: r.datum || null, start: r.start || '', ziel: r.ziel || '', kilometer: Number(r.kilometer) || 0 })),
    vorschussCent: eurToCent(form.vorschussEur),
    ort: form.ort || '',
  };
}

const summen = computed(() => computeSummen(toDoc()));
const kmGesamt = (row) => kmGesamtCent(kmRowToCents(row));
const reiseKmTotal = computed(() => form.reisedaten.reduce((s, r) => s + (Number(r.kilometer) || 0), 0));
// Address autocomplete: server suggestions (event/office) + anything already typed.
const addressSuggestions = computed(() => {
  const set = new Set(serverAddressSuggestions.value);
  for (const r of form.reisedaten) { if (r.start) set.add(r.start); if (r.ziel) set.add(r.ziel); }
  return [...set].filter(Boolean);
});

async function searchAddressSuggestions(query) {
  const { data } = await api.get('/api/reisekosten/address-search', { params: { q: query } });
  return data.suggestions || [];
}

// ── Row helpers ─────────────────────────────────────────────────────────────
function addBetragRow(section) {
  form[section].push({ bezeichnung: '', betragEur: 0 });
}
function addKmRow() {
  form.kilometerpauschale.push({ bezeichnung: 'Kilometerpauschale', kilometer: 0, satzEur: 0.30 });
}
function addPauschUeber() {
  form.pauschalen.uebernachtungen.push({ betragEur: 0 });
}
function addReiseRow() {
  // Prefill date with the event range: first row = Reisebeginn, next = Reiseende.
  const datum = form.reisedaten.length === 0
    ? (form.kopf.reisebeginn || '')
    : (form.kopf.reiseende || form.kopf.reisebeginn || '');
  form.reisedaten.push({ _id: uid(), datum, start: '', ziel: '', kilometer: 0 });
}

// ── Kilometerpauschale ↔ Reisedaten sync ────────────────────────────────────
// Each Fahrt yields exactly one (linked) Kilometerpauschale row — the default
// for 99% of cases. Manually added rows (no _reiseId) are kept as extras.
let uidCounter = 0;
const uid = () => `r${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
/** Rebuild linked km-rows from reisedaten, preserving satz and manual rows. */
function syncKmPauschale() {
  const byReise = new Map();
  const manual = [];
  for (const row of form.kilometerpauschale) {
    if (row._reiseId != null) byReise.set(row._reiseId, row);
    else manual.push(row);
  }
  const auto = form.reisedaten.map((t) => {
    if (!t._id) t._id = uid();
    const existing = byReise.get(t._id);
    const satzEur = existing ? existing.satzEur : 0.30;
    return { _reiseId: t._id, start: t.start || '', ziel: t.ziel || '', kilometer: Number(t.kilometer) || 0, satzEur };
  });
  form.kilometerpauschale = [...auto, ...manual];
}
/** After loading a saved doc: adopt the first N km-rows as the trip-linked rows. */
function linkKmToTrips() {
  const trips = form.reisedaten;
  const rows = form.kilometerpauschale;
  const auto = trips.map((t, idx) => {
    if (!t._id) t._id = uid();
    const src = rows[idx];
    return { _reiseId: t._id, start: t.start || '', ziel: t.ziel || '', kilometer: Number(t.kilometer) || 0, satzEur: src ? (src.satzEur ?? 0.30) : 0.30 };
  });
  const manual = rows.slice(trips.length).map((r) => ({ ...r, _reiseId: undefined }));
  form.kilometerpauschale = [...auto, ...manual];
}

// ── Populate from defaults / existing doc ─────────────────────────────────────
function isoToDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function applyDefaults(d) {
  form.kopf.titel = d.kopf?.titel || '';
  form.kopf.name = d.kopf?.name || '';
  form.kopf.vorname = d.kopf?.vorname || '';
  form.kopf.firma = d.kopf?.firma || 'H. & P. Straightforward GmbH';
  form.kopf.zweck = d.kopf?.zweck || '';
  form.kopf.reiseziel = d.kopf?.reiseziel || '';
  form.kopf.start = d.kopf?.start || '';
  form.kopf.ziel = d.kopf?.ziel || '';
  form.kopf.kostenstelle = d.kopf?.kostenstelle || '';
  form.kopf.reisebeginn = isoToDateInput(d.kopf?.reisebeginn);
  form.kopf.reiseende = isoToDateInput(d.kopf?.reiseende);
  form.kopf.transportmittel = d.kopf?.transportmittel || 'privatpkw';
  form.kopf.tage = d.kopf?.tage || 0;
  form.kopf.stunden = d.kopf?.stunden || '';
  form.kopf.nummernschild = d.kopf?.nummernschild || '';
  form.kilometerpauschale = (d.kilometerpauschale || []).map((r) => ({ bezeichnung: r.bezeichnung || '', start: r.start || '', ziel: r.ziel || '', kilometer: r.kilometer || 0, satzEur: centToEur(r.satzCent) }));
  if (d.ort != null) form.ort = d.ort;
  if (Array.isArray(d.addressSuggestions)) serverAddressSuggestions.value = d.addressSuggestions;
}

function applyExisting(d) {
  form.personalNr = d.personalNr ?? null;
  applyDefaults(d);
  form.ort = d.ort || '';
  form.vorschussEur = centToEur(d.vorschussCent);
  const mapBetrag = (r) => ({ bezeichnung: r.bezeichnung || '', betragEur: centToEur(r.betragCent) });
  form.fahrtkosten = (d.fahrtkosten || []).map(mapBetrag);
  form.uebernachtung = (d.uebernachtung || []).map(mapBetrag);
  form.nebenkosten = (d.nebenkosten || []).map(mapBetrag);
  form.reisedaten = (d.reisedaten || []).map((r) => ({ datum: isoToDateInput(r.datum), start: r.start || '', ziel: r.ziel || '', kilometer: r.kilometer || 0 }));
  const mapPauschal = (r) => ({ betragEur: centToEur(pauschalGesamtCent(r)) });
  form.pauschalen.uebernachtungen = (d.pauschalen?.uebernachtungen || []).map(mapPauschal);
  for (const t of ['tage24', 'tage14', 'tage8']) {
    const r = d.pauschalen?.[t] || {};
    form.pauschalen[t] = mapPauschal(r);
  }
  linkKmToTrips();
}

async function onMitarbeiterChange() {
  if (!selectedPersonalNr.value) return;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/reisekosten/defaults', {
      params: { auftragNr: props.auftragNr, personalNr: selectedPersonalNr.value },
    });
    applyDefaults(data);
  } catch (e) {
    error.value = 'Vorbelegung konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

async function loadExisting() {
  loading.value = true;
  try {
    const { data } = await api.get(`/api/reisekosten/${localDocId.value}`);
    applyExisting(data.data);
    anlagen.value = data.data.anlagen || [];
    // Load event/office address suggestions without overwriting the saved form.
    if (props.auftragNr && data.data.personalNr != null) {
      try {
        const { data: def } = await api.get('/api/reisekosten/defaults', {
          params: { auftragNr: props.auftragNr, personalNr: data.data.personalNr },
        });
        if (Array.isArray(def.addressSuggestions)) serverAddressSuggestions.value = def.addressSuggestions;
      } catch { /* suggestions are optional */ }
    }
  } catch (e) {
    error.value = 'Reisekostenabrechnung konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  Object.assign(form, emptyForm());
  selectedPersonalNr.value = '';
  anlagen.value = [];
  serverAddressSuggestions.value = [];
  localDocId.value = props.docId;
  currentStep.value = 0;
  error.value = '';
}

/** Persist the draft if it doesn't exist yet; returns the doc id (or null on failure). */
async function ensureSaved() {
  if (localDocId.value) return localDocId.value;
  if (!canSave.value) {
    error.value = 'Bitte zuerst einen Mitarbeiter wählen.';
    return null;
  }
  const { data } = await api.post('/api/reisekosten', toDoc());
  localDocId.value = data.data._id;
  emit('saved', { doc: data.data, sign: false });
  return localDocId.value;
}

async function uploadAnlagen(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length || interactionBusy.value) return;
  uploadingAnlage.value = true;
  error.value = '';
  try {
    const id = await ensureSaved();
    if (!id) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const { data } = await api.post(`/api/reisekosten/${id}/anlagen`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    anlagen.value = data.data.anlagen || [];
  } catch (e) {
    error.value = e.response?.data?.message || 'Upload fehlgeschlagen.';
  } finally {
    uploadingAnlage.value = false;
  }
}

async function deleteAnlage(a) {
  if (!localDocId.value || interactionBusy.value) return;
  deletingAnlageKey.value = a.key;
  error.value = '';
  try {
    const { data } = await api.delete(`/api/reisekosten/${localDocId.value}/anlagen`, { data: { key: a.key } });
    anlagen.value = data.data.anlagen || [];
  } catch (e) {
    error.value = e.response?.data?.message || 'Entfernen fehlgeschlagen.';
  } finally {
    deletingAnlageKey.value = null;
  }
}

async function preview() {
  if (interactionBusy.value) return;
  busy.value = true;
  activeAction.value = 'preview';
  error.value = '';
  try {
    const { data } = await api.post('/api/reisekosten/preview', toDoc(), { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) {
    error.value = 'Vorschau fehlgeschlagen.';
  } finally {
    busy.value = false;
    activeAction.value = '';
  }
}

async function save(sign) {
  if (interactionBusy.value || !canSave.value) return;
  busy.value = true;
  activeAction.value = sign ? 'sign' : 'save';
  error.value = '';
  try {
    const payload = toDoc();
    let saved;
    if (localDocId.value) {
      const { data } = await api.put(`/api/reisekosten/${localDocId.value}`, payload);
      saved = data.data;
    } else {
      const { data } = await api.post('/api/reisekosten', payload);
      saved = data.data;
    }
    emit('saved', { doc: saved, sign: !!sign });
    emit('update:modelValue', false);
  } catch (e) {
    error.value = e.response?.data?.message || 'Speichern fehlgeschlagen.';
  } finally {
    busy.value = false;
    activeAction.value = '';
  }
}

function close() {
  if (interactionBusy.value) return;
  emit('update:modelValue', false);
}

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  resetForm();
  if (props.docId) {
    await loadExisting();
  } else if (mitarbeiterOptions.value.length === 1) {
    selectedPersonalNr.value = mitarbeiterOptions.value[0].personalNr;
    await onMitarbeiterChange();
  }
}, { immediate: true });

// Keep one linked Kilometerpauschale row per Fahrt in sync.
watch(() => form.reisedaten, syncKmPauschale, { deep: true });
</script>

<style scoped lang="scss">
:global(.reisekosten-modal) {
  --mf-max-width: min(960px, 94vw);
  --mf-max-height: 94dvh;
  --mf-body-padding: 0;
  --mf-body-overflow: hidden;
  --mf-footer-padding: 0;
  --mf-footer-border: none;
}

/* Steps */
.rk-steps { display: flex; gap: 4px; padding: 12px 18px; border-bottom: 1px solid var(--border); }
.rk-step { flex: 1; display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 8px; color: var(--muted); font-size: 0.8rem; font-weight: 600; opacity: 0.55; }
.rk-step.reachable { opacity: 1; }
.rk-step.active { color: var(--action-accent-text); }
.rk-step.done { color: var(--text); }
.rk-step:disabled { cursor: default; }
.rk-step:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
.rk-step-num { width: 22px; height: 22px; border-radius: 50%; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; flex-shrink: 0; }
.rk-step.active .rk-step-num { background: var(--primary); color: var(--on-action-primary); border-color: var(--primary); }
.rk-step.done .rk-step-num { background: color-mix(in srgb, var(--status-success-text) 15%, var(--surface)); color: var(--status-success-text); border-color: var(--status-success-text); }
.rk-step-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.dialog__body { flex: 1 1 auto; overflow: auto; padding: 18px; display: grid; gap: 20px; align-content: start; }
.dialog__body--center { place-items: center; color: var(--muted); }
.rk-section { display: grid; gap: 18px; }
.rk-block { display: grid; gap: 8px; }
.rk-block--highlight { border: 1px solid var(--primary); border-radius: 8px; padding: 12px 14px; background: color-mix(in srgb, var(--primary) 6%, transparent); }
.betrag-row--linked .row-total { color: var(--action-accent-text); }
.km-linked { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 0.8fr 0.8fr auto auto; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; }
.section-heading h4 { margin: 0; font-size: 0.9rem; }
.section-heading h4 span { color: var(--muted); font-size: 0.72rem; font-weight: 400; margin-left: 6px; }
.base-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.base-grid .span-2 { grid-column: 1 / -1; }
label { display: grid; gap: 5px; color: var(--text); font-size: 0.8rem; font-weight: 600; }
input[type="date"], select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 38px; border: 1px solid var(--control-input-border); border-radius: var(--control-radius); padding: 8px 9px; background: var(--control-input-bg); color: var(--text); font: inherit; font-weight: 400; }
input[type="date"]:focus-visible, select:focus-visible { border-color: var(--primary); outline: 2px solid var(--control-focus-ring); outline-offset: 1px; }
.betrag-row { display: grid; grid-template-columns: minmax(0, 1.6fr) 0.9fr 0.9fr 0.6fr auto; gap: 8px; align-items: end; }
.betrag-row--simple { grid-template-columns: minmax(0, 1fr) 176px 40px; }
.betrag-row--simple .del-btn { justify-self: end; }
.betrag-row .row-label, .betrag-row .row-total { align-self: center; font-size: 0.78rem; color: var(--muted); }
.betrag-row .row-total { text-align: right; font-weight: 600; color: var(--text); }
.reise-row { display: grid; grid-template-columns: 128px minmax(0, 1fr) minmax(0, 1fr) 76px auto; gap: 8px; align-items: end; }
.reise-row > label { min-width: 0; }
.reise-total { display: flex; align-items: center; gap: 10px; justify-content: flex-end; font-size: 0.85rem; padding-top: 8px; border-top: 1px solid var(--border); }
.reise-total b { color: var(--action-accent-text); }
label.mini { font-size: 0.68rem; font-weight: 600; color: var(--muted); }
.pauschal-subsection { display: grid; gap: 8px; }
.pauschal-subsection--abwesenheit { border-top: 1px solid var(--border); padding-top: 12px; }
.pauschal-subsection h5 { margin: 0; font-size: 0.78rem; color: var(--muted); }
.del-btn { --action-ghost-text: var(--status-danger-text); --action-accent-text: var(--status-danger-text); align-self: center; }
.rk-hint { color: var(--muted); font-size: 0.76rem; font-style: italic; margin: 0; }
.anlage-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; padding: 4px 0; }
.anlage-row .anlage-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anlage-row svg { color: var(--action-accent-text); }
.anlage-upload { border-style: dashed; }
.rk-summen { border-top: 1px solid var(--border); padding-top: 12px; gap: 6px; }
.summen-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
.summen-row .mini { display: inline-flex; align-items: center; gap: 4px; }
.summen-row .mini input { width: 100px; text-align: right; }
.summen-row--total { border-top: 1px solid var(--border); padding-top: 6px; font-size: 0.95rem; }
.summen-row--total b { color: var(--action-accent-text); }
.dialog__footer { width: 100%; display: flex; align-items: center; justify-content: end; gap: 10px; padding: 15px 18px; flex-wrap: wrap; border-top: 1px solid var(--border); }
.error { margin: 0 auto 0 0; color: var(--status-danger-text); font-size: 0.78rem; }
@media (max-width: 640px) { .base-grid { grid-template-columns: 1fr; } .betrag-row, .reise-row { grid-template-columns: 1fr 1fr; } }
</style>
