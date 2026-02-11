<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content">
      <header class="modal-header">
        <h3>Mitarbeiter Daten bearbeiten</h3>
        <button class="close-btn" @click="$emit('close')">
          <font-awesome-icon icon="fa-solid fa-times" />
        </button>
      </header>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Vorname</label>
            <input v-model="form.vorname" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>Nachname</label>
            <input v-model="form.nachname" type="text" class="form-input" />
          </div>
        </div>

        <div class="form-group">
          <label>Personalnr</label>
          <input v-model="form.personalnr" type="text" class="form-input" />
          <p class="help-text">
            Änderungen hier aktualisieren die aktuelle Personalnummer.
          </p>
        </div>

        <div class="form-group">
          <label>E-Mail</label>
          <input v-model="form.email" type="email" class="form-input" />
        </div>

        <div class="form-group">
          <label>Erstellt von</label>
          <input v-model="form.erstellt_von" type="text" class="form-input" />
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

      <footer class="modal-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Abbrechen</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">
          <font-awesome-icon
            :icon="saving ? 'fa-solid fa-spinner' : 'fa-solid fa-save'"
            :class="{ 'fa-spin': saving }"
          />
          Speichern
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const props = defineProps({
  mitarbeiter: {
    type: Object,
    required: true,
  },
  saving: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "save"]);

const form = ref({
  vorname: "",
  nachname: "",
  personalnr: "",
  email: "",
  erstellt_von: "",
  additionalEmails: [],
  personalnrHistory: [],
});

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
        erstellt_von: newVal.erstellt_von || "",
        additionalEmails: [...(newVal.additionalEmails || [])],
        personalnrHistory: [...(newVal.personalnrHistory || [])],
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

function save() {
  // Filter empty emails
  form.value.additionalEmails = form.value.additionalEmails.filter(
    (e) => e && e.trim() !== ""
  );
  emit("save", form.value);
}
</script>

<style scoped lang="scss">
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--surface, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--surface);

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  background: var(--surface);
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: var(--surface);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-muted);
  }
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-color);
  font-size: 0.95rem;

  &:focus {
    border-color: var(--primary-color);
    outline: none;
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
  }
}

.help-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.form-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);

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
    background: var(--bg-hover);
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
    color: var(--text-muted);
  }
}

.mt-2 {
  margin-top: 0.5rem;
}

.empty-state {
  color: var(--text-muted);
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
    background: var(--primary-color);
    color: white;
    &:hover {
      filter: brightness(1.1);
    }
  }

  &.btn-secondary {
    background: var(--bg-element);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    &:hover {
      background: var(--bg-hover);
    }
  }

  &.btn-ghost {
    background: transparent;
    color: var(--text-muted);
    &:hover {
      color: var(--text-color);
      background: var(--bg-hover);
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

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;

  &:hover {
    color: var(--text-color);
  }
}
</style>
