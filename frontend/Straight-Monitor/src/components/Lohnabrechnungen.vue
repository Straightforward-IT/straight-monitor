<template>
  <div class="window">
    <h1>Lohnabrechnungen</h1>
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
          <label>Dokumenttyp:</label>
          <select v-model="dokumentart">
            <option value="LA">Lohnabrechnung</option>
            <option value="LST">Lohnsteuerbescheid</option>
          </select>
        </div>
        
        <div class="dropdown-group" v-if="dokumentart === 'LST'">
          <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" v-model="ganzesJahr" />
            Ganzes Jahr
          </label>
        </div>

        <div class="dropdown-group">
          <label>Stadt:</label>
          <select v-model="stadt">
            <option value="B">Berlin</option>
            <option value="HH">Hamburg</option>
            <option value="K">Köln</option>
          </select>
        </div>

        <div class="dropdown-group" v-if="!ganzesJahr">
          <label>Monat:</label>
          <select v-model="monat">
            <option
              v-for="m in 12"
              :key="m"
              :value="String(m).padStart(2, '0')"
            >
              {{ String(m).padStart(2, "0") }}
            </option>
          </select>
        </div>

        <div class="dropdown-group">
          <label>Jahr:</label>
          <select v-model="jahr">
            <option v-for="y in availableYears" :key="y" :value="String(y)">
              {{ y }}
            </option>
          </select>
        </div>

        <div class="dropdown-group">
          <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; color: var(--primary);">
            <input type="checkbox" v-model="testMode" />
            Testmodus (Emails an IT)
          </label>
        </div>
      </div>

      <div class="drag-drop-area" @dragover.prevent @drop="handleDrop">
        PDF und Excel hierher ziehen
      </div>

      <div class="button-group">
        <label for="pdf-upload" class="upload-btn">PDF hochladen</label>
        <input
          id="pdf-upload"
          type="file"
          @change="handlePdfUpload"
          accept="application/pdf"
        />

        <label for="excel-upload" class="upload-btn">Excel hochladen</label>
        <input
          id="excel-upload"
          type="file"
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
      <p v-if="fileCountValid === false" class="error">
        ⚠ Anzahl Seiten und Zeilen stimmen nicht überein.
      </p>
    </div>

    <div class="actions">
      <button class="preview-btn" @click="openPreview" :disabled="!readyToSplit">
        Vorschau 👁️
      </button>
      <button @click="startSplitting" :disabled="!readyToSplit">
        Versenden 📧
      </button>
    </div>
    

    <!-- Preview Modal -->
    <div v-show="showPreviewModal" class="modal-overlay" @click.self="closePreview">
      <div class="modal-content fancy-modal">
        <div class="modal-header">
           <h2>Vorschau Seite {{ previewPageNum }} von {{ previewTotalPages }}</h2>
           <button class="close-btn" @click="closePreview">×</button>
        </div>
        
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
                        <input 
                            type="text" 
                            v-model="searchQuery" 
                            @keyup.enter="performSearch" 
                            placeholder="Name..." 
                        />
                        <button @click="performSearch">🔍</button>
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
                        <button @click="zoomOut" title="Zoom Out">-</button>
                        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
                        <button @click="zoomIn" title="Zoom In">+</button>
                    </div>
                    <button class="reset-btn" @click="resetView">Ansicht zurücksetzen</button>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button class="nav-btn" @click="prevPage" :disabled="previewPageNum <= 1">← Zurück</button>
            <span class="page-indicator">{{ previewPageNum }} / {{ previewTotalPages }}</span>
            <button class="nav-btn" @click="nextPage" :disabled="previewPageNum >= previewTotalPages">Weiter →</button>
        </div>
      </div>
    </div>

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
</template>

<script>
import * as XLSX from "xlsx";
import api from "../utils/api";
import * as pdfjsLib from "pdfjs-dist";import { markRaw } from "vue";
      // Worker Config für Vite mit lokalem Workaround für neuere Versionen
// Versuche CDN für Worker. Falls geblockt, muss man worker lokal hosten.
// Nutze .mjs extension für module support in neueren Versionen
const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default {
  name: "Lohnabrechnungen",
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
      this.pdfFile = e.target.files[0];
      this.pdfName = this.pdfFile.name;
    },
    handleExcelUpload(e) {
      const file = e.target.files[0];
      this.excelFile = file;
      this.excelName = file.name;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Helper für Sortierung (analog Backend)
        const normalize = (str) => {
            if (!str) return "";
            return String(str)
                .toLowerCase()
                .replace(/ä/g, "a")
                .replace(/ö/g, "o")
                .replace(/ü/g, "u")
                .replace(/ß/g, "ss")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z\s]/g, ""); 
        };

        const sorted = rows.slice(1).sort((a, b) => {
          const nachnameCompare = normalize(a[1]).localeCompare(normalize(b[1]));
          if (nachnameCompare !== 0) return nachnameCompare;
          // Sortiere nach Personalnr (Index 0) statt Vorname
          const personalnrA = String(a[0] || "");
          const personalnrB = String(b[0] || "");
          return personalnrA.localeCompare(personalnrB, undefined, { numeric: true });
        });
        
        this.excelData = sorted;
        this.validateCounts();
      };
      reader.readAsArrayBuffer(file);
    },
    async openPreview() {
      if (!this.pdfFile || !this.excelData.length) return;
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
    zoomIn() {
        if(this.scale < 3.0) {
            this.scale = Math.min(this.scale + 0.25, 3.0);
            this.renderPage(this.previewPageNum);
        }
    },
    zoomOut() {
        if(this.scale > 0.5) {
            this.scale = Math.max(this.scale - 0.25, 0.5);
            this.renderPage(this.previewPageNum);
        }
    },
    resetView() {
        this.scale = 1.0; // Standard 100%
        this.panX = 0;
        this.panY = 0;
        if(this.previewPdfDoc) this.renderPage(this.previewPageNum);
    },
    startPan(e) {
        // Only left mouse button
        if(e.button !== 0) return;
        this.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        e.preventDefault(); 
    },
    doPan(e) {
        if (!this.isPanning) return;
        requestAnimationFrame(() => {
             this.panX = e.clientX - this.panStartX;
             this.panY = e.clientY - this.panStartY;
        });
    },
    endPan() {
        this.isPanning = false;
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
      if (!this.pdfFile || !this.excelData.length) return;

      this.loading = true;

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
          this.listenToMailProgress();
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

  const token = this.token;
  const url = `${import.meta.env.VITE_API_BASE_URL}/api/personal/sse-mailstatus?token=${this.token}`;
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
@import "@/assets/styles/global.scss";

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 12px;
  width: 95vw;
  max-width: 1200px;
  height: 90vh; /* Fixed height for modal */
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  border: 1px solid var(--border);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  gap: 20px;

  .header-left {
     flex: 1;
     h2 { font-size: 1.4rem; margin: 0; color: var(--text); }
  }

  .header-center {
     flex: 2;
     display: flex;
     gap: 10px;
     justify-content: center;

     .search-input {
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
        width: 100%;
        max-width: 300px;
        font-size: 1rem;
        
        &:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }
     }
     
     .search-btn {
        padding: 8px 16px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1.1rem;
        
        &:hover { filter: brightness(0.9); }
     }
  }

  .close-btn { 
    background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--muted);
    padding: 0 8px;
    &:hover { color: var(--text); }
  }
}

.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  overflow-y: auto; /* Scroll body content */
  padding-bottom: 20px;
}

.canvas-container {
  width: 100%;
  display: flex;
  justify-content: center;
  /* Allow horizontal scroll if needed */
  overflow-x: auto;
  
  canvas {
     /* Remove max-width constraint or make it larger */
     max-width: none; 
     /* Let height be determined by aspect ratio if width is constrained by container, 
        but here we want it large. Scale set in JS effectively sets pixel dimensions. */
     box-shadow: 0 4px 12px rgba(0,0,0,0.1);
     border: 1px solid var(--border);
  }
}

.excel-info {
  width: 100%;
  background: var(--panel);
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid var(--primary);
  text-align: left;
  margin-top: auto; /* Push to bottom if space allows */
  
  &.error {
    border-color: #d33;
    color: #d33;
  }
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  
  button {
    padding: 8px 16px;
    background: var(--hover);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    
    &:hover:not(:disabled) { background: var(--border); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.window{
  width: 720px;
  margin: 30px auto;
  padding: 28px;
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
  text-align:center;

  h1{ margin-bottom: 20px; font-size: 2rem; color: var(--text); }
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
    select{
      padding:8px 12px; border-radius:8px; border:1px solid var(--border);
      background: var(--tile-bg); color: var(--text);
      transition: border-color .2s, box-shadow .2s;
    }
    select:focus{
      outline:none; border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent);
    }
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

    .upload-btn{
      display:inline-block; padding:12px 20px; border-radius:8px;
      background: var(--primary); color:#fff; font-weight:600; cursor:pointer;
      transition: transform .08s ease, filter .2s ease; text-align:center;
    }
    .upload-btn:hover{ filter: brightness(.95); transform: translateY(-1px); }
    .upload-btn:active{ filter: brightness(.9); transform: translateY(0); }
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
  .error{ color: #d33; font-weight:600; } /* falls du --error willst, kannst du es global ergänzen */
}

.actions{
  display: flex;
  gap: 12px;
  justify-content: center;

  button{
    padding: 12px 24px; border:none; border-radius:8px; font-weight:600;
    background: var(--primary); color:#fff; cursor:pointer;
    transition: transform .08s ease, filter .2s ease, box-shadow .2s ease;
    box-shadow: 0 4px 10px -2px rgba(0,0,0,.15);
  }

  .preview-btn {
      background: var(--tile-bg);
      color: var(--text);
      border: 2px solid var(--border);
      box-shadow: none;
      
      &:hover:not(:disabled) {
          border-color: var(--primary);
          color: var(--primary);
      }
  }

  button:disabled{ opacity:.6; cursor:not-allowed; box-shadow:none; transform:none; }
  button:hover:not(:disabled){ filter: brightness(.95); transform: translateY(-1px); }
  button:active:not(:disabled){ filter: brightness(.9); transform: translateY(0); }
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


/* New Preview Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  z-index: 1000;
  display: flex; justify-content: center; align-items: center;
}

.modal-content.fancy-modal {
  width: 95vw;
  height: 90vh;
  max-width: 1400px;
  background: var(--tile-bg);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  overflow: hidden;
}

.modal-header {
   padding: 16px 24px;
   background: var(--panel);
   border-bottom: 1px solid var(--border);
   display: flex; justify-content: space-between; align-items: center;
   
   h2 { margin: 0; font-size: 1.25rem; color: var(--text); }
   .close-btn { 
      background: none; border: none; font-size: 2rem; 
      line-height:1; cursor: pointer; color: var(--muted); 
      &:hover { color: var(--error, #e53e3e); }
   }
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
    
    input {
       flex: 1; padding: 8px 12px; border-radius: 6px;
       border: 1px solid var(--border); background: var(--tile-bg);
       color: var(--text);
       &:focus { outline: none; border-color: var(--primary); }
    }
    button {
       padding: 8px 12px; background: var(--primary); border: none;
       border-radius: 6px; cursor: pointer;
    }
}

.excel-card {
    background: var(--tile-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    
    &.error {
        border-color: #e53e3e;
        color: #e53e3e;
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
    
    button {
       width: 32px; height: 32px;
       border: none; background: transparent;
       font-size: 1.2rem; font-weight: bold;
       cursor: pointer; color: var(--text);
       border-radius: 4px;
       &:hover { background: var(--hover); }
    }
    
    .zoom-level {
       font-weight: 600;
       font-size: 0.9rem;
    }
}

.reset-btn {
    width: 100%;
    padding: 8px;
    font-size: 0.85rem;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: 6px;
    cursor: pointer;
    &:hover { border-color: var(--text); color: var(--text); }
}

.modal-footer {
   padding: 16px 24px;
   background: var(--panel);
   border-top: 1px solid var(--border);
   display: flex; justify-content: space-between; align-items: center;
   
   .page-indicator { font-weight: 600; color: var(--text); }
   .nav-btn {
      padding: 8px 16px;
      /* reuse standard button styles */
   }
}

@media (max-width: 768px) {
  .window {
    width: calc(100vw - 32px);
    margin: 16px;
    padding: 20px;
    
    h1 {
      font-size: 1.6rem;
      margin-bottom: 16px;
    }
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
        
        select {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px; /* Verhindert Auto-Zoom auf iOS */
          border-radius: 12px;
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
      
      .upload-btn {
        padding: 14px 20px;
        font-size: 16px; /* Verhindert Auto-Zoom */
        border-radius: 12px;
      }
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
  
  .actions button {
    padding: 14px 24px;
    font-size: 16px; /* Verhindert Auto-Zoom */
    width: 100%;
    border-radius: 12px;
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
    width: calc(100vw - 16px);
    margin: 8px;
    padding: 16px;
    
    h1 {
      font-size: 1.4rem;
    }
  }
  
  .upload-section {
    padding: 12px;
    
    .drag-drop-area {
      height: 80px;
      font-size: 0.9rem;
    }
    
    .button-group .upload-btn {
      padding: 12px 16px;
    }
  }
  
  .sample-table th {
    padding: 4px 2px;
    font-size: 0.7rem;
  }
  
  .actions button {
    padding: 12px 20px;
  }
}
</style>
