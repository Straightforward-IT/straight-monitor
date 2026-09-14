<template>
  <ModalFrame
    title="Mitarbeiterdaten bearbeiten"
    :subtitle="employeeSubtitle"
    size="lg"
    layer="elevated"
    class="edit-mitarbeiter-dialog"
    @close="emit('close')"
  >
    <div class="edit-form">
      <section class="form-section form-section--first">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-user" /></span>
          <h4>Persönliche Daten</h4>
        </div>
        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label>Vorname</label>
            <input v-model="form.vorname" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>Nachname</label>
            <input v-model="form.nachname" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>Personalnr</label>
            <input v-model="form.personalnr" type="text" class="form-input" />
            <p class="help-text">
              Änderungen hier aktualisieren die aktuelle Personalnummer.
            </p>
          </div>
        </div>

        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label>E-Mail</label>
            <input v-model="form.email" type="email" class="form-input" />
          </div>
          <div class="form-group">
            <label>Telefon</label>
            <input v-model="form.telefon" type="tel" class="form-input" />
          </div>
          <div class="form-group">
            <label>Geburtsdatum</label>
            <input v-model="form.geburtsdatum" type="date" class="form-input" />
          </div>
        </div>

        <div class="form-grid form-grid--three">
          <div class="form-group">
            <label>Geburtsname</label>
            <input v-model="form.geburtsname" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>Geburtsort</label>
            <input v-model="form.geburtsort" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>Erstellt von</label>
            <input v-model="form.erstellt_von" type="text" class="form-input" />
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
            <label>Personengruppe</label>
            <select v-model="form.persgruppe" class="form-input">
              <option :value="null">— nicht gesetzt —</option>
              <option :value="101">101 – Festangestellt (Festi)</option>
              <option :value="110">110 – Kurzfristig angestellt (KZF)</option>
              <option :value="109">109 – Geringfügig angestellt (Mini)</option>
              <option :value="106">106 – Werkstudent (Werkst.)</option>
            </select>
            <label class="checkbox-label">
              <input v-model="form.persgruppe_set_explicitly" type="checkbox" />
              Manuell gesetzt – nicht vom Import überschreiben
            </label>
          </div>
          <div class="form-group">
            <label>Vorarbeitgeber-Tage</label>
            <input v-model.number="form.vorarbeitgebertage.days" type="number" min="0" step="1" class="form-input" />
          </div>
          <div class="form-group">
            <label>Kalenderjahr</label>
            <input v-model.number="form.vorarbeitgebertage.year" type="number" min="2000" step="1" class="form-input" />
          </div>
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
              <label>Straße</label>
              <input v-model="form.adresse.strasse" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>PLZ</label>
              <input v-model="form.adresse.plz" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>Ort</label>
              <input v-model="form.adresse.ort" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>Land</label>
              <input v-model="form.adresse.land" type="text" class="form-input" />
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
              <label>Straße</label>
              <input v-model="form.adresse2.strasse" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>PLZ</label>
              <input v-model="form.adresse2.plz" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>Ort</label>
              <input v-model="form.adresse2.ort" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>Land</label>
              <input v-model="form.adresse2.land" type="text" class="form-input" />
            </div>
          </div>
          <div class="form-grid form-grid--two">
            <div class="form-group">
              <label>Telefon</label>
              <input v-model="form.adresse2.telefon" type="tel" class="form-input" />
            </div>
            <div class="form-group">
              <label>E-Mail</label>
              <input v-model="form.adresse2.email" type="email" class="form-input" />
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
            <input
              v-model="form.additionalEmails[index]"
              type="email"
              class="form-input"
            />
            <button
              type="button"
              class="btn btn-sm btn-icon btn-danger"
              @click="removeEmail(index)"
              aria-label="E-Mail entfernen"
              title="E-Mail entfernen"
            >
              <font-awesome-icon icon="fa-solid fa-trash" />
            </button>
          </div>
          <button type="button" class="btn btn-sm btn-secondary mt-2" @click="addEmail">
            <font-awesome-icon icon="fa-solid fa-plus" /> E-Mail hinzufügen
          </button>
        </div>
      </section>

      <section class="form-section form-section--last">
        <div class="form-section__heading">
          <span class="form-section__icon"><font-awesome-icon icon="fa-solid fa-clock-rotate-left" /></span>
          <h4>Personalnummer-Historie</h4>
        </div>
        <div class="list-editor">
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
              <button
                type="button"
                class="btn btn-sm btn-icon btn-danger"
                @click="removeHistory(index)"
                aria-label="Historieneintrag entfernen"
                title="Eintrag entfernen"
              >
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </div>
          </div>
          <p v-else class="empty-state">Keine Historie vorhanden.</p>
        </div>
      </section>
    </div>

    <template #footer>
      <div v-if="conflictInfo" class="edit-footer edit-footer--conflict">
        <div class="conflict-warning">
          <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
          Personalnr <strong>{{ form.personalnr }}</strong> wird verwendet von <strong>{{ conflictInfo.name }}</strong>.
          Trotzdem zuweisen? <em>{{ conflictInfo.name }} verliert dadurch die Personalnr.</em>
        </div>
        <div class="conflict-actions">
          <button type="button" class="btn btn-ghost" @click="$emit('cancel-conflict')">Abbrechen</button>
          <button type="button" class="btn btn-danger" :disabled="saving" @click="saveForce">
            <font-awesome-icon :icon="saving ? 'fa-solid fa-spinner' : 'fa-solid fa-right-left'" :class="{ 'fa-spin': saving }" />
            Trotzdem zuweisen
          </button>
        </div>
      </div>
      <div v-else class="edit-footer">
        <div class="modal-footer-actions">
          <button type="button" class="btn btn-ghost" @click="emit('close')">Abbrechen</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
            <font-awesome-icon
              :icon="saving ? 'fa-solid fa-spinner' : 'fa-solid fa-save'"
              :class="{ 'fa-spin': saving }"
            />
            Speichern
          </button>
        </div>
      </div>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import ModalFrame from "@/components/frames/ModalFrame.vue";

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
});

const emit = defineEmits(["close", "save", "save-force", "cancel-conflict"]);

const employeeSubtitle = computed(() => {
  const name = [props.mitarbeiter?.vorname, props.mitarbeiter?.nachname].filter(Boolean).join(" ");
  const personalnr = props.mitarbeiter?.personalnr ? `Personalnr. ${props.mitarbeiter.personalnr}` : "";
  return [name, personalnr].filter(Boolean).join(" · ") || "Mitarbeiterprofil";
});

const form = ref({
  vorname: "",
  nachname: "",
  personalnr: "",
  email: "",
  telefon: "",
  geburtsdatum: "",
  geburtsname: "",
  geburtsort: "",
  erstellt_von: "",
  additionalEmails: [],
  personalnrHistory: [],
  persgruppe: null,
  persgruppe_set_explicitly: false,
  vorarbeitgebertage: { year: new Date().getFullYear(), days: 0 },
  adresse: { strasse: "", plz: "", ort: "", land: "" },
  adresse2: { strasse: "", plz: "", ort: "", land: "", telefon: "", email: "" },
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
        geburtsdatum: toDateInput(newVal.geburtsdatum),
        geburtsname: newVal.geburtsname || "",
        geburtsort: newVal.geburtsort || "",
        erstellt_von: newVal.erstellt_von || "",
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
      };
    }
  },
  { immediate: true }
);

function addEmail() {
  form.value.additionalEmails.push("");
}

function removeEmail(index) {
  form.value.additionalEmails.splice(index, 1);
}

function removeHistory(index) {
  if (confirm("Diesen Historien-Eintrag wirklich löschen?")) {
    form.value.personalnrHistory.splice(index, 1);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return format(new Date(dateStr), "dd.MM.yyyy HH:mm", { locale: de });
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
  form.value.additionalEmails = form.value.additionalEmails.filter(
    (e) => e && e.trim() !== ""
  );
  archiveOldPersonalnrIfChanged();
  emit("save", form.value);
}

function saveForce() {
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
  padding: 9px 11px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg, var(--tile-bg));
  color: var(--text);
  font-size: 0.9rem;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;

  &:hover:not(:focus) {
    border-color: color-mix(in srgb, var(--border) 55%, var(--text));
  }

  &:focus {
    border-color: var(--primary);
    outline: none;
    background: var(--tile-bg, var(--surface));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent);
  }
}

.help-text {
  margin: 5px 0 0;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.3;
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

  &.history-row {
    justify-content: space-between;
    min-height: 42px;
    padding: 7px 8px 7px 12px;
    border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
    background: var(--tile-bg, var(--surface));
    border-radius: 6px;
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

.btn {
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;

  &.btn-primary {
    background: var(--primary);
    color: white;
    &:hover {
      background: color-mix(in srgb, var(--primary) 88%, black);
    }
  }

  &.btn-secondary {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    &:hover {
      background: var(--hover);
    }
  }

  &.btn-ghost {
    background: transparent;
    color: var(--muted);
    &:hover {
      color: var(--text);
      background: var(--hover);
    }
  }

  &.btn-danger {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
    &:hover {
      background: rgba(220, 53, 69, 0.2);
    }
  }

  &.btn-icon {
    width: 36px;
    padding: 0;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.conflict-warning {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text);
  line-height: 1.5;

  svg {
    color: #f59e0b;
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

  .conflict-actions,
  .modal-footer-actions {
    width: 100%;

    .btn {
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
}
</style>
