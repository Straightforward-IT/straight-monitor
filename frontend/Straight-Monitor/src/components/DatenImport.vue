<template>
  <PageLayout title="Daten Import" width="wide" content-variant="flush">
  <div class="window">
    
    <div class="info-text">
      Hochladen von Erweiterten Listen aus L1.
    </div>

    <!-- Last Import Section -->
    <div class="last-import-section">
      <div v-if="loadingHistory" class="loading-history">Lade Historie...</div>
      <div v-else class="history-grid">
        <div v-for="type in (isAdmin ? ['einsatz-komplett', 'personal', 'verfuegbarkeit', 'adressen', 'kunden', 'einsatzort', 'beruf', 'qualifikation', 'nationalitaet', 'lohnart', 'kundenkondition', 'rechnung', 'kundenpreis', 'personalnr-history', 'vorarbeitgebertage'] : ['einsatz-komplett', 'personal', 'verfuegbarkeit'])" :key="type" class="history-card">
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
            <AppFileDropzone label="Zvoove Export" prompt="Zvoove Export hier ablegen" hint="Importiert alles in einem Schritt" :file="einsatzFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'einsatz')" />
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (7001)</td><td colspan="2">Muss in jeder Zeile 7001 enthalten</td></tr>
                    <tr><td>AUFTRAGNR, GESCHST, ...</td><td>Auftragsdaten</td></tr>
                    <tr><td>KUNDENNR, KUNDNAME, ...</td><td>Kundendaten</td></tr>
                    <tr><td>ADR1_*, ADR2_*, ADR3_* (NUMMER, LNAME, STRASSE, PLZ, ORT, ...)</td><td>Kunden-Adressen</td></tr>
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
              <p class="subtitle">Personalnr., Stammdaten, Berufe, Qualifikationen, Staatsangehörigkeit, Persgruppe, Arbeitszeit, Adressen, E-Mail, Telefon</p>
            </div>
            <span v-if="personalFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Personal Import" :file="personalFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'personal')" />
            <div class="requirements-hint">
              <details>
                <summary>Benötigte Spalten anzeigen</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (7002)</td><td>B – Personalnr</td><td>C – Persstatus (6=Ausgetreten)</td></tr>
                    <tr><td>D – Geburtsdatum (GEBDATUM)</td><td>E – Nachname</td><td>F – Vorname</td></tr>
                    <tr><td>G – Geburtsname (GEBNAME)</td><td>H – Geburtsort (GEBORT)</td><td>I – Eintritt (EINTRITT1)</td></tr>
                    <tr><td>J – Austrittsdatum (AUSTRITT1)</td><td>K – IBAN</td><td>L – Führerschein</td></tr>
                    <tr><td>M – Führerschein gültig von</td><td>N – Führerschein gültig bis</td><td>O – Berufsschlüssel (kommasep.)</td></tr>
                    <tr><td>P – Qualischlüssel (kommasep.)</td><td>Q – Personengruppe (PERSGR)</td><td>R – Arbeitsverhältnis gültig von</td></tr>
                    <tr><td>S – Arbeitsverhältnis-Typ (0–3)</td><td>T – Durchschnitt bei Fortführen (0/1)</td><td>U – Arbeitszeit gültig von</td></tr>
                    <tr><td>V – Arbeitszeit gültig bis</td><td>W–AC – Arbeitszeit Mo–So</td><td>AD – Wochenstunden (ARBZEITWCH)</td></tr>
                    <tr><td>AE – Monatsstunden (ARBZEITMON)</td><td>AF – Zeitkonto Plus-Limit</td><td>AG – Zeitkonto Minus-Limit</td></tr>
                    <tr><td>AH – Strasse</td><td>AI – PLZ</td><td>AJ – Ort</td></tr>
                    <tr><td>AK – Land</td><td>AL – Telefon (TEL)</td><td>AM – E-Mail (EMAIL)</td></tr>
                    <tr><td>AN – Strasse2</td><td>AO – PLZ2</td><td>AP – Ort2</td></tr>
                    <tr><td>AQ – Land2</td><td>AR – Telefon2 (TEL2)</td><td>AS – E-Mail2 (EMAIL2)</td></tr>
                    <tr><td>AT – Staatsangehörigkeitsschlüssel (STAATANGEH)</td><td colspan="2">Abgleich mit Nationalitäten-Import</td></tr>
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
            <AppFileDropzone label="Verfügbarkeiten" :file="verfuegbarkeitFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'verfuegbarkeit')" />
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
      <div class="import-section-header" :class="{ 'dev-role--admin': isDev }">
        <i class="fas fa-cogs"></i>
        <h2>System</h2>
      </div>
      <div class="imports-layout">

        <!-- Adressen -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Adressen (Liste 7034)</h2>
              <p class="subtitle">Kunden, Ansprechpartner und Mitarbeiteradressen aus Zvoove</p>
            </div>
            <span v-if="adressenFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Adressen" :file="adressenFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'adressen')" />
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A - Prüffeld (7034)</td><td>B - NUMMER</td><td>C - ART (K, A, P)</td></tr>
                    <tr><td>NAME1, NAME2, BRANCHE</td><td>STRASSE, NAT, PLZ, ORT</td><td>TELEFON1, TELEFON2, LAND</td></tr>
                    <tr><td>ANREDE, KNR, TRANS</td><td>EMAIL</td><td>HOMEPAGE</td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Einsatzorte -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Einsatzorte (Liste 3202)</h2>
              <p class="subtitle">Einsatzorte mit Adresse, Kunde und Standortzuordnung</p>
            </div>
            <span v-if="einsatzortFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Einsatzorte" :file="einsatzortFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'einsatzort')" />
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A - Prüffeld (3202)</td><td>B - AUFTRAGNR</td><td>C - BEZEICHN</td></tr>
                    <tr><td>ADRESSE, ADRESSE_PLZ, ADRESSE_ORT</td><td>ADRESSNAME, BUNDESLAND</td><td>ADRNR</td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Kundenstammdaten -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Kunden (Liste 3203)</h2>
              <p class="subtitle">Kundenstammdaten sowie Post- und Rechnungsanschrift</p>
            </div>
            <span v-if="kundenFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Kunden" :file="kundenFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'kunden')" />
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A - Prüffeld (3203)</td><td>KUNDENNR, KUNDNAME</td><td>ADRNR1, ADRNR2</td></tr>
                    <tr><td>DEBITORKTO, KUNDESEIT, KUNDSTATUS</td><td>SAMMELRECH, USTID</td><td>STEUERNUMMER, HANDELSREGISTERNR, L1RECHGRUPPE</td></tr>
                    <tr><td colspan="3">MWST als letzte Spalte: 0 = MWST-frei, 1 = MWST-pflichtig, 2 = steuerfreie EG-Umsätze, 3 = MWST-frei gem. § 13b UStG</td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

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
            <AppFileDropzone label="Berufe" :file="berufFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'beruf')" />
            <div class="requirements-hint">
              <details>
                <summary>Benötigte Spalten anzeigen</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody><tr><td>Berufnr (Col A)</td><td>Bezeichnung (Col C)</td><td>Tätigkeitsschlüssel (Col D, optional)</td></tr></tbody></table>
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
            <AppFileDropzone label="Qualifikationen" :file="qualifikationFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'qualifikation')" />
            <div class="requirements-hint">
              <details>
                <summary>Benötigte Spalten anzeigen</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody><tr><td>Quali-Nr (Col A)</td><td>Bezeichnung (Col B)</td><td>Beruf-Nr (Col C, optional)</td></tr></tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Nationalitäten -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Nationalitäten</h2>
              <p class="subtitle">Länderschlüssel, Kürzel, Staat und Staatsangehörigkeit</p>
            </div>
            <span v-if="nationalitaetFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Nationalitäten" :file="nationalitaetFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'nationalitaet')" />
            <div class="requirements-hint">
              <details>
                <summary>Benötigte Spalten anzeigen</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody><tr><td>SCHLUESSEL</td><td>NATKENNZ</td><td>STAAT</td><td>STAATANGEH</td><td>STAATSCHL</td></tr></tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Personalnr. Historien -->
        <!-- Lohnarten -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Lohnarten</h2>
              <p class="subtitle">Lohnartenstammdaten aus der Zvoove-Tabelle LOHNART</p>
            </div>
            <span v-if="lohnartFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Lohnarten" :file="lohnartFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'lohnart')" />
            <div class="requirements-hint">
              <details>
                <summary>Benötigte Spalten anzeigen</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody><tr><td>LOHNARTNR</td><td>LOHNARTKUR</td><td>LOHNARTTXT</td><td>Weitere LOHNART-Felder gemäß Export</td></tr></tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Personalnr. Historien -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>70-Tage Vorarbeitgeber</h2>
              <p class="subtitle">Spalte A: Personalnr., Spalte B: bereits genutzte Arbeitstage</p>
            </div>
            <span v-if="vorarbeitgebertageFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="70-Tage Vorarbeitgeber" :file="vorarbeitgebertageFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'vorarbeitgebertage')" />
          </div>
        </div>

        <!-- Personalnr. Historien -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Personalnr. Historien</h2>
              <p class="subtitle">Prüffeld 3201 · Spalte C: kommagetrennte Personalnr-Liste</p>
            </div>
            <span v-if="personalnrHistoryFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Personalnr. Historien" :file="personalnrHistoryFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'personalnr-history')" />
            <div class="requirements-hint">
              <details>
                <summary>Benötigte Spalten anzeigen</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody><tr><td>Prüffeld 3201 (Col A)</td><td>Sozversnr (Col B, ignoriert)</td><td>Personalnr-Blob (Col C, kommagetrennt)</td></tr></tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

      </div>
    </div><!-- End System -->

    <!-- Finanzen Bereich (nur für Admins) -->
    <div v-if="isAdmin" class="import-section">
      <div class="import-section-header" :class="{ 'dev-role--admin': isDev }">
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
            <AppFileDropzone label="Rechnungen" :file="rechnungFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'rechnung')" />
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

        <!-- Kundenpreise Import -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Kundenkonditionen</h2>
              <p class="subtitle">Kundenspezifische Zuschlagsregeln aus KUNDEN_KOND</p>
            </div>
            <span v-if="kundenkonditionFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Kundenkonditionen" :file="kundenkonditionFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'kundenkondition')" />
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>KUNDENNR, TABNR, TABBEZ, LFDNR</td><td>LOHNART, AB, BIS, STD_UHR, JE</td></tr>
                    <tr><td>MONTAG bis FEIERTAG</td><td>PREISNR, PROZENT, VERWENDUNG, PREIS</td></tr>
                    <tr><td>ABSTUNDENGRENZE, NICHTAUTOM</td><td>BRANCHENZUSCHLAGADDIEREN, BERUFSCHL, FID</td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Kundenpreise Import -->
        <div class="import-card">
          <div class="card-header">
            <div class="header-content">
              <h2>Kundenpreise (Liste 3202)</h2>
              <p class="subtitle">Stundenverrechnungspreise pro Kunde und Qualifikation</p>
            </div>
            <span v-if="kundenpreisFile" class="status-indicator ready"><i class="fas fa-check"></i> Bereit</span>
          </div>
          <div class="card-content">
            <AppFileDropzone label="Kundenpreise" :file="kundenpreisFile" accept=".xlsx,.xls" :disabled="loading" @select="setFile($event, 'kundenpreis')" />
            <div class="requirements-hint">
              <details>
                <summary>Erwartete SQL-Export Struktur</summary>
                <div class="table-scroll">
                  <table class="req-table"><tbody>
                    <tr><td>A – Prüffeld (3202)</td><td>B – ID</td><td>C – KUNDENNR</td></tr>
                    <tr><td>D – BERUFSCHL</td><td>E – QUALSCHL</td><td>F – DATUMVON</td></tr>
                    <tr><td>G – DATUMBIS</td><td>H – PREIS1 (EUR/Stunde)</td><td></td></tr>
                  </tbody></table>
                </div>
              </details>
            </div>
          </div>
        </div>

      </div>
    </div><!-- End Finanzen -->

    <div class="actions-bar">
      <AppButton size="lg" :loading="loading" :disabled="!hasAnyFile()" @click="processFiles">
        {{ loading ? 'Import läuft…' : 'Ausgewählte Dateien importieren' }}
      </AppButton>
    </div>


    <!-- Import Result Modal -->
    <ModalFrame
      v-if="showResultModal"
      :title="resultModalData.success ? 'Import-Ergebnis' : 'Import mit Warnungen'"
      size="lg"
      style="--mf-max-width: 700px; --mf-max-height: 80vh; --mf-body-padding: 0"
      :show-close="!assigningNow"
      :close-on-backdrop="!assigningNow"
      :close-on-escape="!assigningNow"
      @close="closeModal"
    >
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

          <div v-if="resultModalData.details?.personalnrConflicts?.length > 0" class="section conflicts-section">
            <h3>⚠️ Doppelte Personalnummern</h3>
            <div class="conflict-list">
              <div v-for="conflict in resultModalData.details.personalnrConflicts" :key="conflict.personalnr" class="conflict-item">
                <strong>Personalnr {{ conflict.personalnr }}</strong>
                <p v-for="owner in conflict.owners" :key="owner.id">
                  {{ owner.name || 'Unbekannter Mitarbeiter' }} · ID: <code>{{ owner.id }}</code> · Primär: <code>{{ owner.personalnr || 'keine' }}</code>
                </p>
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
                <AppButton
                  v-if="!assigningEntry || assigningEntry.email !== entry.email"
                  variant="secondary"
                  size="sm"
                  :disabled="assigningNow"
                  @click="startAssign(entry)"
                >
                  Mitarbeiter suchen
                </AppButton>
                
                <!-- Search & Assign UI -->
                <div v-if="assigningEntry?.email === entry.email" class="assign-panel">
                  <AppTextInput
                    v-model="searchQuery"
                    type="text"
                    placeholder="Name suchen..."
                    aria-label="Mitarbeiter für E-Mail-Zuordnung suchen"
                    :disabled="assigningNow"
                    @update:model-value="searchMitarbeiter($event)"
                  />
                  <AppButton variant="ghost" size="sm" :disabled="assigningNow" @click="cancelAssign">Abbrechen</AppButton>
                  
                  <div v-if="searchResults.length > 0" class="search-results">
                    <button
                      v-for="ma in searchResults" 
                      :key="ma._id" 
                      type="button"
                      class="search-result-item"
                      :disabled="assigningNow"
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
                    </button>
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

      <template #footer>
        <AppButton variant="secondary" :disabled="assigningNow" @click="closeModal">Schließen</AppButton>
      </template>
    </ModalFrame>
  </div>
  </PageLayout>
</template>

<script>
import api from "../utils/api";
import { useAuth } from "../stores/auth";
import { useDataCache } from "../stores/dataCache";
import * as XLSX from 'xlsx';
import PageLayout from '@/components/layout/PageLayout.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';

export default {
  name: "DatenImport",
  components: { PageLayout, ModalFrame, AppButton, AppTextInput, AppFileDropzone },
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

      isDev: import.meta.env.DEV,
      einsatzFile: null,
      personalFile: null,
      verfuegbarkeitFile: null,
      berufFile: null,
      qualifikationFile: null,
      nationalitaetFile: null,
      lohnartFile: null,
      rechnungFile: null,
      kundenpreisFile: null,
      kundenkonditionFile: null,
      personalnrHistoryFile: null,
      vorarbeitgebertageFile: null,
      adressenFile: null,
      einsatzortFile: null,
      kundenFile: null,
      loading: false,
      // Modal state
      showResultModal: false,
      resultModalData: {},
      // Assign feature state
      assigningEntry: null,
      searchQuery: "",
      searchResults: [],
      searching: false,
      searchRequestId: 0,
      assigningNow: false,
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
        kunden: 'Kunden',
        einsatz: 'Einsätze (Legacy)',
        'einsatz-komplett': 'Zvoove Komplett Import',
        personal: 'Personal',
        adressen: 'Adressen',
        einsatzort: 'Einsatzorte',
        verfuegbarkeit: 'Verfügbarkeiten',
        beruf: 'Berufe',
        qualifikation: 'Qualifikationen',
        nationalitaet: 'Nationalitäten',
        lohnart: 'Lohnarten',
        rechnung: 'Rechnungen',
        kundenpreis: 'Kundenpreise',
        kundenkondition: 'Kundenkonditionen',
        'personalnr-history': 'Personalnr. Historien',
        vorarbeitgebertage: '70-Tage Vorarbeitgeber',
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
    async setFile(file, type) {
      if (this.loading) return;
      // Validate Prüffeld for einsatz/personal imports
      const expectedCode = type === 'einsatz' ? 7001 : type === 'personal' ? 7002 : type === 'verfuegbarkeit' ? 7003 : type === 'adressen' ? 7034 : type === 'einsatzort' ? 3202 : type === 'kunden' ? 3203 : type === 'rechnung' ? 6001 : type === 'kundenpreis' ? 3202 : type === 'personalnr-history' ? 3201 : null;
      if (expectedCode) {
        const valid = await this.validatePrueffeld(file, expectedCode);
        if (!valid) return;
      }
      if (type === 'einsatz') this.einsatzFile = file;
      if (type === 'personal') this.personalFile = file;
      if (type === 'verfuegbarkeit') this.verfuegbarkeitFile = file;
      if (type === 'beruf') this.berufFile = file;
      if (type === 'qualifikation') this.qualifikationFile = file;
      if (type === 'nationalitaet') this.nationalitaetFile = file;
      if (type === 'lohnart') this.lohnartFile = file;
      if (type === 'rechnung') this.rechnungFile = file;
      if (type === 'kundenpreis') this.kundenpreisFile = file;
      if (type === 'kundenkondition') this.kundenkonditionFile = file;
      if (type === 'personalnr-history') this.personalnrHistoryFile = file;
      if (type === 'vorarbeitgebertage') this.vorarbeitgebertageFile = file;
      if (type === 'adressen') this.adressenFile = file;
      if (type === 'einsatzort') this.einsatzortFile = file;
      if (type === 'kunden') this.kundenFile = file;
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
            if (!(Array.isArray(expectedCode) ? expectedCode : [expectedCode]).includes(prueffeld)) {
              const labels = { 7001: 'Einsatz-Komplett (Liste 7001)', 7002: 'Personal (Liste 7002)', 7003: 'Verfügbarkeiten (Liste 7003)', 7034: 'Adressen (Liste 7034)', 6001: 'Rechnungen (Liste 6001)', 3201: 'Personalnr-Historien (Liste 3201)', 3202: 'Einsatzorte / Kundenpreise', 3203: 'Kunden' };
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
      if (this.loading) return;
      if (!this.hasAnyFile()) {
        alert("Bitte wählen Sie zuerst mindestens eine Datei aus.");
        return;
      }

      const adminFiles = this.isAdmin ? [this.adressenFile, this.einsatzortFile, this.kundenFile, this.berufFile, this.qualifikationFile, this.nationalitaetFile, this.lohnartFile, this.rechnungFile, this.kundenpreisFile, this.kundenkonditionFile, this.personalnrHistoryFile, this.vorarbeitgebertageFile] : [];
      const fileCount = [this.einsatzFile, this.personalFile, this.verfuegbarkeitFile, ...adminFiles].filter(Boolean).length;
      if (!confirm(`Import von ${fileCount} Datei(en) wirklich starten? Es kann einige Sekunden dauern.`)) return;

      this.loading = true;
      const results = [];
      let hasErrors = false;

      try {
        // Upload all selected files
        // Personal resolves Beruf/Qualifikation keys against these master lists.
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

        if (this.nationalitaetFile && this.isAdmin) {
          const response = await this.uploadFile(this.nationalitaetFile, 'nationalitaet');
          results.push({ type: 'Nationalitäten', ...response });
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

        if (this.verfuegbarkeitFile) {
          const response = await this.uploadFile(this.verfuegbarkeitFile, 'verfuegbarkeit');
          results.push({ type: 'Verfügbarkeiten', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.adressenFile && this.isAdmin) {
          const response = await this.uploadFile(this.adressenFile, 'adressen');
          results.push({ type: 'Adressen', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.einsatzortFile && this.isAdmin) {
          const response = await this.uploadFile(this.einsatzortFile, 'einsatzorte');
          results.push({ type: 'Einsatzorte', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.kundenFile && this.isAdmin) {
          const response = await this.uploadFile(this.kundenFile, 'kunden');
          results.push({ type: 'Kunden', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.lohnartFile && this.isAdmin) {
          const response = await this.uploadFile(this.lohnartFile, 'lohnart');
          results.push({ type: 'Lohnarten', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.rechnungFile && this.isAdmin) {
          const response = await this.uploadFile(this.rechnungFile, 'rechnung');
          results.push({ type: 'Rechnungen', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.kundenpreisFile && this.isAdmin) {
          const response = await this.uploadFile(this.kundenpreisFile, 'kundenpreis');
          results.push({ type: 'Kundenpreise', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.kundenkonditionFile && this.isAdmin) {
          const response = await this.uploadFile(this.kundenkonditionFile, 'kundenkondition');
          results.push({ type: 'Kundenkonditionen', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.personalnrHistoryFile && this.isAdmin) {
          const response = await this.uploadFile(this.personalnrHistoryFile, 'personalnr-history');
          results.push({ type: 'Personalnr. Historien', ...response });
          if (!response.success) hasErrors = true;
        }

        if (this.vorarbeitgebertageFile && this.isAdmin) {
          const response = await this.uploadFile(this.vorarbeitgebertageFile, 'vorarbeitgebertage');
          results.push({ type: '70-Tage Vorarbeitgeber', ...response });
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
        pnrUpdatedList: [],
        personalnrConflicts: []
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
          if (result.details.personalnrConflicts && Array.isArray(result.details.personalnrConflicts)) {
            combinedArrays.personalnrConflicts.push(...result.details.personalnrConflicts);
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
          pnrUpdatedList: combinedArrays.pnrUpdatedList,
          personalnrConflicts: combinedArrays.personalnrConflicts
        }
      };
    },
    async uploadFile(file, endpointSuffix) {
      const formData = new FormData();
      if (endpointSuffix === 'einsatz' || endpointSuffix === 'personal') {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        formData.append('excelColumnCount', String(range.e.c + 1));
      }
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
          message: `${file.name}: ${error.response?.data?.message || error.message || "Unbekannter Fehler"}`,
          details: error.response?.data?.details || {}
        };
      }
    },
    closeModal() {
      if (this.assigningNow) return;
      this.showResultModal = false;
      this.resultModalData = {};
      this.cancelAssign();
    },
    startAssign(entry) {
      this.cancelAssign();
      this.assigningEntry = entry;
    },
    cancelAssign() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
      this.searchRequestId += 1;
      this.assigningEntry = null;
      this.searchQuery = "";
      this.searchResults = [];
      this.searching = false;
    },
    searchMitarbeiter(query = this.searchQuery) {
      this.searchQuery = query;
      // Debounce search
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      const requestId = ++this.searchRequestId;
      
      if (this.searchQuery.length < 2) {
        this.searchResults = [];
        return;
      }
      
      this.searchTimeout = setTimeout(async () => {
        this.searching = true;
        try {
          const response = await api.get('/api/personal/mitarbeiter');
          if (requestId !== this.searchRequestId) return;
          const query = this.searchQuery.toLowerCase();
          this.searchResults = (response.data?.data || [])
            .filter(ma => {
              const fullName = `${ma.vorname} ${ma.nachname}`.toLowerCase();
              return fullName.includes(query) || ma.email?.toLowerCase().includes(query);
            })
            .slice(0, 10); // Limit to 10 results
        } catch (error) {
          if (requestId !== this.searchRequestId) return;
          console.error("Search error:", error);
          this.searchResults = [];
        } finally {
          if (requestId === this.searchRequestId) this.searching = false;
        }
      }, 300);
    },
    async assignEntryToMitarbeiter(entry, mitarbeiter) {
      if (this.assigningNow) return;
      this.assigningNow = true;
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
      } finally {
        this.assigningNow = false;
      }
    },
    // ... assign methods ... same as before ... 
    
    resetAll() {
      this.einsatzFile = null;
      this.personalFile = null;
      this.verfuegbarkeitFile = null;
      this.berufFile = null;
      this.qualifikationFile = null;
      this.nationalitaetFile = null;
      this.lohnartFile = null;
      this.rechnungFile = null;
      this.kundenpreisFile = null;
      this.kundenkonditionFile = null;
      this.personalnrHistoryFile = null;
      this.vorarbeitgebertageFile = null;
      this.adressenFile = null;
      this.einsatzortFile = null;
      this.kundenFile = null;
      this.fetchLastUploads();
    },
    hasAnyFile() {
      const adminFiles = this.isAdmin ? (this.adressenFile || this.einsatzortFile || this.kundenFile || this.berufFile || this.qualifikationFile || this.nationalitaetFile || this.lohnartFile || this.rechnungFile || this.kundenpreisFile || this.kundenkonditionFile || this.personalnrHistoryFile || this.vorarbeitgebertageFile) : false;
      return this.einsatzFile || this.personalFile || this.verfuegbarkeitFile || adminFiles;
    },

  },

  mounted() {
    this.fetchLastUploads();
  },
  beforeUnmount() {
    clearTimeout(this.searchTimeout);
    this.searchRequestId += 1;
  }
};
</script>

<style scoped lang="scss">
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
  width: min(900px, 100%);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 30px;
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial;

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
  
}

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .window {
    width: 100%;
    margin: 0;
    padding: 20px;
  }
  .actions-bar :deep(.app-button) { width: 100%; }
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
  
}

.assign-panel {
  width: 100%;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  :deep(.app-text-input) {
    flex: 1;
    min-width: 200px;
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
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: var(--panel);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: var(--hover);
  }
  &:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: -2px; }
  &:disabled { opacity: .6; cursor: wait; }
  
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

</style>
