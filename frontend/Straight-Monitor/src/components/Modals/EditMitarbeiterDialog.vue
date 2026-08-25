<template>
  <ModalFrame
    title="Mitarbeiter Daten bearbeiten"
    size="lg"
    layer="elevated"
    class="edit-mitarbeiter-dialog"
    @close="emit('close')"
  >
      <div class="edit-form">
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

        <div class="form-group">
          <label>Personengruppe</label>
          <select v-model="form.persgruppe" class="form-input">
            <option :value="null">— nicht gesetzt —</option>
            <option :value="101">101 – Festangestellt (Festi)</option>
            <option :value="110">110 – Kurzfristig angestellt (KZF)</option>
            <option :value="109">109 – Geringfügig angestellt (Mini)</option>
            <option :value="106">106 – Werkstudent (Werkst.)</option>
          </select>
          <label class="checkbox-label" style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)">
            <input type="checkbox" v-model="form.persgruppe_set_explicitly" />
            Manuell gesetzt – nicht vom Import überschreiben
          </label>
        </div>

        <!-- Adresse -->
        <div class="form-section">
          <h4>Adresse</h4>
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

        <!-- Adresse 2 -->
        <div class="form-section">
          <h4>Adresse 2 (Zweitadresse)</h4>
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

        <!-- Additional Emails -->
        <div class="form-section">
          <h4>Alternative E-Mails</h4>
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
              class="btn btn-sm btn-icon btn-danger"
              @click="removeEmail(index)"
            >
              <font-awesome-icon icon="fa-solid fa-trash" />
            </button>
          </div>
          <button class="btn btn-sm btn-secondary mt-2" @click="addEmail">
            <font-awesome-icon icon="fa-solid fa-plus" /> E-Mail hinzufügen
          </button>
        </div>

        <!-- Personalnr History -->
        <div class="form-section">
          <h4>Personalnummer Historie</h4>
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
                class="btn btn-sm btn-icon btn-danger"
                @click="removeHistory(index)"
                title="Eintrag entfernen"
              >
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </div>
          </div>
          <p v-else class="empty-state">Keine Historie vorhanden.</p>
        </div>
      </div>

      <template #footer>
        <!-- Conflict confirmation -->
        <div v-if="conflictInfo" class="edit-footer edit-footer--conflict">
          <div class="conflict-warning">
            <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
            Personalnr <strong>{{ form.personalnr }}</strong> wird verwendet von <strong>{{ conflictInfo.name }}</strong>.
            Trotzdem zuweisen? <em>{{ conflictInfo.name }} verliert dadurch die Personalnr.</em>
          </div>
          <div class="conflict-actions">
            <button class="btn btn-ghost" @click="$emit('cancel-conflict')">Abbrechen</button>
            <button class="btn btn-danger" @click="saveForce" :disabled="saving">
              <font-awesome-icon :icon="saving ? 'fa-solid fa-spinner' : 'fa-solid fa-right-left'" :class="{ 'fa-spin': saving }" />
              Trotzdem zuweisen
            </button>
          </div>
        </div>
        <div v-else class="edit-footer">
          <div class="modal-footer-actions">
            <button class="btn btn-ghost" @click="emit('close')">Abbrechen</button>
            <button class="btn btn-primary" @click="save" :disabled="saving">
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
import { ref, watch } from "vue";
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
.edit-mitarbeiter-dialog {
  --mf-max-width: min(960px, 94vw);
  --mf-body-padding: 24px;
  --mf-footer-padding: 16px 24px;
}

.edit-form {
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-grid--address {
  grid-template-columns: minmax(0, 2fr) minmax(90px, 0.65fr) minmax(0, 1.25fr) minmax(0, 1fr);
}

.form-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--muted);
  }
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
  box-sizing: border-box;

  &:focus {
    border-color: var(--primary);
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 117, 24, 0.15);
  }
}

.help-text {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.form-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);

  h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }
}

.item-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  align-items: center;

  &.history-row {
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--hover);
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
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &.btn-primary {
    background: var(--primary);
    color: white;
    &:hover {
      filter: brightness(1.1);
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
    padding: 0.5rem;
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
  .edit-mitarbeiter-dialog {
    --mf-body-padding: 18px;
    --mf-footer-padding: 14px 18px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

@media (min-width: 621px) and (max-width: 820px) {
  .form-grid--three,
  .form-grid--address {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-group--street {
    grid-column: 1 / -1;
  }
}
</style>
