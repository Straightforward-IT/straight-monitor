<template>
  <div class="window">
    <a class="discrete" @click="switchToDashboard">Zurück zum Dashboard</a>
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

  for (const [location, projects] of Object.entries(this.bewerber_project_gids)) {
    for (const projectType in projects) {
      projectMapping[projects[projectType]] = location;
    }
  }

  const normalize = (s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  let foundLocations = new Set();
  for (const gid of projectGids) {
    const rawLocation = projectMapping[gid];
    if (rawLocation) {
      foundLocations.add(normalize(rawLocation));
    }
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
       const normalizedLocation = this.normalizeLocation(location);

if (this.user_group_ids[normalizedLocation]) {
  userGroups.push(this.user_group_ids[normalizedLocation]);
}

Object.entries(groupMappings).forEach(([key, groupType]) => {
  if (this[key]) {
    const groupId =
      this.user_group_ids[`${normalizedLocation}_${groupType}`];
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

<style scoped lang="scss">$primary: #f69e6f;
$secondary-background: #ffffff; // Panels and modal
$tertiary-background: #f9f9f9; // Input fields, hints
$border-color: #e0e0e0;
$text-color-dark: #333333;
$text-color-medium: #555555;
$text-color-light: #777777;

#app {
  max-width: unset;
}

.window {
  width: 1600px;
  margin: 30px auto;
  padding: 30px;
  background-color: #f7f7f7;
  border-radius: 12px;
  box-shadow: 0px 6px 12px rgba(0, 0, 0, 0.08);
}

.window-panels {
  display: flex;
  gap: 20px;
}

.create-panel,
.second-panel {
  padding: 25px;
  background-color: $secondary-background;
  border-radius: 10px;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.05);
}

.create-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 25px;

  .top-panel,
  .bottom-panel {
    padding: 20px;
    background-color: $secondary-background;
    border-radius: 8px;
    box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.03);
  }

  .top-panel {
    h2 {
      color: $text-color-dark;
      font-size: 1.8rem;
      margin-bottom: 15px;
    }
    .action-buttons {
      margin-bottom: 20px;

      button {
        background-color: transparent;
        color: $primary;
        border: 1px solid $primary;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 500;
        padding: 8px 15px;
        margin-right: 12px;

        &:hover {
          color: white;
          background-color: darken($primary, 8%);
          text-decoration: none;
          box-shadow: 0 2px 6px -1px rgba($primary, 0.4);
        }
      }
    }

    .hinweise {
      background-color: #fdf2e9;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid $primary;
      margin-bottom: 15px;

      h3 {
        color: $text-color-dark;
        margin-bottom: 8px;
        font-size: 1.05rem;
      }

      p {
        margin: 4px 0;
        font-size: 0.95rem;
        color: $text-color-medium;
      }
    }
  }

  .bottom-panel {
    .submit-button {
      width: 100%;
      margin-top: 25px;
      height: 2.8rem;
      font-size: 1.1rem;
      border-radius: 8px;
      background-color: $primary;
      color: white;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 4px 10px -2px rgba($primary, 0.6);
        background-color: darken($primary, 8%);
        transform: translateY(-2px);
      }
      &:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
      }
    }
  }
}

.second-panel {
  flex: 2;
  margin-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: $text-color-dark;
    border-bottom: 2px solid $primary;
    padding-bottom: 8px;
    margin-bottom: 15px;
  }

  h4 {
    font-size: 1.2rem;
    color: $text-color-dark;
    margin: 8px 0;
    font-weight: 500;
  }

  p {
    font-size: 1rem;
    color: $text-color-medium;
    line-height: 1.6;
    margin: 6px 0;

    strong {
      color: $text-color-dark;
      font-weight: 600;
    }
  }

  .asana-html-notes {
    background: #fdfdfd;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid $border-color;
    max-height: 250px;
    overflow-y: auto;
    line-height: 1.5;
    color: $text-color-medium;
  }

  .no-data {
    text-align: center;
    color: $text-color-light;
    font-size: 0.95rem;
    margin-top: 20px;
  }
}

.input-label {
  display: block;
  border-bottom: 1px solid $primary;
  padding-bottom: 4px;
  margin-bottom: 12px; /* Increased space between label and input */
  font-weight: 500;
  color: $text-color-dark;
}
.check-label {
  display: flex;
  align-items: center;
  height: 2rem;
  border-left: 2px solid $primary;
  padding-left: 10px;
  user-select: none;
  font-size: 0.95rem;
  color: $text-color-medium;
  /* No direct margin here, relying on check-item gap */
}

.discrete {
  margin: 15px;
  color: $text-color-light;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s ease;
  &:hover {
    color: darken($primary, 10%);
    text-decoration: underline;
  }
}

.input-group {
  display: flex;
  flex-wrap: wrap;
  gap: 20px; /* Increased gap for more horizontal space */
  padding: 0;
  margin-bottom: 25px; /* Added vertical spacing between input groups */
}

.checkbox-group {
  background-color: $tertiary-background;
  display: grid;
  border-radius: 8px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 20px; /* Increased gap for more space between checkboxes */
  padding: 20px; /* Increased padding inside the checkbox group */
  border: 1px solid $border-color;
  margin-top: 25px; /* Added vertical spacing from the group above */
  margin-bottom: 25px; /* Added vertical spacing from the group below */
}

.check-item label {
  gap: 15px; /* Increased gap between text and checkbox */
}

.input-item {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  /* No margin-bottom here, relying on input-group's gap */
}

.text-input,
.standort-dropdown {
  flex-grow: 1;
  border-radius: 8px;
  background-color: $tertiary-background;
  border: 1px solid $border-color;
  padding: 12px;
  font-size: 1rem;
  color: $text-color-dark;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.2);
  }
  &:hover {
    transform: none;
    box-shadow: none;
    border-color: darken($border-color, 10%);
  }
}

.text-input-disabled {
  background-color: #eeeeee;
  color: #a0a0a0;
  cursor: not-allowed;
  border: 1px solid #cccccc;
}

.check-input {
  cursor: pointer;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  accent-color: $primary;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
  &:active {
    transform: scale(0.95);
  }
}

.modal {
  background: rgba(0, 0, 0, 0.6);
}
.modal-content {
  background: $secondary-background;
  padding: 35px;
  border-radius: 12px;
  width: 400px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.15);

  .close-modal {
    position: absolute;
    top: 15px;
    right: 15px;
    font-size: 1.5rem;
    color: $text-color-light;
    cursor: pointer;
    transition: color 0.2s ease;
    &:hover {
      color: $text-color-dark;
    }
  }

  h4 {
    font-size: 1.3rem;
    color: $text-color-dark;
    margin-bottom: 20px;
    font-weight: 600;
  }

  .autocomplete-wrapper {
    .text-input {
      width: calc(100% - 24px);
      padding: 12px;
      margin-bottom: 10px;
      font-size: 1rem;
    }

    .mitarbeiter-list {
      max-height: 250px;
      border-radius: 6px;
      border: 1px solid $border-color;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);

      li {
        padding: 12px 15px;
        font-size: 0.95rem;
        color: $text-color-dark;
        &:not(:last-child) {
          border-bottom: 1px solid #f0f0f0;
        }

        &.highlighted,
        &:hover {
          background-color: $primary;
          color: white;
        }
      }
    }
  }
}
</style>
