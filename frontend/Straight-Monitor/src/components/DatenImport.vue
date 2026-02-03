<template>
  <div class="window">
    <h1>Daten Import</h1>
    
    <div class="info-text">
      Laden Sie hier die entsprechenden Excel-Dateien für Aufträge, Kunden und Einsätze hoch.
    </div>

    <!-- Last Import Section -->
    <div class="last-import-section">
      <h3>Letzte Uploads</h3>
      <div v-if="loadingHistory" class="loading-history">Lade Historie...</div>
      <div v-else class="history-grid">
        <div v-for="type in ['auftrag', 'kunde', 'einsatz', 'personal', 'beruf', 'qualifikation', 'personal_quali']" :key="type" class="history-card">
          <div class="history-header">
            <span class="history-title">{{ getLabel(type) }}</span>
            <span class="status-dot" :class="lastUploads[type]?.status || 'none'"></span>
          </div>
          <div class="history-body">
            <template v-if="lastUploads[type]">
              <div class="history-date">{{ formatDate(lastUploads[type].timestamp) }}</div>
              <div class="history-info">{{ lastUploads[type].filename }}</div>
              <div class="history-count">{{ lastUploads[type].recordCount }} Einträge</div>
            </template>
            <template v-else>
              <div class="no-history">- Noch keine Daten -</div>
            </template>
          </div>
        </div>
      </div>
    </div>


    <!-- Import-Bereich mit Tabs oder Accordion für Übersichtlichkeit -->
    <div class="imports-layout">
      
      <!-- Auftrag Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Aufträge</h2>
            <p class="subtitle">Importiert Auftragsdaten aus Zvoove</p>
          </div>
          <span v-if="auftragFile" class="status-indicator ready">
            <i class="fas fa-check"></i> Bereit
          </span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': auftragFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'auftrag')"
            @click="triggerFileInput('auftrag-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="auftragFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!auftragFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ auftragFile.name }}</span>
              </div>
            </div>
            <input id="auftrag-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'auftrag')" accept=".xlsx, .xls" />
          </div>

          <div class="requirements-hint">
            <details>
              <summary>Benötigte Spalten anzeigen</summary>
              <div class="table-scroll">
                <table class="req-table"><tbody><tr><td>GESCHST</td><td>AUFTRAGNR</td><td>KUNDENNR</td><td>EVENTTITEL</td><td>BEDIENER</td><td>DTANGELEGTAM</td><td>BESTDATUM</td><td>VONDATUM</td><td>BISDATUM</td><td>EVENT_STRASSE</td><td>EVENT_PLZ</td><td>EVENT_ORT</td><td>EVENT_LOCATION</td><td>AKTIV</td><td>AUFTSTATUS</td></tr></tbody></table>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- Kunde Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Kunden</h2>
            <p class="subtitle">Stammdaten und Bemerkungen</p>
          </div>
          <span v-if="kundeFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': kundeFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'kunde')"
            @click="triggerFileInput('kunde-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="kundeFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!kundeFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ kundeFile.name }}</span>
              </div>
            </div>
            <input id="kunde-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'kunde')" accept=".xlsx, .xls" />
          </div>

          <div class="requirements-hint">
            <details>
              <summary>Benötigte Spalten anzeigen</summary>
              <div class="table-scroll">
                <table class="req-table"><tbody><tr><td>KUNDENNR</td><td>KUNDNAME</td><td>KUNDESEIT</td><td>KUNDSTATUS</td><td>GESCHST</td><td>KOSTENST</td><td>BEMERKUNG</td><td>BEMERKUNG2</td><td>BEMERKUNG3</td></tr></tbody></table>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- Einsatz Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Einsätze</h2>
            <p class="subtitle">Schichtplanungen und Disposition</p>
          </div>
          <span v-if="einsatzFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': einsatzFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'einsatz')"
            @click="triggerFileInput('einsatz-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="einsatzFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!einsatzFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ einsatzFile.name }}</span>
              </div>
            </div>
            <input id="einsatz-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'einsatz')" accept=".xlsx, .xls" />
          </div>
        </div>
      </div>

      <!-- Personal Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Personal-Zuordnung</h2>
            <p class="subtitle">Verknüpft Personalnr. via E-Mail</p>
          </div>
          <span v-if="personalFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': personalFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'personal')"
            @click="triggerFileInput('personal-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="personalFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!personalFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ personalFile.name }}</span>
              </div>
            </div>
            <input id="personal-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'personal')" accept=".xlsx, .xls" />
          </div>

          <div class="requirements-hint">
            <details>
              <summary>Benötigte Spalten anzeigen</summary>
              <div class="table-scroll">
                <table class="req-table"><tbody><tr><td>Personalnr (Col A)</td><td>E-Mail (Col B)</td></tr></tbody></table>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- Beruf Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Berufe (Jobs)</h2>
            <p class="subtitle">Berufsschlüssel und Bezeichnungen</p>
          </div>
          <span v-if="berufFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': berufFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'beruf')"
            @click="triggerFileInput('beruf-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="berufFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!berufFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ berufFile.name }}</span>
              </div>
            </div>
            <input id="beruf-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'beruf')" accept=".xlsx, .xls" />
          </div>

          <div class="requirements-hint">
            <details>
              <summary>Benötigte Spalten anzeigen</summary>
              <div class="table-scroll">
                <table class="req-table"><tbody><tr><td>Berufnr (Col A)</td><td>Bezeichnung (Col C)</td></tr></tbody></table>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- Qualifikation Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Qualifikationen</h2>
            <p class="subtitle">Qualifikationsschlüssel und Namen</p>
          </div>
          <span v-if="qualifikationFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': qualifikationFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'qualifikation')"
            @click="triggerFileInput('qualifikation-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="qualifikationFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!qualifikationFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ qualifikationFile.name }}</span>
              </div>
            </div>
            <input id="qualifikation-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'qualifikation')" accept=".xlsx, .xls" />
          </div>

          <div class="requirements-hint">
            <details>
              <summary>Benötigte Spalten anzeigen</summary>
              <div class="table-scroll">
                <table class="req-table"><tbody><tr><td>Quali-Nr (Col A)</td><td>Bezeichnung (Col B)</td></tr></tbody></table>
              </div>
            </details>
          </div>
        </div>
      </div>

      <!-- Personal-Skills Zuordnung Section -->
      <div class="import-card">
        <div class="card-header">
          <div class="header-content">
            <h2>Personal Skills</h2>
            <p class="subtitle">Zuordnung: Personalnr ↔ Beruf/Quali</p>
          </div>
          <span v-if="personalQualiFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
        </div>

        <div class="card-content">
          <div class="upload-area" 
            :class="{ 'has-file': personalQualiFile }"
            @dragover.prevent 
            @drop="(e) => handleDragAndDrop(e, 'personal_quali')"
            @click="triggerFileInput('personal-quali-upload')"
          >
            <div class="upload-content">
              <i class="upload-icon" :class="personalQualiFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
              <div class="upload-text">
                <span v-if="!personalQualiFile">Datei hier ablegen oder klicken</span>
                <span v-else class="file-name">{{ personalQualiFile.name }}</span>
              </div>
            </div>
            <input id="personal-quali-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'personal_quali')" accept=".xlsx, .xls" />
          </div>

          <div class="requirements-hint">
            <details>
              <summary>Benötigte Spalten anzeigen</summary>
              <div class="table-scroll">
                <table class="req-table"><tbody><tr><td>Personalnr (Col A)</td><td>Beruf Key (Col B)</td><td>Quali Key (Col C)</td></tr></tbody></table>
              </div>
            </details>
          </div>
        </div>
      </div>
    
    </div><!-- End imports-layout -->

    <div class="actions-bar">
      <button class="primary-btn large" @click="processFiles" :disabled="!hasAnyFile() || loading">
        <span v-if="loading"><i class="fas fa-spinner fa-spin"></i> Import läuft...</span>
        <span v-else><i class="fas fa-file-import"></i> {{ hasAnyFile() ? 'Ausgewählte Dateien importieren' : 'Dateien auswählen zum Starten' }}</span>
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
          <p class="result-message" v-html="resultModalData.message"></p>
          
          <!-- Statistics -->
          <div v-if="resultModalData.details" class="stats-grid">
            <div class="stat-item" v-if="resultModalData.details.total !== undefined">
              <span class="stat-value">{{ resultModalData.details.total }}</span>
              <span class="stat-label">Gesamt</span>
            </div>
            <div class="stat-item success" v-if="resultModalData.details.inserted !== undefined">
              <span class="stat-value">{{ resultModalData.details.inserted }}</span>
              <span class="stat-label">Neu hinzugefügt</span>
            </div>
            <div class="stat-item success" v-if="resultModalData.details.updated !== undefined">
              <span class="stat-value">{{ resultModalData.details.updated }}</span>
              <span class="stat-label">Aktualisiert</span>
            </div>
            <div class="stat-item" v-if="resultModalData.details.unchanged !== undefined">
              <span class="stat-value">{{ resultModalData.details.unchanged }}</span>
              <span class="stat-label">Unverändert</span>
            </div>
            <div class="stat-item" v-if="resultModalData.details.matched !== undefined">
              <span class="stat-value">{{ resultModalData.details.matched }}</span>
              <span class="stat-label">Gefunden</span>
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
                  <span class="personalnr-badge"> Personalnr: {{ entry.personalnr }}</span>
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
                      <span class="status-badge" :class="ma.isActive ? 'active' : 'inactive'">
                        {{ ma.isActive ? 'Aktiv' : 'Inaktiv' }}
                      </span>
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
      berufFile: null,
      qualifikationFile: null,
      personalQualiFile: null,
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
      lastUploads: {},
      loadingHistory: false
    };
  },
  methods: {
    async fetchLastUploads() {
      this.loadingHistory = true;
      try {
        const response = await api.get('/api/import/last-uploads');
        if (response.data.success) {
          this.lastUploads = response.data.data;
        }
      } catch (err) {
        console.error("Error fetching last uploads:", err);
      } finally {
        this.loadingHistory = false;
      }
    },
    getLabel(type) {
      const labels = {
        auftrag: 'Aufträge',
        kunde: 'Kunden',
        einsatz: 'Einsätze',
        personal: 'Personal',
        beruf: 'Berufe',
        qualifikation: 'Qualifikationen',
        personal_quali: 'Pers. Skills'
      };
      return labels[type] || type;
    },
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    },
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
      // Set the selected file for the specific type
      if (type === 'auftrag') this.auftragFile = file;
      if (type === 'kunde') this.kundeFile = file;
      if (type === 'einsatz') this.einsatzFile = file;
      if (type === 'personal') this.personalFile = file;
      if (type === 'beruf') this.berufFile = file;
      if (type === 'qualifikation') this.qualifikationFile = file;
      if (type === 'personal_quali') this.personalQualiFile = file;
    },
    async processFiles() {
      if (!this.hasAnyFile()) {
        alert("Bitte wählen Sie zuerst mindestens eine Datei aus.");
        return;
      }

      const fileCount = [this.auftragFile, this.kundeFile, this.einsatzFile, this.personalFile, this.berufFile, this.qualifikationFile, this.personalQualiFile].filter(Boolean).length;
      if (!confirm(`Import von ${fileCount} Datei(en) wirklich starten? Es kann einige Sekunden dauern.`)) return;

      this.loading = true;
      const results = [];
      let hasErrors = false;

      try {
        // Upload all selected files
        if (this.auftragFile) {
          const response = await this.uploadFile(this.auftragFile, 'auftrag');
          results.push({ type: 'Aufträge', ...response });
          if (!response.success) hasErrors = true;
        }
        
        if (this.kundeFile) {
          const response = await this.uploadFile(this.kundeFile, 'kunde');
          results.push({ type: 'Kunden', ...response });
          if (!response.success) hasErrors = true;
        }
        
        if (this.einsatzFile) {
          const response = await this.uploadFile(this.einsatzFile, 'einsatz');
          results.push({ type: 'Einsätze', ...response });
          if (!response.success) hasErrors = true;
        }
        
        if (this.personalFile) {
          const response = await this.uploadFile(this.personalFile, 'personal');
          results.push({ type: 'Personal', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.berufFile) {
          const response = await this.uploadFile(this.berufFile, 'beruf');
          results.push({ type: 'Berufe', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.qualifikationFile) {
          const response = await this.uploadFile(this.qualifikationFile, 'qualifikation');
          results.push({ type: 'Qualifikationen', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.personalQualiFile) {
          const response = await this.uploadFile(this.personalQualiFile, 'personal_quali');
          results.push({ type: 'Pers. Skills', ...response });
          if (!response.success) hasErrors = true;
        }
        
        // Combine results for modal
        this.resultModalData = this.combineResults(results);
        this.showResultModal = true;
        
        if (!hasErrors) {
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
        await this.fetchLastUploads();
      }
    },
    combineResults(results) {
      // Combine multiple import results into one modal view
      let combinedMessage = '';
      let allSuccessful = true;
      let totalStats = {};
      let combinedArrays = {
        notFoundEntries: [],
        conflictDetails: []
      };
      
      results.forEach(result => {
        if (!result.success) allSuccessful = false;
        combinedMessage += `\n\n<strong>${result.type}:</strong> ${result.message}`;
        
        if (result.details) {
          // Merge numeric stats
          Object.keys(result.details).forEach(key => {
            if (typeof result.details[key] === 'number') {
              totalStats[key] = (totalStats[key] || 0) + result.details[key];
            }
          });
          
          // Merge arrays (notFoundEntries, conflictDetails)
          if (result.details.notFoundEntries && Array.isArray(result.details.notFoundEntries)) {
            combinedArrays.notFoundEntries.push(...result.details.notFoundEntries);
          }
          if (result.details.conflictDetails && Array.isArray(result.details.conflictDetails)) {
            combinedArrays.conflictDetails.push(...result.details.conflictDetails);
          }
        }
      });
      
      return {
        success: allSuccessful,
        message: `Import von ${results.length} Datei(en) abgeschlossen:${combinedMessage}`,
        details: { 
          ...totalStats,
          notFoundEntries: combinedArrays.notFoundEntries,
          conflictDetails: combinedArrays.conflictDetails
        }
      };
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
    // ... assign methods ... same as before ... 
    
    resetAll() {
      this.auftragFile = null;
      this.kundeFile = null;
      this.einsatzFile = null;
      this.personalFile = null;
      this.berufFile = null;
      this.qualifikationFile = null;
      this.personalQualiFile = null;
      this.fetchLastUploads(); // Refresh history after upload
    },
    hasAnyFile() {
      return this.auftragFile || this.kundeFile || this.einsatzFile || this.personalFile || this.berufFile || this.qualifikationFile || this.personalQualiFile;
    },

    handleEscapeKey(event) {
      if (event.key === 'Escape' && this.showResultModal) {
        this.closeModal();
      }
    }
  },

  mounted() {
    this.fetchLastUploads();
    document.addEventListener('keydown', this.handleEscapeKey);
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.last-import-section {
  margin-bottom: 30px;
  
  h3 {
    font-size: 1.1rem;
    margin-bottom: 15px;
    color: var(--text-muted);
  }
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.history-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 15px;
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    
    .history-title {
      font-weight: 600;
      font-size: 0.95rem;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
      
      &.success { background: #4ade80; box-shadow: 0 0 5px rgba(74, 222, 128, 0.4); }
      &.warning { background: #fbbf24; }
      &.failed { background: #f87171; }
      &.none { background: transparent; border: 1px solid var(--border); }
    }
  }
  
  .history-body {
    font-size: 0.85rem;
    
    .history-date {
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    
    .history-info {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
      font-weight: 500;
    }
    
    .history-count {
      color: var(--primary);
    }
    
    .no-history {
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
      padding: 10px 0;
    }
  }
}

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

.imports-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.import-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 5px 15px rgba(0,0,0,0.05);
  }
  
  .card-header {
    background: var(--header-bg);
    padding: 15px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-content {
      h2 {
        font-size: 1.1rem;
        margin: 0;
        color: var(--text);
      }
      .subtitle {
        font-size: 0.8rem;
        color: var(--text-muted);
        margin: 2px 0 0;
      }
    }
    
    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      padding: 4px 10px;
      border-radius: 20px;
      
      &.ready {
        background: rgba(74, 222, 128, 0.1);
        color: #4ade80;
        border: 1px solid rgba(74, 222, 128, 0.2);
      }
    }
  }
  
  .card-content {
    padding: 20px;
  }
}

.upload-area {
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 30px 20px;
  cursor: pointer;
  background: var(--bg-tertiary);
  transition: all 0.2s;
  text-align: center;
  position: relative;
  
  &:hover {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.02);
  }
  
  &.has-file {
    border-style: solid;
    border-color: #4ade80;
    background: rgba(74, 222, 128, 0.05);
    
    .upload-icon {
      color: #4ade80;
    }
  }
  
  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    
    .upload-icon {
      font-size: 2rem;
      color: var(--text-muted);
      transition: color 0.2s;
    }
    
    .upload-text {
      font-size: 0.9rem;
      color: var(--text-muted);
      
      .file-name {
        color: var(--text);
        font-weight: 500;
        word-break: break-all;
      }
    }
  }
}

.requirements-hint {
  margin-top: 15px;
  font-size: 0.85rem;
  
  details {
    summary {
      cursor: pointer;
      color: var(--primary);
      outline: none;
      
      &:hover {
        text-decoration: underline;
      }
    }
  }
  
  .table-scroll {
    margin-top: 10px;
    max-height: 200px;
    overflow-y: auto;
    
    .req-table {
      width: 100%;
      border-collapse: collapse;
      
      td {
        padding: 4px 8px;
        border: 1px solid var(--border);
        background: var(--bg-tertiary);
        font-family: monospace;
        font-size: 0.8rem;
      }
    }
  }
}

.actions-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  
  .primary-btn.large {
    padding: 12px 24px;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 10px;
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.hidden-input {
  display: none;
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
  
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    margin-left: 8px;
    
    &.active {
      background: color-mix(in oklab, var(--success, #22c55e) 20%, transparent);
      color: var(--success, #22c55e);
    }
    
    &.inactive {
      background: color-mix(in oklab, var(--muted) 20%, transparent);
      color: var(--muted);
    }
  }
  
  .primary-email {
    font-size: 0.85rem;
    color: var(--muted);
  }
  
  .existing-pnr {
    font-size: 0.75rem;
    color: var(--primary);
    margin-left: 8px;
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

.primary-btn {
  /* Default styling for primary button if not globally defined */
  background-color: var(--primary, #3b82f6);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;

  &:hover {
    filter: brightness(0.9);
  }
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
