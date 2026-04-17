<template>
  <div class="window">
    <h1>Daten Import</h1>
    
    <div class="info-text">
      Hochladen von Erweiterten Listen aus L1.
    </div>

    <!-- Last Import Section -->
    <div class="last-import-section">
      <div v-if="loadingHistory" class="loading-history">Lade Historie...</div>
      <div v-else class="history-grid">
        <div v-for="type in (isAdmin ? ['einsatz-komplett', 'personal', 'verfuegbarkeit', 'beruf', 'qualifikation', 'rechnung'] : ['einsatz-komplett', 'personal', 'verfuegbarkeit'])" :key="type" class="history-card">
          <div class="history-header">
            <span class="history-title">{{ getLabel(type) }}</span>
            <span class="status-dot" :class="getDisplayUpload(type)?.status || 'none'"></span>
          </div>
          <div class="history-body">
            <template v-if="getDisplayUpload(type)">
              <div class="history-date">{{ formatDate(getDisplayUpload(type).timestamp) }}</div>
              <div class="history-info">{{ getDisplayUpload(type).filename }}</div>
              <div class="history-count">{{ getDisplayUpload(type).recordCount }} Einträge</div>
            </template>
            <template v-else>
              <div class="no-history">- Noch keine Daten -</div>
            </template>
          </div>
        </div>
      </div>
    </div>


    <!-- Personal Bereich -->
    <div class="import-section">
      <div class="import-section-header">
        <i class="fas fa-users"></i>
        <h2>Personal</h2>
      </div>
      <div class="imports-layout">

        <!-- Zvoove Komplett Import -->
        <div class="import-card featured-import">
          <div class="card-header">
            <div class="header-content">
              <h2>Zvoove Komplett Import (Liste 7001)</h2>
              <p class="subtitle">Importiert Einsätze, Aufträge und Kunden aus einer Datei (Master-Import)</p>
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
                  <span v-if="!einsatzFile"><strong>Zvoove Export hier ablegen</strong><br>Importiert alles in einem Schritt</span>
                  <span v-else class="file-name">{{ einsatzFile.name }}</span>
                </div>
              </div>
              <input id="einsatz-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'einsatz')" accept=".xlsx, .xls" />
            </div>
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (7001)</td><td colspan="2">Muss in jeder Zeile 7001 enthalten</td></tr>
                    <tr><td>AUFTRAGNR, GESCHST, ...</td><td>Auftragsdaten</td></tr>
                    <tr><td>KUNDENNR, KUNDNAME, ...</td><td>Kundendaten</td></tr>
                    <tr><td>ID_AUFTRAG_ARBEITSSCHICHTEN, BEZEICHNUNG, ...</td><td>Schichtdaten</td></tr>
                    <tr><td>PERSONALNR, DATUMVON, BEZEICHN, ...</td><td>Einsatzdaten</td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Personal Import (kombiniert) -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Personal Import (Liste 7002)</h2>
              <p class="subtitle">Personalnr., Austrittsdatum, Berufe, Qualifikationen, Persgruppe, E-Mail, Telefon</p>
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
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (7002)</td><td>B – Personalnr</td><td>C – Persstatus (6=Ausgetreten)</td></tr>
                    <tr><td>D – Austrittsdatum</td><td>E – Berufsschlüssel (kommasep.)</td><td>F – Qualischlüssel (kommasep.)</td></tr>
                    <tr><td>G – Personengruppe</td><td>H – E-Mail</td><td>I – Telefon</td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Verfügbarkeiten Import -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Verfügbarkeiten (Liste 7003)</h2>
              <p class="subtitle">Tägliche Verfügbarkeiten aus EINSATZZEIT_TAEGLICH</p>
            </div>
            <span v-if="verfuegbarkeitFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <div class="upload-area"
              :class="{ 'has-file': verfuegbarkeitFile }"
              @dragover.prevent
              @drop="(e) => handleDragAndDrop(e, 'verfuegbarkeit')"
              @click="triggerFileInput('verfuegbarkeit-upload')"
            >
              <div class="upload-content">
                <i class="upload-icon" :class="verfuegbarkeitFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
                <div class="upload-text">
                  <span v-if="!verfuegbarkeitFile">Datei hier ablegen oder klicken</span>
                  <span v-else class="file-name">{{ verfuegbarkeitFile.name }}</span>
                </div>
              </div>
              <input id="verfuegbarkeit-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'verfuegbarkeit')" accept=".xlsx, .xls" />
            </div>
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (7003)</td><td colspan="2">Muss in jeder Zeile 7003 enthalten</td></tr>
                    <tr><td>B – ID</td><td>C – PERSONALNR</td><td>D – DATUM</td></tr>
                    <tr><td>E – VON</td><td>F – BIS</td><td>G – INFO</td></tr>
                    <tr><td>H – VERFUEGBAR (0/1)</td><td>I – ANLAGEBEDIENER</td><td>J – ZULETZTBEARBEITET</td></tr>
                    <tr><td>K – GANZTAEGIG (0/1)</td><td colspan="2"></td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

      </div>
    </div><!-- End Personal -->

    <!-- System Bereich (nur für Admins) -->
    <div v-if="isAdmin" class="import-section">
      <div class="import-section-header">
        <i class="fas fa-cogs"></i>
        <h2>System</h2>
      </div>
      <div class="imports-layout">

        <!-- Berufe -->
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

        <!-- Qualifikationen -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Qualifikationen</h2>
              <p class="subtitle">Qualifikationsschlüssel und Bezeichnungen</p>
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

      </div>
    </div><!-- End System -->

    <!-- Finanzen Bereich (nur für Admins) -->
    <div v-if="isAdmin" class="import-section">
      <div class="import-section-header">
        <i class="fas fa-file-invoice-dollar"></i>
        <h2>Finanzen</h2>
      </div>
      <div class="imports-layout">

        <!-- Rechnungen Import -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Rechnungen (Liste 6001)</h2>
              <p class="subtitle">Rechnungsdaten aus L1 — vertraulich, verschlüsselt gespeichert</p>
            </div>
            <span v-if="rechnungFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <div class="upload-area"
              :class="{ 'has-file': rechnungFile }"
              @dragover.prevent
              @drop="(e) => handleDragAndDrop(e, 'rechnung')"
              @click="triggerFileInput('rechnung-upload')"
            >
              <div class="upload-content">
                <i class="upload-icon" :class="rechnungFile ? 'fas fa-file-excel' : 'fas fa-cloud-upload-alt'"></i>
                <div class="upload-text">
                  <span v-if="!rechnungFile">Datei hier ablegen oder klicken</span>
                  <span v-else class="file-name">{{ rechnungFile.name }}</span>
                </div>
              </div>
              <input id="rechnung-upload" type="file" class="hidden-input" @change="(e) => handleFileUpload(e, 'rechnung')" accept=".xlsx, .xls" />
            </div>
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (6001)</td><td colspan="2">Muss in jeder Zeile 6001 enthalten</td></tr>
                    <tr><td>B – KOSTENST</td><td>C – RECHART</td><td>D – RECHSTATUS</td></tr>
                    <tr><td>E – KUNDENNR</td><td>F – AUFTRAGNR</td><td></td></tr>
                    <tr><td>G – RECHNDATUM</td><td>H – BUCHDATUM</td><td>I – NATCODE</td></tr>
                    <tr><td>J – DNETTO</td><td>K – DMWST</td><td>L – DBRUTTO</td></tr>
                    <tr><td>M – EURNETTO</td><td>N – EURMWST</td><td>O – EURBRUTTO</td></tr>
                    <tr><td>P – NETTO</td><td>Q – MWST</td><td>R – BRUTTO</td></tr>
                    <tr><td>S – DEBITORKTO</td><td>T – RECHALTNR</td><td>U – RECHTEXT</td></tr>
                    <tr><td>V – LFDLEISTNR</td><td>W – RECHNUNGNR</td><td></td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

      </div>
    </div><!-- End Finanzen -->

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
          
          <!-- Master Import Details (Zvoove Komplett / Schichten) -->
          <div v-if="resultModalData.details && (resultModalData.details.auftrag || resultModalData.details.einsatz || resultModalData.details.schicht)" class="master-stats-container">
            <h3>📊 Detaillierte Auswertung</h3>
            <div class="master-stats-grid">
              <!-- Schichten Card -->
              <div v-if="resultModalData.details.schicht" class="stat-card master-card">
                <div class="stat-icon green"><i class="fas fa-layer-group"></i></div>
                <div class="stat-content">
                  <span class="stat-title">Schichten</span>
                  <div class="stat-row">
                    <span class="val success">+{{ resultModalData.details.schicht.inserted || 0 }}</span>
                    <span class="lbl">Neu</span>
                  </div>
                  <div class="stat-row">
                    <span class="val danger">-{{ resultModalData.details.schicht.deleted || 0 }}</span>
                    <span class="lbl">Ersetzt</span>
                  </div>
                </div>
              </div>

              <!-- Einsätze Card -->
              <div v-if="resultModalData.details.einsatz" class="stat-card master-card">
                <div class="stat-icon blue"><i class="fas fa-calendar-check"></i></div>
                <div class="stat-content">
                  <span class="stat-title">Einsätze</span>
                  <div class="stat-row">
                    <span class="val success">+{{ resultModalData.details.einsatz.inserted || 0 }}</span>
                    <span class="lbl">Neu</span>
                  </div>
                  <div class="stat-row">
                    <span class="val danger">-{{ resultModalData.details.einsatz.deleted || 0 }}</span>
                    <span class="lbl">Ersetzt</span>
                  </div>
                </div>
              </div>

              <!-- Aufträge Card -->
              <div v-if="resultModalData.details.auftrag" class="stat-card master-card">
                <div class="stat-icon orange"><i class="fas fa-file-invoice"></i></div>
                <div class="stat-content">
                  <span class="stat-title">Aufträge</span>
                  <div class="stat-row">
                    <span class="val success">+{{ resultModalData.details.auftrag.upserted || 0 }}</span>
                    <span class="lbl">Neu</span>
                  </div>
                  <div class="stat-row">
                    <span class="val info">~{{ resultModalData.details.auftrag.matched || 0 }}</span>
                    <span class="lbl">Update</span>
                  </div>
                </div>
              </div>

               <!-- Kunden Card -->
               <div v-if="resultModalData.details.kunde" class="stat-card master-card">
                <div class="stat-icon purple"><i class="fas fa-users"></i></div>
                <div class="stat-content">
                  <span class="stat-title">Kunden</span>
                  <div class="stat-row">
                    <span class="val success">+{{ resultModalData.details.kunde.upserted || 0 }}</span>
                    <span class="lbl">Neu</span>
                  </div>
                  <div class="stat-row">
                    <span class="val info">~{{ resultModalData.details.kunde.matched || 0 }}</span>
                    <span class="lbl">Update</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Legacy Simple Statistics -->
          <div v-if="resultModalData.details && !resultModalData.details.einsatz" class="stats-grid">
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
            <div class="stat-item warning" v-if="resultModalData.details.pnrUpdated > 0">
              <span class="stat-value">{{ resultModalData.details.pnrUpdated }}</span>
              <span class="stat-label">PNr korrigiert</span>
            </div>
            <div class="stat-item warning" v-if="resultModalData.details.deactivated > 0">
              <span class="stat-value">{{ resultModalData.details.deactivated }}</span>
              <span class="stat-label">Deaktiviert</span>
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

          <!-- PNr Updated Section -->
          <div v-if="resultModalData.details?.pnrUpdatedList?.length > 0" class="section pnr-updated-section">
            <h3>🔄 Personalnr korrigiert (per E-Mail-Fallback)</h3>
            <p class="section-hint">Diese Mitarbeiter wurden per E-Mail gefunden. Ihre Personalnr wurde aktualisiert, die alte in die Historie übernommen.</p>
            <div class="notfound-list">
              <div v-for="(entry, idx) in resultModalData.details.pnrUpdatedList" :key="idx" class="pnr-updated-item">
                <span class="pnr-email">{{ entry.email }}</span>
                <span class="pnr-change"><code>{{ entry.alt }}</code> → <code>{{ entry.neu }}</code></span>
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
import { useAuth } from "../stores/auth";
import { useDataCache } from "../stores/dataCache";
import * as XLSX from 'xlsx';

export default {
  name: "DatenImport",
  setup() {
    const authStore = useAuth();
    const dataCache = useDataCache();
    return { authStore, dataCache };
  },
  computed: {
    isAdmin() {
      return this.authStore?.user?.roles?.includes('ADMIN');
    }
  },
  data() {
    return {

      einsatzFile: null,
      personalFile: null,
      verfuegbarkeitFile: null,
      berufFile: null,
      qualifikationFile: null,
      rechnungFile: null,
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
        kunde: 'Kunden',
        einsatz: 'Einsätze (Legacy)',
        'einsatz-komplett': 'Zvoove Komplett Import',
        personal: 'Personal',
        verfuegbarkeit: 'Verfügbarkeiten',
        beruf: 'Berufe',
        qualifikation: 'Qualifikationen',
        rechnung: 'Rechnungen',
      };
      return labels[type] || type;
    },
    getDisplayUpload(type) {
      return this.lastUploads[type];
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
    async setFile(file, type) {
      // Validate Prüffeld for einsatz/personal imports
      const expectedCode = type === 'einsatz' ? 7001 : type === 'personal' ? 7002 : type === 'verfuegbarkeit' ? 7003 : type === 'rechnung' ? 6001 : null;
      if (expectedCode) {
        const valid = await this.validatePrueffeld(file, expectedCode);
        if (!valid) return;
      }
      if (type === 'einsatz') this.einsatzFile = file;
      if (type === 'personal') this.personalFile = file;
      if (type === 'verfuegbarkeit') this.verfuegbarkeitFile = file;
      if (type === 'beruf') this.berufFile = file;
      if (type === 'qualifikation') this.qualifikationFile = file;
      if (type === 'rechnung') this.rechnungFile = file;
    },
    validatePrueffeld(file, expectedCode) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const startRow = rows.length > 0 && isNaN(rows[0][0]) ? 1 : 0;
            if (rows.length <= startRow) {
              alert('Die Datei enthält keine Daten.');
              resolve(false);
              return;
            }
            const prueffeld = parseInt(rows[startRow][0], 10);
            if (prueffeld !== expectedCode) {
              const labels = { 7001: 'Einsatz-Komplett (Liste 7001)', 7002: 'Personal (Liste 7002)' };
              alert(`⚠️ Prüffeld-Fehler: Spalte A enthält "${rows[startRow][0] ?? '(leer)'}" – erwartet wird ${expectedCode} (${labels[expectedCode]}).`);
              resolve(false);
              return;
            }
            resolve(true);
          } catch (err) {
            console.error('Prüffeld validation error:', err);
            alert('Fehler beim Lesen der Datei.');
            resolve(false);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    },
    async processFiles() {
      if (!this.hasAnyFile()) {
        alert("Bitte wählen Sie zuerst mindestens eine Datei aus.");
        return;
      }

      const adminFiles = this.isAdmin ? [this.berufFile, this.qualifikationFile, this.rechnungFile] : [];
      const fileCount = [this.einsatzFile, this.personalFile, this.verfuegbarkeitFile, ...adminFiles].filter(Boolean).length;
      if (!confirm(`Import von ${fileCount} Datei(en) wirklich starten? Es kann einige Sekunden dauern.`)) return;

      this.loading = true;
      const results = [];
      let hasErrors = false;

      try {
        // Upload all selected files
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

        if (this.verfuegbarkeitFile) {
          const response = await this.uploadFile(this.verfuegbarkeitFile, 'verfuegbarkeit');
          results.push({ type: 'Verfügbarkeiten', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.berufFile && this.isAdmin) {
          const response = await this.uploadFile(this.berufFile, 'beruf');
          results.push({ type: 'Berufe', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.qualifikationFile && this.isAdmin) {
          const response = await this.uploadFile(this.qualifikationFile, 'qualifikation');
          results.push({ type: 'Qualifikationen', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.rechnungFile && this.isAdmin) {
          const response = await this.uploadFile(this.rechnungFile, 'rechnung');
          results.push({ type: 'Rechnungen', ...response });
          if (!response.success) hasErrors = true;
        }

        // Combine results for modal
        this.resultModalData = this.combineResults(results);
        this.showResultModal = true;
        
        if (!hasErrors) {
          this.resetAll();
        }

        // Trigger Flip user sync silently in the background after a successful personal import
        const personalResult = results.find(r => r.type === 'Personal');
        if (personalResult?.success) {
          api.get('/api/personal/initialRoutine').catch(() => {});
        }
        
        // Invalidate caches so the next navigation shows fresh data
        const einsatzResult = results.find(r => r.type === 'Einsätze');
        if (personalResult?.success) this.dataCache.invalidateCache('mitarbeiter');
        if (einsatzResult?.success) {
          this.dataCache.invalidateCache('auftraege');
          this.dataCache.invalidateCache('kunden');
        }
        const berufResult = results.find(r => r.type === 'Berufe');
        const qualiResult = results.find(r => r.type === 'Qualifikationen');
        if (berufResult?.success) this.dataCache.invalidateCache('berufe');
        if (qualiResult?.success) this.dataCache.invalidateCache('qualifikationen');

        // After successful rechnung import, dispatch watchlist reports to all users with watchlist entries
        const rechnungResult = results.find(r => r.type === 'Rechnungen');
        if (rechnungResult?.success) {
          try {
            const reportResp = await api.post('/api/users/watchlist-reports/send-all');
            if (reportResp.data?.sent > 0) {
              this.resultModalData.message += `<div class="mb-2"><strong>Watchlist-Berichte:</strong> ${reportResp.data.msg}</div>`;
            }
          } catch (e) {
            console.warn('[DatenImport] Watchlist report dispatch failed:', e);
          }
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
      let nestedStats = {}; // To store structured stats from master import (auftrag, kunde, einsatz)

      let combinedArrays = {
        notFoundEntries: [],
        conflictDetails: [],
        pnrUpdatedList: []
      };
      
      results.forEach(result => {
        if (!result.success) allSuccessful = false;
        combinedMessage += `<div class="mb-2"><strong>${result.type}:</strong> ${result.message}</div>`;
        
        if (result.details) {
          // Check for nested master import structure
          if (result.details.auftrag || result.details.kunde || result.details.einsatz || result.details.schicht) {
             nestedStats = result.details;
          }

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
          if (result.details.pnrUpdatedList && Array.isArray(result.details.pnrUpdatedList)) {
            combinedArrays.pnrUpdatedList.push(...result.details.pnrUpdatedList);
          }
        }
      });
      
      return {
        success: allSuccessful,
        message: combinedMessage,
        details: { 
          ...totalStats,
          ...nestedStats, // Include specific sub-objects (auftrag, kunde, einsatz)
          notFoundEntries: combinedArrays.notFoundEntries,
          conflictDetails: combinedArrays.conflictDetails,
          pnrUpdatedList: combinedArrays.pnrUpdatedList
        }
      };
    },
    async uploadFile(file, endpointSuffix) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await api.post(`/api/import/${endpointSuffix}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 600000, // 10 min – large imports can take a while
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
      this.einsatzFile = null;
      this.personalFile = null;
      this.verfuegbarkeitFile = null;
      this.berufFile = null;
      this.qualifikationFile = null;
      this.rechnungFile = null;
      this.fetchLastUploads();
    },
    hasAnyFile() {
      const adminFiles = this.isAdmin ? (this.berufFile || this.qualifikationFile || this.rechnungFile) : false;
      return this.einsatzFile || this.personalFile || this.verfuegbarkeitFile || adminFiles;
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

.import-section {
  margin-bottom: 32px;
}

.import-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border);

  i {
    font-size: 1rem;
    color: var(--primary);
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
}

.imports-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
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

/* Master Import Specific Styles */
.master-stats-container {
  margin-bottom: 24px;

  h3 {
    margin: 0 0 16px;
    font-size: 1rem;
    color: var(--text);
  }
}

.master-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card.master-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 1.2rem;
    flex-shrink: 0;

    &.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
    &.orange { background: rgba(249, 115, 22, 0.1); color: #f97316; }
    &.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
    &.green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  }

  .stat-content {
    flex: 1;
  }

  .stat-title {
    display: block;
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 8px;
    color: var(--text);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    margin-bottom: 4px;

    .val {
      font-weight: 700;
      &.success { color: #22c55e; }
      &.danger { color: #ef4444; }
      &.info { color: #3b82f6; }
    }
    
    .lbl {
      color: var(--muted);
      font-size: 0.8rem;
    }
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

.pnr-updated-section {
  border-color: #f59e0b;
}

.pnr-updated-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--tile-bg);
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 0.9rem;

  .pnr-email {
    flex: 1;
    font-family: monospace;
    color: var(--text);
  }

  .pnr-change {
    color: var(--text-muted);
    code {
      background: var(--panel);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
  }
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
