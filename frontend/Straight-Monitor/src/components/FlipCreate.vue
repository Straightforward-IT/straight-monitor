<template>
  <div class="window">
    <a class="discrete" @click="switchToDashboard">Zurück</a>
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
           <!-- <button @click="openReentryModal">Wiedereintritt MA</button>-->
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
            </div>
          </div>

          <!-- Standort Selection -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label">1. Standort*</label>
              <select class="standort-dropdown" v-model="locations[0]" required>
                <option value="">-</option>
                <option
                  v-for="location in availableLocations(0)"
                  :key="location"
                  :value="location"
                >
                  {{ location }}
                </option>
              </select>
            </div>
            <div class="input-item">
              <label class="input-label">2. Standort</label>
              <select class="standort-dropdown" v-model="locations[1]">
                <option value="">-</option>
                <option
                  v-for="location in availableLocations(1)"
                  :key="location"
                  :value="location"
                >
                  {{ location }}
                </option>
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
            <div class="check-item" v-if="locations.includes('Hamburg')">
              <label class="check-label"
                >UKE <input type="checkbox" v-model="isUKE" class="check-input"
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
              <label class="input-label">Standort</label>
              <input
                type="text"
                v-model="location"
                class="text-input"
                placeholder="Standort"
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
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import debounce from "lodash.debounce";
import AsanaMappings from "@/assets/AsanaMappings.json";
import FlipMappings from "@/assets/FlipMappings.json";

export default {
  name: "Erstellen",
  emits: [],
  components: {
    FontAwesomeIcon,
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
      primary_user_group: "",
      locations: [],
      isService: false,
      isLogistik: false,
      isTeamleiter: false,
      isFestangestellt: false,
      isOffice: false,
      isUKE: false,
      job_title: "Mitarbeiter/in",
      location: "",
      department: "",
      userGroups: [],

      //Response
      createdFlipUser: null,
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
        } else {
          this.asanaTask = null;
        }
      }, 1000), // 500ms debounce (half a second wait)
      immediate: false,
    }, isTeamleiter: {
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
    locations: {
      deep: true,
      handler(newLocations) {
        this.location = newLocations[0] || "";
      },
    },
    isService: "setDepartment",
    isLogistik: "setDepartment",
    isUKE: "setDepartment",
  },
  computed: {
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
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    setDepartment() {
      let departments = [];

      if (this.isService) departments.push("Service");
      if (this.isLogistik) departments.push("Logistik");
      if (this.isUKE) departments.push("UKE");

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
      const jobKeywords = ["s", "service", "l", "logi", "logistik", "uke", "s+l", "l+s"];

      // Split into words while preserving order
      let words = name.split(" ");
      let filteredWords = [];
      let isService = false;
      let isLogistik = false;
      let isUKE = false;

      // Remove job-related keywords and detect role flags
      words.forEach((word) => {
        const lowerWord = word.toLowerCase();

        if (["s", "service"].includes(lowerWord)) {
          isService = true;
        } else if (["l", "logi", "logistik"].includes(lowerWord)) {
          isLogistik = true;
        } else if (["uke"].includes(lowerWord)) {
          isUKE = true;
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
      this.isUKE = isUKE;
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
      this.primary_user_group = "";
      this.locations = [];
      this.isService = false;
      this.isLogistik = false;
      this.isTeamleiter = false;
      this.isFestangestellt = false;
      this.isOffice = false;
      this.isUKE = false;
      this.job_title = "Mitarbeiter/in";
      this.location = "";
      this.department = "";
      this.userGroups = [];
      this.showReentryModal = false;
      this.createdFlipUser = null;
    },
    openReentryModal() {
      this.showReentryModal = true;
    },
    async submitNewUser() {
  if (this.isSubmitting) return;

 // 🛡 Null/empty field checks
 if (
    !this.vorname?.trim() ||
    !this.nachname?.trim() ||
    !this.email?.trim() ||
    !this.locations[0] 
  ) {
    alert("⚠️ Bitte fülle alle Pflichtfelder aus: Vorname, Nachname, E-Mail, Standort.");
    return;
  }

  this.isSubmitting = true;
  try {
    this.setUserGroups();
    const primaryLocation = this.locations[0] || null;
    const primaryUserGroupId = primaryLocation
      ? this.user_group_ids[primaryLocation.toLowerCase()]
      : null;

    const userPayload = {
      asana_id: this.asana_id || null,
      first_name: this.vorname,
      last_name: this.nachname,
      email: this.email,
      role: "USER",
      created_by: this.userEmail,
      primary_user_group_id: primaryUserGroupId,
      attributes: [
        {
          name: "job_title",
          value: this.job_title
        },{
          name: "location",
          value: this.location
        },{
          name: "department",
          value: this.department
        },
    ],
      user_group_ids: this.userGroups || [],
    };

    const response = await api.post("/api/personal/create", userPayload);
    this.createdFlipUser = response.data.flipUser;
    alert("✅ Benutzer erfolgreich erstellt!");
  } catch (error) {
    console.error("❌ Fehler beim Erstellen:", error);

    if (error.response && error.response.status === 409) {
      alert(`⚠️ ${error.response.data.message}`);
    } else {
      alert("❌ Fehler beim Erstellen! Bitte versuche es später erneut.");
    }
  }  finally {
    this.isSubmitting = false;
  }
},
    parseTaskProjects(memberships) {
      if (!memberships || memberships.length === 0) return;

      const projectGids = memberships.map((m) => m.project.gid);
      const projectMapping = {};

      for (const [location, projects] of Object.entries(
        this.bewerber_project_gids
      )) {
        for (const projectType in projects) {
          projectMapping[projects[projectType]] = location;
        }
      }

      let foundLocations = new Set();
      for (const gid of projectGids) {
        if (projectMapping[gid]) foundLocations.add(projectMapping[gid]);
      }

      this.locations = [...foundLocations];
    },
    getGroupsFor(groupType, location) {
      const mapping = {
        service: {
          Berlin: this.user_group_ids.berlin_service,
          Hamburg: this.user_group_ids.hamburg_service,
          Koeln: this.user_group_ids.koeln_service,
        },
        logistik: {
          Berlin: this.user_group_ids.berlin_logistik,
          Hamburg: this.user_group_ids.hamburg_logistik,
          Koeln: this.user_group_ids.koeln_logistik,
        },
        festangestellte: {
          Berlin: this.user_group_ids.berlin_festangestellte,
          Hamburg: this.user_group_ids.hamburg_festangestellte,
          Koeln: this.user_group_ids.koeln_festangestellte,
        },
        teamleiter: {
          Berlin: this.user_group_ids.berlin_teamleiter,
          Hamburg: this.user_group_ids.hamburg_teamleiter,
          Koeln: this.user_group_ids.koeln_teamleiter,
        },
        office: {
          Berlin: this.user_group_ids.berlin_office,
          Hamburg: this.user_group_ids.hamburg_office,
          Koeln: this.user_group_ids.koeln_office,
        },
      };

      return mapping[groupType]?.[location] || null;
    },
    setUserGroups() {
      let userGroups = [];

      const groupMappings = {
        isService: "service",
        isLogistik: "logistik",
        isFestangestellt: "festangestellte",
        isTeamleiter: "teamleiter",
        isOffice: "office",
      };

      this.locations.forEach((location) => {
        if (this.user_group_ids[location.toLowerCase()]) {
          userGroups.push(this.user_group_ids[location.toLowerCase()]);
        }

        Object.entries(groupMappings).forEach(([key, groupType]) => {
          if (this[key]) {
            const groupId =
              this.user_group_ids[`${location.toLowerCase()}_${groupType}`];
            if (groupId) {
              userGroups.push(groupId);
            }
          }
        });
      });

      if (this.isUKE && this.user_group_ids.hamburg_uke) {
        userGroups.push(this.user_group_ids.hamburg_uke);
      }

      this.userGroups = [...new Set(userGroups)];
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
  },
};
</script>

<style scoped lang="scss">
$primary: #f69e6f;

#app {
  max-width: unset;
}

.window {
  width: 1600px;
  margin: auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
}
.window-panels {
  display: flex;
}
/* User panel takes 60% of space */
.create-panel {
  flex: 3; // 60% of total space
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
}

.create-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 15px;

  .top-panel,
  .bottom-panel {
    padding: 15px;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.05);
  }

  .top-panel {
    .action-buttons {
      margin-bottom: 15px;

      button {
        background-color: transparent;
        color: #f69e6f;
        border: none;
        cursor: pointer;
        font-weight: 600;
        padding: 5px 10px;
        margin-right: 10px; // <-- Adds spacing between buttons horizontally

        &:last-child {
          margin-right: 0; // Removes margin from the last button
        }

        &:hover {
          color: darken(#f69e6f, 15%);
          text-decoration: underline;
        }
      }
    }

    .hinweise {
      background-color: #f7f7f7;
      padding: 10px;
      border-radius: 5px;
      border-left: 3px solid #f69e6f;
      margin-bottom: 10px;

      h3 {
        margin-bottom: 5px;
      }

      p {
        margin: 2px 0;
        font-size: 0.9rem;
      }
    }
  }

  .bottom-panel {
    .submit-button {
      width: 100%;
      margin-top: 20px;
    }
  }
}

.second-panel {
  flex: 2; // 40% of total space
  padding: 20px;
  margin-left: 10px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 15px;
  font-family: Arial, sans-serif;

  h3 {
    font-size: 1.2rem;
    font-weight: bold;
    color: #414141;
    border-bottom: 2px solid $primary;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }

  h4 {
    font-size: 1.1rem;
    color: #000000;
    margin: 5px 0;
  }

  p {
    font-size: 0.95rem;
    color: #555;
    line-height: 1.4;
    margin: 4px 0;

    strong {
      color: #232323;
    }
  }

  .task-description {
    background-color: #f9f9f9;
    padding: 10px;
    border-left: 3px solid $primary;
    border-radius: 5px;
    font-size: 0.9rem;
    color: #444;
    line-height: 1.5;
  }

  .asana-html-notes {
    background: #fafafa;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #ddd;
    max-height: 200px;
    overflow-y: auto;
  }

  .no-data {
    text-align: center;
    color: #777;
    font-size: 0.9rem;
    margin-top: 10px;
  }
}

.input-label {
  display: inline-block; /* Ensures label takes width based on content */
  border-bottom: 1px solid $primary; /* Thin border at the bottom */
  padding-bottom: 2px; /* Adds some space between text and border */
}
.check-label {
  display: inline-block;
  height: 1.5rem;
  border-left: 1px solid $primary;
  padding-left: 8px;
  user-select: none;
}

.discrete {
  margin: 5px;
}

input {
  width: unset;
}
.input-group {
  display: flex;
  flex-wrap: wrap;
  padding: 5px;
  gap: 5px;
}
.checkbox-group {
  background-color: #f9f9f9;
  display: grid;
  border-radius: 8px;
  grid-template-columns: repeat(2, 1fr); /* Two equal columns */
  gap: 10px; /* Space between items */
}

.check-item label {
  display: flex;
  align-items: center;
  gap: 8px; /* Space between text and checkbox */
  cursor: pointer;
}

.input-item {
  display: inline-grid;
  justify-items: center;
}
.text-input {
  cursor: text;
}
.standort-dropdown {
  cursor: pointer;
}
.standort-dropdown,
.text-input {
  border-radius: 8px;
  background-color: #f9f9f9;
  padding: 10px;
  margin: 5px;
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0px 10px 20px 0px rgba(0, 0, 0, 0.2);
    &:active {
      transform: scale(0.99);
    }
  }
}

.text-input-disabled {
  border-radius: 8px;
  background-color: #f9f9f9;
  padding: 10px;
  margin: 5px;
  color: gray;
}

.check-input {
  cursor: pointer;
  width: 15px;

  &:hover {
    transform: translateY(-3px);
    &:active {
      transform: scale(0.99);
    }
  }
}

.submit-button {
  width: 100%;
  height: 2rem;
  font-size: 14px;
  line-height: 0rem;
  background-color: $primary;
  color: white;
  border: none;
  margin-top: 0px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    box-shadow: 0 2px 6px -1px rgba($primary, 0.65);
    background-color: mix(black, $primary, 10%);

    &:active {
      transform: translateY(-3px);
    }
  }
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 350px;
  text-align: center;
  position: relative;

  .item-actions {
    display: flex;
    justify-content: center; /* Center buttons */
    gap: 10px; /* Add space between buttons */
    margin-top: 10px; /* Add space above buttons */
  }

  button {
    margin: 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;

    &:hover {
      background-color: mix(black, $primary, 10%);
    }
  }
  .autocomplete-wrapper {
    position: relative;

    .mitarbeiter-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      padding: 0px;
      max-height: 200px;
      overflow-y: auto;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      border-radius: 0 0 6px 6px;
      margin-top: -1px;
      z-index: 100;

      li {
        padding: 10px;
        cursor: pointer;
        transition: background 0.2s;

        &.highlighted,
        &:hover {
          background-color: #f69e6f;
          color: white;
        }
      }
    }
  }

  .autocomplete-input {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #ddd;
    font-size: 0.95rem;
  }

  .suggestions-list {
    position: absolute;
    width: 100%;
    max-height: 150px;
    overflow-y: auto;
    background: white;
    border: 1px solid #ddd;
    border-radius: 0 0 6px 6px;
    border-top: none;
    z-index: 10;
    margin-top: -2px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

    li {
      padding: 8px;
      cursor: pointer;

      &:hover {
        background-color: #f69e6f;
        color: white;
      }
    }
  }
}
</style>
