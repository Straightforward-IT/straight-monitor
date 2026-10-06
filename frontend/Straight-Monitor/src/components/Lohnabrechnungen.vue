<template>
  <PageLayout title="Lohnabrechnungen" width="standard" content-variant="flush">
  <div class="window">
<div class="info-box">
  <p><strong>⚠ Bitte beachten:</strong> Die Excel-Datei muss folgende Spalten enthalten:</p>
  <table class="sample-table">
    <thead>
      <tr>
        <th>Personalnr</th>
        <th>Nachname</th>
        <th>Vorname</th>
        <th>Austritt</th>
        <th>Email</th>
      </tr>
    </thead>
  </table>
</div>

    <div class="upload-section">
      <div class="dropdowns">
        <div class="dropdown-group">
          <label for="payroll-document-type">Dokumenttyp:</label>
          <AppSelect id="payroll-document-type" v-model="dokumentart" :disabled="loading">
            <option value="LA">Lohnabrechnung</option>
            <option value="LST">Lohnsteuerbescheid</option>
          </AppSelect>
        </div>
        
        <div class="dropdown-group" v-if="dokumentart === 'LST'">
          <AppToggleChip v-model="ganzesJahr" label="Ganzes Jahr" accessible-label="Ganzes Jahr" :disabled="loading" />
        </div>

        <div class="dropdown-group">
          <label for="payroll-city">Stadt:</label>
          <AppSelect id="payroll-city" v-model="stadt" :disabled="loading">
            <option value="B">Berlin</option>
            <option value="HH">Hamburg</option>
            <option value="K">Köln</option>
          </AppSelect>
        </div>

        <div class="dropdown-group" v-if="!ganzesJahr">
          <label for="payroll-month">Monat:</label>
          <AppSelect id="payroll-month" v-model="monat" :disabled="loading">
            <option
              v-for="m in 12"
              :key="m"
              :value="String(m).padStart(2, '0')"
            >
              {{ String(m).padStart(2, "0") }}
            </option>
          </AppSelect>
        </div>

        <div class="dropdown-group">
          <label for="payroll-year">Jahr:</label>
          <AppSelect id="payroll-year" v-model="jahr" :disabled="loading">
            <option v-for="y in availableYears" :key="y" :value="String(y)">
              {{ y }}
            </option>
          </AppSelect>
        </div>

        <div class="dropdown-group">
          <AppToggleChip v-model="testMode" label="Testmodus (E-Mails an IT)" accessible-label="Testmodus (E-Mails an IT)" :disabled="loading" />
        </div>
      </div>

      <div class="drag-drop-area" @dragover.prevent @drop.prevent="handleDrop">
        PDF und Excel hierher ziehen
      </div>

      <div class="button-group">
        <AppButton variant="secondary" :disabled="loading" @click="$refs.pdfUploadInput?.click()">PDF auswählen</AppButton>
        <input
          id="pdf-upload"
          ref="pdfUploadInput"
          type="file"
          aria-label="PDF-Datei für Lohnabrechnungen auswählen"
          :disabled="loading"
          @change="handlePdfUpload"
          accept="application/pdf"
        />

        <AppButton variant="secondary" :disabled="loading" @click="$refs.excelUploadInput?.click()">Excel auswählen</AppButton>
        <input
          id="excel-upload"
          ref="excelUploadInput"
          type="file"
          aria-label="Excel-Datei für Lohnabrechnungen auswählen"
          :disabled="loading"
          @change="handleExcelUpload"
          accept=".xlsx, .xls"
        />
      </div>
    </div>

    <div class="file-name">
      <p>
        PDF: <strong>{{ pdfName }}</strong>
      </p>
      <p>
        Excel: <strong>{{ excelName }}</strong>
      </p>
      <p v-if="fileCountValid === false" class="error" role="alert">
        ⚠ Anzahl Seiten und Zeilen stimmen nicht überein.
      </p>
    </div>

    <div class="actions">
      <AppButton variant="secondary" @click="openPreview" :disabled="!readyToSplit || loading">
        Vorschau 👁️
      </AppButton>
      <AppButton :loading="loading" :disabled="!readyToSplit" @click="startSplitting">
        Versenden 📧
      </AppButton>
    </div>
    

    <!-- Preview Modal -->
    <ModalFrame
      v-if="showPreviewModal"
      :title="`Vorschau Seite ${previewPageNum} von ${previewTotalPages}`"
      size="full"
      style="--mf-max-width: min(1400px, 95vw); --mf-max-height: 90vh; --mf-body-padding: 0; --mf-body-overflow: hidden"
      @close="closePreview"
    >
        
        <div class="preview-body-split">
            <!-- Left: Canvas Area with Pan/Zoom -->
            <div 
                class="canvas-wrapper" 
                @mousedown="startPan" 
                @mousemove="doPan" 
                @mouseup="endPan" 
                @mouseleave="endPan"
                @wheel.prevent="handleWheel"
            >
               <div :style="canvasTransformStyle" class="canvas-transform-box">
                  <canvas ref="theCanvas"></canvas>
               </div>
            </div>
            
            <!-- Right: Sidebar -->
            <div class="sidebar">
                <!-- Search -->
                <div class="sidebar-section">
                    <label>Suche</label>
                    <div class="search-box">
                        <AppTextInput
                            type="text" 
                            v-model="searchQuery" 
                            aria-label="Name in Lohnabrechnungen suchen"
                            @keyup.enter="performSearch" 
                            placeholder="Name..." 
                        />
                        <AppButton size="sm" @click="performSearch">Suchen</AppButton>
                    </div>
                </div>

                <!-- Excel Match Info -->
                <div class="sidebar-section">
                    <label>Excel Zuordnung</label>
                    <div class="excel-card" v-if="excelData[previewPageNum - 1]">
                        <div class="card-row">
                            <span>Name:</span>
                            <strong>{{ excelData[previewPageNum - 1][2] }} {{ excelData[previewPageNum - 1][1] }}</strong>
                        </div>
                        <div class="card-row">
                             <span>Email:</span>
                             <strong :title="excelData[previewPageNum - 1][4]" class="truncate-text">{{ excelData[previewPageNum - 1][4] }}</strong>
                        </div>
                    </div>
                    <div class="excel-card error" v-else>
                        <p>⚠ Keine Daten</p>
                    </div>
                </div>

                <!-- Zoom Controls -->
                <div class="sidebar-section">
                    <label>Ansicht</label>
                    <div class="zoom-controls">
                        <AppIconButton variant="ghost" size="sm" label="Vorschau verkleinern" @click="zoomOut">−</AppIconButton>
                        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
                        <AppIconButton variant="ghost" size="sm" label="Vorschau vergrößern" @click="zoomIn">+</AppIconButton>
                    </div>
                    <AppButton variant="secondary" size="sm" block @click="resetView">Ansicht zurücksetzen</AppButton>
                </div>
            </div>
        </div>

      <template #footer>
        <div class="preview-footer-controls">
            <AppButton variant="secondary" size="sm" @click="prevPage" :disabled="previewPageNum <= 1">← Zurück</AppButton>
            <span class="page-indicator">{{ previewPageNum }} / {{ previewTotalPages }}</span>
            <AppButton variant="secondary" size="sm" @click="nextPage" :disabled="previewPageNum >= previewTotalPages">Weiter →</AppButton>
        </div>
      </template>
    </ModalFrame>

    <!-- Fortschrittsbalken -->
    <div v-if="progressActive" class="progress-wrapper">
      <p v-if="progressMessage">{{ progressMessage }}</p>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
    </div>

    <div v-if="loading" class="loader">
      ⏳ Bitte warten – PDF wird verarbeitet ...
    </div>

  </div>
  </PageLayout>
</template>

<script>
import * as XLSX from "xlsx";
import api from "../utils/api";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { markRaw } from "vue";
import PageLayout from '@/components/layout/PageLayout.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppToggleChip from '@/components/ui-elements/AppToggleChip.vue';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default {
  name: "Lohnabrechnungen",
  components: { PageLayout, ModalFrame, AppButton, AppIconButton, AppSelect, AppTextInput, AppToggleChip },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userLocation: "",
      pdfFile: null,
      excelFile: null,
      excelData: [],
      
      // Preview States
      showPreviewModal: false,
      previewPageNum: 1,
      previewTotalPages: 0,
      previewPdfDoc: null,
      previewCanvas: null,
      currentPerson: null,
      previewError: null,
      searchQuery: "",
      
      // Zoom & Pan
      scale: 1.5,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      panX: 0,
      panY: 0,

      pdfName: "",
      excelName: "",
      stadt: "HH",
      monat: "01",
      jahr: String(new Date().getFullYear()),
      dokumentart: "LA",
      ganzesJahr: false,
      testMode: false,
      fileCountValid: null,
      loading: false,

      // Für SSE Fortschritt
      progressActive: false,
      progressPercent: 0,
      progressMessage: "",
    };
  },
  computed: {
    readyToSplit() {
      return this.pdfFile && this.excelData.length > 0;
    },
    stadtFullName() {
      const map = {
        HH: "Hamburg",
        B: "Berlin",
        K: "Köln",
      };
      return map[this.stadt] || "Unbekannt";
    },
    availableYears() {
      const current = new Date().getFullYear();
      return [current, current - 1, current + 1];
    },
    canvasTransformStyle() {
      // Panning shifts the canvas
      return {
        transform: `translate(${this.panX}px, ${this.panY}px)`,
        cursor: this.isPanning ? "grabbing" : "grab",
        transformOrigin: "top left"
      };
    }
  },
  methods: {
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me", {});
          this.userID = response.data._id;
          this.userLocation = response.data.location;
        } catch (error) {
          console.error("Error fetching user data:", error);
          this.$router.push("/");
        }
      } else {
        console.error("No token found");
        this.$router.push("/");
      }
    },
    switchToDashboard() {
      if (confirm("Zurück zur Startseite?")) this.$router.push("/");
    },
    preventBrowserDefault(event) {
      event.preventDefault();
      event.stopPropagation();
    },
    handlePdfUpload(e) {
      if (this.loading || !e.target.files?.[0]) return;
      this.pdfFile = e.target.files[0];
      this.pdfName = this.pdfFile.name;
    },
    handleExcelUpload(e) {
      if (this.loading || !e.target.files?.[0]) return;
      const file = e.target.files[0];
      this.excelFile = file;
      this.excelName = file.name;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        this.excelData = rows.slice(1);
        this.validateCounts();
      };
      reader.readAsArrayBuffer(file);
    },
    async openPreview() {
      if (!this.pdfFile || !this.excelData.length || this.loading) return;
      this.showPreviewModal = true;
      this.previewPageNum = 1;

      // Reset view on fresh open
      this.resetView();

      try {
        const arrayBuffer = await this.pdfFile.arrayBuffer();
        
        // Use TypedArray directly to avoid issues
        const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
        
        const pdf = await loadingTask.promise;
        this.previewPdfDoc = markRaw(pdf);
        this.previewTotalPages = pdf.numPages;
        
        this.$nextTick(() => {
             this.renderPage(this.previewPageNum);
        });
       
      } catch (err) {
        console.error("Fehler beim Laden der PDF Vorschau:", err);
        // Fallback: Worker manuell setzen falls CDN fehlschlägt
        if(err.name === 'MissingPDFException' || err.message.includes('worker')) {
             alert("PDF Worker konnte nicht geladen werden. Bitte Seite neu laden.");
        } else {
             alert("Konnte PDF nicht laden: " + err.message);
        }
        this.showPreviewModal = false;
      }
    },
    async renderPage(num) {
      if (!this.previewPdfDoc) return;
      
      this.previewPageNum = num;
      // Personendaten aus Excel holen (Array ist 0-basiert, PageNum 1-basiert)
      const personIndex = num - 1;
      if (personIndex < this.excelData.length) {
         const row = this.excelData[personIndex];
         this.currentPerson = {
             nachname: row[1],
             vorname: row[2],
             email: row[4]
         };
      } else {
         this.currentPerson = null; 
      }

      const page = await this.previewPdfDoc.getPage(num);
      
      const canvas = this.$refs.theCanvas;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      // Use current user-defined scale for rendering quality
      const viewport = page.getViewport({ scale: this.scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    },
    
    // Zoom & Pan Logic
    resetView() {
        this.scale = 1.0; // Standard 100%
        this.panX = 0;
        this.panY = 0;
        if(this.previewPdfDoc) this.renderPage(this.previewPageNum);
    },
    handleWheel(e) {
        if (e.ctrlKey) {
             // Zoom logic for pinch-to-zoom or Ctrl+Scroll
             if (e.deltaY < 0) this.zoomIn();
             else this.zoomOut();
        } else {
             // Standard scroll -> pan
             // Invert deltaY for natural scrolling feeling or direct map? Usually wheel down moves document up -> panY decreases.
             this.panY -= e.deltaY;
             this.panX -= e.deltaX;
        }
    },
    zoomIn() {
        if(this.scale < 3.0) {
            this.scale += 0.25;
            this.renderPage(this.previewPageNum);
        }
    },
    zoomOut() {
        if(this.scale > 0.5) {
            this.scale -= 0.25;
            this.renderPage(this.previewPageNum);
        }
    },
    
    // Panning (Drag Mouse)
    startPan(e) {
        this.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        e.preventDefault(); // Prevent text selection
    },
    doPan(e) {
        if (!this.isPanning) return;
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
    },
    endPan() {
        this.isPanning = false;
    },

    performSearch() {
      if (!this.searchQuery) return;
      const q = this.searchQuery.toLowerCase();

      // Suche in excelData nach Namen (Index 1=Nachname, 2=Vorname)
      const index = this.excelData.findIndex((row) => {
        const fullName = ((row[1] || "") + " " + (row[2] || "")).toLowerCase();
        // Auch umgekehrt prüfen (Vorname Nachname)
        const reversedName = ((row[2] || "") + " " + (row[1] || "")).toLowerCase();
        
        return fullName.includes(q) || reversedName.includes(q);
      });

      if (index >= 0) {
         // PageNum ist 1-basiert, Index 0-basiert
         this.renderPage(index + 1);
      } else {
         alert("Mitarbeiter nicht gefunden.");
      }
    },
    prevPage() {
      if (this.previewPageNum <= 1) return;
      this.renderPage(this.previewPageNum - 1);
    },
    nextPage() {
      if (this.previewPageNum >= this.previewTotalPages) return;
      this.renderPage(this.previewPageNum + 1);
    },
    closePreview() {
        this.showPreviewModal = false;
        this.previewPdfDoc = null;
    },
    handleDrop(e) {
      if (this.loading) return;
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (file.type === "application/pdf")
          this.handlePdfUpload({ target: { files: [file] } });
        else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))
          this.handleExcelUpload({ target: { files: [file] } });
      });
    },
    validateCounts() {
      this.fileCountValid = null; // placeholder
    },
    startSplitting() {
      if (!this.pdfFile || !this.excelData.length || this.loading) return;

      this.loading = true;

      // ⚡ Connect SSE BEFORE the upload POST so the progressMap entry exists
      // when the backend starts sending emails.
      this.listenToMailProgress();

      const formData = new FormData();
      formData.append("pdf", this.pdfFile);
      formData.append("excel", this.excelFile);
      formData.append("stadt", this.stadt);
      formData.append("monat", this.monat);
      formData.append("jahr", this.jahr);
      formData.append("dokumentart", this.dokumentart);
      formData.append("ganzesJahr", this.ganzesJahr);
      formData.append("testMode", this.testMode);
      formData.append("stadt_full", this.stadtFullName);

      api
        .post("/api/personal/upload-lohnabrechnungen", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "x-auth-token": this.token,
          },
          responseType: "blob", // ⬅️ wichtig! sonst wird die ZIP nicht richtig empfangen
        })
        .then((res) => {
          const blob = res.data;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const suffix = this.ganzesJahr ? this.jahr : `${this.monat}_${this.jahr}`;
          a.download = `Lohnabrechnungen_${this.stadt}_${suffix}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        })
        .catch((err) => {
          const msg = err?.response?.data || err.message;
          alert("❌ Fehler: " + msg);
          console.error("Fehler beim Aufteilen:", err);
        })
        .finally(() => {
          this.loading = false;
        });
    },


    listenToMailProgress() {
      this.progressActive = true;
      this.progressPercent = 0;
      this.progressMessage = "📤 Versand gestartet ...";

      // Strip any trailing slash from the base URL to avoid double-slash paths
      const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
      const url = `${base}/api/personal/sse-mailstatus?token=${this.token}`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (e) => {
        const [index, totalName] = e.data.split(" ");
        const [current, total] = index.split("/").map(Number);
        this.progressPercent = Math.floor((current / total) * 100);
        this.progressMessage = `📧 ${current}/${total}: ${totalName}`;
      };

      eventSource.addEventListener("done", (e) => {
        this.progressMessage = "✅ Alle E-Mails verschickt!";
        this.progressPercent = 100;
        setTimeout(() => {
          this.progressActive = false;
        }, 4000);
        eventSource.close();
      });

      eventSource.onerror = (err) => {
        console.warn("SSE-Fehler:", err);
        eventSource.close();
      };
    }

  },
  mounted() {
  this.setAxiosAuthToken();
  this.fetchUserData().then(() => {
    // Stadt zuordnen nach userLocation
    const reverseMap = {
      Hamburg: "HH",
      Berlin: "B",
      Köln: "K",
    };
    if (this.userLocation && reverseMap[this.userLocation]) {
      this.stadt = reverseMap[this.userLocation];
    }

    // Monat: immer den VORHERIGEN Monat auswählen
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const padded = String(lastMonth.getMonth() + 1).padStart(2, "0");
    this.monat = padded;
  });

  window.addEventListener("dragover", this.preventBrowserDefault);
  window.addEventListener("drop", this.preventBrowserDefault);
},

  beforeUnmount() {
    // Für Vue 2 oder vor Vue 3.2; für Vue 3.2+ 'unmounted'
    window.removeEventListener("dragover", this.preventBrowserDefault);
    window.removeEventListener("drop", this.preventBrowserDefault);
  },
};
</script>

<style scoped lang="scss">
.window{
  width: min(720px, 100%);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 28px;
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
  text-align:center;

}

.leftAlign{ text-align:left; margin-bottom: 12px; }
.discrete{
  display:inline-block; padding:6px 10px;
  color: var(--muted); text-decoration:none; font-weight:500;
  transition: color .2s ease;
}
.discrete:hover{ color: var(--primary); }

.info-box{
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
  text-align:left;
  color: var(--text);
  font-size:.95rem;
}

.sample-table{
  width:100%; border-collapse:collapse; table-layout:fixed; margin-top:8px;
  th{
    padding:10px; border:1px solid var(--border);
    font-size:.85rem; text-align:center; white-space:nowrap; color: var(--text);
    background: var(--hover);
  }
}

.upload-section{
  background: var(--panel);
  border:1px solid var(--border);
  border-radius:10px;
  padding: 18px;
  margin-bottom: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);

  .dropdowns{
    display:flex; flex-wrap:wrap; gap:16px 24px; justify-content:center; margin-bottom:14px;
  }
  .dropdown-group{
    display:flex; flex-direction:column; gap:6px; align-items:flex-start;
    label{ font-weight:500; color: var(--text); }
    :deep(.app-select){ min-width: 120px; }
  }

  .drag-drop-area{
    width:100%; height:120px; margin-top:10px;
    border:2px dashed var(--border); border-radius:10px;
    display:flex; align-items:center; justify-content:center;
    color: var(--muted); background: var(--tile-bg);
    cursor:pointer; transition: background .2s, border-color .2s, color .2s;

    &:hover{ background: var(--hover); border-color: var(--primary); color: var(--text); }
    &:active{ background: color-mix(in oklab, var(--hover) 60%, var(--tile-bg)); }
  }

  .button-group{
    display:flex; flex-direction:column; gap:12px; margin-top:16px;
    :deep(.app-button){ width: 100%; }
  }

  input[type="file"]{ display:none; }
}

.file-name{
  margin: 18px 0 22px; font-size:.95rem;
  background: var(--panel); border:1px solid var(--border);
  border-radius:10px; padding:12px; color: var(--muted);
  box-shadow: 0 1px 3px rgba(0,0,0,.03);

  p{ margin:6px 0; }
  strong{ color: var(--text); }
  .error{ color: var(--status-danger-text); font-weight:600; }
}

.actions{
  display: flex;
  gap: 12px;
  justify-content: center;
}

.loader{
  margin-top: 14px; font-size:1rem; color: var(--muted); font-weight:500;
}

.progress-wrapper{
  margin-top: 18px; text-align:left; color: var(--text); font-size:.95rem;
}

.progress-bar{
  height: 14px; width: 100%; border-radius:10px; overflow:hidden; margin-top:6px;
  background: var(--hover); box-shadow: inset 0 1px 3px rgba(0,0,0,.08);
}
.progress-fill{
  height:100%; width:0;
  background: var(--primary); /* gern auf --success umstellen, wenn du es global definierst */
  transition: width .35s ease;
}


.preview-body-split {
   flex: 1;
   display: flex;
   overflow: hidden;
   position: relative;
}

/* Left: Interactive Canvas */
.canvas-wrapper {
   flex: 1;
   background: var(--bg-body, #1a1a1a); /* Dark background for contrast */
   overflow: hidden; /* Hide overflow, we handle pan via transform */
   position: relative;
   cursor: grab;
   display: flex;
   align-items: center;
   justify-content: center;
   
   &:active { cursor: grabbing; }
}

.canvas-transform-box {
   transition: transform 0.1s ease-out; /* Smooth feeling */
   box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

/* Right: Sidebar */
.sidebar {
   width: 320px;
   background: var(--panel);
   border-left: 1px solid var(--border);
   display: flex;
   flex-direction: column;
   padding: 20px;
   gap: 24px;
   overflow-y: auto;
   z-index: 2;
}

.sidebar-section {
    label {
        display: block;
        margin-bottom: 8px;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
        font-weight: 600;
    }
}

.search-box {
    display: flex; 
    gap: 8px;
    :deep(.app-text-input) { flex: 1; min-width: 0; }
}

.excel-card {
    background: var(--tile-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    
    &.error {
        border-color: var(--status-danger-text);
        color: var(--status-danger-text);
    }
    
    .card-row {
        display: flex; 
        justify-content: space-between; 
        margin-bottom: 8px;
        font-size: 0.95rem;
        
        span { color: var(--muted); }
        strong { color: var(--text); max-width: 60%; text-align: right; }
        
        &:last-child { margin-bottom: 0; }
    }
}

.truncate-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    vertical-align: bottom;
}

/* Zoom Controls */
.zoom-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--tile-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 8px;
    
    .zoom-level {
       font-weight: 600;
       font-size: 0.9rem;
    }
}

.preview-footer-controls { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 8px; }
.page-indicator { font-weight: 600; color: var(--text); }

@media (max-width: 768px) {
  .window {
    width: 100%;
    margin: 0;
    padding: 20px;
  }
  
  .info-box {
    padding: 12px;
    margin-bottom: 16px;
    font-size: 0.9rem;
  }
  
  .sample-table th {
    padding: 6px 4px;
    font-size: 0.75rem;
  }
  
  .upload-section {
    padding: 14px;
    
    .dropdowns {
      flex-direction: column;
      gap: 12px;
      margin-bottom: 12px;
      
      .dropdown-group {
        width: 100%;
        
        :deep(.app-select) {
          width: 100%;
          font-size: 16px; /* Verhindert Auto-Zoom auf iOS */
        }
      }
    }
    
    .drag-drop-area {
      height: 100px;
      font-size: 1rem;
      margin-top: 8px;
    }
    
    .button-group {
      gap: 10px;
      
      :deep(.app-button) { font-size: 16px; }
    }
  }
  
  .file-name {
    margin: 14px 0 18px;
    padding: 10px;
    font-size: 0.9rem;
    
    p {
      margin: 4px 0;
    }
  }
  
  .actions :deep(.app-button) {
    font-size: 16px; /* Verhindert Auto-Zoom */
    width: 100%;
  }
  
  .progress-wrapper {
    margin-top: 14px;
    font-size: 0.9rem;
  }
  
  .progress-bar {
    height: 12px;
    border-radius: 8px;
  }
  
  .loader {
    margin-top: 12px;
    font-size: 0.9rem;
  }
}

/* Kleine Mobile Geräte */
@media (max-width: 480px) {
  .window {
    width: 100%;
    margin: 0;
    padding: 16px;
  }
  
  .upload-section {
    padding: 12px;
    
    .drag-drop-area {
      height: 80px;
      font-size: 0.9rem;
    }
    
  }
  
  .sample-table th {
    padding: 4px 2px;
    font-size: 0.7rem;
  }
  
}
</style>
