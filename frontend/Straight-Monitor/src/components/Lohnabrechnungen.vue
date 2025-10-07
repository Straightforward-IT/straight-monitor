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
        <div class="dropdown-group">
          <label>Stadt:</label>
          <select v-model="stadt">
            <option value="B">Berlin</option>
            <option value="HH">Hamburg</option>
            <option value="K">Köln</option>
          </select>
        </div>

        <div class="dropdown-group">
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
      <button @click="startSplitting" :disabled="!readyToSplit">
        Versenden 📧
      </button>
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

export default {
  name: "Lohnabrechnungen",
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userLocation: "",
      pdfFile: null,
      excelFile: null,
      excelData: [],
      pdfName: "",
      excelName: "",
      stadt: "HH",
      monat: "01",
      dokumentart: "LA",
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
        const sorted = rows.slice(1).sort((a, b) => a[1]?.localeCompare(b[1]));
        this.excelData = sorted;
        this.validateCounts();
      };
      reader.readAsArrayBuffer(file); // 👈 modern & nicht-deprecated
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
      formData.append("dokumentart", this.dokumentart);
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
          a.download = `Lohnabrechnungen_${this.stadt}_${this.monat}.zip`;
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
  button{
    padding: 12px 24px; border:none; border-radius:8px; font-weight:600;
    background: var(--primary); color:#fff; cursor:pointer;
    transition: transform .08s ease, filter .2s ease, box-shadow .2s ease;
    box-shadow: 0 4px 10px -2px rgba(0,0,0,.15);
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

/* Mobile Optimierungen */
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
