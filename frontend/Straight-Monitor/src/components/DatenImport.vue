<template>
  <div class="window">
    <h1>Daten Import</h1>
    
    <div class="info-text">
      Laden Sie hier die entsprechenden Excel-Dateien für Aufträge, Kunden und Einsätze hoch.
    </div>

    <!-- Auftrag Section -->
    <div class="import-section">
      <div class="section-header">
        <h2>Aufträge</h2>
        <span v-if="auftragFile" class="status-indicator ready">Bereit</span>
      </div>

      <div class="info-box">
        <p><strong>Benötigte Spalten:</strong></p>
        <div class="table-container">
          <table class="sample-table">
            <thead>
              <tr>
                <th>GESCHST</th>
                <th>AUFTRAGNR</th>
                <th>KUNDENNR</th>
                <th>EVENTTITEL</th>
                <th>BEDIENER</th>
                <th>DTANGELEGTAM</th>
                <th>BESTDATUM</th>
                <th>VONDATUM</th>
                <th>BISDATUM</th>
                <th>EVENT_STRASSE</th>
                <th>EVENT_PLZ</th>
                <th>EVENT_ORT</th>
                <th>EVENT_LOCATION</th>
                <th>AKTIV</th>
                <th>AUFTSTATUS</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
      
      <div class="upload-section">
        <div 
          class="drag-drop-area" 
          :class="{ 'has-file': auftragFile }"
          @dragover.prevent 
          @drop="(e) => handleDragAndDrop(e, 'auftrag')"
          @click="triggerFileInput('auftrag-upload')"
        >
          <span v-if="!auftragFile">Auftrag Excel hier ablegen oder klicken</span>
          <span v-else>
            Datei ausgewählt: <strong>{{ auftragFile.name }}</strong>
            <br><small>(Zum Ändern klicken oder neue Datei ziehen)</small>
          </span>
        </div>
        <input
          id="auftrag-upload"
          type="file"
          class="hidden-input"
          @change="(e) => handleFileUpload(e, 'auftrag')"
          accept=".xlsx, .xls"
        />
      </div>
    </div>

    <!-- Kunde Section -->
    <div class="import-section">
      <div class="section-header">
        <h2>Kunden</h2>
        <span v-if="kundeFile" class="status-indicator ready">Bereit</span>
      </div>

      <div class="info-box">
        <p><strong>Benötigte Spalten:</strong></p>
        <div class="table-container">
          <table class="sample-table">
            <thead>
              <tr>
                <th>KUNDENNR</th>
                <th>KUNDNAME</th>
                <th>KUNDESEIT</th>
                <th>KUNDSTATUS</th>
                <th>GESCHST</th>
                <th>KOSTENST</th>
                <th>BEMERKUNG</th>
                <th>BEMERKUNG2</th>
                <th>BEMERKUNG3</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>

      <div class="upload-section">
        <div 
          class="drag-drop-area" 
          :class="{ 'has-file': kundeFile }"
          @dragover.prevent 
          @drop="(e) => handleDragAndDrop(e, 'kunde')"
          @click="triggerFileInput('kunde-upload')"
        >
          <span v-if="!kundeFile">Kunden Excel hier ablegen oder klicken</span>
          <span v-else>
            Datei ausgewählt: <strong>{{ kundeFile.name }}</strong>
            <br><small>(Zum Ändern klicken oder neue Datei ziehen)</small>
          </span>
        </div>
        <input
          id="kunde-upload"
          type="file"
          class="hidden-input"
          @change="(e) => handleFileUpload(e, 'kunde')"
          accept=".xlsx, .xls"
        />
      </div>
    </div>

    <!-- Einsatz Section -->
    <div class="import-section">
      <div class="section-header">
        <h2>Einsätze</h2>
        <span v-if="einsatzFile" class="status-indicator ready">Bereit</span>
      </div>

      <div class="upload-section">
        <div 
          class="drag-drop-area" 
          :class="{ 'has-file': einsatzFile }"
          @dragover.prevent 
          @drop="(e) => handleDragAndDrop(e, 'einsatz')"
          @click="triggerFileInput('einsatz-upload')"
        >
          <span v-if="!einsatzFile">Einsatz Excel hier ablegen oder klicken</span>
          <span v-else>
            Datei ausgewählt: <strong>{{ einsatzFile.name }}</strong>
            <br><small>(Zum Ändern klicken oder neue Datei ziehen)</small>
          </span>
        </div>
        <input
          id="einsatz-upload"
          type="file"
          class="hidden-input"
          @change="(e) => handleFileUpload(e, 'einsatz')"
          accept=".xlsx, .xls"
        />
      </div>
    </div>

    <!-- Personal Section -->
    <div class="import-section">
      <div class="section-header">
        <h2>Personal (Personalnummern)</h2>
        <span v-if="personalFile" class="status-indicator ready">Bereit</span>
      </div>

      <div class="info-box">
        <p><strong>Benötigte Spalten:</strong></p>
        <div class="table-container">
          <table class="sample-table">
            <thead>
              <tr>
                <th>Personalnr (Column A)</th>
                <th>E-Mail (Column B)</th>
              </tr>
            </thead>
          </table>
        </div>
        <p class="info-note"><small>Verknüpft Mitarbeiter anhand der E-Mail mit der Personalnummer aus Zvoove.</small></p>
      </div>

      <div class="upload-section">
        <div 
          class="drag-drop-area" 
          :class="{ 'has-file': personalFile }"
          @dragover.prevent 
          @drop="(e) => handleDragAndDrop(e, 'personal')"
          @click="triggerFileInput('personal-upload')"
        >
          <span v-if="!personalFile">Personal Excel hier ablegen oder klicken</span>
          <span v-else>
            Datei ausgewählt: <strong>{{ personalFile.name }}</strong>
            <br><small>(Zum Ändern klicken oder neue Datei ziehen)</small>
          </span>
        </div>
        <input
          id="personal-upload"
          type="file"
          class="hidden-input"
          @change="(e) => handleFileUpload(e, 'personal')"
          accept=".xlsx, .xls"
        />
      </div>
    </div>

    <div class="actions">
      <button @click="processFiles" :disabled="!hasAnyFile() || loading">
        {{ loading ? 'Import läuft...' : 'Import Starten' }}
      </button>
    </div>

    <!-- Import Result Modal -->
    <div v-if="showResultModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ resultModalData.success ? '✓ Import Ergebnis' : '⚠️ Import mit Warnungen' }}</h2>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>
        
        <div class="modal-body">
          <p class="result-message">{{ resultModalData.message }}</p>
          
          <!-- Statistics -->
          <div v-if="resultModalData.details" class="stats-grid">
            <div class="stat-item" v-if="resultModalData.details.matched !== undefined">
              <span class="stat-value">{{ resultModalData.details.matched }}</span>
              <span class="stat-label">Gefunden</span>
            </div>
            <div class="stat-item success" v-if="resultModalData.details.updated !== undefined">
              <span class="stat-value">{{ resultModalData.details.updated }}</span>
              <span class="stat-label">Aktualisiert</span>
            </div>
            <div class="stat-item" v-if="resultModalData.details.unchanged !== undefined">
              <span class="stat-value">{{ resultModalData.details.unchanged }}</span>
              <span class="stat-label">Unverändert</span>
            </div>
            <div class="stat-item warning" v-if="resultModalData.details.conflicts > 0">
              <span class="stat-value">{{ resultModalData.details.conflicts }}</span>
              <span class="stat-label">Konflikte</span>
            </div>
            <div class="stat-item info" v-if="resultModalData.details.notFound > 0">
              <span class="stat-value">{{ resultModalData.details.notFound }}</span>
              <span class="stat-label">Nicht gefunden</span>
            </div>
          </div>

          <!-- Conflicts Section -->
          <div v-if="resultModalData.details?.conflictDetails?.length > 0" class="section conflicts-section">
            <h3>⚠️ Konflikte</h3>
            <div class="conflict-list">
              <div v-for="(conflict, idx) in resultModalData.details.conflictDetails" :key="idx" class="conflict-item">
                <strong>Personalnr {{ conflict.personalnr }}</strong>
                <p>{{ conflict.name }} ({{ conflict.email }})</p>
                <p class="conflict-with">↳ Bereits vergeben an: {{ conflict.conflictWith.name }} ({{ conflict.conflictWith.email }})</p>
              </div>
            </div>
          </div>

          <!-- Not Found Emails Section with Assign Feature -->
          <div v-if="resultModalData.details?.notFoundEntries?.length > 0" class="section notfound-section">
            <h3>ℹ️ E-Mails nicht gefunden</h3>
            <p class="section-hint">Diese E-Mails wurden in der Datenbank nicht gefunden. Sie können sie einem Mitarbeiter zuweisen (inkl. Personalnr).</p>
            
            <div class="notfound-list">
              <div v-for="(entry, idx) in resultModalData.details.notFoundEntries" :key="idx" class="notfound-item">
                <div class="entry-info">
                  <span class="email">{{ entry.email }}</span>
                  <span class="personalnr-badge">Personalnr: {{ entry.personalnr }}</span>
                </div>
                <button 
                  v-if="!assigningEntry || assigningEntry.email !== entry.email"
                  class="assign-btn" 
                  @click="startAssign(entry)"
                >
                  Mitarbeiter suchen
                </button>
                
                <!-- Search & Assign UI -->
                <div v-if="assigningEntry?.email === entry.email" class="assign-panel">
                  <input 
                    v-model="searchQuery"
                    type="text"
                    placeholder="Name suchen..."
                    class="search-input"
                    @input="searchMitarbeiter"
                  />
                  <button class="cancel-btn" @click="cancelAssign">Abbrechen</button>
                  
                  <div v-if="searchResults.length > 0" class="search-results">
                    <div 
                      v-for="ma in searchResults" 
                      :key="ma._id" 
                      class="search-result-item"
                      @click="assignEntryToMitarbeiter(entry, ma)"
                    >
                      <strong>{{ ma.vorname }} {{ ma.nachname }}</strong>
                      <span class="primary-email">{{ ma.email }}</span>
                      <span v-if="ma.personalnr" class="existing-pnr">Personalnr: {{ ma.personalnr }}</span>
                      <span v-if="ma.additionalEmails?.length" class="additional-count">
                        +{{ ma.additionalEmails.length }} weitere E-Mails
                      </span>
                    </div>
                  </div>
                  <div v-else-if="searchQuery.length >= 2 && !searching" class="no-results">
                    Keine Mitarbeiter gefunden
                  </div>
                  <div v-if="searching" class="searching">Suche...</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="primary-btn" @click="closeModal">Schließen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "../utils/api";

export default {
  name: "DatenImport",
  data() {
    return {
      auftragFile: null,
      kundeFile: null,
      einsatzFile: null,
      personalFile: null,
      loading: false,
      // Modal state
      showResultModal: false,
      resultModalData: {},
      // Assign feature state
      assigningEntry: null,
      searchQuery: "",
      searchResults: [],
      searching: false,
      searchTimeout: null,
    };
  },
  methods: {
    triggerFileInput(id) {
      document.getElementById(id).click();
    },
    handleFileUpload(event, type) {
      const file = event.target.files[0];
      if (file) this.setFile(file, type);
      // Reset input value so same file can be selected again if needed
      event.target.value = '';
    },
    handleDragAndDrop(event, type) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) this.setFile(file, type);
    },
    setFile(file, type) {
      // Reset all files first - only one upload at a time
      this.auftragFile = null;
      this.kundeFile = null;
      this.einsatzFile = null;
      this.personalFile = null;
      
      // Then set the selected file
      if (type === 'auftrag') this.auftragFile = file;
      if (type === 'kunde') this.kundeFile = file;
      if (type === 'einsatz') this.einsatzFile = file;
      if (type === 'personal') this.personalFile = file;
    },
    getCurrentFile() {
      if (this.auftragFile) return { file: this.auftragFile, type: 'auftrag' };
      if (this.kundeFile) return { file: this.kundeFile, type: 'kunde' };
      if (this.einsatzFile) return { file: this.einsatzFile, type: 'einsatz' };
      if (this.personalFile) return { file: this.personalFile, type: 'personal' };
      return null;
    },
    async processFiles() {
      const current = this.getCurrentFile();
      if (!current) {
        alert("Bitte wählen Sie zuerst eine Datei aus.");
        return;
      }

      if (!confirm("Import wirklich starten? Es kann einige Sekunden dauern.")) return;

      this.loading = true;
      const results = [];
      const errors = [];

      try {
        const response = await this.uploadFile(current.file, current.type);
        
        // Show modal with results
        this.resultModalData = response;
        this.showResultModal = true;
        
        if (response.success) {
          this.resetAll();
        }
      } catch (err) {
        console.error("Global import error:", err);
        this.resultModalData = {
          success: false,
          message: "Ein unerwarteter Fehler ist aufgetreten: " + (err.message || "Unbekannter Fehler")
        };
        this.showResultModal = true;
      } finally {
        this.loading = false;
      }
    },
    async uploadFile(file, endpointSuffix) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await api.post(`/api/import/${endpointSuffix}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
      } catch (error) {
        console.error(`Error uploading ${endpointSuffix}:`, error);
        return {
          success: false,
          message: `${file.name}: ${error.response?.data?.message || error.message || "Unbekannter Fehler"}`
        };
      }
    },
    closeModal() {
      this.showResultModal = false;
      this.resultModalData = {};
      this.cancelAssign();
    },
    startAssign(entry) {
      this.assigningEntry = entry;
      this.searchQuery = "";
      this.searchResults = [];
    },
    cancelAssign() {
      this.assigningEntry = null;
      this.searchQuery = "";
      this.searchResults = [];
    },
    searchMitarbeiter() {
      // Debounce search
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      
      if (this.searchQuery.length < 2) {
        this.searchResults = [];
        return;
      }
      
      this.searchTimeout = setTimeout(async () => {
        this.searching = true;
        try {
          const response = await api.get('/api/personal/mitarbeiter');
          const query = this.searchQuery.toLowerCase();
          this.searchResults = (response.data?.data || [])
            .filter(ma => {
              const fullName = `${ma.vorname} ${ma.nachname}`.toLowerCase();
              return fullName.includes(query) || ma.email?.toLowerCase().includes(query);
            })
            .slice(0, 10); // Limit to 10 results
        } catch (error) {
          console.error("Search error:", error);
          this.searchResults = [];
        } finally {
          this.searching = false;
        }
      }, 300);
    },
    async assignEntryToMitarbeiter(entry, mitarbeiter) {
      try {
        // 1. Add email to additionalEmails
        await api.post(`/api/personal/mitarbeiter/${mitarbeiter._id}/additional-email`, {
          email: entry.email
        });
        
        // 2. Update personalnr (if mitarbeiter doesn't have one or if we want to overwrite)
        if (!mitarbeiter.personalnr) {
          await api.patch(`/api/personal/mitarbeiter/${mitarbeiter._id}/personalnr`, {
            personalnr: entry.personalnr
          });
        }
        
        // Remove from not found list
        const idx = this.resultModalData.details.notFoundEntries.findIndex(e => e.email === entry.email);
        if (idx > -1) {
          this.resultModalData.details.notFoundEntries.splice(idx, 1);
          this.resultModalData.details.notFound--;
        }
        
        this.cancelAssign();
        
        const personalnrMsg = !mitarbeiter.personalnr 
          ? ` und Personalnr ${entry.personalnr}` 
          : ` (Personalnr ${mitarbeiter.personalnr} bleibt unverändert)`;
        alert(`✓ E-Mail ${entry.email}${personalnrMsg} wurde ${mitarbeiter.vorname} ${mitarbeiter.nachname} zugewiesen.`);
      } catch (error) {
        console.error("Assign error:", error);
        if (error.response?.data?.conflict) {
          alert(`⚠️ Konflikt: ${error.response.data.message}\n\nVerwendet von: ${error.response.data.conflict.name}`);
        } else {
          alert("Fehler beim Zuweisen: " + (error.response?.data?.message || error.message));
        }
      }
    },
    resetAll() {
      this.auftragFile = null;
      this.kundeFile = null;
      this.einsatzFile = null;
      this.personalFile = null;
    },
    hasAnyFile() {
      return this.auftragFile || this.kundeFile || this.einsatzFile || this.personalFile;
    },

    handleEscapeKey(event) {
      if (event.key === 'Escape' && this.showResultModal) {
        this.closeModal();
      }
    }
  },

  mounted() {
    document.addEventListener('keydown', this.handleEscapeKey);
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.window {
  width: 900px;
  max-width: 96vw; /* Ensure it doesn't overflow small screens */
  margin: 30px auto;
  padding: 30px;
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial;

  h1 {
    text-align: center;
    margin-bottom: 10px;
    font-size: 2.0rem;
    color: var(--text);
  }
}

.info-text {
  text-align: center;
  color: var(--muted);
  margin-bottom: 30px;
}

.import-section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 15px 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  h2 {
    font-size: 1.1rem;
    margin: 0;
    color: var(--text);
    font-weight: 600;
  }
}

.info-box {
  background: var(--tile-bg); /* slightly clearer than panel */
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 5px;
  text-align: left;
  color: var(--text);
  font-size: 0.85rem;
  
  p { margin: 0 0 8px; }
}

.table-container {
  overflow-x: auto;
  max-width: 100%;
}

.sample-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  
  th {
    padding: 6px 10px;
    border: 1px solid var(--border);
    font-size: 0.75rem;
    text-align: center;
    color: var(--text);
    background: var(--hover);
  }
}

.status-indicator {
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: var(--border);
  color: var(--muted);
  font-weight: bold;

  &.ready {
    background-color: color-mix(in oklab, var(--success, #22c55e) 20%, transparent);
    color: var(--success, #22c55e);
  }
}

.upload-section {
  .hidden-input {
    display: none;
  }
}

.drag-drop-area {
  width: 100%;
  box-sizing: border-box; /* Ensures padding and border are included in width */
  height: 80px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.95rem;
  color: var(--muted);
  background: var(--tile-bg);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 10px;

  &:hover {
    background: var(--hover);
    border-color: var(--primary);
    color: var(--primary);
  }

  &.has-file {
    border-color: var(--success, #22c55e);
    background: color-mix(in oklab, var(--success, #22c55e) 5%, var(--tile-bg));
    color: var(--text);
    
    strong {
      color: var(--success, #22c55e);
    }
  }
}

.actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;

  button {
    padding: 12px 24px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: transform .08s ease, filter .2s ease;
    font-size: 1rem;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: grayscale(0.5);
    }
    
    &:hover:not(:disabled) {
      filter: brightness(0.95);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      filter: brightness(0.9);
      transform: translateY(0);
    }

    &.secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);

      &:hover {
        background: var(--hover);
        color: var(--text);
      }
    }
  }
}

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .window {
    width: calc(100vw - 32px);
    margin: 16px;
    padding: 20px;
  }
  
  .actions {
    flex-direction: column;
    button {
      width: 100%;
    }
  }
}

/* Modal Styles */
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
  padding: 20px;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  
  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    
    &:hover {
      color: var(--text);
    }
  }
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.result-message {
  font-size: 1rem;
  margin-bottom: 20px;
  color: var(--text);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat-item {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  
  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--muted);
    text-transform: uppercase;
  }
  
  &.success {
    border-color: var(--success, #22c55e);
    .stat-value { color: var(--success, #22c55e); }
  }
  
  &.warning {
    border-color: #f59e0b;
    .stat-value { color: #f59e0b; }
  }
  
  &.info {
    border-color: #3b82f6;
    .stat-value { color: #3b82f6; }
  }
}

.section {
  margin-top: 20px;
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  
  h3 {
    margin: 0 0 12px;
    font-size: 1rem;
    color: var(--text);
  }
}

.section-hint {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 12px;
}

.conflicts-section {
  border-color: #f59e0b;
}

.conflict-item {
  padding: 10px;
  background: var(--tile-bg);
  border-radius: 6px;
  margin-bottom: 8px;
  
  p {
    margin: 4px 0;
    font-size: 0.9rem;
  }
  
  .conflict-with {
    color: #f59e0b;
    font-size: 0.85rem;
  }
}

.notfound-section {
  border-color: #3b82f6;
}

.notfound-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--tile-bg);
  border-radius: 6px;
  margin-bottom: 8px;
  
  .email {
    flex: 1;
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--text);
  }
  
  .assign-btn {
    padding: 6px 12px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    
    &:hover {
      filter: brightness(0.9);
    }
  }
}

.assign-panel {
  width: 100%;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--panel);
    color: var(--text);
    font-size: 0.9rem;
    
    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
  
  .cancel-btn {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--muted);
    cursor: pointer;
    
    &:hover {
      background: var(--hover);
      color: var(--text);
    }
  }
}

.search-results {
  width: 100%;
  margin-top: 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.search-result-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: var(--hover);
  }
  
  strong {
    display: block;
    color: var(--text);
  }
  
  .primary-email {
    font-size: 0.85rem;
    color: var(--muted);
  }
  
  .additional-count {
    font-size: 0.75rem;
    color: var(--primary);
    margin-left: 8px;
  }
}

.no-results, .searching {
  width: 100%;
  text-align: center;
  padding: 12px;
  color: var(--muted);
  font-size: 0.9rem;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  
  .primary-btn {
    padding: 10px 20px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    
    &:hover {
      filter: brightness(0.9);
    }
  }
}
</style>
