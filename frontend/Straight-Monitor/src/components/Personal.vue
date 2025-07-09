<template>
  <div class="page-window">
    <div class="top-tab-bar">
      <button
        class="tab-button"
        :class="{ active: activeView === 'mitarbeiter' }"
        @click="activeView = 'mitarbeiter'"
      >
        Mitarbeiter
      </button>
      <button
        class="tab-button"
        :class="{ active: activeView === 'dokumente' }"
        @click="activeView = 'dokumente'"
      >
        Dokumente
      </button>
    </div>

    <div class="main-content">
      <div v-if="activeView === 'mitarbeiter'">
        <div class="filter-bar">
          <button
            class="filter-toggle"
            :class="{ active: activeStatusFilter === 'Aktiv' }"
            @click="setFilter('status', 'Aktiv')"
          >
            Aktiv
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeStatusFilter === 'Inaktiv' }"
            @click="setFilter('status', 'Inaktiv')"
          >
            Inaktiv
          </button>
          <div class="divider"></div>
          <button
            class="filter-toggle"
            :class="{ active: activeLocationFilter === 'Alle' }"
            @click="setFilter('location', 'Alle')"
          >
            Alle Standorte
          </button>
          <button
            v-for="location in locations"
            :key="location"
            class="filter-toggle"
            :class="{ active: activeLocationFilter === location }"
            @click="setFilter('location', location)"
          >
            {{ location }}
          </button>
          <div class="divider"></div>
          <button
            class="filter-toggle"
            :class="{ active: activeDepartmentFilter === 'Alle' }"
            @click="setFilter('department', 'Alle')"
          >
            Alle Bereiche
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDepartmentFilter === 'Service' }"
            @click="setFilter('department', 'Service')"
          >
            Service
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDepartmentFilter === 'Logistik' }"
            @click="setFilter('department', 'Logistik')"
          >
            Logistik
          </button>
        </div>

        <div class="search-sort-bar">
          <div class="search-wrapper">
            <font-awesome-icon icon="fa-solid fa-search" class="search-icon" />
            <input
              type="text"
              placeholder="Mitarbeiter suchen..."
              v-model="mitarbeitersSearchQuery"
            />
          </div>
          <button class="sort-button">
            <font-awesome-icon icon="fa-solid fa-sort" />
            Sortieren
          </button>
        </div>

         <div class="mitarbeiter-grid">
          <div
            v-for="ma in filteredMitarbeiters"
            :key="ma._id"
            class="mitarbeiter-card-outer"
          >
            <div class="card-actions-left">
              <button
                class="action-button"
                :class="{ active: activeCardView === 'straight' }"
                title="Straight-Profil"
                @click="activeCardView = 'straight'"
              >
                <img src="@/assets/SF_002.png" alt="Straightforward Profil" />
              </button>
              <button
                class="action-button"
                :class="{ active: activeCardView === 'flip' }"
                title="Flip-Profil"
                @click="activeCardView = 'flip'"
              >
                <img src="@/assets/flip.png" alt="Flip Profil" />
              </button>
              <button
                class="action-button"
                :class="{ active: activeCardView === 'asana' }"
                title="Asana-Task"
                @click="activeCardView = 'asana'"
              >
                <img src="@/assets/asana.png" alt="Asana Task" />
              </button>
            </div>

            <div class="mitarbeiter-card-inner">
              <div class="card-header">
                <div class="card-title">
                  <span class="card-name">{{ ma.vorname }} {{ ma.nachname }}</span>
                  <span class="card-status" :class="{ active: ma.isActive }">
                    {{ ma.isActive ? "Aktiv" : "Inaktiv" }}
                  </span>
                </div>
              </div>
              <div class="card-body">
                 </div>
            </div>
            </div>
         </div>
      </div>

      <div v-if="activeView === 'dokumente'">
        <div class="filter-bar">
          <button
            class="filter-toggle"
            :class="{ active: activeDocStatusFilter === 'Alle' }"
            @click="setDocFilter('status', 'Alle')"
          >
            Alle Status
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDocStatusFilter === 'Zugewiesen' }"
            @click="setDocFilter('status', 'Zugewiesen')"
          >
            Zugewiesen
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDocStatusFilter === 'Offen' }"
            @click="setDocFilter('status', 'Offen')"
          >
            Offen
          </button>
          <div class="divider"></div>
          <button
            class="filter-toggle"
            :class="{ active: activeDocTypeFilter === 'Alle' }"
            @click="setDocFilter('type', 'Alle')"
          >
            Alle Typen
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDocTypeFilter === 'Laufzettel' }"
            @click="setDocFilter('type', 'Laufzettel')"
          >
            Laufzettel
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDocTypeFilter === 'Event-Bericht' }"
            @click="setDocFilter('type', 'Event-Bericht')"
          >
            Event-Berichte
          </button>
          <button
            class="filter-toggle"
            :class="{ active: activeDocTypeFilter === 'Evaluierung' }"
            @click="setDocFilter('type', 'Evaluierung')"
          >
            Evaluierungen
          </button>
        </div>

        <div class="search-sort-bar">
          <div class="search-wrapper">
            <font-awesome-icon icon="fa-solid fa-search" class="search-icon" />
            <input
              type="text"
              placeholder="Dokumente durchsuchen..."
              v-model="documentsSearchQuery"
            />
          </div>
          <button class="sort-button">
            <font-awesome-icon icon="fa-solid fa-sort" />
            Sortieren
          </button>
        </div>

        <div class="table-container">
          <table class="documents-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Bezeichnung / Ort</th>
                <th>Datum</th>
                <th>Personen</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in filteredDocuments" :key="doc.id">
                <td>
                  <span :class="['doc-type-pill', doc.docType.toLowerCase()]">{{
                    doc.docType
                  }}</span>
                </td>
                <td>{{ doc.bezeichnung }}</td>
                <td>{{ formatDate(doc.datum) }}</td>
                <td>{{ doc.personen }}</td>
                <td>
                  <span :class="['status-pill', doc.status.toLowerCase()]">{{
                    doc.status
                  }}</span>
                </td>
                <td>
                  <button class="action-button-table">Details</button>
                </td>
              </tr>
              <tr v-if="filteredDocuments.length === 0">
                <td colspan="6" class="no-results">
                  Keine Dokumente gefunden.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import api from "@/utils/api";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faSearch, faSort } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(faSearch, faSort);

export default {
  components: {
    FontAwesomeIcon,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userID: "",
      userName: "",
      userLocation: "",

      locations: ["Hamburg", "Berlin", "Köln"],

      documents: [],
      filteredDocuments: [],
      currentDocument: null,
      mitarbeiters: [],
       currentMitarbeiter: null,
      cachedFlipUsers: [],
      flipUserGroups: [],
      selectedLocations: [],
      documentsSearchQuery: "",
      mitarbeitersSearchQuery: "",
      documentsSortBy: "datum",
      mitarbeitersSortBy: "vorname",
      documentsIsAscending: true,
      mitarbeitersIsAscending: true,

       activeStatusFilter: 'Aktiv', 
      activeLocationFilter: 'Alle',
      activeDepartmentFilter: 'Alle', 


      activeView: "mitarbeiter",
      activeCardView: 'straight'
    };
  },
  computed: {
    // NEU: Die Computed Property, die die Filterlogik enthält
    filteredMitarbeiters() {
      let result = this.mitarbeiters;

      // 1. Filter nach Status (Aktiv/Inaktiv)
      if (this.activeStatusFilter === 'Aktiv') {
        result = result.filter(ma => ma.isActive);
      } else if (this.activeStatusFilter === 'Inaktiv') {
        result = result.filter(ma => !ma.isActive);
      }

      // 2. Filter nach Standort
      if (this.activeLocationFilter !== 'Alle') {
        result = result.filter(ma => ma.standort === this.activeLocationFilter);
      }

      // 3. Filter nach Bereich
      if (this.activeDepartmentFilter !== 'Alle') {
        result = result.filter(ma => ma.abteilung === this.activeDepartmentFilter);
      }

      // 4. Filter nach Suchbegriff
      const query = this.mitarbeitersSearchQuery.toLowerCase().trim();
      if (query) {
        result = result.filter(ma => 
          (ma.vorname && ma.vorname.toLowerCase().includes(query)) ||
          (ma.nachname && ma.nachname.toLowerCase().includes(query)) ||
          (ma.email && ma.email.toLowerCase().includes(query))
        );
      }

      return result;
    }
  },
  methods: {
    // Monitor Benutzer und Auth
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me");
          this.userEmail = response.data.email;
          this.userID = response.data._id;
          this.userName = response.data.name;
          this.userLocation = response.data.location;
          this.selectedLocations.push(this.userLocation);
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerdaten:", error);
          this.$router.push("/");
        }
      } else {
        this.$router.push("/");
      }
    },
    // Fetching
    async fetchDocuments() {
      try {
        const response = await api.get("/api/reports");
        this.documents = response.data.data;
        this.filteredDocuments = this.documents;
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    },
    async fetchMitarbeiters() {
      try {
        const response = await api.get("/api/personal/mitarbeiter");
        this.mitarbeiters = response.data.data;
        console.log("Fetched Mitarbeiter: ", this.mitarbeiters);
      } catch (error) {
        console.error("Error fetching Flip Users:", error);
      }
    },
    async fetchFlipUserGroups() {
      try {
        const response = await api.get("/api/personal/user-groups");
        this.userGroups = response.data.groups;
        console.log("Fetched UserGroups: ", this.userGroups);
      } catch (error) {
        console.error("Error fetching Flip Users:", error);
      }
    },
    async fetchFlipUser(id) {
      try {
        const response = await api.get(`/api/personal/flip/by-id/${id}`);
        let flipUser = response.data;
        console.log(flipUser);
        return flipUser;
      } catch (error) {
        console.error("Error fetching Flip User:", error);
      }
    },
    async fetchAsanaTask(gid) {
      try {
        const response = await api.get(`/api/asana/task/${gid}`);
        let task = response.data.task;
        console.log(task);
        return task;
      } catch (error) {
        console.error("Error fetching AsanaTask:", error);
      }
    },
    async fetchAsanaTaskStories(gid) {
      try {
        const response = await api.get(`/api/asana/task/${gid}/stories`);
        let task = response.data.stories.data;
        console.log(task);
        return task;
      } catch (error) {
        console.error("Error fetching AsanaTask:", error);
      }
    },
    // Patching
    async patchFlipDocument() {
      //ToDo
    },
    async patchMitarbeiter(id, updateData) {
      try {
        const response = await api.patch(
          `/api/personal/mitarbeiter/${id}`,
          updateData
        );

        const updatedMitarbeiter = response.data.data;

        const index = this.mitarbeiters.findIndex((m) => m._id === id);

        if (index !== -1) {
          this.mitarbeiters.splice(index, 1, updatedMitarbeiter);

          const filteredIndex = this.filteredMitarbeiters.findIndex(
            (m) => m._id === id
          );
          if (filteredIndex !== -1) {
            this.filteredMitarbeiters.splice(
              filteredIndex,
              1,
              updatedMitarbeiter
            );
          }

          console.log(
            "Mitarbeiter erfolgreich aktualisiert:",
            updatedMitarbeiter
          );
          return updatedMitarbeiter;
        } else {
          console.warn(
            `Mitarbeiter mit ID ${id} wurde im lokalen Array nicht gefunden. Lade die Liste neu.`
          );
          await this.fetchMitarbeiters();
          return null;
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error("Fehler beim Patchen des Mitarbeiters:", errorMessage);
        throw error;
      }
    },
    async patchTask(gid, updateData) {
      try {
        if (!gid || !updateData || Object.keys(updateData).length === 0) {
          console.error("Task GID und updateData dürfen nicht leer sein.");
          return null;
        }

        const response = await api.patch(
          `/api/asana/updateTask/${gid}`,
          updateData
        );

        const updatedTask = response.data.data;

        console.log(`Asana Task ${gid} erfolgreich aktualisiert:`, updatedTask);

        // Da keine lokale Task-Liste (wie this.tasks) existiert,
        // geben wir einfach die aktualisierten Daten zurück.
        // Die aufrufende Komponente ist dann für die weitere Verarbeitung verantwortlich.
        return updatedTask;
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(
          `Fehler beim Patchen des Asana Tasks ${gid}:`,
          errorMessage
        );
        throw error;
      }
    },
    // Posting
    async postAsanaStory(gid, htmlText) {
      try {
        if (!gid || !htmlText || htmlText.trim() === "") {
          console.error(
            "Eine Task-GID und ein HTML-Text sind für das Posten eines Kommentars erforderlich."
          );
          return null;
        }

        const payload = {
          html_text: htmlText,
        };

        const response = await api.post(
          `/api/asana/task/${gid}/story`,
          payload
        );

        const createdStory = response.data.data;

        console.log(
          `Kommentar erfolgreich zu Task ${gid} hinzugefügt:`,
          createdStory
        );

        return createdStory;
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(
          `Fehler beim Posten des Kommentars zu Asana Task ${gid}:`,
          errorMessage
        );
        throw error; // Re-throw the error so the calling component can handle it (e.g., show a notification)
      }
    },
    async postFlipTask(taskData) {
      try {
        // Validierung der Eingabedaten
        if (
          !taskData ||
          !taskData.title ||
          !taskData.recipients ||
          taskData.recipients.length === 0
        ) {
          throw new Error(
            "Titel und Empfänger sind für das Erstellen einer Flip-Aufgabe erforderlich."
          );
        }

        const response = await api.post("/api/personal/assignTask", taskData);

        const createdTask = response.data.data;
        console.log("Flip-Aufgabe erfolgreich zugewiesen:", createdTask);

        return createdTask;
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error("Fehler beim Zuweisen der Flip-Aufgabe:", errorMessage);
        throw error;
      }
    },
    async patchFlipUser(id, updateData) {
      try {
        if (!id || !updateData || Object.keys(updateData).length === 0) {
          throw new Error(
            "Flip User ID und ein Update-Objekt sind erforderlich."
          );
        }
        const response = await api.patch(
          `/api/personal/flip/user/${id}`,
          updateData
        );
        const updatedUser = response.data.data;
        console.log("Flip-Benutzer erfolgreich aktualisiert:", updatedUser);
        return updatedUser;
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(
          "Fehler beim Aktualisieren des Flip-Benutzers:",
          errorMessage
        );
        throw error;
      }
    },
    // Posting
    async assignFlipDocument() {
      //ToDo
    },
    async assignFlipUserGroups(assignments) {
      try {
        // Validierung der Eingabedaten
        if (
          !assignments ||
          !Array.isArray(assignments) ||
          assignments.length === 0
        ) {
          throw new Error(
            "Ein Array von Zuweisungen ('assignments') ist erforderlich."
          );
        }

        // Das Backend erwartet die Daten in einem Objekt mit dem Schlüssel 'items'
        const payload = {
          items: assignments,
        };

        const response = await api.post(
          "/api/personal/user-groups-assign",
          payload
        );

        console.log("Benutzergruppen erfolgreich zugewiesen:", response.data);

        // Gibt die Antwort vom Backend zurück
        return response.data;
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(
          "Fehler beim Zuweisen der Benutzergruppen:",
          errorMessage
        );
        throw error;
      }
    },
    // Deleting

    // Filter & Sorting
     setFilter(type, value) {
      if (type === 'status') {
        this.activeStatusFilter = value;
      } else if (type === 'location') {
        this.activeLocationFilter = value;
      } else if (type === 'department') {
        this.activeDepartmentFilter = value;
      }
    },
    switchToDashboard() {
      this.$router.push("/");
    },
  },
  mounted() {
    
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchDocuments();
    this.fetchMitarbeiters();
    this.fetchFlipUserGroups();
    this.fetchFlipUser("a6a6c4e0-29b2-4ae1-b1a0-7d963d4389ce");
    this.fetchAsanaTask("1209580006893795");
    this.fetchAsanaTaskStories("1209580006893795");
    
  },
};
</script>
<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.page-window {
  width: 100%;
  height: 100vh;
  padding: 20px 30px;
  background-color: #f8f9fa;
}

.top-tab-bar {
  display: flex;
  background-color: transparent;
  border-bottom: 1px solid #dee2e6;
}

.tab-button {
  background: #f1f3f4;
  border: 1px solid #dee2e6;
  border-bottom: none;
  cursor: pointer;
  padding: 10px 20px;
  margin-right: 4px;
  margin-bottom: -1px;
  color: #495057;
  font-weight: 500;
  font-size: 16px;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s ease;

  &:hover {
    background: #fff;
  }

  &.active {
    background: #fff;
    color: $base-primary;
    font-weight: 600;
    border-bottom-color: #fff;
  }
}

.main-content {
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-top: none;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border-radius: 0 12px 12px 12px;
  height: calc(100vh - 63px);
  overflow-y: auto;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 15px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e9ecef;
  overflow-x: auto;
  white-space: nowrap;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
  }
}

.filter-toggle {
  padding: 6px 14px;
  border: 1px solid #ced4da;
  border-radius: 16px;
  background-color: #f8f9fa;
  color: #495057;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #868e96;
  }
  &.active {
    background-color: $base-primary;
    color: white;
    border-color: $base-primary;
  }
}

.divider {
  height: 20px;
  width: 1px;
  background-color: #dee2e6;
  margin: 0 5px;
}

.search-sort-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.search-wrapper {
  position: relative;
  width: 400px;
  .search-icon {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: #adb5bd;
  }
  input {
    width: 100%;
    padding: 10px 15px 10px 40px;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    font-size: 15px;
    &:focus {
      outline: none;
      border-color: $base-primary;
      box-shadow: 0 0 0 2px rgba($base-primary, 0.2);
    }
  }
}

.sort-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  background-color: #fff;
  border: 1px solid #dee2e6;
  color: #495057;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

.mitarbeiter-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px 30px; 
}
.mitarbeiter-card-outer {
  position: relative; // Wichtig für die absolute Positionierung der Buttons
}
.mitarbeiter-card-inner {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.04);
  transition: all 0.25s ease-in-out;
  padding: 20px;
  height: 100%; // Stellt sicher, dass alle Karten die gleiche Höhe haben

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.08);
  }
}
.mitarbeiter-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease-in-out;
  padding: 20px;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  }
}

.card-actions-left {
  position: absolute;
  top: 50%;
  left: 0;
  // Zentriert die Button-Gruppe vertikal und schiebt sie zur Hälfte nach außen
  transform: translate(-50%, -50%);
  z-index: 10; // Stellt sicher, dass die Buttons über dem Kartenschatten liegen

  display: flex;
  flex-direction: column;
  gap: 8px;
}
.action-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #e0e0e0;
  background-color: #fff; // Wichtig, damit sie nicht durchsichtig sind
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &:hover {
    transform: scale(1.1);
    border-color: #c0c0c0;
  }
  
  &.active {
    border-color: $base-primary;
    box-shadow: 0 0 8px rgba($base-primary, 0.6);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #212529;
}

.card-status {
  font-size: 0.8rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 12px;
  color: #6c757d;
  background-color: #f1f3f4;

  &.active {
    color: #1f7a4d;
    background-color: #d4edda;
  }
}


.card-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  .detail-label {
    font-size: 0.8rem;
    color: #6c757d;
    margin-bottom: 2px;
  }
  .detail-value {
    font-size: 0.95rem;
    color: #343a40;
    overflow-wrap: break-word;
  }
}

.content-placeholder,
.content-placeholder-missing {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}
.content-placeholder-missing {
  color: #dc3545;
}

.card-actions {
  display: flex;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.action-button {
  background-color: transparent;
  border: none;
  border-left: 1px solid #dee2e6;
  padding: 6px;
  width: 38px;
  height: 34px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  opacity: 0.7;

  &:first-child {
    border-left: none;
  }

  img {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background-color: #f1f3f4;
  }

  &.active {
    background-color: #e9ecef;
    opacity: 1;
  }
}
</style>