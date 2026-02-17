<template>
  <div class="public-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Daten werden geladen...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">!</div>
      <h2>Fehler</h2>
      <p>{{ error }}</p>
    </div>

    <!-- No Email -->
    <div v-else-if="!email || !publicToken" class="error-state">
      <h2>Kein Zugriff</h2>
      <p>Fehlende Zugangsdaten. Bitte öffne diese Seite über die Flip App.</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="mitarbeiter" class="content">
      <PublicHeader :vorname="mitarbeiter.vorname" />

      <!-- Header -->
      <div class="page-content">
        <div class="page-header">
          <p class="subtitle">Deine Einsätze & Event Reports</p>
        </div>

        <!-- Einsätze List -->
        <div class="section">
          <h2>Vergangene Einsätze</h2>
          <div v-if="einsaetze.length === 0" class="empty-state">
            Keine vergangenen Einsätze gefunden.
          </div>
          <div v-else class="einsatz-list">
            <div
              v-for="einsatz in einsaetze"
              :key="einsatz._id"
              class="einsatz-card"
            >
              <div class="einsatz-header">
                <span class="einsatz-title">
                  {{
                    einsatz.auftrag?.eventTitel ||
                    einsatz.bezeichnung ||
                    `Auftrag #${einsatz.auftragNr}`
                  }}
                </span>
                <span class="einsatz-date">
                  {{ formatDate(einsatz.datumVon) }} –
                  {{ formatDate(einsatz.datumBis) }}
                </span>
              </div>
              <div class="einsatz-details">
                <span v-if="einsatz.auftrag?.eventLocation">
                  <i class="fa-solid fa-location-dot"></i>
                  {{ einsatz.auftrag.eventLocation }}
                </span>
                <span v-if="einsatz.auftrag?.eventOrt">
                  {{ einsatz.auftrag.eventOrt }}
                </span>
                <span class="auftrag-nr">Nr. {{ einsatz.auftragNr }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- EventReport Section -->
        <div class="section">
          <h2>Event Report schreiben</h2>

          <!-- Success Message -->
          <div v-if="submitSuccess" class="success-message">
            <i class="fa-solid fa-check-circle"></i>
            EventReport erfolgreich eingereicht!
          </div>

          <form v-else @submit.prevent="submitReport" class="report-form">
            <!-- Einsatz Dropdown -->
            <div class="form-group">
              <label>Einsatz auswählen *</label>
              <select
                v-model="selectedEinsatz"
                required
                @change="onEinsatzSelect"
              >
                <option value="" disabled>— Einsatz wählen —</option>
                <option
                  v-for="einsatz in einsaetze"
                  :key="einsatz._id"
                  :value="einsatz._id"
                >
                  {{
                    einsatz.auftrag?.eventTitel ||
                    einsatz.bezeichnung ||
                    `Auftrag #${einsatz.auftragNr}`
                  }}
                  ({{ formatDate(einsatz.datumVon) }})
                </option>
              </select>
            </div>

            <!-- Pre-filled from Einsatz -->
            <div class="form-row">
              <div class="form-group">
                <label>Standort *</label>
                <input v-model="form.location" type="text" required />
              </div>
              <div class="form-group">
                <label>Kunde *</label>
                <input v-model="form.kunde" type="text" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Auftragnummer</label>
                <input
                  v-model="form.auftragnummer"
                  type="text"
                  readonly
                  class="readonly"
                />
              </div>
              <div class="form-group">
                <label>Datum *</label>
                <input v-model="form.datum" type="date" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Teamleiter</label>
                <input
                  :value="mitarbeiter.vorname + ' ' + mitarbeiter.nachname"
                  type="text"
                  readonly
                  class="readonly"
                />
              </div>
              <div class="form-group">
                <label>Mitarbeiter Anzahl</label>
                <input v-model="form.mitarbeiter_anzahl" type="text" />
              </div>
            </div>

            <!-- Rating Fields -->
            <div class="form-group">
              <label>Pünktlichkeit</label>
              <div class="rating-group">
                <label
                  v-for="option in ratingOptions"
                  :key="'p-' + option"
                  class="radio-label"
                >
                  <input
                    type="radio"
                    v-model="form.puenktlichkeit"
                    :value="option"
                  />
                  {{ option }}
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Erscheinungsbild</label>
              <div class="rating-group">
                <label
                  v-for="option in ratingOptions"
                  :key="'e-' + option"
                  class="radio-label"
                >
                  <input
                    type="radio"
                    v-model="form.erscheinungsbild"
                    :value="option"
                  />
                  {{ option }}
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Team</label>
              <div class="rating-group">
                <label
                  v-for="option in ratingOptions"
                  :key="'t-' + option"
                  class="radio-label"
                >
                  <input type="radio" v-model="form.team" :value="option" />
                  {{ option }}
                </label>
              </div>
            </div>

            <!-- Text Fields -->
            <div class="form-group">
              <label>Mitarbeiter & Job</label>
              <textarea
                v-model="form.mitarbeiter_job"
                rows="3"
                placeholder="Wie haben die Mitarbeiter ihre Aufgaben erledigt?"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Feedback Auftraggeber</label>
              <textarea
                v-model="form.feedback_auftraggeber"
                rows="3"
                placeholder="Was hat der Auftraggeber gesagt?"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Sonstiges</label>
              <textarea
                v-model="form.sonstiges"
                rows="3"
                placeholder="Weitere Anmerkungen..."
              ></textarea>
            </div>

            <button type="submit" class="submit-btn" :disabled="submitting">
              <span v-if="submitting">Wird gesendet...</span>
              <span v-else>EventReport absenden</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import apiPublic from "@/utils/api-public";
import PublicHeader from "./PublicHeader.vue";

const route = useRoute();
const email = computed(() => route.query.email);
const publicToken = computed(() => route.query.token);

// Axios instance that sends the public token with every request
const api = apiPublic;

api.interceptors.request.use((config) => {
  if (publicToken.value) {
    config.headers["x-public-token"] = publicToken.value;
  }
  return config;
});

const loading = ref(true);
const error = ref("");
const mitarbeiter = ref(null);
const einsaetze = ref([]);
const selectedEinsatz = ref("");
const submitSuccess = ref(false);
const submitting = ref(false);

const ratingOptions = ["Sehr gut", "Gut", "Befriedigend", "Mangelhaft"];

const form = reactive({
  location: "",
  kunde: "",
  auftragnummer: "",
  datum: "",
  mitarbeiter_anzahl: "",
  puenktlichkeit: "",
  erscheinungsbild: "",
  team: "",
  mitarbeiter_job: "",
  feedback_auftraggeber: "",
  sonstiges: "",
});

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function onEinsatzSelect() {
  const einsatz = einsaetze.value.find((e) => e._id === selectedEinsatz.value);
  if (!einsatz) return;

  form.auftragnummer = String(einsatz.auftragNr || "");
  form.datum = einsatz.datumVon
    ? new Date(einsatz.datumVon).toISOString().split("T")[0]
    : "";
  form.location = einsatz.auftrag?.geschSt || einsatz.auftrag?.eventOrt || "";
  form.kunde = einsatz.auftrag?.eventTitel || einsatz.bezeichnung || "";
}

async function loadData() {
  if (!email.value || !publicToken.value) {
    loading.value = false;
    return;
  }

  try {
    // 1. Get Mitarbeiter by email
    const maRes = await api.get("/api/public/mitarbeiter", {
      params: { email: email.value },
    });
    mitarbeiter.value = maRes.data;

    // 2. Get Einsätze by personalNr
    if (mitarbeiter.value.personalnr) {
      const eRes = await api.get("/api/public/einsaetze", {
        params: { personalNr: mitarbeiter.value.personalnr },
      });
      einsaetze.value = eRes.data;
    }
  } catch (err) {
    console.error("Load error:", err);
    if (err.response?.status === 404) {
      error.value = "Mitarbeiter mit dieser E-Mail nicht gefunden.";
    } else {
      error.value =
        "Daten konnten nicht geladen werden. Bitte versuche es später erneut.";
    }
  } finally {
    loading.value = false;
  }
}

async function submitReport() {
  submitting.value = true;
  try {
    await api.post("/api/public/eventreport", {
      location: form.location,
      kunde: form.kunde,
      auftragnummer: form.auftragnummer,
      name_teamleiter: `${mitarbeiter.value.vorname} ${mitarbeiter.value.nachname}`,
      mitarbeiter_anzahl: form.mitarbeiter_anzahl,
      datum: form.datum,
      puenktlichkeit: form.puenktlichkeit,
      erscheinungsbild: form.erscheinungsbild,
      team: form.team,
      mitarbeiter_job: form.mitarbeiter_job,
      feedback_auftraggeber: form.feedback_auftraggeber,
      sonstiges: form.sonstiges,
      teamleiter_email: email.value,
    });
    submitSuccess.value = true;
  } catch (err) {
    console.error("Submit error:", err);
    alert("Fehler beim Absenden: " + (err.response?.data?.msg || err.message));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.public-page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  /* padding removed to allow header to be full width at top */
  padding: 0;
}

.page-content {
  padding: 1rem;
  padding-bottom: 3rem;
  max-width: 700px;
  margin: 0 auto;
  padding-bottom: 3rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: var(--muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  text-align: center;
  color: var(--muted);
}

.error-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  font-size: 2rem;
  /* margin removed from here as we handle layout inside */
  align-items: center;
 

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.theme-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-toggle {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.theme-label {
  font-size: 0.75rem;
  color: var(--muted);
  background: var(--hover);
  padding: 2px 6px;
  border-radius: 4px;
} justify-content: center;
  margin-bottom: 1rem;
}

.content {
  max-width: 700px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  color: var(--text);
  margin: 0 0 0.25rem;
}

.subtitle {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.15rem;
  color: var(--text);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.empty-state {
  color: var(--muted);
  font-style: italic;
  padding: 1rem;
  text-align: center;
  background: var(--tile-bg);
  border-radius: 8px;
}

/* Einsatz Cards */
.einsatz-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.einsatz-card {
  background: var(--tile-bg);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.einsatz-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.einsatz-title {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
}

.einsatz-date {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.einsatz-details {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--muted);
  flex-wrap: wrap;
}

.auftrag-nr {
  background: var(--hover);
  color: var(--text);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.75rem;
}

/* Form */
.report-form {
  background: var(--tile-bg);
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 500px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.3rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--bg);
  color: var(--text);
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--tile-bg);
}

.readonly {
  background: var(--hover) !important;
  color: var(--muted);
}

.rating-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 400;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text);
}

.radio-label input[type="radio"] {
  width: auto;
  accent-color: var(--primary);
}

.submit-btn {
  width: 100%;
  padding: 0.85rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  background: #d4edda;
  color: #155724;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
  font-size: 1.1rem;
}
/* Dark mode override specific for success msg */
[data-theme="dark"] .success-message {
  background: rgba(40, 167, 69, 0.2);
  color: #75b798;
}

.success-message i {
  margin-right: 0.5rem;
  color: #28a745;
}
</style>
