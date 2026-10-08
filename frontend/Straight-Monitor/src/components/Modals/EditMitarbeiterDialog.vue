<template>
  <ModalFrame
    title="Mitarbeiterdaten bearbeiten"
    :subtitle="employeeSubtitle"
    size="lg"
    layer="elevated"
    minimizable
    :minimize-id="minimizeId"
    :minimize-title="minimizeTitle"
    :show-close="!saving"
    :close-on-backdrop="!saving"
    :close-on-escape="!saving"
    class="edit-mitarbeiter-dialog"
    @close="requestClose"
  >
    <fieldset class="edit-form" :disabled="saving" :aria-busy="saving || undefined">
      <section class="form-section form-section--first">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-user" /></span>
          <h4>Persönliche Daten</h4>
        </div>
        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label :for="fieldId('vorname')">Vorname</label>
            <AppTextInput :id="fieldId('vorname')" v-model="form.vorname" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('nachname')">Nachname</label>
            <AppTextInput :id="fieldId('nachname')" v-model="form.nachname" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('personalnr')">Personalnr</label>
            <AppTextInput :id="fieldId('personalnr')" v-model="form.personalnr" class="form-input" :aria-describedby="fieldId('personalnr-help')" />
            <p :id="fieldId('personalnr-help')" class="help-text">
              Änderungen hier aktualisieren die aktuelle Personalnummer.
            </p>
          </div>
        </div>

        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label :for="fieldId('email')">E-Mail</label>
            <AppTextInput :id="fieldId('email')" v-model="form.email" type="email" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('telefon')">Telefon</label>
            <AppTextInput :id="fieldId('telefon')" v-model="form.telefon" type="tel" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('geburtsdatum')">Geburtsdatum</label>
            <AppTextInput :id="fieldId('geburtsdatum')" v-model="form.geburtsdatum" type="date" class="form-input" />
          </div>
        </div>

        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label :for="fieldId('geburtsname')">Geburtsname</label>
            <AppTextInput :id="fieldId('geburtsname')" v-model="form.geburtsname" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('geburtsort')">Geburtsort</label>
            <AppTextInput :id="fieldId('geburtsort')" v-model="form.geburtsort" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('iban')">IBAN</label>
            <AppTextInput :id="fieldId('iban')" v-model="form.iban" class="form-input" :class="{ 'form-input--missing': !form.iban }" :aria-invalid="!form.iban || undefined" :aria-describedby="!form.iban ? fieldId('iban-help') : undefined" autocomplete="off" />
            <p v-if="!form.iban" :id="fieldId('iban-help')" class="help-text help-text--missing">IBAN fehlt!</p>
          </div>
        </div>

        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label :for="fieldId('konfektionsgroesse')">Konfektionsgröße</label>
            <AppTextInput :id="fieldId('konfektionsgroesse')" v-model.trim="form.konfektionsgroesse" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('schuhgroesse')">Schuhgröße</label>
            <AppTextInput :id="fieldId('schuhgroesse')" v-model.trim="form.schuhgroesse" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('nationalitaet')">Staatsangehörigkeit</label>
            <AppSelect :id="fieldId('nationalitaet')" v-model="form.nationalitaet" class="form-input">
              <option value="">— nicht gesetzt —</option>
              <option v-for="nationalitaet in nationalitaeten" :key="nationalitaet.schluessel" :value="String(nationalitaet.schluessel)">
                {{ nationalitaetOptionLabel(nationalitaet) }}
              </option>
            </AppSelect>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-briefcase" /></span>
          <h4>Beschäftigung</h4>
        </div>
        <div class="form-grid form-grid--employment">
          <div class="form-group form-group--employment-type">
            <label :for="fieldId('persgruppe')">Personengruppe</label>
            <AppSelect :id="fieldId('persgruppe')" v-model="form.persgruppe" class="form-input">
              <option :value="null">— nicht gesetzt —</option>
              <option :value="101">101 – Festangestellt (Festi)</option>
              <option :value="110">110 – Kurzfristig angestellt (KZF)</option>
              <option :value="109">109 – Geringfügig angestellt (Mini)</option>
              <option :value="106">106 – Werkstudent (Werkst.)</option>
            </AppSelect>
            <label class="checkbox-label">
              <input v-model="form.persgruppe_set_explicitly" type="checkbox" />
              Manuell gesetzt – nicht vom Import überschreiben
            </label>
          </div>
          <div class="form-group">
            <label :for="fieldId('vorarbeitgebertage-days')">Vorarbeitgeber-Tage</label>
            <AppTextInput :id="fieldId('vorarbeitgebertage-days')" v-model.number="form.vorarbeitgebertage.days" type="number" min="0" step="1" class="form-input" />
          </div>
          <div class="form-group">
            <label :for="fieldId('vorarbeitgebertage-year')">Kalenderjahr</label>
            <AppTextInput :id="fieldId('vorarbeitgebertage-year')" v-model.number="form.vorarbeitgebertage.year" type="number" min="2000" step="1" class="form-input" />
          </div>
        </div>
      </section>

      <section class="form-section form-section--licenses">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-id-card" /></span>
          <h4>Führerscheine</h4>
        </div>
        <div class="list-editor">
          <div v-for="(license, index) in form.fuehrerscheine" :key="index" class="license-row">
            <AppTextInput
              v-model.trim="license.klasse"
              class="form-input"
              :aria-label="`Führerscheinklasse ${index + 1}`"
              placeholder="Klasse, z. B. B"
            />
            <AppTextInput
              v-model="license.gueltigVon"
              type="date"
              class="form-input"
              :aria-label="`Führerschein gültig von ${index + 1}`"
            />
            <AppTextInput
              v-model="license.gueltigBis"
              type="date"
              class="form-input"
              :aria-label="`Führerschein gültig bis ${index + 1}`"
            />
            <AppIconButton
              size="sm"
              variant="ghost"
              :label="`Führerschein ${index + 1} entfernen`"
              @click="removeLicense(index)"
            >
              <font-awesome-icon icon="fa-solid fa-trash" />
            </AppIconButton>
          </div>
          <AppButton size="sm" variant="secondary" @click="addLicense">
            <font-awesome-icon icon="fa-solid fa-plus" /> Führerschein hinzufügen
          </AppButton>
        </div>
      </section>

      <section class="form-section">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-location-dot" /></span>
          <h4>Adressen</h4>
        </div>
        <div class="address-group">
          <h5>Hauptadresse</h5>
          <div class="form-grid form-grid--address">
            <div class="form-group form-group--street">
              <label :for="fieldId('adresse-strasse')">Straße</label>
              <AppTextInput :id="fieldId('adresse-strasse')" v-model="form.adresse.strasse" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse-plz')">PLZ</label>
              <AppTextInput :id="fieldId('adresse-plz')" v-model="form.adresse.plz" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse-ort')">Ort</label>
              <AppTextInput :id="fieldId('adresse-ort')" v-model="form.adresse.ort" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse-land')">Land</label>
              <AppTextInput :id="fieldId('adresse-land')" v-model="form.adresse.land" class="form-input" />
            </div>
          </div>
        </div>
        <div class="address-group address-group--secondary">
          <div class="address-group__heading">
            <h5>Zweitadresse</h5>
            <span>Optional</span>
          </div>
          <div class="form-grid form-grid--address">
            <div class="form-group form-group--street">
              <label :for="fieldId('adresse2-strasse')">Straße</label>
              <AppTextInput :id="fieldId('adresse2-strasse')" v-model="form.adresse2.strasse" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse2-plz')">PLZ</label>
              <AppTextInput :id="fieldId('adresse2-plz')" v-model="form.adresse2.plz" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse2-ort')">Ort</label>
              <AppTextInput :id="fieldId('adresse2-ort')" v-model="form.adresse2.ort" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse2-land')">Land</label>
              <AppTextInput :id="fieldId('adresse2-land')" v-model="form.adresse2.land" class="form-input" />
            </div>
          </div>
          <div class="form-grid form-grid--two">
            <div class="form-group">
              <label :for="fieldId('adresse2-telefon')">Telefon</label>
              <AppTextInput :id="fieldId('adresse2-telefon')" v-model="form.adresse2.telefon" type="tel" class="form-input" />
            </div>
            <div class="form-group">
              <label :for="fieldId('adresse2-email')">E-Mail</label>
              <AppTextInput :id="fieldId('adresse2-email')" v-model="form.adresse2.email" type="email" class="form-input" />
            </div>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-envelope" /></span>
          <h4>Alternative E-Mails</h4>
        </div>
        <div class="list-editor">
          <div
            v-for="(email, index) in form.additionalEmails"
            :key="index"
            class="item-row"
          >
            <AppTextInput
              v-model="form.additionalEmails[index]"
              type="email"
              class="form-input"
              :aria-label="`Alternative E-Mail ${index + 1}`"
            />
            <AppIconButton
              size="sm"
              variant="ghost"
              :label="`Alternative E-Mail ${index + 1} entfernen`"
              @click="removeEmail(index)"
            >
              <font-awesome-icon icon="fa-solid fa-trash" />
            </AppIconButton>
          </div>
          <AppButton size="sm" variant="secondary" class="mt-2" @click="addEmail">
            <font-awesome-icon icon="fa-solid fa-plus" /> E-Mail hinzufügen
          </AppButton>
        </div>
      </section>

      <section class="form-section form-section--last">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-clock-rotate-left" /></span>
          <h4>Personalnummer-Historie</h4>
        </div>
        <div class="list-editor">
          <div v-if="canEditPersonalnrHistory" class="history-add-row">
            <AppTextInput
              :id="fieldId('personalnr-history')"
              v-model.trim="personalnrHistoryInput"
              class="form-input"
              placeholder="Personalnummer hinzufügen"
              :disabled="historySaving"
              @keyup.enter="addHistory"
            />
            <AppButton size="sm" variant="secondary" :loading="historySaving" :disabled="!personalnrHistoryInput" @click="addHistory">
              <font-awesome-icon v-if="!historySaving" icon="fa-solid fa-plus" />
              Hinzufügen
            </AppButton>
          </div>
          <div v-if="form.personalnrHistory && form.personalnrHistory.length > 0">
            <div
              v-for="(entry, index) in form.personalnrHistory"
              :key="index"
              class="item-row history-row"
            >
              <div class="history-value">
                <strong>{{ entry.value }}</strong>
                <span class="meta">
                  {{ formatDate(entry.updatedAt) }} ({{ entry.source }})
                </span>
              </div>
              <AppIconButton
                v-if="canEditPersonalnrHistory"
                size="sm"
                variant="ghost"
                :label="`Historieneintrag ${entry.value} entfernen`"
                @click="removeHistory(entry)"
              >
                <font-awesome-icon icon="fa-solid fa-trash" />
              </AppIconButton>
            </div>
          </div>
          <p v-else class="empty-state">Keine Historie vorhanden.</p>
        </div>
      </section>
    </fieldset>

    <template #footer>
      <div v-if="conflictInfo" class="edit-footer edit-footer--conflict">
        <div class="conflict-warning">
          <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
          Personalnr <strong>{{ form.personalnr }}</strong> wird verwendet von <strong>{{ conflictInfo.name }}</strong>.
          Trotzdem zuweisen? <em>{{ conflictInfo.name }} verliert dadurch die Personalnr.</em>
        </div>
        <div class="conflict-actions">
          <AppButton variant="ghost" :disabled="saving" @click="emit('cancel-conflict')">Abbrechen</AppButton>
          <AppButton variant="danger" :loading="saving" @click="saveForce">
            <font-awesome-icon v-if="!saving" icon="fa-solid fa-right-left" />
            Trotzdem zuweisen
          </AppButton>
        </div>
      </div>
      <div v-else class="edit-footer">
        <div class="modal-footer-actions">
          <AppButton variant="ghost" :disabled="saving" @click="requestClose">Abbrechen</AppButton>
          <AppButton :loading="saving" @click="save">
            <font-awesome-icon v-if="!saving" icon="fa-solid fa-save" />
            Speichern
          </AppButton>
        </div>
      </div>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, useId, watch } from "vue";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import ModalFrame from "@/components/frames/ModalFrame.vue";
import AppButton from "@/components/ui-elements/AppButton.vue";
import AppIconButton from "@/components/ui-elements/AppIconButton.vue";
import AppTextInput from "@/components/ui-elements/AppTextInput.vue";
import AppSelect from "@/components/ui-elements/AppSelect.vue";

const props = defineProps({
  mitarbeiter: {
    type: Object,
    required: true,
  },
  saving: {
    type: Boolean,
    default: false,
  },
  conflictInfo: {
    type: Object,
    default: null, // { id, name }
  },
  nationalitaeten: {
    type: Array,
    default: () => [],
  },
  canEditPersonalnrHistory: {
    type: Boolean,
    default: false,
  },
  historySaving: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "save", "save-force", "cancel-conflict", "add-personalnr-history", "remove-personalnr-history"]);
const formId = useId();
const fieldId = (field) => `${formId}-${field}`;
const personalnrHistoryInput = ref("");

function requestClose() {
  if (!props.saving) emit("close");
}

const employeeName = computed(() =>
  [props.mitarbeiter?.vorname, props.mitarbeiter?.nachname].filter(Boolean).join(" ")
);
const minimizeId = computed(() =>
  `edit-mitarbeiter-${props.mitarbeiter?._id || props.mitarbeiter?.personalnr || "employee"}`
);
const minimizeTitle = computed(() =>
  employeeName.value ? `${employeeName.value} bearbeiten` : "Mitarbeiter bearbeiten"
);
const employeeSubtitle = computed(() => {
  const personalnr = props.mitarbeiter?.personalnr ? `Personalnr. ${props.mitarbeiter.personalnr}` : "";
  return [employeeName.value, personalnr].filter(Boolean).join(" · ") || "Mitarbeiterprofil";
});

const form = ref({
  vorname: "",
  nachname: "",
  personalnr: "",
  email: "",
  telefon: "",
  iban: "",
  konfektionsgroesse: "",
  schuhgroesse: "",
  geburtsdatum: "",
  geburtsname: "",
  geburtsort: "",
  nationalitaet: "",
  additionalEmails: [],
  personalnrHistory: [],
  persgruppe: null,
  persgruppe_set_explicitly: false,
  vorarbeitgebertage: { year: new Date().getFullYear(), days: 0 },
  adresse: { strasse: "", plz: "", ort: "", land: "" },
  adresse2: { strasse: "", plz: "", ort: "", land: "", telefon: "", email: "" },
  fuehrerscheine: [],
});

// yyyy-MM-dd for <input type="date">
function toDateInput(val) {
  if (!val) return "";
  const d = new Date(val);
  return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
}

// Initialize form from props
watch(
  () => props.mitarbeiter,
  (newVal) => {
    if (newVal) {
      form.value = {
        vorname: newVal.vorname || "",
        nachname: newVal.nachname || "",
        personalnr: newVal.personalnr || "",
        email: newVal.email || "",
        telefon: newVal.telefon || "",
        iban: newVal.iban || "",
        konfektionsgroesse: newVal.konfektionsgroesse || "",
        schuhgroesse: newVal.schuhgroesse || "",
        geburtsdatum: toDateInput(newVal.geburtsdatum),
        geburtsname: newVal.geburtsname || "",
        geburtsort: newVal.geburtsort || "",
        nationalitaet: newVal.nationalitaet != null ? String(newVal.nationalitaet) : "",
        additionalEmails: [...(newVal.additionalEmails || [])],
        personalnrHistory: [...(newVal.personalnrHistory || [])],
        persgruppe: newVal.persgruppe ?? null,
        persgruppe_set_explicitly: !!newVal.persgruppe_set_explicitly,
        vorarbeitgebertage: {
          year: newVal.vorarbeitgebertage?.year ?? new Date().getFullYear(),
          days: newVal.vorarbeitgebertage?.days ?? 0,
        },
        adresse: {
          strasse: newVal.adresse?.strasse || "",
          plz: newVal.adresse?.plz || "",
          ort: newVal.adresse?.ort || "",
          land: newVal.adresse?.land || "",
        },
        adresse2: {
          strasse: newVal.adresse2?.strasse || "",
          plz: newVal.adresse2?.plz || "",
          ort: newVal.adresse2?.ort || "",
          land: newVal.adresse2?.land || "",
          telefon: newVal.adresse2?.telefon || "",
          email: newVal.adresse2?.email || "",
        },
        fuehrerscheine: (Array.isArray(newVal.fuehrerscheine)
          ? newVal.fuehrerscheine
          : newVal.fuehrerschein
            ? [newVal.fuehrerschein]
            : []
        ).map((license) => ({
          klasse: license.klasse || "",
          gueltigVon: toDateInput(license.gueltigVon),
          gueltigBis: toDateInput(license.gueltigBis),
          source: license.source || "manual",
        })),
      };
    }
  },
  { immediate: true }
);

function addEmail() {
  if (props.saving) return;
  form.value.additionalEmails.push("");
}

function removeEmail(index) {
  if (props.saving) return;
  form.value.additionalEmails.splice(index, 1);
}

function addLicense() {
  if (props.saving) return;
  form.value.fuehrerscheine.push({ klasse: "", gueltigVon: "", gueltigBis: "", source: "manual" });
}

function removeLicense(index) {
  if (props.saving) return;
  form.value.fuehrerscheine.splice(index, 1);
}

function removeHistory(index) {
  if (props.historySaving || !index?._id) return;
  if (confirm("Diesen Historien-Eintrag wirklich löschen?")) {
    emit("remove-personalnr-history", index._id);
  }
}

function addHistory() {
  const value = personalnrHistoryInput.value.trim();
  if (!value || props.historySaving) return;
  emit("add-personalnr-history", value);
  personalnrHistoryInput.value = "";
}

watch(
  () => props.mitarbeiter?.personalnrHistory,
  (history) => {
    form.value.personalnrHistory = [...(history || [])];
  },
  { deep: true },
);

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return format(new Date(dateStr), "dd.MM.yyyy HH:mm", { locale: de });
}

function nationalitaetOptionLabel(nationalitaet) {
  const label = nationalitaet.staatAngehoerigkeit || nationalitaet.natKennz;
  return label ? `${nationalitaet.staat} (${label})` : nationalitaet.staat;
}

function archiveOldPersonalnrIfChanged() {
  const oldNr = props.mitarbeiter?.personalnr?.trim();
  const newNr = form.value.personalnr?.trim();
  if (oldNr && newNr && oldNr !== newNr) {
    const alreadyInHistory = form.value.personalnrHistory.some(
      (e) => e.value === oldNr
    );
    if (!alreadyInHistory) {
      form.value.personalnrHistory.unshift({
        value: oldNr,
        updatedAt: new Date().toISOString(),
        updatedBy: "user",
        source: "manual",
      });
    }
  }
}

function save() {
  if (props.saving) return;
  form.value.additionalEmails = form.value.additionalEmails.filter(
    (e) => e && e.trim() !== ""
  );
  archiveOldPersonalnrIfChanged();
  emit("save", form.value);
}

function saveForce() {
  if (props.saving) return;
  form.value.additionalEmails = form.value.additionalEmails.filter(
    (e) => e && e.trim() !== ""
  );
  archiveOldPersonalnrIfChanged();
  emit("save-force", form.value);
}
</script>

<style scoped lang="scss">
:global(.edit-mitarbeiter-dialog) {
  --mf-max-width: min(1040px, calc(100vw - 32px));
  --mf-max-height: min(860px, calc(100dvh - 32px));
  --mf-body-padding: 0;
  --mf-header-padding: 17px 24px;
  --mf-footer-padding: 13px 24px;
  --mf-radius: 10px;
  --mf-border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  --mf-shadow: 0 24px 64px rgba(0, 0, 0, 0.24);
  --mf-title-size: 1.08rem;
}

:global(.edit-mitarbeiter-dialog .mf-header) {
  background: color-mix(in srgb, var(--tile-bg, var(--surface)) 94%, var(--primary) 6%);
}

:global(.edit-mitarbeiter-dialog .mf-subtitle) {
  margin-bottom: 2px;
  text-transform: none;
  letter-spacing: 0;
}

:global(.edit-mitarbeiter-dialog .mf-footer) {
  background: var(--tile-bg, var(--surface));
}

.edit-form {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
}

.form-section {
  margin: 0;
  padding: 20px 24px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);

  &:nth-child(even) {
    background: color-mix(in srgb, var(--tile-bg, var(--surface)) 96%, var(--text) 4%);
  }
}

.form-section--last {
  border-bottom: 0;
}

.form-section__heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;

  h4 {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
    font-weight: 700;
  }
}

.form-section__icon {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  font-size: 0.8rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;

  & + & {
    margin-top: 14px;
  }
}

.form-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-grid--address {
  grid-template-columns: minmax(0, 2fr) minmax(90px, 0.65fr) minmax(0, 1.25fr) minmax(0, 1fr);
}

.form-grid--employment {
  grid-template-columns: minmax(280px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr);
}

.form-group {
  min-width: 0;

  label {
    display: block;
    margin-bottom: 6px;
    font-weight: 600;
    font-size: 0.78rem;
    color: var(--muted);
  }
}

.form-input {
  width: 100%;
  min-height: 40px;
}

.form-input--missing {
  border-color: var(--status-danger-text, #c43d3d);

  &:focus {
    border-color: var(--status-danger-text, #c43d3d);
    outline-color: color-mix(in srgb, var(--status-danger-text, #c43d3d) 42%, transparent);
  }
}

.help-text {
  margin: 5px 0 0;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.3;
}

.help-text--missing {
  color: var(--status-danger-text, #c43d3d);
  font-weight: 600;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  margin: 9px 0 0 !important;
  font-size: 0.76rem !important;
  line-height: 1.35;
  cursor: pointer;

  input {
    width: 15px;
    height: 15px;
    margin: 0;
    flex: 0 0 auto;
    accent-color: var(--primary);
  }
}

.address-group {
  h5 {
    margin: 0 0 11px;
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 700;
  }
}

.address-group--secondary {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px dashed color-mix(in srgb, var(--border) 75%, transparent);
}

.address-group__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 11px;

  h5 {
    margin: 0;
  }

  span {
    color: var(--muted);
    font-size: 0.7rem;
  }
}

.list-editor {
  max-width: 720px;
}

.item-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;

  .form-input {
    flex: 1;
  }

  .app-icon-button {
    color: var(--status-danger-text, #c43d3d);
  }

  .app-icon-button:hover:not(:disabled) {
    color: var(--status-danger-text, #c43d3d);
    background: color-mix(in srgb, var(--status-danger-text, #c43d3d) 10%, transparent);
  }

  &.history-row {
    justify-content: space-between;
    min-height: 42px;
    padding: 7px 8px 7px 12px;
    border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
    background: var(--tile-bg, var(--surface));
    border-radius: 6px;
  }
}

.form-section--licenses {
  padding-top: 12px;
  padding-bottom: 14px;

  .form-section__heading {
    margin-bottom: 10px;
  }

  .form-section__icon {
    width: 26px;
    height: 26px;
    flex-basis: 26px;
    font-size: 0.72rem;
  }

  .form-section__heading h4 {
    font-size: 0.88rem;
  }
}

.license-row {
  display: grid;
  grid-template-columns: minmax(100px, 0.8fr) minmax(150px, 1fr) minmax(150px, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;

  .form-input {
    min-height: 34px;
  }
}

.history-value {
  display: flex;
  flex-direction: column;

  strong {
    font-size: 0.95rem;
  }

  .meta {
    font-size: 0.8rem;
    color: var(--muted);
  }
}

.mt-2 {
  margin-top: 0.5rem;
}

.empty-state {
  color: var(--muted);
  font-style: italic;
  font-size: 0.9rem;
}

.conflict-warning {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text);
  line-height: 1.5;

  svg {
    color: var(--status-warning-text, #a66b00);
    margin-right: 0.4rem;
  }

  em {
    color: var(--muted);
    font-style: normal;
  }
}

.conflict-actions {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
  justify-content: flex-end;
}

.edit-footer {
  width: 100%;
}

.edit-footer--conflict {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

@media (max-width: 620px) {
  :global(.edit-mitarbeiter-dialog) {
    --mf-max-width: calc(100vw - 16px);
    --mf-max-height: calc(100dvh - 16px);
    --mf-header-padding: 14px 16px;
    --mf-footer-padding: 12px 16px;
    --mf-radius: 8px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;

    & + & {
      margin-top: 0;
    }
  }

  .form-group + .form-group {
    margin-top: 13px;
  }

  .form-section {
    padding: 18px 16px 20px;
  }

  .form-section__heading {
    margin-bottom: 14px;
  }

  .form-section--licenses {
    padding-top: 12px;
    padding-bottom: 14px;
  }

  .license-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;

    .form-input:first-child {
      grid-column: 1 / -1;
    }
  }

  .conflict-actions,
  .modal-footer-actions {
    width: 100%;

    .app-button {
      flex: 1;
    }
  }
}

@media (min-width: 621px) and (max-width: 820px) {
  .form-grid--three,
  .form-grid--address,
  .form-grid--employment {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-group--employment-type,
  .form-group--street {
    grid-column: 1 / -1;
  }

  .license-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;

    .form-input:first-child {
      grid-column: 1 / -1;
    }
  }
}
</style>
