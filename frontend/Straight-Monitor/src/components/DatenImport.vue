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
        <span class="status-indicator" :class="{ 'ready': auftragFile }">
          {{ auftragFile ? 'Bereit' : 'Fehlt' }}
        </span>
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
        <span class="status-indicator" :class="{ 'ready': kundeFile }">
          {{ kundeFile ? 'Bereit' : 'Fehlt' }}
        </span>
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
        <span class="status-indicator" :class="{ 'ready': einsatzFile }">
          {{ einsatzFile ? 'Bereit' : 'Fehlt' }}
        </span>
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

    <div class="actions">
      <button @click="processFiles" :disabled="!hasAnyFile || loading">
        {{ loading ? 'Import läuft...' : 'Import Starten' }}
      </button>
      <button class="secondary" @click="resetAll" :disabled="loading">
        Zurücksetzen
      </button>
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
      loading: false,
    };
  },
  computed: {
    hasAnyFile() {
      return this.auftragFile || this.kundeFile || this.einsatzFile;
    }
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
      // Basic validation for excel types could go here
      if (type === 'auftrag') this.auftragFile = file;
      if (type === 'kunde') this.kundeFile = file;
      if (type === 'einsatz') this.einsatzFile = file;
    },
    async processFiles() {
      if (!confirm("Möchten Sie den Import wirklich starten? Dies kann einige Sekunden dauern.")) return;

      this.loading = true;
      const results = [];
      const errors = [];

      try {
        if (this.auftragFile) {
          await this.uploadFile(this.auftragFile, 'auftrag', results, errors);
        }
        if (this.kundeFile) {
          await this.uploadFile(this.kundeFile, 'kunde', results, errors);
        }
        if (this.einsatzFile) {
          await this.uploadFile(this.einsatzFile, 'einsatz', results, errors);
        }

        let message = "Import abgeschlossen!\n\n";
        results.forEach(res => message += `✓ ${res}\n`);
        errors.forEach(err => message += `❌ ${err}\n`);
        
        alert(message);
        
        if (errors.length === 0) {
          this.resetAll();
        }
      } catch (err) {
        console.error("Global import error:", err);
        alert("Ein unerwarteter Fehler ist aufgetreten.");
      } finally {
        this.loading = false;
      }
    },
    async uploadFile(file, endpointSuffix, results, errors) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await api.post(`/api/import/${endpointSuffix}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        results.push(`${file.name}: ${response.data.message}`);
      } catch (error) {
        console.error(`Error uploading ${endpointSuffix}:`, error);
        const errMsg = error.response?.data?.message || error.message || "Unbekannter Fehler";
        errors.push(`${file.name}: ${errMsg}`);
      }
    },
    resetAll() {
      this.auftragFile = null;
      this.kundeFile = null;
      this.einsatzFile = null;
    }
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
</style>
