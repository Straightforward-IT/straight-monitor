<template>
  <PageLayout title="Bewerber erstellen" width="wide" content-variant="flush">
  <div class="window">
    <!-- Notification Banner -->
    <transition name="notify">
      <div v-if="notification.visible" :class="['notify-banner', `notify-${notification.type}`]" role="status">
        <span class="notify-dot" aria-hidden="true"></span>
        <span class="notify-text">{{ notification.message }}</span>
        <AppIconButton variant="ghost" size="sm" label="Meldung schließen" @click="notification.visible = false">&times;</AppIconButton>
      </div>
    </transition>

    <div class="window-panels">
      <div class="create-panel">
        <!-- Top Panel -->
        <div class="top-panel">
          <h2>Benutzerangaben</h2>

          <!-- Toggle Button -->

          <div class="action-buttons">
            <AppButton variant="secondary" :disabled="isSubmitting" @click="showHinweise = !showHinweise">
              {{ showHinweise ? "Hinweise verbergen" : "Hinweise anzeigen" }}
            </AppButton>
            <AppButton variant="secondary" :disabled="isSubmitting" @click="resetNewUser">Formular zurücksetzen</AppButton>
            <AppButton variant="secondary" :disabled="isSubmitting" @click="fetchAsanaTask">Asana Task neu laden</AppButton>
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
              <label class="input-label" for="flip-asana-id">Asana Task-ID</label>
              <AppTextInput
                id="flip-asana-id"
                type="text"
                v-model="asana_id"
                :disabled="isSubmitting"
                placeholder="e.g. 1209453587596953"
              />
              <div v-if="fieldStatus.asana_id.state !== 'idle'" class="field-hint" :class="`hint-${fieldStatus.asana_id.state}`">
                <span v-if="fieldStatus.asana_id.state === 'checking'">Wird geprüft …</span>
                <span v-else-if="fieldStatus.asana_id.state === 'clear'">Neueinstellung</span>
                <span v-else-if="fieldStatus.asana_id.state === 'error'">Prüfung fehlgeschlagen</span>
                <template v-else-if="fieldStatus.asana_id.state === 'found'">
                  <span>Gefunden: {{ fieldStatus.asana_id.mitarbeiter.vorname }} {{ fieldStatus.asana_id.mitarbeiter.nachname }}
                    <span class="hint-badge" :class="fieldStatus.asana_id.mitarbeiter.isActive ? 'badge-active' : 'badge-inactive'">
                      {{ fieldStatus.asana_id.mitarbeiter.isActive ? 'aktiv' : 'inaktiv' }}
                    </span>
                  </span>
                  <AppButton variant="outlined" size="sm" :disabled="isSubmitting" @click="openReentryForMitarbeiter(fieldStatus.asana_id.mitarbeiter)">Wiedereintritt</AppButton>
                </template>
              </div>
            </div>
          </div>

          <!-- Name Inputs -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label" for="flip-vorname">Vorname*</label>
              <AppTextInput
                id="flip-vorname"
                type="text"
                v-model="vorname"
                :disabled="isSubmitting"
                placeholder="Vorname*"
              />
            </div>
            <div class="input-item">
              <label class="input-label" for="flip-nachname">Nachname*</label>
              <AppTextInput
                id="flip-nachname"
                type="text"
                v-model="nachname"
                :disabled="isSubmitting"
                placeholder="Nachname*"
              />
            </div>
            <div class="input-item">
              <label class="input-label" for="flip-email">E-Mail*</label>
              <AppTextInput
                id="flip-email"
                type="email"
                v-model="emailFormatted"
                :disabled="isSubmitting"
                placeholder="E-Mail*"
              />
              <div v-if="fieldStatus.email.state !== 'idle'" class="field-hint" :class="`hint-${fieldStatus.email.state}`">
                <span v-if="fieldStatus.email.state === 'checking'">Wird geprüft …</span>
                <span v-else-if="fieldStatus.email.state === 'clear'">Neueinstellung</span>
                <span v-else-if="fieldStatus.email.state === 'error'">Prüfung fehlgeschlagen</span>
                <template v-else-if="fieldStatus.email.state === 'found'">
                  <span>Gefunden: {{ fieldStatus.email.mitarbeiter.vorname }} {{ fieldStatus.email.mitarbeiter.nachname }}
                    <span class="hint-badge" :class="fieldStatus.email.mitarbeiter.isActive ? 'badge-active' : 'badge-inactive'">
                      {{ fieldStatus.email.mitarbeiter.isActive ? 'aktiv' : 'inaktiv' }}
                    </span>
                  </span>
                  <AppButton variant="outlined" size="sm" :disabled="isSubmitting" @click="openReentryForMitarbeiter(fieldStatus.email.mitarbeiter)">Wiedereintritt</AppButton>
                </template>
              </div>
            </div>
            <div class="input-item">
              <label class="input-label" for="flip-personalnr">Personalnummer*</label>
              <AppTextInput
                id="flip-personalnr"
                type="text"
                v-model="personalnr"
                :disabled="isSubmitting"
                placeholder="Personalnummer*"
              />
              <div v-if="fieldStatus.personalnr.state !== 'idle'" class="field-hint" :class="`hint-${fieldStatus.personalnr.state}`">
                <span v-if="fieldStatus.personalnr.state === 'checking'">Wird geprüft …</span>
                <span v-else-if="fieldStatus.personalnr.state === 'clear'">Neueinstellung</span>
                <span v-else-if="fieldStatus.personalnr.state === 'error'">Prüfung fehlgeschlagen</span>
                <template v-else-if="fieldStatus.personalnr.state === 'found'">
                  <span>Gefunden: {{ fieldStatus.personalnr.mitarbeiter.vorname }} {{ fieldStatus.personalnr.mitarbeiter.nachname }}
                    <span class="hint-badge" :class="fieldStatus.personalnr.mitarbeiter.isActive ? 'badge-active' : 'badge-inactive'">
                      {{ fieldStatus.personalnr.mitarbeiter.isActive ? 'aktiv' : 'inaktiv' }}
                    </span>
                  </span>
                  <AppButton variant="outlined" size="sm" :disabled="isSubmitting" @click="openReentryForMitarbeiter(fieldStatus.personalnr.mitarbeiter)">Wiedereintritt</AppButton>
                </template>
              </div>
            </div>
          </div>

          <!-- Standort Selection -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label" for="flip-location">Standort*</label>
              <AppSelect id="flip-location" v-model="location" :disabled="isSubmitting" required>
                <option value="">-</option>
                <option value="Hamburg">Hamburg</option>
                <option value="Berlin">Berlin</option>
                <option value="Köln">Köln</option>
              </AppSelect>
            </div>
          </div>

          <!-- Role Selection -->
          <div class="input-group checkbox-group">
            <AppToggleChip v-model="isService" label="Service" :disabled="isSubmitting" />
            <AppToggleChip v-model="isLogistik" label="Logistik" :disabled="isSubmitting" />
            <AppToggleChip v-model="isKueche" label="Küche" :disabled="isSubmitting" />
            <AppToggleChip v-model="isTeamleiter" label="Teamleiter" :disabled="isSubmitting" />
            <AppToggleChip v-model="isFestangestellt" label="Festangestellte" :disabled="isSubmitting" />
            <AppToggleChip v-model="isOffice" label="Office" :disabled="isSubmitting" />
          </div>

          <!-- Profile Information -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label" for="flip-job-title">Job Titel</label>
              <AppTextInput
                id="flip-job-title"
                type="text"
                v-model="job_title"
                :disabled="isSubmitting"
                placeholder="Job Titel"
              />
            </div>
            <div class="input-item">
              <label class="input-label" for="flip-department">Abteilung</label>
              <AppTextInput
                id="flip-department"
                type="text"
                v-model="department"
                :disabled="isSubmitting"
                placeholder="Abteilung"
              />
            </div>
          </div>

          <!-- Submit Button -->
          <AppButton class="submit-button" :loading="isSubmitting" block @click="submitNewUser">
            {{ isSubmitting ? "Erstellt..." : "Erstellen" }}
          </AppButton>

        </div>
      </div>
      <!-- ASANA PANEL -->
      <div class="second-panel">
        <h3>Asana Task Details</h3>

        <div v-if="asanaTask">
          <!-- Task Title -->
          <h4>{{ asanaTask.name }}</h4>

          <!-- Project Memberships -->
          <div>
            <strong>Projekte:</strong>
            <p v-for="project in asanaTask.memberships" :key="project.project?.gid || project.project?.name">
              {{ project.project.name }}
            </p>
          </div>

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
    <ModalFrame
      :model-value="showPersonalnrHinweis"
      title="Wichtige Information"
      size="sm"
      :show-close="false"
      :close-on-escape="false"
      :close-on-backdrop="false"
    >
        <div class="info-content">
          <p><strong>Ab sofort ist die Personalnummer ein Pflichtfeld!</strong></p>
          <p>Bitte gib immer die Personalnummer des Mitarbeiters ein.</p>
          <p><strong>Falls die Personalnummer nicht verfügbar ist:</strong></p>
          <p>Trag eine <strong>0</strong> (Null) ein.</p>
        </div>
      <template #footer>
        <AppButton @click="closePersonalnrHinweis">Verstanden</AppButton>
      </template>
    </ModalFrame>
    
    <ModalFrame :model-value="showReentryModal" title="Wiedereintritt MA" size="sm" @close="showReentryModal = false">
        <!-- Input for Mitarbeiter search -->
        <div class="autocomplete-wrapper">
          <AppTextInput
            type="text"
            v-model="searchMitarbeiter"
            @keydown.down.prevent="highlightNext"
            @keydown.up.prevent="highlightPrev"
            @keydown.enter.prevent="selectHighlighted"
            placeholder="Mitarbeiter suchen..."
            aria-label="Mitarbeiter suchen"
          />
          <ul v-if="filteredMitarbeiter.length" class="mitarbeiter-list">
            <li
              v-for="(mitarbeiter, index) in filteredMitarbeiter"
              :key="mitarbeiter._id"
              @mouseenter="highlightOption(index)"
            >
              <button type="button" :class="{ highlighted: index === selectedIndex }" @click="selectMitarbeiter(mitarbeiter)">
                {{ mitarbeiter.vorname }} {{ mitarbeiter.nachname }} ({{ mitarbeiter.email }})
              </button>
            </li>
          </ul>
        </div>
    </ModalFrame>

  </div>
  </PageLayout>

  <!-- Wiedereintritt: EmployeeCard Modal -->
  <EmployeeCardModal
    :mitarbeiterId="reentryMitarbeiter?._id"
    @close="reentryMitarbeiter = null"
  />

</template>

<script>
import api from "@/utils/api";
import debounce from "lodash.debounce";
import AsanaMappings from "@/assets/AsanaMappings.json";
import FlipMappings from "@/assets/FlipMappings.json";
import EmployeeCardModal from "@/components/Modals/EmployeeCardModal.vue";
import PageLayout from "@/components/layout/PageLayout.vue";
import ModalFrame from "@/components/frames/ModalFrame.vue";
import AppButton from "@/components/ui-elements/AppButton.vue";
import AppIconButton from "@/components/ui-elements/AppIconButton.vue";
import AppTextInput from "@/components/ui-elements/AppTextInput.vue";
import AppSelect from "@/components/ui-elements/AppSelect.vue";
import AppToggleChip from "@/components/ui-elements/AppToggleChip.vue";
export default {
  name: "Erstellen",
  emits: [],
  components: {
    EmployeeCardModal,
    PageLayout,
    ModalFrame,
    AppButton,
    AppIconButton,
    AppTextInput,
    AppSelect,
    AppToggleChip,
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
      isKueche: false,
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
    isKueche: "setDepartment",
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
    openReentryForMitarbeiter(mitarbeiter) {
      this.reentryMitarbeiter = mitarbeiter;
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
      if (this.isKueche) departments.push("Küche");

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
      const jobKeywords = ["s", "service", "l", "logi", "logistik", "k", "küche", "kueche", "s+l", "l+s"];

      // Split into words while preserving order
      let words = name.split(" ");
      let filteredWords = [];
      let isService = false;
      let isLogistik = false;
      let isKueche = false;

      // Remove job-related keywords and detect role flags
      words.forEach((word) => {
        const lowerWord = word.toLowerCase();

        if (["s", "service"].includes(lowerWord)) {
          isService = true;
        } else if (["l", "logi", "logistik"].includes(lowerWord)) {
          isLogistik = true;
        } else if (["k", "küche", "kueche"].includes(lowerWord)) {
          isKueche = true;
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
      this.isKueche = isKueche;
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
      this.isKueche = false;
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
        { name: "isKueche",   value: String(this.isKueche) },
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
/* Wrapper */
.window{
  width: 100%;
  box-sizing: border-box;
  padding: 24px;
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
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
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
    .submit-button{ margin-top: 22px; }
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

/* Checkbox Group */
.checkbox-group{
  display:flex; gap: 10px; padding: 16px;
  background: rgba(var(--border-rgb), 0.1); 
  border: 1px solid rgba(var(--border-rgb), 0.3);
  border-radius: 8px;
}

.info-content { line-height: 1.6; }
.info-content p { margin: 8px 0; }
.autocomplete-wrapper .app-text-input { margin-bottom: 8px; }
.mitarbeiter-list{
  max-height: 260px; overflow:auto; 
  border: 1px solid rgba(var(--border-rgb), 0.2);
  border-radius: 8px; 
  background: rgba(var(--border-rgb), 0.03); 
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0,0,0,.05); 
  padding: 0; margin: 0; list-style: none;
}
.mitarbeiter-list li{ border-bottom: 1px solid var(--border); }
.mitarbeiter-list li:last-child{ border-bottom: none; }
.mitarbeiter-list button {
  width: 100%; padding: 10px 12px; border: 0;
  background: transparent; color: inherit; text-align: left; cursor: pointer;
}
.mitarbeiter-list button.highlighted,
.mitarbeiter-list button:hover,
.mitarbeiter-list button:focus-visible{
  background: var(--action-ghost-hover, var(--hover)); color: var(--text);
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

/* ============= MOBILE RESPONSIVE OPTIMIERUNGEN ============= */

@media (max-width: 1024px) {
  /* Tablets */
  .window {
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
        
        .app-button { width: 100%; }
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
  
  /* Checkbox Group Mobile */
  .checkbox-group {
    gap: 12px;
    padding: 12px;
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
  
  .mitarbeiter-list {
    max-height: 200px;
  }
}

@media (max-width: 480px) {
  /* Kleine Mobile Geräte */
  .window {
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
    
  }
  
  /* Checkbox Group - Single Column auf sehr kleinen Displays */
  .checkbox-group {
    gap: 8px;
    padding: 10px;
  }
  
  .input-label {
    font-size: 0.85rem;
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
  
}
</style>
