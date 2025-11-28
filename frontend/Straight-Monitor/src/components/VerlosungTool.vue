<template>
  <div class="verlosung-tool">
    <header class="tool-header">
      <h4>Verlosungs<span>verwaltung</span></h4>
      <p class="subtitle">Erstellung und Ziehung von Verlosungen</p>
    </header>

    <!-- Tabs -->
    <div class="tabs">
      <button
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        <font-awesome-icon :icon="['fas', 'list']" />
        Verlosungen
      </button>
      <button
        :class="{ active: activeTab === 'create' }"
        @click="activeTab = 'create'"
      >
        <font-awesome-icon :icon="['fas', 'plus']" />
        Neue Verlosung
      </button>
    </div>

    <!-- Create Tab -->
    <div v-if="activeTab === 'create'" class="tab-content">
      <div class="form-card">
        <h2>Neue Verlosung erstellen</h2>

        <div class="form-group">
          <label>Titel *</label>
          <input
            v-model="form.titel"
            type="text"
            placeholder="z.B. Gutschein-Verlosung März 2025"
            required
          />
        </div>

        <div class="form-group">
          <label>Beschreibung</label>
          <textarea
            v-model="form.beschreibung"
            placeholder="Optionale Beschreibung"
            rows="3"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Verlosung startet am</label>
            <input
              v-model="form.start_date"
              type="datetime-local"
              placeholder="Optional"
            />
          </div>
          <div class="form-group">
            <label>Verlosung endet am</label>
            <input
              v-model="form.end_date"
              type="datetime-local"
              placeholder="Optional"
            />
          </div>
        </div>

        <div class="form-group">
          <label>Anzahl der Gewinner *</label>
          <input
            v-model.number="form.anzahl_gewinner"
            type="number"
            min="1"
            placeholder="z.B. 1"
            required
          />
          <small class="form-hint"
            >Wie viele Gewinner sollen gezogen werden?</small
          >
        </div>

        <div class="form-group">
          <label>Gutschein-Typ *</label>
          <select v-model="form.gutschein_type" required>
            <option value="">-- Bitte wählen --</option>
            <option v-for="type in gutscheinTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </div>

        <div class="form-actions">
          <button
            @click="createVerlosung"
            :disabled="
              !form.titel || !form.gutschein_type || !form.anzahl_gewinner
            "
            class="btn-primary"
          >
            <font-awesome-icon :icon="['fas', 'magic']" />
            Verlosung erstellen
          </button>
          <button @click="resetForm" class="btn-secondary">
            <font-awesome-icon :icon="['fas', 'redo']" />
            Zurücksetzen
          </button>
        </div>

        <!-- Status Messages -->
        <div v-if="successMessage" class="message success">
          <font-awesome-icon :icon="['fas', 'check']" />
          {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="message error">
          <font-awesome-icon :icon="['fas', 'times']" />
          {{ errorMessage }}
        </div>
      </div>
    </div>

    <!-- List Tab -->
    <div v-if="activeTab === 'list'" class="tab-content">
      <div class="list-header">
        <h2>Alle Verlosungen</h2>
        <div class="filter-group">
          <select v-model="filterStatus">
            <option value="">Alle</option>
            <option value="OFFEN">
              <font-awesome-icon :icon="['fas', 'unlock']" /> Offen
            </option>
            <option value="GESCHLOSSEN">
              <font-awesome-icon :icon="['fas', 'lock']" /> Geschlossen
            </option>
            <option value="ABGESCHLOSSEN">
              <font-awesome-icon :icon="['fas', 'trophy']" /> Abgeschlossen
            </option>
          </select>
        </div>
      </div>

      <div v-if="verlosungen.length === 0" class="empty-state">
        <font-awesome-icon :icon="['fas', 'inbox']" class="empty-icon" />
        <p>Noch keine Verlosungen erstellt.</p>
      </div>

      <div v-else class="verlosungen-grid">
        <div
          v-for="verlosung in filteredVerlosungen"
          :key="verlosung._id"
          class="verlosung-card"
        >
          <div class="card-header">
            <h3>{{ verlosung.titel }}</h3>
            <span :class="['status-badge', verlosung.status.toLowerCase()]">
              {{ verlosung.status }}
            </span>
          </div>

          <div class="card-body">
            <p v-if="verlosung.beschreibung">
              <strong>Beschreibung:</strong> {{ verlosung.beschreibung }}
            </p>

            <p>
              <strong>Gutschein-Typ:</strong> {{ verlosung.gutschein_type }}
            </p>

            <p v-if="verlosung.gravur_type">
              <strong>Gravur-Typ:</strong>
              {{ formatGravurType(verlosung.gravur_type) }}
            </p>

            <div class="stats-row">
              <div class="stat-item">
                <strong>Teilnehmer:</strong>
                <span>{{ verlosung.eintraege?.length || 0 }}</span>
              </div>
              <div class="stat-item">
                <strong>Anzahl Gewinner:</strong>
                <span>{{ verlosung.anzahl_gewinner || 1 }}</span>
              </div>
            </div>

            <div
              v-if="
                verlosung.gewinner_liste && verlosung.gewinner_liste.length > 0
              "
            >
              <strong
                >Gewinner ({{ verlosung.gewinner_liste.length }}/{{
                  verlosung.anzahl_gewinner
                }}):</strong
              >
              <ul class="gewinner-liste">
                <li v-for="(g, idx) in verlosung.gewinner_liste" :key="idx">
                  {{ g.mitarbeiter?.vorname }} {{ g.mitarbeiter?.nachname }}
                  <small>({{ formatDate(g.bestaetigt_am) }})</small>
                </li>
              </ul>
            </div>
            <p v-else>
              <strong>Gewinner:</strong>
              {{
                verlosung.gewinner_mitarbeiter
                  ? `${verlosung.gewinner_mitarbeiter.vorname} ${verlosung.gewinner_mitarbeiter.nachname}`
                  : "Noch nicht gezogen"
              }}
            </p>

            <p>
              <strong>Erstellt:</strong>
              {{ formatDate(verlosung.erstellt_am) }}
            </p>
          </div>

          <div class="card-actions">
            <button
              v-if="verlosung.status === 'OFFEN'"
              @click="schließeVerlosung(verlosung._id)"
              class="btn-small btn-warning"
            >
              <font-awesome-icon :icon="['fas', 'lock']" />
              Schließen
            </button>

            <button
              v-if="verlosung.status === 'GESCHLOSSEN'"
              @click="zieheGewinner(verlosung._id)"
              class="btn-small btn-success"
            >
              <font-awesome-icon :icon="['fas', 'dice']" />
              Gewinner ziehen
            </button>

            <button
              @click="showTeilnehmer(verlosung)"
              class="btn-small btn-info"
            >
              <font-awesome-icon :icon="['fas', 'users']" />
              Teilnehmer ({{ verlosung.eintraege?.length || 0 }})
            </button>

            <button
              @click="deleteVerlosung(verlosung._id)"
              class="btn-small btn-danger"
            >
              <font-awesome-icon :icon="['fas', 'trash']" />
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Gewinner-Bestätigungs-Dialog -->
    <div
      v-if="showWinnerDialog"
      class="modal-overlay"
      @click.self="ablehnenGewinner"
    >
      <div class="winner-dialog">
        <div class="dialog-header">
          <h2>
            <font-awesome-icon :icon="['fas', 'trophy']" />
            Gewinner gezogen!
          </h2>
          <button @click="ablehnenGewinner" class="close-btn">
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>

        <div class="dialog-body" v-if="currentWinner">
          <div class="winner-info">
            <h3>{{ currentWinner.vorname }} {{ currentWinner.nachname }}</h3>
            <p class="email">
              <font-awesome-icon :icon="['fas', 'envelope']" />
              {{ currentWinner.email }}
            </p>

            <div v-if="currentWinner.flip_user" class="flip-user-details">
              <h4>Flip User Details</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <strong>Benutzername:</strong>
                  <span>{{ currentWinner.flip_user.username || "-" }}</span>
                </div>
                <div class="detail-item">
                  <strong>Rolle:</strong>
                  <span>{{ currentWinner.flip_user.role || "-" }}</span>
                </div>
                <div class="detail-item">
                  <strong>Status:</strong>
                  <span
                    :class="[
                      'status-badge',
                      currentWinner.flip_user.status?.toLowerCase(),
                    ]"
                  >
                    {{ currentWinner.flip_user.status || "-" }}
                  </span>
                </div>
                <div class="detail-item">
                  <strong>Gruppe:</strong>
                  <span>{{
                    currentWinner.flip_user.primary_user_group?.title?.text ||
                    "-"
                  }}</span>
                </div>
                <div class="detail-item">
                  <strong>Erstellt:</strong>
                  <span>{{
                    formatDate(currentWinner.flip_user.created_at)
                  }}</span>
                </div>
                <div class="detail-item">
                  <strong>External ID:</strong>
                  <span>{{ currentWinner.flip_user.external_id || "-" }}</span>
                </div>
              </div>
            </div>

            <div v-else class="no-flip-user">
              <p>⚠️ Kein Flip-User gefunden</p>
              <p class="small-text">
                Flip ID: {{ currentWinner.flip_id || "Nicht vorhanden" }}
              </p>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button @click="bestaetigenGewinner" class="btn-success">
            ✅ Gewinner bestätigen
          </button>
          <button @click="ablehnenGewinner" class="btn-secondary">
            🔄 Neu ziehen
          </button>
        </div>
      </div>
    </div>

    <!-- Teilnehmer-Tabelle Modal -->
    <div
      v-if="showTeilnehmerDialog"
      class="modal-overlay"
      @click.self="closeTeilnehmer"
    >
      <div class="teilnehmer-dialog">
        <div class="dialog-header">
          <h2>Teilnehmer: {{ selectedVerlosung?.titel }}</h2>
          <button @click="closeTeilnehmer" class="close-btn">✕</button>
        </div>

        <div class="dialog-body">
          <div class="teilnehmer-grid">
            <div
              v-for="(eintrag, index) in selectedVerlosung?.eintraege"
              :key="eintrag._id"
              :class="{
                'teilnehmer-card': true,
                'roulette-highlight': rouletteActive && rouletteIndex === index,
                'winner-disabled': isWinner(eintrag)
              }"
            >
              <div class="card-number">#{{ index + 1 }}</div>
              <div class="card-name">
                {{ eintrag.name_mitarbeiter }}
              </div>
              <span v-if="isWinner(eintrag)" class="winner-badge">🏆</span>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button
            v-if="
              selectedVerlosung?.status === 'GESCHLOSSEN' && !rouletteActive
            "
            @click="startRoulette"
            class="btn-success btn-large"
          >
           <font-awesome-icon :icon="['fas', 'dice']" />
             Ziehung starten
          </button>
          <button @click="closeTeilnehmer" class="btn-secondary">
            Schließen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "@/utils/api";
import logger from "@/utils/logger";

// Enums
const GUTSCHEIN_TYPES = {
  ATENTO: "ATENTO",
  BONBON: "BONBON",
  WUNSCHGUTSCHEIN: "WUNSCHGUTSCHEIN",
  GRAVUR: "GRAVUR",
};

const GRAVUR_TYPES = {
  CUTTERMESSER: "cuttermesser",
  KELLNERMESSER: "kellnermesser",
};

const gutscheinTypes = Object.values(GUTSCHEIN_TYPES);
const gravurTypes = Object.values(GRAVUR_TYPES);

// State
const activeTab = ref("list"); // Standardmäßig Liste zeigen
const verlosungen = ref([]);
const filterStatus = ref("");

const form = ref({
  titel: "",
  beschreibung: "",
  gutschein_type: "",
  gravur_type: "",
  start_date: "",
  end_date: "",
  anzahl_gewinner: 1,
});

const successMessage = ref("");
const errorMessage = ref("");

// Gewinner-Bestätigungsdialog
const showWinnerDialog = ref(false);
const currentWinner = ref(null);
const currentVerlosungId = ref(null);

// Teilnehmer-Tabelle Dialog
const showTeilnehmerDialog = ref(false);
const selectedVerlosung = ref(null);

// Roulette-Animation
const rouletteActive = ref(false);
const rouletteIndex = ref(0);
const winnerIndices = ref(new Set()); // Speichert Indizes der bereits gezogenen Gewinner

// Computed
const filteredVerlosungen = computed(() => {
  if (!filterStatus.value) return verlosungen.value;
  return verlosungen.value.filter((v) => v.status === filterStatus.value);
});

// Helper: Prüft ob ein Eintrag bereits Gewinner ist
const isWinner = (eintrag) => {
  if (!selectedVerlosung.value?.gewinner_liste || !selectedVerlosung.value.gewinner_liste.length) {
    return false;
  }
  
  // Vergleiche mit eintrag._id oder eintrag.eintrag._id
  const eintragId = eintrag._id?.toString() || eintrag._id;
  
  return selectedVerlosung.value.gewinner_liste.some((g) => {
    // g.eintrag kann entweder ein populated Objekt oder eine ObjectId sein
    const gewinnerId = g.eintrag?._id?.toString() || g.eintrag?.toString() || g.eintrag_id?.toString();
    
    logger.debug('Vergleiche Gewinner:', { 
      eintragId, 
      gewinnerId,
      matches: eintragId === gewinnerId 
    });
    
    return eintragId === gewinnerId;
  });
};

// Helper: Gibt verfügbare (nicht-Gewinner) Indizes zurück
const getAvailableIndices = () => {
  if (!selectedVerlosung.value?.eintraege) return [];
  
  return selectedVerlosung.value.eintraege
    .map((eintrag, index) => ({ eintrag, index }))
    .filter(({ eintrag }) => !isWinner(eintrag))
    .map(({ index }) => index);
};

// Methods
const createVerlosung = async () => {
  try {
    errorMessage.value = "";
    successMessage.value = "";

    if (!form.value.titel || !form.value.gutschein_type) {
      errorMessage.value = "Titel und Gutschein-Typ sind erforderlich!";
      return;
    }

    if (!form.value.anzahl_gewinner || form.value.anzahl_gewinner < 1) {
      errorMessage.value = "Die Anzahl der Gewinner muss mindestens 1 sein!";
      return;
    }

    const payload = {
      titel: form.value.titel,
      beschreibung: form.value.beschreibung,
      gutschein_type: form.value.gutschein_type,
      start_date: form.value.start_date || undefined,
      end_date: form.value.end_date || undefined,
      anzahl_gewinner: form.value.anzahl_gewinner,
    };

    const response = await api.post("/api/wordpress/verlosung/create", payload);

    logger.apiSuccess("Verlosung erstellt", response.data);
    successMessage.value = `✅ Verlosung "${form.value.titel}" erfolgreich erstellt!`;

    resetForm();
    loadVerlosungen();

    // Clear message after 3 seconds
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (error) {
    logger.error("Fehler beim Erstellen der Verlosung:", error);
    errorMessage.value =
      error.response?.data?.error || "Fehler beim Erstellen der Verlosung";
  }
};

const resetForm = () => {
  form.value = {
    titel: "",
    beschreibung: "",
    gutschein_type: "",
    gravur_type: "",
    start_date: "",
    end_date: "",
    anzahl_gewinner: 1,
  };
};

const loadVerlosungen = async () => {
  try {
    const response = await api.get("/api/wordpress/verlosung/list");
    verlosungen.value = response.data.data;
    logger.debug("Verlosungen geladen:", verlosungen.value);
  } catch (error) {
    logger.error("Fehler beim Laden der Verlosungen:", error);
    errorMessage.value = "Fehler beim Laden der Verlosungen";
  }
};

const schließeVerlosung = async (id) => {
  try {
    await api.put(`/api/wordpress/verlosung/${id}/close`);
    successMessage.value = "✅ Verlosung geschlossen!";
    loadVerlosungen();
  } catch (error) {
    logger.error("Fehler beim Schließen:", error);
    errorMessage.value = "Fehler beim Schließen der Verlosung";
  }
};

const zieheGewinner = async (id) => {
  try {
    errorMessage.value = "";
    const response = await api.post(`/api/wordpress/verlosung/${id}/draw`);

    // Gewinner-Daten speichern und Dialog öffnen
    currentWinner.value = response.data.gewinner;
    currentVerlosungId.value = id;
    showWinnerDialog.value = true;

    logger.debug("Gewinner gezogen:", response.data.gewinner);
  } catch (error) {
    logger.error("Fehler beim Ziehen des Gewinners:", error);
    errorMessage.value =
      error.response?.data?.error || "Fehler beim Ziehen des Gewinners";
  }
};

const bestaetigenGewinner = async () => {
  try {
    errorMessage.value = "";
    successMessage.value = "";

    const response = await api.post(
      `/api/wordpress/verlosung/${currentVerlosungId.value}/confirm-winner`,
      { eintrag_id: currentWinner.value.eintrag_id }
    );

    successMessage.value = `✅ ${response.data.message}`;
    showWinnerDialog.value = false;
    currentWinner.value = null;
    currentVerlosungId.value = null;

    await loadVerlosungen();

    // Falls noch weitere Gewinner zu ziehen sind
    if (!response.data.verlosung_abgeschlossen) {
      setTimeout(() => {
        successMessage.value = "";
      }, 2000);
    }
  } catch (error) {
    logger.error("Fehler beim Bestätigen des Gewinners:", error);
    errorMessage.value =
      error.response?.data?.error || "Fehler beim Bestätigen des Gewinners";
  }
};

const ablehnenGewinner = () => {
  showWinnerDialog.value = false;
  currentWinner.value = null;
  currentVerlosungId.value = null;
};

const showTeilnehmer = (verlosung) => {
  selectedVerlosung.value = verlosung;
  showTeilnehmerDialog.value = true;
  rouletteActive.value = false;
  rouletteIndex.value = 0;
};

const closeTeilnehmer = () => {
  showTeilnehmerDialog.value = false;
  selectedVerlosung.value = null;
  rouletteActive.value = false;
  rouletteIndex.value = 0;
};

const startRoulette = async () => {
  if (!selectedVerlosung.value?.eintraege?.length) {
    errorMessage.value = "Keine Teilnehmer vorhanden";
    return;
  }

  const availableIndices = getAvailableIndices();
  
  if (availableIndices.length === 0) {
    errorMessage.value = "Alle Teilnehmer wurden bereits als Gewinner gezogen";
    return;
  }

  try {
    // 🎯 ZUERST: Gewinner vom Backend ziehen
    logger.debug("Ziehe Gewinner vom Backend...");
    const response = await api.post(`/api/wordpress/verlosung/${selectedVerlosung.value._id}/draw`);
    const gewinner = response.data.gewinner;
    
    logger.debug("Gewinner gezogen:", gewinner);
    
    // Finde den Index des Gewinner-Eintrags
    const gewinnerEintragId = gewinner.eintrag_id;
    const targetIndex = selectedVerlosung.value.eintraege.findIndex(
      (eintrag) => eintrag._id === gewinnerEintragId
    );
    
    if (targetIndex === -1) {
      logger.error("Gewinner-Eintrag nicht in Liste gefunden!");
      errorMessage.value = "Fehler: Gewinner nicht gefunden";
      return;
    }
    
    logger.debug(`Ziel-Index für Animation: ${targetIndex}`);
    
    // Animation starten
    rouletteActive.value = true;
    
    const totalEntries = selectedVerlosung.value.eintraege.length;
    const MIN_FULL_CYCLES = 3; // Mindestens 3 komplette Durchgänge
    
    // Berechne wie viele Steps bis zum Gewinner (nach MIN_FULL_CYCLES)
    const stepsToWinner = (MIN_FULL_CYCLES * totalEntries) + targetIndex;
    
    let lastUpdateTime = Date.now();
    let currentPosition = 0;
    let completedSteps = 0;
    
    const animate = () => {
      // Prüfe ob wir am Ziel angekommen sind
      if (completedSteps >= stepsToWinner && currentPosition === targetIndex) {
        // Animation beendet
        rouletteIndex.value = targetIndex;
        
        setTimeout(() => {
          rouletteActive.value = false;
          
          // Zeige Gewinner-Dialog
          currentWinner.value = gewinner;
          currentVerlosungId.value = selectedVerlosung.value._id;
          showWinnerDialog.value = true;
          
          closeTeilnehmer();
        }, 800);
        return;
      }
      
      // Berechne Fortschritt (0 bis 1)
      const progress = completedSteps / stepsToWinner;
      
      // Easing-Funktion: Startet schnell, wird langsamer
      // Erste 70% schnell (MIN_FULL_CYCLES), letzten 30% verlangsamen
      let easeOutCubic;
      if (progress < 0.7) {
        easeOutCubic = 0; // Konstante schnelle Geschwindigkeit
      } else {
        // Easing nur in den letzten 30%
        const adjustedProgress = (progress - 0.7) / 0.3;
        easeOutCubic = 1 - Math.pow(1 - adjustedProgress, 3);
      }
      
      // Berechne Delay zwischen Updates
      const minDelay = 30;  // Schnell
      const maxDelay = 400; // Langsam
      const currentDelay = minDelay + (maxDelay - minDelay) * easeOutCubic;
      
      const now = Date.now();
      if (now - lastUpdateTime >= currentDelay) {
        // Gehe zur nächsten Position (sequenziell)
        currentPosition = (currentPosition + 1) % totalEntries;
        completedSteps++;
        
        rouletteIndex.value = currentPosition;
        lastUpdateTime = now;
      }
      
      requestAnimationFrame(animate);
    };
    
    // Starte bei Position 0
    currentPosition = 0;
    rouletteIndex.value = 0;
    completedSteps = 0;
    
    requestAnimationFrame(animate);
    
  } catch (error) {
    logger.error("Fehler beim Starten des Roulettes:", error);
    errorMessage.value = error.response?.data?.error || "Fehler beim Ziehen des Gewinners";
    rouletteActive.value = false;
  }
};

const addTestTeilnehmer = async () => {
  if (!selectedVerlosung.value) {
    errorMessage.value = "Keine Verlosung ausgewählt";
    return;
  }

  try {
    logger.debug("Füge Test-Teilnehmer zu Verlosung hinzu...");
    
    // Rufe Backend-Endpoint auf, um echte Einträge zu erstellen
    const response = await api.post(
      `/api/wordpress/verlosung/${selectedVerlosung.value._id}/add-test-participants`,
      { count: 50 }
    );
    
    logger.apiSuccess("Test-Teilnehmer hinzugefügt", response.data);
    
    successMessage.value = `✅ ${response.data.count} Test-Teilnehmer hinzugefügt! Insgesamt: ${response.data.total_eintraege}`;
    
    // Verlosungen neu laden, um aktualisierte Daten zu bekommen
    await loadVerlosungen();
    
    // Dialog schließen und neu öffnen, um aktualisierte Daten zu zeigen
    const verlosungId = selectedVerlosung.value._id;
    closeTeilnehmer();
    
    // Finde aktualisierte Verlosung und zeige Teilnehmer
    setTimeout(() => {
      const updatedVerlosung = verlosungen.value.find(v => v._id === verlosungId);
      if (updatedVerlosung) {
        showTeilnehmer(updatedVerlosung);
      }
    }, 100);
    
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
    
  } catch (error) {
    logger.error("Fehler beim Hinzufügen der Test-Teilnehmer:", error);
    errorMessage.value = "Fehler beim Hinzufügen der Test-Teilnehmer: " + (error.response?.data?.error || error.message);
  }
};

const seeDetails = (id) => {
  logger.info("Details für Verlosung:", id);
  // TODO: Modal/Detail-View implementieren
};

const deleteVerlosung = async (id) => {
  if (confirm("Verlosung wirklich löschen?")) {
    try {
      await api.delete(`/api/wordpress/verlosung/${id}`);
      successMessage.value = "✅ Verlosung gelöscht!";
      loadVerlosungen();
    } catch (error) {
      logger.error("Fehler beim Löschen:", error);
      errorMessage.value = "Fehler beim Löschen der Verlosung";
    }
  }
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("de-DE");
};

const formatGravurType = (type) => {
  const map = {
    cuttermesser: "Cuttermesser",
    kellnermesser: "Kellnermesser",
  };
  return map[type] || type;
};

// Lifecycle
onMounted(() => {
  loadVerlosungen();
});
</script>

<style scoped lang="scss">
.verlosung-tool {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  background: $base-light-gray;
  min-height: 100vh;

  .tool-header {
    margin-bottom: 30px;

    h4 {
      font-size: 2em;
      color: $base-text-dark;
      margin: 0 0 8px 0;

      span {
        color: $base-primary;
      }
    }

    .subtitle {
      color: $base-text-medium;
      font-size: 1em;
      margin: 0;
    }
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    border-bottom: 2px solid $base-border-color;

    button {
      padding: 12px 24px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      font-size: 1em;
      font-weight: 500;
      color: $base-text-medium;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 8px;

      &:hover {
        color: $base-text-dark;
        background: rgba($base-primary, 0.05);
      }

      &.active {
        color: $base-primary;
        border-bottom-color: $base-primary;
      }
    }
  }

  .tab-content {
    animation: fadeIn 0.3s;
  }

  .form-card {
    background: $base-panel-bg;
    border: 1px solid $base-border-color;
    border-radius: 8px;
    padding: 30px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

    h2 {
      margin-top: 0;
      color: $base-text-dark;
      font-size: 1.5em;
    }

    .form-group {
      margin-bottom: 20px;

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: $base-text-dark;
      }

      input,
      textarea,
      select {
        width: 100%;
        padding: 12px;
        border: 1px solid $base-border-color;
        border-radius: 4px;
        font-size: 1em;
        font-family: inherit;
        background: $base-input-bg;
        color: $base-text-dark;

        &:focus {
          outline: none;
          border-color: $base-primary;
          box-shadow: 0 0 0 3px rgba($base-primary, 0.1);
        }
      }

      textarea {
        resize: vertical;
      }

      .form-hint {
        display: block;
        margin-top: 6px;
        font-size: 0.85em;
        color: $base-text-medium;
        font-style: italic;
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 30px;
      flex-wrap: wrap;
    }
  }

  .message {
    padding: 15px 20px;
    border-radius: 6px;
    margin-top: 20px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid $base-border-color;

    &.success {
      background: color-mix(in srgb, $base-primary 10%, $base-panel-bg);
      color: $base-primary;
      border-color: $base-primary;
    }

    &.error {
      background: $base-panel-bg;
      color: $base-text-dark;
      border-color: $base-border-color;
    }
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 15px;

    h2 {
      margin: 0;
      color: $base-text-dark;
    }

    .filter-group {
      select {
        padding: 10px 15px;
        border: 1px solid $base-border-color;
        border-radius: 6px;
        font-size: 1em;
        background: $base-panel-bg;
        color: $base-text-dark;

        &:focus {
          outline: none;
          border-color: $base-primary;
        }
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 60px 40px;
    background: $base-panel-bg;
    border-radius: 8px;
    color: $base-text-medium;
    border: 1px solid $base-border-color;

    .empty-icon {
      font-size: 3em;
      margin-bottom: 15px;
      opacity: 0.5;
    }

    p {
      font-size: 1.1em;
    }
  }

  .verlosungen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
  }

  .verlosung-card {
    background: $base-panel-bg;
    border: 1px solid $base-border-color;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: transform 0.3s, box-shadow 0.3s;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid $base-border-color;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba($base-primary, 0.02);

      h3 {
        margin: 0;
        color: $base-text-dark;
        font-size: 1.2em;
      }

      .status-badge {
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.85em;
        font-weight: 600;
        border: 1px solid $base-border-color;

        &.offen {
          background: color-mix(in srgb, $base-primary 15%, $base-panel-bg);
          color: $base-primary;
          border-color: $base-primary;
        }

        &.geschlossen {
          background: $base-panel-bg;
          color: $base-text-medium;
          border-color: $base-border-color;
        }

        &.abgeschlossen {
          background: color-mix(in srgb, $base-primary 15%, $base-panel-bg);
          color: $base-primary;
          border-color: $base-primary;
        }
      }
    }

    .card-body {
      padding: 20px;

      p {
        margin: 10px 0;
        font-size: 0.95em;
        color: $base-text-notsodark;

        strong {
          color: $base-text-dark;
        }
      }

      .stats-row {
        display: flex;
        gap: 20px;
        margin: 15px 0;

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;

          strong {
            color: $base-text-medium;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          span {
            color: $base-text-dark;
            font-weight: 600;
            font-size: 1.1em;
          }
        }
      }
    }

    .card-actions {
      padding: 15px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  }
}

// Teilnehmer-Dialog (größer für Grid)
.teilnehmer-dialog {
  background: $base-panel-bg;
  border-radius: 12px;
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
  display: flex;
  flex-direction: column;

  .dialog-header {
    padding: 24px;
    border-bottom: 2px solid $base-border-color;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    background: rgba($base-primary, 0.05);

    h2 {
      margin: 0;
      color: $base-text-dark;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: $base-text-medium;
      padding: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      transition: all 0.2s;

      &:hover {
        background: rgba($base-primary, 0.1);
        color: $base-primary;
      }
    }
  }

  .dialog-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;

    .teilnehmer-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
      padding: 10px;

      @media (max-width: 768px) {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      }

      .teilnehmer-card {
        background: $base-panel-bg;
        border: 1px solid $base-border-color;
        border-radius: 6px;
        padding: 8px;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        min-height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;

        &:hover {
          border-color: $base-primary;
          box-shadow: 0 2px 6px rgba($base-primary, 0.15);
        }

        &.roulette-highlight {
          background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
          border-color: #ffd700;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(255, 215, 0, 0.6);
          animation: pulseCard 0.4s ease;
          z-index: 100;
        }

        &.winner-disabled {
          opacity: 0.3;
          background: repeating-linear-gradient(
            45deg,
            rgba($base-border-color, 0.2),
            rgba($base-border-color, 0.2) 10px,
            rgba($base-border-color, 0.1) 10px,
            rgba($base-border-color, 0.1) 20px
          );
          border: 2px dashed $base-border-color;
          pointer-events: none;
          filter: grayscale(100%);

          .card-name {
            text-decoration: line-through;
            color: $base-text-medium;
            font-weight: 400;
          }

          .card-number {
            opacity: 0.5;
          }
        }

        .card-number {
          position: absolute;
          top: 3px;
          right: 3px;
          background: rgba($base-primary, 0.1);
          color: $base-primary;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 0.65em;
          font-weight: 700;
        }

        .card-name {
          font-size: 0.75em;
          font-weight: 600;
          color: $base-text-dark;
          padding-right: 25px;
          word-wrap: break-word;
          line-height: 1.2;

          .winner-badge {
            display: inline-block;
            margin-left: 3px;
            font-size: 0.9em;
            animation: bounce 0.5s ease infinite;
          }
        }
      }
    }
  }

  .dialog-actions {
    padding: 20px;
    border-top: 2px solid $base-border-color;
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-shrink: 0;

    .btn-large {
      min-width: 200px;
      padding: 14px 20px;
      font-size: 1.1em;
      font-weight: 600;
    }
  }
}

// Button base styles (chip-style from PeopleDocsModern)
.btn-primary,
.btn-secondary,
.btn-small,
.btn-warning,
.btn-success,
.btn-info,
.btn-danger {
  border: 1px solid $base-border-color;
  background: $base-panel-bg;
  color: $base-text-dark;
  border-radius: 6px;
  padding: 8px 16px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 0.95em;
  font-weight: 500;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
    border-color: color-mix(in srgb, $base-primary 50%, $base-border-color);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-primary {
  background: color-mix(in srgb, $base-primary 15%, $base-panel-bg);
  border-color: $base-primary;
  color: $base-primary;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, $base-primary 25%, $base-panel-bg);
    box-shadow: 0 0 0 2px color-mix(in srgb, $base-primary 20%, transparent);
  }
}

.btn-secondary {
  background: $base-panel-bg;
  border-color: $base-border-color;
  color: $base-text-medium;

  &:hover:not(:disabled) {
    border-color: $base-text-medium;
    color: $base-text-dark;
  }
}

.btn-warning,
.btn-success,
.btn-info {
  background: color-mix(in srgb, $base-primary 15%, $base-panel-bg);
  border-color: $base-primary;
  color: $base-primary;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, $base-primary 25%, $base-panel-bg);
    box-shadow: 0 0 0 2px color-mix(in srgb, $base-primary 20%, transparent);
  }
}

.btn-danger {
  background: $base-panel-bg;
  border-color: $base-border-color;
  color: $base-text-medium;

  &:hover:not(:disabled) {
    border-color: $base-text-medium;
    color: $base-text-dark;
  }
}

.btn-small {
  padding: 6px 12px;
  font-size: 0.85em;
}

.btn-large {
  padding: 12px 24px;
  font-size: 1.05em;
  font-weight: 600;
}

.gewinner-liste {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;

  li {
    padding: 4px 0;

    small {
      color: #666;
      font-size: 0.85em;
      margin-left: 8px;
    }
  }
}

// Modal Overlay
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
  backdrop-filter: blur(4px);
}

.winner-dialog,
.teilnehmer-dialog {
  background: $base-panel-bg;
  border-radius: 12px;
  width: 90%;
  max-width: 14000px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;

  .dialog-header {
    padding: 24px;
    border-bottom: 2px solid $base-border-color;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba($base-primary, 0.05);

    h2 {
      margin: 0;
      color: $base-text-dark;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: $base-text-medium;
      padding: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      transition: all 0.2s;

      &:hover {
        background: rgba($base-primary, 0.1);
        color: $base-primary;
        color: #333;
      }
    }
  }

  .dialog-body {
    padding: 30px 20px;

    .winner-info {
      text-align: center;

      h3 {
        font-size: 1.8em;
        color: #333;
        margin: 0 0 10px 0;
      }

      .email {
        font-size: 1.1em;
        color: #666;
        margin: 0 0 30px 0;
      }

      .flip-user-details {
        background: #f9f9f9;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        text-align: left;

        h4 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.2em;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;

          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;

            strong {
              color: #666;
              font-size: 0.9em;
            }

            span {
              color: #333;
              font-size: 1em;
            }

            .status-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 0.85em;
              font-weight: 500;
              width: fit-content;

              &.active {
                background: #d4edda;
                color: #155724;
              }

              &.pending_deletion {
                background: #fff3cd;
                color: #856404;
              }
            }
          }
        }
      }

      .no-flip-user {
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;

        p {
          margin: 5px 0;
          color: #856404;
        }

        .small-text {
          font-size: 0.9em;
          color: #666;
        }
      }
    }
  }

  .dialog-actions {
    padding: 20px;
    border-top: 2px solid #e0e0e0;
    display: flex;
    gap: 10px;
    justify-content: center;

    button {
      min-width: 150px;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1.02);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes pulseCard {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1.08);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
