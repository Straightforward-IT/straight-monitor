<template>
  <Teleport to="body">
    <div v-if="modelValue" class="backdrop" @mousedown.self="close">
      <section class="dialog" role="dialog" aria-modal="true" aria-label="Reisekostenabrechnung">
        <header class="dialog__header">
          <div>
            <p>Einsatzdokument</p>
            <h3>{{ isEditing ? 'Reisekostenabrechnung bearbeiten' : 'Reisekostenabrechnung' }}</h3>
          </div>
          <button type="button" class="icon-button" title="Schließen" @click="close">
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </button>
        </header>

        <!-- Step breadcrumb -->
        <nav class="rk-steps">
          <button
            v-for="(s, i) in steps"
            :key="s.key"
            class="rk-step"
            :class="{ active: currentStep === i, done: currentStep > i, reachable: i <= maxReachableStep }"
            type="button"
            :disabled="i > maxReachableStep"
            @click="i <= maxReachableStep && (currentStep = i)"
          >
            <span class="rk-step-num">
              <font-awesome-icon v-if="currentStep > i" :icon="['fas', 'check']" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="rk-step-label">{{ s.label }}</span>
          </button>
        </nav>

        <div v-if="loading" class="dialog__body dialog__body--center">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lade…
        </div>

        <div v-else class="dialog__body">
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
                <label>Name, Vorname<input :value="`${form.kopf.name}${form.kopf.vorname ? ', ' + form.kopf.vorname : ''}`" type="text" disabled /></label>
                <label>Firma<input v-model="form.kopf.firma" type="text" /></label>
                <label>Zweck der Reise<input v-model="form.kopf.zweck" type="text" /></label>
                <label>Nummernschild<input v-model="form.kopf.nummernschild" type="text" placeholder="z. B. HH-AB 123" /></label>
                <label>Fahrt erfolgte mit
                  <select v-model="form.kopf.transportmittel">
                    <option value="dienstwagen">Dienstwagen</option>
                    <option value="privatpkw">Privat-PKW</option>
                    <option value="mietwagen">Mietwagen</option>
                    <option value="bahn">Bahn</option>
                    <option value="flugzeug">Flugzeug</option>
                  </select>
                </label>
                <label>Ort (Unterschrift)<input v-model="form.ort" type="text" placeholder="z. B. Hamburg" /></label>
                <label>Reisebeginn (Datum)<input v-model="form.kopf.reisebeginn" type="date" /></label>
                <label>Reiseende (Datum)<input v-model="form.kopf.reiseende" type="date" /></label>
                <label>Gesamtdauer (Tage)<input v-model.number="form.kopf.tage" type="number" min="0" /></label>
                <label>Gesamtdauer (Stunden)<input v-model="form.kopf.stunden" type="text" /></label>
              </div>
            </div>
          </section>

          <!-- ───────── STEP 2: Reisedaten ───────── -->
          <section v-show="currentStep === 1" class="rk-section">
            <div class="rk-block">
              <div class="section-heading">
                <h4>Reisedaten <span>Fahrtstrecke — erscheint als eigene Seite im Dokument</span></h4>
                <button type="button" class="add-btn" @click="addReiseRow"><font-awesome-icon :icon="['fas','plus']" /> Fahrt</button>
              </div>
              <p v-if="!form.reisedaten.length" class="rk-hint">Noch keine Fahrten. Füge Start, Ziel, Datum und Kilometer hinzu.</p>
              <div v-for="(row, i) in form.reisedaten" :key="'r'+i" class="reise-row">
                <label class="mini">Datum<input v-model="row.datum" type="date" /></label>
                <label class="mini">Start<AddressAutocomplete v-model="row.start" placeholder="Startadresse" :local-suggestions="addressSuggestions" /></label>
                <label class="mini">Ziel<AddressAutocomplete v-model="row.ziel" placeholder="Zieladresse" :local-suggestions="addressSuggestions" /></label>
                <label class="mini">km<input v-model.number="row.kilometer" type="number" step="0.1" min="0" /></label>
                <button type="button" class="del-btn" @click="form.reisedaten.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
              <div v-if="form.reisedaten.length" class="reise-total">
                <span>Gesamt</span><b>{{ reiseKmTotal.toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} km</b>
                <button type="button" class="add-btn" title="Gesamtkilometer in die Kilometerpauschale übernehmen" @click="kmInPauschale"><font-awesome-icon :icon="['fas','arrow-right']" /> In Pauschale</button>
              </div>
            </div>
          </section>

          <!-- ───────── STEP 3: Kostendaten ───────── -->
          <section v-show="currentStep === 2" class="rk-section">
            <!-- Fahrtkosten -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Fahrtkosten <span>Einzelnachweis mit Anlagen</span></h4>
                <button type="button" class="add-btn" @click="addBetragRow('fahrtkosten')"><font-awesome-icon :icon="['fas','plus']" /> Zeile</button>
              </div>
              <div v-for="(row, i) in form.fahrtkosten" :key="'f'+i" class="betrag-row">
                <input v-model="row.bezeichnung" type="text" placeholder="Bezeichnung" />
                <label class="mini">Bemessung €<input v-model.number="row.bemessungEur" type="number" step="0.01" min="0" /></label>
                <label class="mini">Betrag €<input v-model.number="row.betragEur" type="number" step="0.01" min="0" /></label>
                <label class="mini">%<input v-model.number="row.prozent" type="number" step="1" min="0" /></label>
                <button type="button" class="del-btn" @click="form.fahrtkosten.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
            </div>

            <!-- Kilometerpauschale -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Kilometerpauschale</h4>
                <button type="button" class="add-btn" @click="addKmRow"><font-awesome-icon :icon="['fas','plus']" /> Zeile</button>
              </div>
              <div v-for="(row, i) in form.kilometerpauschale" :key="'km'+i" class="betrag-row">
                <input v-model="row.bezeichnung" type="text" placeholder="Bezeichnung" />
                <label class="mini">Kilometer<input v-model.number="row.kilometer" type="number" step="1" min="0" /></label>
                <label class="mini">€ / km<input v-model.number="row.satzEur" type="number" step="0.01" min="0" /></label>
                <span class="row-total">{{ centToStr(kmGesamt(row)) }} €</span>
                <button type="button" class="del-btn" @click="form.kilometerpauschale.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
            </div>

            <!-- Übernachtungskosten -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Übernachtungskosten <span>ohne Frühstück</span></h4>
                <button type="button" class="add-btn" @click="addBetragRow('uebernachtung')"><font-awesome-icon :icon="['fas','plus']" /> Zeile</button>
              </div>
              <div v-for="(row, i) in form.uebernachtung" :key="'u'+i" class="betrag-row">
                <input v-model="row.bezeichnung" type="text" placeholder="Bezeichnung" />
                <label class="mini">Bemessung €<input v-model.number="row.bemessungEur" type="number" step="0.01" min="0" /></label>
                <label class="mini">Betrag €<input v-model.number="row.betragEur" type="number" step="0.01" min="0" /></label>
                <label class="mini">%<input v-model.number="row.prozent" type="number" step="1" min="0" /></label>
                <button type="button" class="del-btn" @click="form.uebernachtung.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
            </div>

            <!-- Pauschalbeträge -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Pauschalbeträge für Arbeitnehmer</h4>
                <button type="button" class="add-btn" @click="addPauschUeber"><font-awesome-icon :icon="['fas','plus']" /> Übernachtung</button>
              </div>
              <div v-for="(row, i) in form.pauschalen.uebernachtungen" :key="'pu'+i" class="betrag-row">
                <span class="row-label">Übernachtung</span>
                <label class="mini">Anzahl<input v-model.number="row.anzahl" type="number" step="1" min="0" /></label>
                <label class="mini">€ / Übernacht.<input v-model.number="row.satzEur" type="number" step="0.01" min="0" /></label>
                <span class="row-total">{{ centToStr(pauschGesamt(row)) }} €</span>
                <button type="button" class="del-btn" @click="form.pauschalen.uebernachtungen.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
              <div v-for="tag in tagKeys" :key="tag.key" class="betrag-row">
                <span class="row-label">{{ tag.label }}</span>
                <label class="mini">Tage<input v-model.number="form.pauschalen[tag.key].tage" type="number" step="1" min="0" /></label>
                <label class="mini">€ / Tag<input v-model.number="form.pauschalen[tag.key].satzEur" type="number" step="0.01" min="0" /></label>
                <span class="row-total">{{ centToStr(pauschGesamt(form.pauschalen[tag.key])) }} €</span>
              </div>
            </div>

            <!-- Nebenkosten -->
            <div class="rk-block">
              <div class="section-heading">
                <h4>Nebenkosten</h4>
                <button type="button" class="add-btn" @click="addBetragRow('nebenkosten')"><font-awesome-icon :icon="['fas','plus']" /> Zeile</button>
              </div>
              <div v-for="(row, i) in form.nebenkosten" :key="'n'+i" class="betrag-row">
                <input v-model="row.bezeichnung" type="text" placeholder="Bezeichnung" />
                <label class="mini">Bemessung €<input v-model.number="row.bemessungEur" type="number" step="0.01" min="0" /></label>
                <label class="mini">Betrag €<input v-model.number="row.betragEur" type="number" step="0.01" min="0" /></label>
                <label class="mini">%<input v-model.number="row.prozent" type="number" step="1" min="0" /></label>
                <button type="button" class="del-btn" @click="form.nebenkosten.splice(i,1)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
            </div>

            <!-- Summen -->
            <div class="rk-block rk-summen">
              <div class="summen-row"><span>Vorschuß</span><label class="mini"><input v-model.number="form.vorschussEur" type="number" step="0.01" min="0" /> €</label></div>
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
                <button type="button" class="del-btn" title="Entfernen" @click="deleteAnlage(a)"><font-awesome-icon :icon="['fas','xmark']" /></button>
              </div>
              <label class="anlage-upload" :class="{ disabled: uploadingAnlage }">
                <font-awesome-icon :icon="['fas', uploadingAnlage ? 'spinner' : 'upload']" :spin="uploadingAnlage" />
                {{ uploadingAnlage ? 'Wird hochgeladen…' : 'Belege hinzufügen (Bild / PDF)' }}
                <input type="file" multiple accept="image/*,application/pdf" class="sr-only" :disabled="uploadingAnlage" @change="uploadAnlagen" />
              </label>
            </div>
          </section>
        </div>

        <footer class="dialog__footer">
          <p v-if="error" class="error">{{ error }}</p>
          <button v-if="currentStep > 0" type="button" class="secondary" @click="currentStep--">
            <font-awesome-icon :icon="['fas','arrow-left']" /> Zurück
          </button>
          <button v-else type="button" class="secondary" @click="close">Abbrechen</button>

          <button type="button" class="secondary" :disabled="busy" @click="preview">
            <font-awesome-icon :icon="['fas','eye']" /> Vorschau
          </button>

          <button v-if="currentStep < steps.length - 1" type="button" class="primary" :disabled="!canAdvance" @click="currentStep++">
            Weiter <font-awesome-icon :icon="['fas','arrow-right']" />
          </button>
          <template v-else>
            <button type="button" class="secondary" :disabled="busy || !canSave" @click="save(false)">
              <font-awesome-icon :icon="['fas', busy ? 'spinner' : 'floppy-disk']" :spin="busy" /> Speichern
            </button>
            <button type="button" class="primary" :disabled="busy || !canSave" @click="save(true)">
              <font-awesome-icon :icon="['fas','file-signature']" /> Speichern & signieren
            </button>
          </template>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faSpinner, faXmark, faPlus, faEye, faFloppyDisk, faFileSignature, faUpload, faFilePdf, faFileImage, faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import { computeSummen, centToStr, kmGesamtCent, pauschalGesamtCent, eurToCent, centToEur } from '@/utils/reisekostenCalc';
import AddressAutocomplete from '@/components/AddressAutocomplete.vue';

library.add(faCheck, faSpinner, faXmark, faPlus, faEye, faFloppyDisk, faFileSignature, faUpload, faFilePdf, faFileImage, faArrowLeft, faArrowRight);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  auftragNr: { type: [Number, String], default: null },
  docId: { type: String, default: null },
  einsaetze: { type: Array, default: () => [] },
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
const serverAddressSuggestions = ref([]);
// Local id: starts from prop, set after the first (auto-)save so the doc can be edited/attached to.
const localDocId = ref(props.docId);

const tagKeys = [
  { key: 'tage24', label: 'Abwesenheit ≥ 24 Std' },
  { key: 'tage14', label: 'Abwesenheit ≥ 14 Std' },
  { key: 'tage8', label: 'Abwesenheit ≥ 8 Std' },
];

const isEditing = computed(() => !!localDocId.value);
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
      tage24: { tage: 0, satzEur: 0 },
      tage14: { tage: 0, satzEur: 0 },
      tage8: { tage: 0, satzEur: 0 },
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
  return { bezeichnung: r.bezeichnung || '', bemessungCent: eurToCent(r.bemessungEur), betragCent: eurToCent(r.betragEur), prozent: Number(r.prozent) || 0 };
}
function kmRowToCents(r) {
  return { bezeichnung: r.bezeichnung || '', kilometer: Number(r.kilometer) || 0, satzCent: eurToCent(r.satzEur) };
}
function pauschRowToCents(r) {
  return { anzahl: Number(r.anzahl) || 0, tage: Number(r.tage) || 0, satzCent: eurToCent(r.satzEur) };
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
const pauschGesamt = (row) => pauschalGesamtCent(pauschRowToCents(row));
const reiseKmTotal = computed(() => form.reisedaten.reduce((s, r) => s + (Number(r.kilometer) || 0), 0));
// Address autocomplete: server suggestions (event/office) + anything already typed.
const addressSuggestions = computed(() => {
  const set = new Set(serverAddressSuggestions.value);
  for (const r of form.reisedaten) { if (r.start) set.add(r.start); if (r.ziel) set.add(r.ziel); }
  return [...set].filter(Boolean);
});

// ── Row helpers ─────────────────────────────────────────────────────────────
function addBetragRow(section) {
  form[section].push({ bezeichnung: '', bemessungEur: 0, betragEur: 0, prozent: 0 });
}
function addKmRow() {
  form.kilometerpauschale.push({ bezeichnung: 'Kilometerpauschale', kilometer: 0, satzEur: 0.30 });
}
function addPauschUeber() {
  form.pauschalen.uebernachtungen.push({ anzahl: 0, satzEur: 0 });
}
function addReiseRow() {
  // Prefill date with the event range: first row = Reisebeginn, next = Reiseende.
  const datum = form.reisedaten.length === 0
    ? (form.kopf.reisebeginn || '')
    : (form.kopf.reiseende || form.kopf.reisebeginn || '');
  form.reisedaten.push({ datum, start: '', ziel: '', kilometer: 0 });
}
/** Copy the reisedaten km total into a Kilometerpauschale row. */
function kmInPauschale() {
  const km = Math.round(reiseKmTotal.value * 10) / 10;
  if (form.kilometerpauschale.length) {
    form.kilometerpauschale[0].kilometer = km;
  } else {
    form.kilometerpauschale.push({ bezeichnung: 'Kilometerpauschale', kilometer: km, satzEur: 0.30 });
  }
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
  form.kilometerpauschale = (d.kilometerpauschale || []).map((r) => ({ bezeichnung: r.bezeichnung || '', kilometer: r.kilometer || 0, satzEur: centToEur(r.satzCent) }));
  if (d.ort != null) form.ort = d.ort;
  if (Array.isArray(d.addressSuggestions)) serverAddressSuggestions.value = d.addressSuggestions;
}

function applyExisting(d) {
  form.personalNr = d.personalNr ?? null;
  applyDefaults(d);
  form.ort = d.ort || '';
  form.vorschussEur = centToEur(d.vorschussCent);
  const mapBetrag = (r) => ({ bezeichnung: r.bezeichnung || '', bemessungEur: centToEur(r.bemessungCent), betragEur: centToEur(r.betragCent), prozent: r.prozent || 0 });
  form.fahrtkosten = (d.fahrtkosten || []).map(mapBetrag);
  form.uebernachtung = (d.uebernachtung || []).map(mapBetrag);
  form.nebenkosten = (d.nebenkosten || []).map(mapBetrag);
  form.reisedaten = (d.reisedaten || []).map((r) => ({ datum: isoToDateInput(r.datum), start: r.start || '', ziel: r.ziel || '', kilometer: r.kilometer || 0 }));
  form.pauschalen.uebernachtungen = (d.pauschalen?.uebernachtungen || []).map((r) => ({ anzahl: r.anzahl || 0, satzEur: centToEur(r.satzCent) }));
  for (const t of ['tage24', 'tage14', 'tage8']) {
    const r = d.pauschalen?.[t] || {};
    form.pauschalen[t] = { tage: r.tage || 0, satzEur: centToEur(r.satzCent) };
  }
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
  if (!files.length) return;
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
  if (!localDocId.value) return;
  try {
    const { data } = await api.delete(`/api/reisekosten/${localDocId.value}/anlagen`, { data: { key: a.key } });
    anlagen.value = data.data.anlagen || [];
  } catch (e) {
    error.value = e.response?.data?.message || 'Entfernen fehlgeschlagen.';
  }
}

async function preview() {
  busy.value = true;
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
  }
}

async function save(sign) {
  busy.value = true;
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
    close();
  } catch (e) {
    error.value = e.response?.data?.message || 'Speichern fehlgeschlagen.';
  } finally {
    busy.value = false;
  }
}

function close() {
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
});
</script>

<style scoped lang="scss">
.backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 18px; background: var(--overlay); }
.dialog { width: min(760px, 100%); max-height: min(94vh, 1040px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); color: var(--text); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2); }
.dialog__header, .dialog__footer { display: flex; align-items: center; gap: 10px; padding: 15px 18px; }
.dialog__header { justify-content: space-between; border-bottom: 1px solid var(--border); }
.dialog__header p, .dialog__header h3 { margin: 0; }
.dialog__header p { color: var(--primary); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
.dialog__header h3 { font-size: 1.08rem; }

/* Steps */
.rk-steps { display: flex; gap: 4px; padding: 12px 18px; border-bottom: 1px solid var(--border); }
.rk-step { flex: 1; display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 8px; color: var(--muted); font-size: 0.8rem; font-weight: 600; opacity: 0.55; }
.rk-step.reachable { opacity: 1; }
.rk-step.active { color: var(--primary); }
.rk-step.done { color: var(--text); }
.rk-step:disabled { cursor: default; }
.rk-step-num { width: 22px; height: 22px; border-radius: 50%; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; flex-shrink: 0; }
.rk-step.active .rk-step-num { background: var(--primary); color: #fff; border-color: var(--primary); }
.rk-step.done .rk-step-num { background: #10b981; color: #fff; border-color: #10b981; }
.rk-step-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.dialog__body { flex: 1 1 auto; overflow: auto; padding: 18px; display: grid; gap: 20px; align-content: start; }
.dialog__body--center { place-items: center; color: var(--muted); }
.rk-section { display: grid; gap: 18px; }
.rk-block { display: grid; gap: 8px; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; }
.section-heading h4 { margin: 0; font-size: 0.9rem; }
.section-heading h4 span { color: var(--muted); font-size: 0.72rem; font-weight: 400; margin-left: 6px; }
.base-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.base-grid .span-2 { grid-column: 1 / -1; }
label { display: grid; gap: 5px; color: var(--text); font-size: 0.8rem; font-weight: 600; }
input, select, textarea { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 8px 9px; background: var(--surface, var(--tile-bg)); color: var(--text); font: inherit; font-weight: 400; }
input:focus, select:focus, textarea:focus { border-color: var(--primary); outline: none; }
input:disabled { opacity: 0.7; }
.betrag-row { display: grid; grid-template-columns: minmax(0, 1.6fr) 0.9fr 0.9fr 0.6fr auto; gap: 8px; align-items: end; }
.betrag-row .row-label, .betrag-row .row-total { align-self: center; font-size: 0.78rem; color: var(--muted); }
.betrag-row .row-total { text-align: right; font-weight: 600; color: var(--text); }
.reise-row { display: grid; grid-template-columns: 128px minmax(0, 1fr) minmax(0, 1fr) 76px auto; gap: 8px; align-items: end; }
.reise-row > label { min-width: 0; }
.reise-total { display: flex; align-items: center; gap: 10px; justify-content: flex-end; font-size: 0.85rem; padding-top: 8px; border-top: 1px solid var(--border); }
.reise-total b { color: var(--primary); }
label.mini { font-size: 0.68rem; font-weight: 600; color: var(--muted); }
.add-btn { border: 1px solid var(--border); background: transparent; color: var(--primary); border-radius: 6px; padding: 5px 9px; font-size: 0.74rem; font-weight: 600; cursor: pointer; }
.del-btn { border: none; background: transparent; color: #c3423f; cursor: pointer; padding: 8px; align-self: center; }
.rk-hint { color: var(--muted); font-size: 0.76rem; font-style: italic; margin: 0; }
.anlage-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; padding: 4px 0; }
.anlage-row .anlage-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anlage-row svg { color: var(--primary); }
.anlage-upload { display: inline-flex; align-items: center; gap: 8px; border: 1px dashed var(--border); border-radius: 6px; padding: 9px 12px; cursor: pointer; color: var(--primary); font-size: 0.8rem; font-weight: 600; }
.anlage-upload.disabled { opacity: 0.6; cursor: not-allowed; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.rk-summen { border-top: 1px solid var(--border); padding-top: 12px; gap: 6px; }
.summen-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
.summen-row .mini { display: inline-flex; align-items: center; gap: 4px; }
.summen-row .mini input { width: 100px; text-align: right; }
.summen-row--total { border-top: 1px solid var(--border); padding-top: 6px; font-size: 0.95rem; }
.summen-row--total b { color: var(--primary); }
.dialog__footer { justify-content: end; flex-wrap: wrap; border-top: 1px solid var(--border); }
.error { margin: 0 auto 0 0; color: #c3423f; font-size: 0.78rem; }
button { border: none; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 600; padding: 8px 12px; }
.icon-button, .secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
.primary { background: var(--primary); color: #fff; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
@media (max-width: 640px) { .base-grid { grid-template-columns: 1fr; } .betrag-row, .reise-row { grid-template-columns: 1fr 1fr; } }
</style>
