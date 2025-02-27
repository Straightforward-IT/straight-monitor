<template>
  <div class="window">
    <a class="discrete" @click="switchToDashboard">Zurück</a>
    <div class="window-panels">
      <div class="create-panel">
        <div class="user-create">
          <h2>Benutzer Erstellen</h2>
          <section style="margin: 15px">
            <h3>Hinweise: </h3>
            <p>- Diese Seite sollte immer aus dem 'Bewerber erstellen' Link im Asana Task geöffnet werden</p>
            <p>- Einige Felder werden aus dem Asana Task automatisch befüllt - diese unbedingt kontrollieren</p>
            <p>- In 99% der Fälle wird nur der 1.Standort gebraucht</p>
            <p>- Das Passwort wird automatisch auf 'password' gesetzt und kann bei der 1. Anmeldung geändert werden</p>
          </section>

          <!-- Asana ID Input -->
          <div class="input-group">
            <div class="input-item">
              <label class="input-label">Asana Task-ID</label>
              <input
                v-if="asana_id"
                disabled
                type="text"
                v-model="asana_id"
                class="text-input-disabled"
                placeholder="e.g. 1209453587596953"
              />
              <span v-if="!asana_id" class="asana-span">
                <input
                  type="text"
                  v-model="asana_id_input"
                  class="text-input"
                  placeholder="e.g. 1209453587596953"
                />
              </span>
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
                v-model="email"
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
            <div class="input-item">
              <label class="input-label">3. Standort</label>
              <select class="standort-dropdown" v-model="locations[2]">
                <option value="">-</option>
                <option
                  v-for="location in availableLocations(2)"
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
          <button class="submit-button" @click="submitNewUser">
            Erstellen
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
            <strong>Projekt:</strong>
            {{ getProjectName(asanaTask.memberships) }}
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
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";

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
      flipUsers: null,
      asanaTasks: null,
      asanaTask: null,
      userGroups: null,
      showAsanaModal: false,
      // Konstanten
      bewerber_project_gids: {
        bewerber_b: "1203882527761007",
        bewerber_hh: "1204666703404588",
        bewerber_k: "1207192167671531",
      },
      user_group_ids: {
        all_users: "12af8c2e-7076-4b66-90d0-b2b7fd885c88",
        berlin: "fe6d165f-f588-4762-90ee-a949b08a3c07",
        berlin_service: "18d4f311-7b51-430a-9e70-885cca7248e4",
        berlin_logistik: "bdbb18bf-d0bd-4fba-b339-785533bb09b9",
        berlin_festangestellte: "ce92c64b-46e2-4a31-93aa-a7ed1b1a6843",
        berlin_office: "e5473746-c88f-4799-ae68-731a28ba595f",
        berlin_teamleiter: "b99df75f-eb8d-42f8-838f-413223ae1572",

        hamburg: "1372dc72-86ad-4375-b3b9-11b5350f4c3e",
        hamburg_service: "3808e874-a254-4731-843d-3df0844088a1",
        hamburg_logistik: "3365d98e-27e6-4965-9794-b05802290a49",
        hamburg_festangestellte: "e3e05ccf-e429-498a-a833-1b8b7a2feec9",
        hamburg_office: "db9c176d-941b-49b4-ad3f-56df0a33e45b",
        hamburg_teamleiter: "806cb6f0-ee73-4376-98c0-710679c9ef96",
        hamburg_uke: "8db46766-19b3-4151-b91e-d04dda0e72d3",

        koeln: "13e5b96d-c8f3-4dcc-944e-8ba491efb570",
        koeln_service: "aa3c1034-0414-4a72-9917-5f3db06f0131",
        koeln_logistik: "bf483217-f705-4bab-8150-ee7a7bf2a08f",
        koeln_festangestellte: "67153127-21ae-4717-9f88-cb90638bbd48",
        koeln_office: "63a3e1d1-4ce5-4962-ae32-939b5cc6ba5f",
        koeln_teamleiter: "a99dfeff-9ee3-4de2-b6d1-15c59081b2a1",
      },
      // User Create
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
      asana_id: this.$route.params.id || null,
      asana_id_input: "",
      job_title: "Mitarbeiter/in",
      location: "",
      department: "",
      userGroups: [],
      //
    };
  },
  watch: {
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
    isService(newValue) {
      this.setDepartment();
    },
    isLogistik(newValue) {
      this.setDepartment();
    },
    isUKE(newValue) {
      this.setDepartment();
    },
  },
  computed: {
    availableLocations() {
      return (index) => {
        const allLocations = ["Berlin", "Hamburg", "Koeln"];
        const selectedLocations = this.locations.filter(
          (loc, i) => loc && i !== index
        ); // Exclude current index and empty values
        return allLocations.filter((loc) => !selectedLocations.includes(loc)); // Remove already selected
      };
    },
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
        console.log("Fetching task:", this.asana_id);
        const response = await api.get(`/api/asana/task/${this.asana_id}`);
        this.asanaTask = response.data.task;

        console.log("✅ Asana Task fetched:", this.asanaTask);

        // Only call parseTaskName if fields are empty to allow manual edits
        if (!this.vorname && !this.nachname) {
          this.parseTaskName(this.asanaTask.name);
        }
      } catch (error) {
        console.error("❌ Error fetching Asana task:", error);
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
      const jobKeywords = ["s", "service", "l", "logi", "logistik", "uke"];

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
    async fetchFlipUsers(params) {
      if (this.token) {
        if (!params) {
          params = {
            sort: "LAST_NAME_ASC",
            page_number: "1",
            page_limit: "100",
          };
        }
        const response = await api.get("/api/personal/flip", { params });
        console.log("✅ Fetched Flip Users:", response.data);
        this.flipUsers = response.data;
      } else {
        this.switchToDashboard();
      }
    },
    async fetchFlipUserGroups(params) {
      if (this.token) {
        if (!params) {
          params = {
            sort: "GROUP_NAME_ASC",
            page_number: "1",
            page_limit: "100",
            status: "ACTIVE",
          };
        }
        const response = await api.get("/api/personal/user-groups", { params });
        console.log("✅ Fetched User Groups:", response.data.groups);
        this.userGroups = response.data;
      } else {
        this.switchToDashboard();
      }
    },
    resetNewUser() {
      const asanaIdFromUrl = this.$route.params.id || null;
      this.asana_id = asanaIdFromUrl || "";

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
      this.asana_id = "";
      this.job_title = "Mitarbeiter/in";
      this.location = "";
      this.department = "";
      this.userGroups = [];
      this.showAsanaModal = false;
    },
    async submitNewUser() {
      if (!this.token) {
        this.switchToDashboard();
        return;
      }

      try {
        // ✅ Ensure user groups are set before submitting
        this.setUserGroups();

        // ✅ Determine the primary user group based on the first selected location
        const primaryLocation = this.locations[0] || null;
        let primaryUserGroupId = null;

        if (primaryLocation) {
          const normalizedLocation = primaryLocation.toLowerCase();
          primaryUserGroupId = this.user_group_ids[normalizedLocation] || null;
        }

        // ✅ Construct request payload
        const userPayload = {
          asana_id: this.asana_id || null,
          first_name: this.vorname,
          last_name: this.nachname,
          email: this.email,
          role: "USER",
          primary_user_group: primaryUserGroupId
            ? { id: primaryUserGroupId }
            : null, // ✅ Fix: Wrap in `{ id: value }`
          profile: {
            job_title: this.job_title,
            location: this.location,
            department: this.department,
          },
          user_group_ids: this.userGroups.length > 0 ? this.userGroups : [], // ✅ Fix: Use `[]` instead of `["undefined"]`
        };
        console.log("Primary User Group:", primaryUserGroupId);
        console.log("📤 Sending user creation request:", userPayload);

        // ✅ Send API request to create user
        const response = await api.post("/api/personal/create", userPayload);
        console.log("✅ User created successfully:", response.data);
        alert("✅ Das hat geklappt!");
      } catch (error) {
        console.error(
          "❌ Error creating user:",
          error.response?.data || error.message
        );
        alert("❌ Das hat nicht geklappt.");
      }
    },
    async submitNewUserMock() {
      if (!this.token) {
        this.switchToDashboard();
        return;
      }

      try {
        // ✅ Ensure user groups are set before submitting
        this.setUserGroups();

        // ✅ Determine the primary user group based on the first selected location
        const primaryLocation = this.locations[0] || null;
        let primaryUserGroupId = "undefined";

        if (primaryLocation) {
          const normalizedLocation = primaryLocation.toLowerCase();
          primaryUserGroupId =
            this.user_group_ids[normalizedLocation] || "undefined";
        }

        // ✅ Construct request payload
        const userPayload = {
          asana_id: this.asana_id || this.asana_id_input,
          first_name: this.vorname,
          last_name: this.nachname,
          email: this.email,
          role: "USER",
          primary_user_group_id: primaryUserGroupId,
          profile: {
            job_title: this.job_title,
            location: this.location,
            department: this.department,
          },
          user_group_ids:
            this.userGroups.length > 0 ? this.userGroups : ["undefined"], // Replace empty array with "undefined"
        };

        console.log("📤 Mock User Creation Request:");
        console.log("First Name:", userPayload.first_name || "undefined");
        console.log("Last Name:", userPayload.last_name || "undefined");
        console.log("Email:", userPayload.email || "undefined");
        console.log("Asana ID:", userPayload.asana_id || "undefined");
        console.log("Job Title:", userPayload.profile.job_title || "undefined");
        console.log("Location:", userPayload.profile.location || "undefined");
        console.log(
          "Department:",
          userPayload.profile.department || "undefined"
        );
        console.log("Primary User Group:", primaryUserGroupId);
        console.log(
          "User Groups:",
          userPayload.user_group_ids.join(", ") || "undefined"
        );
      } catch (error) {
        console.error(
          "❌ Mock Error creating user:",
          error.response?.data || error.message
        );
      }
    },
    getProjectName(memberships) {
      if (!memberships || memberships.length === 0) return "Nicht zugeordnet";

      // Extract all project GIDs from memberships
      const projectGids = memberships.map(
        (membership) => membership.project.gid
      );

      console.log("Extracted project GIDs:", projectGids);

      // Define project GID mappings
      const projectMapping = {
        1203882527761007: "Berlin",
        1204666703404588: "Hamburg",
        1207192167671531: "Koeln",
      };

      // Check for a match in the project mapping
      for (const gid of projectGids) {
        if (projectMapping[gid]) {
          this.locations[0] = projectMapping[gid]; // Update location dynamically
          return projectMapping[gid];
        }
      }

      return "Nicht zugeordnet";
    },
    openAsanaModal() {
      this.showAsanaModal = true;
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

      // Dynamically add groups based on attributes
      Object.entries(groupMappings).forEach(([key, groupType]) => {
        if (this[key]) {
          userGroups.push(
            ...this.locations.map((location) =>
              this.getGroupsFor(groupType, location)
            )
          );
        }
      });

      // **Hinzufügen der Hauptgruppen (Berlin, Hamburg, Koeln)**
      this.locations.forEach((location) => {
        const normalizedLocation = location.toLowerCase();
        if (this.user_group_ids[normalizedLocation]) {
          userGroups.push(this.user_group_ids[normalizedLocation]);
        }
      });

      // **Duplikate entfernen und zuweisen**
      this.userGroups = [...new Set(userGroups)];

      // Handle special Hamburg UKE case separately
      if (this.isUKE) {
        userGroups.push(this.user_group_ids.hamburg_uke);
      }

      // Remove duplicates and assign
      this.userGroups = [...new Set(userGroups)];
    },
    openAsanaModal() {
      this.showAsanaModal = true;
    },
    switchToDashboard() {
      this.$router.push("/");
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    //  this.fetchSchulungenTasks();
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
</style>
