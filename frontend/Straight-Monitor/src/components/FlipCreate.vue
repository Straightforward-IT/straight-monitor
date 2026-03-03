<template>
  <div class="window">
    <!-- Notification Banner -->
    <transition name="notify">
      <div v-if="notification.visible" :class="['notify-banner', `notify-${notification.type}`]" role="status">
        <span class="notify-dot" aria-hidden="true"></span>
        <span class="notify-text">{{ notification.message }}</span>
        <button class="notify-close" @click="notification.visible = false" aria-label="Schließen">&times;</button>
      </div>
    </transition>

    <div class="window-panels">
      <div class="create-panel">
        <!-- Top Panel -->
        <div class="top-panel">
          <h2>Bewerber erstellen</h2>

          <!-- Toggle Button -->

          <div class="action-buttons">
            <button class="toggle-button" @click="showHinweise = !showHinweise">
              {{ showHinweise ? "Hinweise verbergen" : "Hinweise anzeigen" }}
            </button>
            <button @click="resetNewUser">Formular Zurücksetzen</button>
            <button @click="fetchAsanaTask">Asana Task neu laden</button>
            <button v-if="isDev" class="dev-notify-btn" @click="testNotify">Feedback testen</button>
           <!-- <button @click="openReentryModal">Wiedereintritt MA</button> -->
          </div>

          <!-- Hinweise Section (toggleable) -->
          <section class="hinweise" v-if="showHinweise">
            <h3>Hinweise:</h3>
            <p>
              - Diese Seite sollte möglichst immer aus dem 'Bewerber erstellen'
              Link im Asana Task geöffnet werden.
            </p>
            <p>
              - Einige Felder werden aus dem Asana Task automatisch befüllt -
              diese unbedingt kontrollieren.
            </p>
            <p>
              - Das Passwort wird automatisch auf 'password' gesetzt und kann
              bei der 1. Anmeldung geändert werden.
            </p>
          </section>
        </div>

        <!-- Bottom Panel -->
        <div class="bottom-panel">
          <!-- Asana ID Input -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label">Asana Task-ID</label>
              <input
                type="text"
                v-model="asana_id"
                class="text-input"
                placeholder="e.g. 1209453587596953"
              />
              <div v-if="fieldStatus.asana_id.state !== 'idle'" class="field-hint" :class="`hint-${fieldStatus.asana_id.state}`">
                <span v-if="fieldStatus.asana_id.state === 'checking'">Wird geprüft …</span>
                <span v-else-if="fieldStatus.asana_id.state === 'clear'">Nicht vorhanden</span>
                <span v-else-if="fieldStatus.asana_id.state === 'error'">Prüfung fehlgeschlagen</span>
                <template v-else-if="fieldStatus.asana_id.state === 'found'">
                  <span>Gefunden: {{ fieldStatus.asana_id.mitarbeiter.vorname }} {{ fieldStatus.asana_id.mitarbeiter.nachname }}
                    <span class="hint-badge" :class="fieldStatus.asana_id.mitarbeiter.isActive ? 'badge-active' : 'badge-inactive'">
                      {{ fieldStatus.asana_id.mitarbeiter.isActive ? 'aktiv' : 'inaktiv' }}
                    </span>
                  </span>
                  <button class="reentry-btn" @click="openReentryForMitarbeiter(fieldStatus.asana_id.mitarbeiter)">Wiedereintritt</button>
                </template>
              </div>
            </div>
          </div>

          <!-- Name Inputs -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label">Vorname*</label>
              <input
                type="text"
                v-model="vorname"
                class="text-input"
                placeholder="Vorname*"
              />
            </div>
            <div class="input-item">
              <label class="input-label">Nachname*</label>
              <input
                type="text"
                v-model="nachname"
                class="text-input"
                placeholder="Nachname*"
              />
            </div>
            <div class="input-item">
              <label class="input-label">E-Mail*</label>
              <input
                type="email"
                v-model="emailFormatted"
                class="text-input email"
                placeholder="E-Mail*"
              />
              <div v-if="fieldStatus.email.state !== 'idle'" class="field-hint" :class="`hint-${fieldStatus.email.state}`">
                <span v-if="fieldStatus.email.state === 'checking'">Wird geprüft …</span>
                <span v-else-if="fieldStatus.email.state === 'clear'">Nicht vorhanden</span>
                <span v-else-if="fieldStatus.email.state === 'error'">Prüfung fehlgeschlagen</span>
                <template v-else-if="fieldStatus.email.state === 'found'">
                  <span>Gefunden: {{ fieldStatus.email.mitarbeiter.vorname }} {{ fieldStatus.email.mitarbeiter.nachname }}
                    <span class="hint-badge" :class="fieldStatus.email.mitarbeiter.isActive ? 'badge-active' : 'badge-inactive'">
                      {{ fieldStatus.email.mitarbeiter.isActive ? 'aktiv' : 'inaktiv' }}
                    </span>
                  </span>
                  <button class="reentry-btn" @click="openReentryForMitarbeiter(fieldStatus.email.mitarbeiter)">Wiedereintritt</button>
                </template>
              </div>
            </div>
            <div class="input-item">
              <label class="input-label">Personalnummer*</label>
              <input
                type="text"
                v-model="personalnr"
                class="text-input"
                placeholder="Personalnummer*"
              />
              <div v-if="fieldStatus.personalnr.state !== 'idle'" class="field-hint" :class="`hint-${fieldStatus.personalnr.state}`">
                <span v-if="fieldStatus.personalnr.state === 'checking'">Wird geprüft …</span>
                <span v-else-if="fieldStatus.personalnr.state === 'clear'">Nicht vorhanden</span>
                <span v-else-if="fieldStatus.personalnr.state === 'error'">Prüfung fehlgeschlagen</span>
                <template v-else-if="fieldStatus.personalnr.state === 'found'">
                  <span>Gefunden: {{ fieldStatus.personalnr.mitarbeiter.vorname }} {{ fieldStatus.personalnr.mitarbeiter.nachname }}
                    <span class="hint-badge" :class="fieldStatus.personalnr.mitarbeiter.isActive ? 'badge-active' : 'badge-inactive'">
                      {{ fieldStatus.personalnr.mitarbeiter.isActive ? 'aktiv' : 'inaktiv' }}
                    </span>
                  </span>
                  <button class="reentry-btn" @click="openReentryForMitarbeiter(fieldStatus.personalnr.mitarbeiter)">Wiedereintritt</button>
                </template>
              </div>
            </div>
          </div>

          <!-- Standort Selection -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label">Standort*</label>
              <select class="standort-dropdown" v-model="location" required>
                <option value="">-</option>
                <option value="Hamburg">Hamburg</option>
                <option value="Berlin">Berlin</option>
                <option value="Köln">Köln</option>
              </select>
            </div>
          </div>

          <!-- Role Selection -->
          <div class="input-group checkbox-group">
            <div class="check-item">
              <label class="check-label"
                >Service
                <input type="checkbox" v-model="isService" class="check-input"
              /></label>
            </div>
            <div class="check-item">
              <label class="check-label"
                >Logistik
                <input type="checkbox" v-model="isLogistik" class="check-input"
              /></label>
            </div>
            <div class="check-item">
              <label class="check-label"
                >Teamleiter
                <input
                  type="checkbox"
                  v-model="isTeamleiter"
                  class="check-input"
              /></label>
            </div>
            <div class="check-item">
              <label class="check-label"
                >Festangestellte
                <input
                  type="checkbox"
                  v-model="isFestangestellt"
                  class="check-input"
              /></label>
            </div>
            <div class="check-item">
              <label class="check-label"
                >Office
                <input type="checkbox" v-model="isOffice" class="check-input"
              /></label>
            </div>
          </div>

          <!-- Profile Information -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label">Job Titel</label>
              <input
                type="text"
                v-model="job_title"
                class="text-input"
                placeholder="Job Titel"
              />
            </div>
            <div class="input-item">
              <label class="input-label">Abteilung</label>
              <input
                type="text"
                v-model="department"
                class="text-input"
                placeholder="Abteilung"
              />
            </div>
          </div>

          <!-- Submit Button -->
          <button 
  class="submit-button" 
  @click="submitNewUser"
  :disabled="isSubmitting"
>
  {{ isSubmitting ? "Erstellt..." : "Erstellen" }}
</button>

        </div>
      </div>
      <!-- ASANA PANEL -->
      <div class="second-panel">
        <h3>Asana Task Details</h3>

        <div v-if="asanaTask">
          <!-- Task Title -->
          <h4>{{ asanaTask.name }}</h4>

          <!-- Project Memberships -->
          <p>
            <strong>Projekte:</strong>
            <p v-for="project in asanaTask.memberships">
              {{ project.project.name }}
            </p>
          </p>

          <h3>Beschreibung</h3>
          <div
            v-if="asanaTask.html_notes"
            class="asana-html-notes"
            v-html="parseNotes(asanaTask.html_notes)"
          ></div>
          <p v-else-if="asanaTask.notes">Beschreibung: {{ asanaTask.notes }}</p>
          <p v-else><strong>Keine Beschreibung verfügbar</strong></p>
        </div>
        <div v-else>
          <p>Keine Asana-Daten geladen.</p>
        </div>
      </div>
    </div>
    
    <!-- Personalnr Hinweis Modal -->
    <div v-if="showPersonalnrHinweis" class="modal">
      <div class="modal-content info-modal">
        <h3>ℹ Wichtige Information</h3>
        <div class="info-content">
          <p><strong>Ab sofort ist die Personalnummer ein Pflichtfeld!</strong></p>
          <p>Bitte gib immer die Personalnummer des Mitarbeiters ein.</p>
          <p><strong>Falls die Personalnummer nicht verfügbar ist:</strong></p>
          <p>Trag eine <strong>0</strong> (Null) ein.</p>
        </div>
        <button class="info-modal-btn" @click="closePersonalnrHinweis">
          Verstanden
        </button>
      </div>
    </div>
    
    <div v-if="showReentryModal" class="modal">
      <div class="modal-content">
        <font-awesome-icon
          class="close-modal"
          :icon="['fas', 'times']"
          @click="showReentryModal = false"
        />
        <h4>Wiedereintritt MA</h4>

        <!-- Input for Mitarbeiter search -->
        <div class="autocomplete-wrapper">
          <input
            type="text"
            v-model="searchMitarbeiter"
            @keydown.down.prevent="highlightNext"
            @keydown.up.prevent="highlightPrev"
            @keydown.enter.prevent="selectHighlighted"
            placeholder="Mitarbeiter suchen..."
            class="text-input"
          />
          <ul v-if="filteredMitarbeiter.length" class="mitarbeiter-list">
            <li
              v-for="(mitarbeiter, index) in filteredMitarbeiter"
              :key="mitarbeiter._id"
              :class="{ highlighted: index === selectedIndex }"
              @mouseenter="highlightOption(index)"
              @click="selectMitarbeiter(mitarbeiter)"
            >
              {{ mitarbeiter.vorname }} {{ mitarbeiter.nachname }} ({{
                mitarbeiter.email
              }})
            </li>
          </ul>
        </div>
      </div>
    </div>

  </div>

  <!-- Wiedereintritt: EmployeeCard Modal -->
  <div v-if="reentryMitarbeiter" class="modal-overlay reentry-modal" @click.self="reentryMitarbeiter = null">
    <div class="modal-content modal-employee">
      <div class="modal-header">
        <h2>Wiedereintritt — Bestandsdaten</h2>
        <button class="close-btn" @click="reentryMitarbeiter = null">&times;</button>
      </div>
      <div class="modal-body modal-employee-body">
        <EmployeeCard
          v-if="reentryFullData"
          :ma="reentryFullData"
          :initiallyExpanded="true"
          :showCheckbox="false"
        />
        <div v-else class="loading-employee">
          <font-awesome-icon icon="fa-solid fa-spinner" spin />
          <span>Lade Mitarbeiter…</span>
        </div>
      </div>
    </div>
  </div>

</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import debounce from "lodash.debounce";
import AsanaMappings from "@/assets/AsanaMappings.json";
import FlipMappings from "@/assets/FlipMappings.json";
import EmployeeCard from "@/components/EmployeeCard.vue";
export default {
  name: "Erstellen",
  emits: [],
  components: {
    FontAwesomeIcon,
    EmployeeCard,
  },
  props: {},
  data() {
    return {
      // System
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userName: "",
      userID: "",
      asanaTask: null,
      flipUsers: null,
      userGroups: null,
      showHinweise: false,
      showReentryModal: false,
      showPersonalnrHinweis: false,
      inactiveMitarbeiter: [],
      searchMitarbeiter: "",
      selectedIndex: -1,
      isSubmitting: false,
      // JSON Mappings
      bewerber_project_gids: AsanaMappings,
      user_group_ids: FlipMappings.user_group_ids,

      // User Form Data
      asana_id: this.$route.params.id || null,
      vorname: "",
      nachname: "",
      email: "",
      personalnr: "",
      primary_user_group: "",
      location: "",
      isService: false,
      isLogistik: false,
      isTeamleiter: false,
      isFestangestellt: false,
      isOffice: false,
      job_title: "Mitarbeiter/in",
      department: "",
      userGroups: [],

      //Response
      createdFlipUser: null,

      // Field existence checks (live, debounced)
      // state: 'idle' | 'checking' | 'found' | 'clear' | 'error'
      fieldStatus: {
        email:      { state: 'idle', mitarbeiter: null },
        personalnr: { state: 'idle', mitarbeiter: null },
        asana_id:   { state: 'idle', mitarbeiter: null },
      },

      // Wiedereintritt modal
      reentryMitarbeiter: null,  // basic stub — triggers modal v-if
      reentryFullData: null,     // full DB + Flip merged object

      // Notification
      notification: {
        visible: false,
        type: 'info', // 'success' | 'error' | 'warning' | 'info'
        message: '',
        _timer: null,
      },
    };
  },
  watch: {
    asana_id: {
      handler: debounce(async function (newVal) {
        if (newVal && newVal.trim().length > 8) {
          const trimmedId = newVal.trim();
          const taskFound = await this.fetchAsanaTask(trimmedId);
          if (!taskFound) {
            this.asanaTask = null;
          }
          this.checkField('asana_id', trimmedId);
        } else {
          this.asanaTask = null;
          this.fieldStatus.asana_id = { state: 'idle', mitarbeiter: null };
        }
      }, 1000),
      immediate: false,
    },
    email: debounce(function (val) {
      if (val && val.trim().length > 4 && val.includes('@')) {
        this.checkField('email', val.trim());
      } else {
        this.fieldStatus.email = { state: 'idle', mitarbeiter: null };
      }
    }, 600),
    personalnr: debounce(function (val) {
      if (val && val.trim().length > 0 && val.trim() !== '0') {
        this.checkField('personalnr', val.trim());
      } else {
        this.fieldStatus.personalnr = { state: 'idle', mitarbeiter: null };
      }
    }, 600),
    isTeamleiter: {
      immediate: true,
      handler(newVal) {
        if(newVal) {
          this.job_title = "Teamleiter/in";
        } else {
          this.job_title = "Mitarbeiter/in";
        }
      }
    },
    "$route.params.id": {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.asana_id = newId;
          localStorage.setItem("asana_id", newId);
        }
      },
    },
    token(newToken) {
      if (newToken) {
        localStorage.setItem("token", newToken);
        this.setAxiosAuthToken();
      } else {
        localStorage.removeItem("token");
      }
    },
    isService: "setDepartment",
    isLogistik: "setDepartment",
  },
  computed: {
    isDev() {
      return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    },
    availableLocations() {
      return (index) => {
        const allLocations = Object.keys(this.bewerber_project_gids);
        return allLocations.filter(
          (loc) =>
            !this.locations.includes(loc) ||
            this.locations.indexOf(loc) === index
        );
      };
    },
    filteredMitarbeiter() {
      const query = this.searchMitarbeiter.toLowerCase().trim();
      if (!query) return [];

      return this.inactiveMitarbeiter
        .filter(({ vorname, nachname, email }) => {
          const fullName = `${vorname} ${nachname}`.toLowerCase();
          return (
            fullName.includes(query) || email.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          const input = query;
          const fullNameA = `${a.vorname} ${a.nachname}`.toLowerCase();
          const fullNameB = `${b.vorname} ${b.nachname}`.toLowerCase();
          return fullNameA.startsWith(input)
            ? -1
            : fullNameB.startsWith(input)
            ? 1
            : fullNameA.localeCompare(fullNameB);
        });
    },
    selectedMitarbeiter() {
      return this.filteredMitarbeiter[this.selectedIndex] || null;
    },
    emailFormatted: {
      get() {
        return this.email;
      },
      set(value) {
        this.email = value.toLowerCase();
      }
    }
  },
  methods: {
    async checkField(field, value) {
      if (!value) return;
      this.fieldStatus[field] = { state: 'checking', mitarbeiter: null };
      try {
        const params = {};
        params[field] = value;
        const { data } = await api.get('/api/personal/check', { params });
        if (data.found) {
          this.fieldStatus[field] = { state: 'found', mitarbeiter: data.mitarbeiter };
        } else {
          this.fieldStatus[field] = { state: 'clear', mitarbeiter: null };
        }
      } catch {
        this.fieldStatus[field] = { state: 'error', mitarbeiter: null };
      }
    },
    async openReentryForMitarbeiter(mitarbeiter) {
      this.reentryMitarbeiter = mitarbeiter;  // open modal immediately
      this.reentryFullData = null;
      try {
        const response = await api.get(`/api/personal/mitarbeiter/${mitarbeiter._id}`);
        const mitarbeiterData = response.data.data;
        if (mitarbeiterData.flip_id) {
          try {
            const flipResponse = await api.get(`/api/personal/flip/by-id/${mitarbeiterData.flip_id}`);
            mitarbeiterData.flip = flipResponse.data;
          } catch {
            mitarbeiterData.flip = null;
          }
        }
        this.reentryFullData = mitarbeiterData;
      } catch {
        this.showNotification('error', 'Mitarbeiter-Daten konnten nicht geladen werden.');
        this.reentryMitarbeiter = null;
      }
    },
    showNotification(type, message, duration = null) {
      if (this.notification._timer) clearTimeout(this.notification._timer);
      this.notification.type = type;
      this.notification.message = message;
      this.notification.visible = true;

      const defaultDuration = type === 'error' ? 10000 : type === 'warning' ? 7000 : 4000;
      const ms = duration ?? defaultDuration;
      this.notification._timer = setTimeout(() => {
        this.notification.visible = false;
      }, ms);
    },
    testNotify() {
      const samples = [
        { type: 'success', message: 'Benutzer Max Mustermann wurde angelegt.' },
        { type: 'info',    message: 'Asana-Task geladen. Felder wurden automatisch befüllt.' },
        { type: 'warning', message: 'E-Mail-Adresse bereits vergeben. Bitte eine andere angeben.' },
        { type: 'error',   message: 'Verbindung zum Server fehlgeschlagen. Status 503.' },
      ];
      const currentIdx = samples.findIndex(s => s.type === this.notification.type);
      const next = samples[(currentIdx + 1) % samples.length];
      this.showNotification(next.type, next.message);
    },
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    normalizeLocation(location) {
  return location
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
},
    setDepartment() {
      let departments = [];

      if (this.isService) departments.push("Service");
      if (this.isLogistik) departments.push("Logistik");

      // Join all selected departments with "/" or set empty string if none
      this.department = departments.length ? departments.join("/") : "";
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me");
          this.userEmail = response.data.email;
          this.userID = response.data._id;
          this.userName = response.data.name;
          this.searchQuery = response.data.location;
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerdaten:", error);
          this.switchToDashboard();
        }
      } else {
        this.switchToDashboard();
      }
    },
    async fetchAsanaTask() {
      if (!this.asana_id) return;
      try {
        const response = await api.get(`/api/asana/task/${this.asana_id}`);
        this.asanaTask = response.data.task;
        console.log(this.asanaTask);
        if (!this.vorname && !this.nachname) {
          this.parseTaskName(this.asanaTask.name);
        }
        this.parseTaskProjects(this.asanaTask.memberships);
        return true;
      } catch (error) {
        console.error("❌ Error fetching Asana task:", error);
        return false;
      }
    },
    highlightNext() {
      if (this.selectedIndex < this.filteredMitarbeiter.length - 1) {
        this.selectedIndex++;
        this.scrollHighlightedIntoView();
      }
    },
    highlightPrev() {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.scrollHighlightedIntoView();
      }
    },
    selectHighlighted() {
      if (this.selectedIndex >= 0 && this.filteredMitarbeiter.length > 0) {
        this.selectMitarbeiter(this.filteredMitarbeiter[this.selectedIndex]);
      }
    },
    highlightOption(index) {
      this.selectedIndex = index;
    },
    scrollHighlightedIntoView() {
      this.$nextTick(() => {
        const container = this.$el.querySelector(".mitarbeiter-list");
        const highlightedItem = container.querySelector(".highlighted");

        if (highlightedItem) {
          highlightedItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      });
    },
    selectMitarbeiter(mitarbeiter) {
      this.selectedMitarbeiter = mitarbeiter;
      this.searchMitarbeiter = `${mitarbeiter.vorname} ${mitarbeiter.nachname}`;
      this.selectedIndex = -1;
      this.filteredMitarbeiter = [];

      this.autofillMitarbeiterDetails(mitarbeiter);
    },
  
    async autofillMitarbeiterDetails(mitarbeiter) {
      this.vorname = mitarbeiter.vorname;
      this.nachname = mitarbeiter.nachname;
      this.email = mitarbeiter.email;

      if (mitarbeiter.asana_id) {
        this.asana_id = mitarbeiter.asana_id;
        await this.fetchAsanaTask(mitarbeiter.asana_id);
      }

      this.filteredMitarbeiter = [];
    },
    async fetchInactiveMitarbeiter() {
      if (!this.token) return this.switchToDashboard();
      try {
        const response = await api.get("/api/personal/mitarbeiter", {
          params: { isActive: false },
        });
        this.inactiveMitarbeiter = response.data.data;
      } catch (error) {
        console.error("Fehler beim Laden inaktiver Mitarbeiter:", error);
      }
    },
    async fetchSchulungenTasks() {
      if (!this.token) {
        return this.switchToDashboard();
      }

      try {
        // Create an array of promises for all project requests
        const projectIds = Object.values(this.bewerber_project_gids);
        const requests = projectIds.map((project_id) => {
          let opts = {
            project: project_id,
            completed_since: new Date().toISOString(),
            opt_fields:
              "assignee, assignee_status, completed, completed_at, completed_by, created_at, created_by, due_at, due_on, followers, html_notes, memberships, modified_at, name, notes, parent, permalink_url, projects",
          };

          return api.get("/api/asana/tasks", { params: opts });
        });

        // Wait for all requests to complete
        const responses = await Promise.all(requests);

        // Extract tasks from responses
        const allTasks = responses.flatMap(
          (response) => response.data.tasks || []
        );

        console.log("✅ Fetched Schulungen Tasks:", allTasks);
        return allTasks;
      } catch (error) {
        console.error(
          "❌ Error fetching Schulungen tasks:",
          error.response?.data || error.message
        );
      }
    },
    parseTaskName(name) {
      function cleanWords(words) {
        return words
          .map((word) => word.trim()) // Remove leading/trailing spaces
          .filter((word) => /[a-zA-ZäöüÄÖÜß]/.test(word)); // Ensure the word contains at least one letter
      }

      if (!name || this.vorname || this.nachname) return; // Prevent overwriting if names are already set

      name = name.trim();

      // Define job-related keywords to be removed
      const jobKeywords = ["s", "service", "l", "logi", "logistik", "s+l", "l+s"];

      // Split into words while preserving order
      let words = name.split(" ");
      let filteredWords = [];
      let isService = false;
      let isLogistik = false;

      // Remove job-related keywords and detect role flags
      words.forEach((word) => {
        const lowerWord = word.toLowerCase();

        if (["s", "service"].includes(lowerWord)) {
          isService = true;
        } else if (["l", "logi", "logistik"].includes(lowerWord)) {
          isLogistik = true;
        } else if(["s+l", "l+s"].includes(lowerWord)) {
          isService = true;
          isLogistik = true;
        } else {
          filteredWords.push(word); // Keep only words that are not job-related
        }
      });
      words = filteredWords;
      // Assign detected fields
      this.isService = isService;
      this.isLogistik = isLogistik;
      // Check if the name is in "Last, First" format (contains a comma)
      let firstNames = [];
      let lastName = "";

      if (name.includes(",")) {
        const parts = words.join(" ").split(",");

        // Clean up each part AFTER splitting to keep the comma logic intact
        lastName = parts[0].trim().replace(/[^a-zA-ZäöüÄÖÜß-]/g, ""); // Keep only letters + hyphens
        firstNames = parts
          .slice(1)
          .join(" ")
          .trim()
          .replace(/[^a-zA-ZäöüÄÖÜß -]/g, "")
          .split(" ");
      } else {
        // Otherwise, assume last word is the last name, rest are first names
        words = cleanWords(words); // Clean words AFTER checking for comma

        let lastCandidate = words.pop() || ""; // Get the last word

        // If last name is empty or just a hyphen, fallback to previous word
        if (!lastCandidate || lastCandidate === "-") {
          lastCandidate = words.pop() || "";
        }

        lastName = lastCandidate;
        firstNames = words;
      }

      // Remove dashes ONLY IF at beginning or end of first/last name
      firstNames = firstNames.map((fn) => fn.replace(/^-+|-+$/g, ""));
      lastName = lastName.replace(/^-+|-+$/g, "");

      // Assign extracted names
      this.vorname = firstNames.join(" ");
      this.nachname = lastName;

      console.log("✅ Parsed Name:", {
        vorname: this.vorname,
        nachname: this.nachname,
      });
    },
    parseNotes(html) {
      if (!html) return "";

      // Remove "Bewerber erstellen" text
      html = html.replace("Bewerber erstellen", "");

      // Remove hyperlinks
      html = html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");

      // Extract potential email
      const emailMatch = html.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      );

      if (emailMatch && emailMatch.length === 1) {
        this.email = emailMatch[0]; // Assign email if exactly one found
        console.log("✅ Extracted Email:", this.email);
      }

      return html;
    },
    async fetchFlipUsers() {
      if (!this.token) return this.switchToDashboard();
      try {
        const response = await api.get("/api/personal/flip", {
          params: { sort: "LAST_NAME_ASC", page_number: "1", page_limit: "100" },
        });
        this.flipUsers = response.data;
      } catch (error) {
        console.error("Fehler beim Laden der Flip-Benutzer:", error);
      }
    },
    async fetchFlipUserGroups() {
      if (!this.token) return this.switchToDashboard();
      try {
        const response = await api.get("/api/personal/user-groups", {
          params: {
            sort: "GROUP_NAME_ASC",
            page_number: "1",
            page_limit: "100",
            status: "ACTIVE",
          },
        });
        this.userGroups = response.data;
      } catch (error) {
        console.error("Fehler beim Laden der Benutzergruppen:", error);
      }
    },
    resetNewUser() {
      this.asana_id = this.$route.params.id || "";
      this.vorname = "";
      this.nachname = "";
      this.email = "";
      this.personalnr = "";
      this.primary_user_group = "";
      this.location = "";
      this.isService = false;
      this.isLogistik = false;
      this.isTeamleiter = false;
      this.isFestangestellt = false;
      this.isOffice = false;
      this.job_title = "Mitarbeiter/in";
      this.department = "";
      this.showReentryModal = false;
      this.reentryMitarbeiter = null;
      this.reentryFullData = null;
      this.createdFlipUser = null;
      this.fieldStatus = {
        email:      { state: 'idle', mitarbeiter: null },
        personalnr: { state: 'idle', mitarbeiter: null },
        asana_id:   { state: 'idle', mitarbeiter: null },
      };
    },
    openReentryModal() {
      this.showReentryModal = true;
    },
    
    checkPersonalnrHinweis() {
      const hasSeenHinweis = localStorage.getItem('hasSeenPersonalnrHinweis');
      if (!hasSeenHinweis) {
        this.showPersonalnrHinweis = true;
      }
    },
    
    closePersonalnrHinweis() {
      localStorage.setItem('hasSeenPersonalnrHinweis', 'true');
      this.showPersonalnrHinweis = false;
    },
    
    async submitNewUser() {
  if (this.isSubmitting) return;

 // 🛡 Null/empty field checks
 if (
    !this.vorname?.trim() ||
    !this.nachname?.trim() ||
    !this.email?.trim() ||
    !this.personalnr?.trim() ||
    !this.location
  ) {
    this.showNotification('warning', 'Bitte fülle alle Pflichtfelder aus: Vorname, Nachname, E-Mail, Personalnummer (oder 0), Standort.');
    return;
  }

  this.isSubmitting = true;
  try {
    const trimmedPersonalnr = this.personalnr.trim();
    const personalnrValue = trimmedPersonalnr === '0' ? null : trimmedPersonalnr;

    const userPayload = {
      asana_id: this.asana_id || null,
      first_name: this.vorname,
      last_name: this.nachname,
      email: this.email,
      personalnr: personalnrValue,
      role: "USER",
      created_by: this.userEmail,
      attributes: [
        { name: "job_title",  value: this.job_title },
        { name: "location",   value: this.location },
        { name: "department", value: this.department },
        { name: "isService",  value: String(this.isService) },
        { name: "isLogistik", value: String(this.isLogistik) },
        { name: "isTeamLead", value: String(this.isTeamleiter) },
        { name: "isOffice",   value: String(this.isOffice) },
        { name: "isFesti",    value: String(this.isFestangestellt) },
      ],
    };

    const response = await api.post("/api/personal/create", userPayload);
    this.createdFlipUser = response.data.flipUser;
    this.showNotification('success', `Benutzer ${this.vorname} ${this.nachname} wurde erfolgreich erstellt.`);
  } catch (error) {
    console.error("❌ Fehler beim Erstellen:", error);

    if (error.response && error.response.status === 409) {
      const d = error.response.data;
      this.showNotification('warning', d.message || 'Ein Benutzer mit diesen Daten existiert bereits.');
      // If the server returned the conflicting mitarbeiter, open the Wiedereintritt modal automatically
      if (d.mitarbeiter_id) {
        await this.openReentryForMitarbeiter({ _id: d.mitarbeiter_id });
      }
    } else if (error.response?.status === 422) {
      const details = error.response.data?.errors?.map(e => e.msg).join(', ');
      this.showNotification('error', `Ungültige Eingabe: ${details || error.response.data?.message || 'Bitte Felder prüfen.'}`);
    } else if (error.response?.status === 500) {
      this.showNotification('error', `Serverfehler: ${error.response.data?.message || 'Interner Fehler. Bitte Logs prüfen.'}`);
    } else if (!error.response) {
      this.showNotification('error', 'Keine Verbindung zum Server. Bitte Netzwerk und Backend prüfen.');
    } else {
      this.showNotification('error', `Fehler beim Erstellen (${error.response?.status ?? 'unbekannt'}): ${error.response?.data?.message || error.message}`);
    }
  } finally {
    this.isSubmitting = false;
  }
},
    parseTaskProjects(memberships) {
  if (!memberships || memberships.length === 0) return;

  const projectGids = memberships.map((m) => m.project.gid);
  const projectMapping = {};

  for (const [loc, projects] of Object.entries(this.bewerber_project_gids)) {
    for (const projectType in projects) {
      projectMapping[projects[projectType]] = loc;
    }
  }

  // Map canonical display names
  const canonicalMap = { Hamburg: "Hamburg", Berlin: "Berlin", "Köln": "Köln" };

  for (const gid of projectGids) {
    const rawLocation = projectMapping[gid];
    if (rawLocation && canonicalMap[rawLocation]) {
      this.location = canonicalMap[rawLocation];
      return; // Use first match
    }
  }
},

    switchToDashboard() {
      this.$router.push("/");
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchInactiveMitarbeiter();
    this.fetchFlipUsers();
    this.fetchFlipUserGroups();
    this.fetchAsanaTask();
    this.checkPersonalnrHinweis();
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* Wrapper */
.window{
  max-width: 1600px;
  width: calc(100% - 60px);
  margin: 30px auto;
  padding: 30px;
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 6px 12px rgba(0,0,0,.12);
}

/* Panels-Layout */
.window-panels{ display:flex; gap:20px; }

/* Cards */
.create-panel,
.second-panel{
  padding: 25px;
  background: var(--tile-bg);
  color: var(--text);
  border:1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0,0,0,.06);
}

/* Create-Panel Aufteilung */
.create-panel{
  flex:3; display:flex; flex-direction:column; gap:20px;

  .top-panel, .bottom-panel{
    padding: 20px;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  .top-panel{
    h2{ font-size:1.8rem; margin:0 0 14px; color: var(--text); }

    .action-buttons{
      margin-bottom: 16px;
      button{
        background: transparent;
        color: var(--primary);
        border:1px solid var(--primary);
        border-radius: 8px;
        cursor:pointer;
        font-weight:600;
        padding: 8px 14px;
        margin-right: 10px;
        transition: background .2s, color .2s, transform .08s, border-color .2s;
      }
      button:hover{
        background: var(--primary);
        color:#fff;
        transform: translateY(-1px);
      }
      button:active{ transform: translateY(0); }
      button:disabled{ opacity:.6; cursor:not-allowed; }
    }

    .hinweise{
      background: rgba(var(--primary-rgb), 0.05);
      color: var(--text);
      padding: 16px;
      border-radius: 8px;
      border-left: 3px solid var(--primary);
      margin: 12px 0 0;

      h3{ margin:0 0 6px; font-size:1.05rem; }
      p{ margin: 4px 0; color: var(--muted); }
    }
  }

  .bottom-panel{
    /* Submit */
    .submit-button{
      width: 100%; margin-top: 22px; height: 2.8rem;
      font-size: 1.05rem; border-radius: 8px;
      background: var(--primary); color:#fff; border:none; cursor:pointer;
      transition: filter .2s, transform .08s, box-shadow .2s;
      box-shadow: 0 4px 10px -2px rgba(0,0,0,.18);
    }
    .submit-button:hover{ filter: brightness(.95); transform: translateY(-1px); }
    .submit-button:active{ filter: brightness(.9); transform: translateY(0); }
    .submit-button:disabled{ opacity:.6; cursor:not-allowed; box-shadow:none; transform:none; }
  }
}

/* Asana-Panel rechts */
.second-panel{
  flex:2; display:flex; flex-direction:column; gap:14px;

  h3{
    font-size:1.4rem; font-weight:700; color: var(--text);
    border-bottom: 2px solid var(--primary); padding-bottom:6px; margin:0 0 10px;
  }
  h4{ font-size:1.15rem; margin:6px 0; color: var(--text); font-weight:600; }
  p{ margin:6px 0; color: var(--muted); }
  p strong{ color: var(--text); }

  .asana-html-notes{
    background: rgba(var(--border-rgb), 0.05);
    color: var(--text);
    border: 1px solid rgba(var(--border-rgb), 0.2);
    border-radius: 8px;
    padding: 16px;
    max-height: 260px;
    overflow:auto;
    line-height: 1.6;
  }
  .no-data{ text-align:center; color: var(--muted); font-size:.95rem; margin-top:12px; }
}

/* Labels */
.input-label{
  display:block;
  padding-bottom: 4px;
  margin-bottom: 10px;
  font-weight:600;
  color: var(--text);
  border-bottom: 1px solid var(--primary);
}

/* Checkbox Label */
.check-label{
  display:flex; align-items:center; gap:10px;
  height: 2rem; padding-left: 10px; user-select:none;
  color: var(--muted); border-left: 2px solid var(--primary);
}

/* Back link */
.discrete{
  display:inline-block; margin: 0 0 12px; padding:6px 10px;
  color: var(--muted); font-weight:600; text-decoration:none;
  transition: color .2s;
}
.discrete:hover{ color: var(--primary); }

/* Inputs */
.input-group{ display:flex; flex-wrap:wrap; gap:20px; margin-bottom: 22px; }
.input-item{ flex:1; min-width: 220px; display:flex; flex-direction:column; }

.text-input, .standort-dropdown{
  border-radius: 8px;
  background: rgba(var(--border-rgb), 0.03);
  color: var(--text);
  border: 1px solid rgba(var(--border-rgb), 0.3);
  padding: 12px 14px; font-size: 1rem;
  transition: border-color .2s, box-shadow .2s, background .2s;
}
.text-input:focus, .standort-dropdown:focus{
  outline:none; border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent);
}
.text-input:hover, .standort-dropdown:hover{
  border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
}
.text-input.email{ text-transform: lowercase; }

/* Checkbox Group */
.checkbox-group{
  display:grid; gap: 16px; padding: 20px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  background: rgba(var(--border-rgb), 0.1); 
  border: 1px solid rgba(var(--border-rgb), 0.3);
  border-radius: 8px;
}

/* Native checkbox mit Theme */
.check-input{
  width:18px; height:18px; min-width:18px; min-height:18px;
  accent-color: var(--primary);
  cursor:pointer; transition: transform .12s ease;
}
.check-input:hover{ transform: scale(1.06); }
.check-input:active{ transform: scale(.98); }

/* Modal */
.modal{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background: var(--overlay); z-index: 1000; }
.modal-content{
  position:relative;
  background: var(--tile-bg); color: var(--text);
  border: 1px solid rgba(var(--border-rgb), 0.3);
  border-radius: 16px; padding: 28px; width: 420px;
  box-shadow: 0 12px 40px rgba(0,0,0,.15);
}

.info-modal {
  max-width: 500px;
  width: calc(100% - 32px);
  
  h3 {
    margin: 0 0 16px;
    font-size: 1.4rem;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .info-content {
    margin-bottom: 20px;
    line-height: 1.6;
    
    p {
      margin: 8px 0;
      color: var(--text);
      
      strong {
        color: var(--primary);
      }
    }
  }
  
  .info-modal-btn {
    width: 100%;
    padding: 12px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter .2s, transform .08s;
    
    &:hover {
      filter: brightness(.95);
      transform: translateY(-1px);
    }
    
    &:active {
      filter: brightness(.9);
      transform: translateY(0);
    }
  }
}

.close-modal{
  position:absolute; top:10px; right:10px; font-size:18px;
  color: var(--muted); cursor:pointer; transition: color .2s;
}
.close-modal:hover{ color: var(--text); }

.autocomplete-wrapper .text-input{ width: calc(100% - 2px); margin-bottom: 8px; }
.mitarbeiter-list{
  max-height: 260px; overflow:auto; 
  border: 1px solid rgba(var(--border-rgb), 0.2);
  border-radius: 8px; 
  background: rgba(var(--border-rgb), 0.03); 
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0,0,0,.05); 
  padding: 0; margin: 0; list-style: none;
}
.mitarbeiter-list li{
  padding: 10px 12px; border-bottom: 1px solid var(--border); cursor:pointer;
}
.mitarbeiter-list li:last-child{ border-bottom: none; }
.mitarbeiter-list li.highlighted,
.mitarbeiter-list li:hover{
  background: var(--primary); color:#fff;
}

/* ============= NOTIFICATION BANNER ============= */

.notify-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border-radius: 6px;
  border-left: 4px solid currentColor;
  margin-bottom: 16px;
  font-size: 0.9rem;
  line-height: 1.45;
  font-weight: 500;

  .notify-dot {
    width: 6px;
    height: 6px;
    min-width: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.65;
  }

  .notify-text {
    flex: 1;
    word-break: break-word;
  }

  .notify-close {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.35;
    font-size: 1.15rem;
    line-height: 1;
    padding: 0 2px;
    color: inherit;
    transition: opacity 0.12s;
    &:hover { opacity: 0.75; }
  }
}

.notify-success {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.7);
}

.notify-error {
  background: rgba(239, 68, 68, 0.11);
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.7);
}

.notify-warning {
  background: rgba(245, 158, 11, 0.11);
  color: #92400e;
  border-color: rgba(245, 158, 11, 0.7);
}

.notify-info {
  background: rgba(var(--border-rgb), 0.08);
  color: var(--text);
  border-color: rgba(var(--border-rgb), 0.45);
}

/* Fade only — kein Slide */
.notify-enter-active,
.notify-leave-active {
  transition: opacity 0.18s ease;
}
.notify-enter-from,
.notify-leave-to {
  opacity: 0;
}

/* Dev-only preview button */
.dev-notify-btn {
  opacity: 0.45 !important;
  font-style: italic;
  font-size: 0.78rem !important;
  border-style: dashed !important;
  &:hover { opacity: 0.85 !important; }
}

/* ============= FIELD HINTS ============= */

.field-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
  font-size: 0.8rem;
  line-height: 1.4;
}

.hint-checking { color: var(--muted); font-style: italic; }
.hint-clear    { color: #15803d; }
.hint-error    { color: #b91c1c; }
.hint-found    { color: #92400e; font-weight: 500; }

.hint-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  vertical-align: middle;
}
.badge-active   { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
.badge-inactive { background: rgba(107, 114, 128, 0.12); color: var(--muted); }

.reentry-btn {
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover { background: var(--primary); color: #fff; }
}

/* ============= WIEDEREINTRITT MODAL ============= */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-employee {
  max-width: 900px;
  width: 95%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.6;
    transition: opacity 0.12s;
    &:hover { opacity: 1; }
  }
}

.modal-body {
  overflow-y: auto;
}

.modal-employee-body {
  padding: 0;
  max-height: 80vh;
}

.loading-employee {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--muted);
}

/* ============= MOBILE RESPONSIVE OPTIMIERUNGEN ============= */

@media (max-width: 1024px) {
  /* Tablets */
  .window {
    width: calc(100vw - 32px);
    margin: 16px;
    padding: 20px;
  }
  
  .window-panels {
    flex-direction: column;
    gap: 16px;
  }
  
  .create-panel, .second-panel {
    padding: 20px;
  }
  
  .create-panel .top-panel,
  .create-panel .bottom-panel {
    padding: 16px;
  }
}

@media (max-width: 768px) {
  /* Mobile */
  .window {
    width: calc(100vw - 16px);
    margin: 8px;
    padding: 16px;
  }
  
  .window-panels {
    flex-direction: column;
    gap: 12px;
  }
  
  /* Panels kompakter */
  .create-panel, .second-panel {
    padding: 16px;
  }
  
  .create-panel {
    gap: 16px;
    
    .top-panel, .bottom-panel {
      padding: 0;
      margin-bottom: 16px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    .top-panel {
      h2 {
        font-size: 1.4rem;
        margin-bottom: 12px;
      }
      
      /* Action Buttons Stack Layout */
      .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
        
        button {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px; /* Anti-Zoom */
          text-align: center;
          margin-right: 0;
        }
      }
      
      .hinweise {
        padding: 12px;
        margin: 8px 0 0;
        
        h3 {
          font-size: 1rem;
        }
        
        p {
          font-size: 0.9rem;
          margin: 3px 0;
        }
      }
    }
  }
  
  /* Input Groups Mobile */
  .input-group {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    
    .input-item {
      min-width: 100%;
      flex: none;
    }
  }
  
  /* Input Labels kompakter */
  .input-label {
    font-size: 0.9rem;
    margin-bottom: 8px;
    padding-bottom: 3px;
  }
  
  /* Inputs Touch-Optimiert */
  .text-input, .standort-dropdown {
    padding: 14px 16px;
    font-size: 16px; /* Verhindert Auto-Zoom */
    border-radius: 12px;
  }
  
  /* Checkbox Group Mobile */
  .checkbox-group {
    grid-template-columns: 1fr 1fr; /* 2 Spalten auf Mobile */
    gap: 12px;
    padding: 12px;
    
    .check-label {
      font-size: 0.9rem;
      padding-left: 8px;
      height: auto;
      min-height: 2.5rem;
    }
    
    .check-input {
      width: 20px;
      height: 20px;
      min-width: 20px;
      min-height: 20px;
    }
  }
  
  /* Submit Button Mobile */
  .submit-button {
    height: 3rem;
    font-size: 16px; /* Anti-Zoom */
    border-radius: 12px;
    margin-top: 16px;
  }
  
  /* Asana Panel Mobile */
  .second-panel {
    h3 {
      font-size: 1.2rem;
      margin-bottom: 8px;
    }
    
    h4 {
      font-size: 1rem;
    }
    
    p {
      font-size: 0.9rem;
      margin: 4px 0;
    }
    
    .asana-html-notes {
      padding: 10px;
      max-height: 200px;
      font-size: 0.9rem;
    }
  }
  
  /* Modal Mobile */
  .modal-content {
    width: calc(100vw - 32px);
    margin: 16px;
    padding: 20px;
  }
  
  .autocomplete-wrapper .text-input {
    padding: 14px 16px;
    font-size: 16px; /* Anti-Zoom */
  }
  
  .mitarbeiter-list {
    max-height: 200px;
    
    li {
      padding: 12px;
      font-size: 0.9rem;
    }
  }
}

@media (max-width: 480px) {
  /* Kleine Mobile Geräte */
  .window {
    width: calc(100vw - 8px);
    margin: 4px;
    padding: 12px;
  }
  
  .create-panel, .second-panel {
    padding: 12px;
  }
  
  .create-panel .top-panel,
  .create-panel .bottom-panel {
    padding: 10px;
  }
  
  .create-panel .top-panel {
    h2 {
      font-size: 1.2rem;
    }
    
    .action-buttons button {
      padding: 10px 14px;
      font-size: 15px;
    }
  }
  
  /* Checkbox Group - Single Column auf sehr kleinen Displays */
  .checkbox-group {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px;
  }
  
  .input-label {
    font-size: 0.85rem;
  }
  
  .text-input, .standort-dropdown {
    padding: 12px 14px;
  }
  
  .submit-button {
    height: 2.8rem;
    font-size: 15px;
  }
  
  .second-panel {
    h3 {
      font-size: 1.1rem;
    }
    
    .asana-html-notes {
      padding: 8px;
      max-height: 150px;
      font-size: 0.85rem;
    }
  }
}

/* Landscape Mobile Optimierung */
@media (max-width: 768px) and (orientation: landscape) {
  .window-panels {
    flex-direction: row;
  }
  
  .create-panel {
    flex: 2;
  }
  
  .second-panel {
    flex: 1;
  }
  
  .checkbox-group {
    grid-template-columns: repeat(3, 1fr); /* 3 Spalten im Landscape */
  }
}
</style>

