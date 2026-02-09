<template>
    <div class="window">
      <h1>Flip Austritte</h1>
      <div class="info-box">
        <p><strong>⚠ Bitte beachten:</strong> Die Excel-Datei muss folgende Spalten enthalten:</p>
        <table class="sample-table">
          <thead>
            <tr>
              <th>Personal-Nr</th>
              <th>Nachname</th>
              <th>Vorname</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="upload-section">
        <div class="drag-drop-area" @dragover.prevent @drop="handleDragAndDrop">
          Excel hierher ziehen
        </div>
        <label for="file-upload">Oder manuell hochladen</label>
        <input id="file-upload" type="file" @change="handleFileUpload" accept=".xlsx, .xls" />
      </div>
  
      <div class="file-name">
        <p>Hochgeladen: <strong>{{ fileName }}</strong></p>
      </div>
  
      <button @click="submitUsers" :disabled="!userList.length">Nutzer löschen</button>
  
      <div v-if="notFound.length">
        <h3>Nicht gefundene Nutzer:</h3>
        <ul>
          <li v-for="name in notFound" :key="name">{{ name }}</li>
        </ul>
      </div>
    </div>
  </template>
  
  <script>
  import * as XLSX from 'xlsx';
  import api from "../utils/api";
  
  export default {
    data() {
      return {
        fileName: "",
        userList: [],
        notFound: [],
        token: localStorage.getItem("token") || null,
      };
    },
    methods: {
      handleFileUpload(event) {
        const file = event.target.files[0];
        this.fileName = file.name;
        this.readExcel(file);
      },
      handleDragAndDrop(event) {
        const file = event.dataTransfer.files[0];
        this.fileName = file.name;
        this.readExcel(file);
      },
      readExcel(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
          this.userList = json.slice(1).map(row => ({
            personalnr: row[0] ? String(row[0]).trim() : null,
            nachname: row[1],
            vorname: row[2],
          }));
        };
        reader.readAsArrayBuffer(file);
      },
      async submitUsers() {
        try {
          const response = await api.post("/api/personal/flip/exit", this.userList, {
            headers: { "Content-Type": "application/json" }
          });
          this.notFound = response.data.notFound;
          alert('Verarbeitung abgeschlossen.');
        } catch (error) {
          console.error("Fehler beim Löschen:", error);
          alert("Es ist ein Fehler aufgetreten.");
        }
      },
      switchToDashboard() {
        const userConfirmed = window.confirm(
          "Bist du Sicher? Alle ungespeicherten Änderungen gehen verloren."
        );
        if (userConfirmed) {
          this.$router.push("/");
        }
      },
    },
  };
  </script>
  <style scoped lang="scss">
@import "@/assets/styles/global.scss";

.window{
  width: 600px;
  margin: 30px auto;
  padding: 24px;
  background: var(--tile-bg);
  color: var(--text);
  border:1px solid var(--border);
  border-radius:10px;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
  text-align:center;

  h1{ margin: 8px 0 16px; font-size:1.8rem; color: var(--text); }
}

.leftAlign{ text-align:left; margin-bottom: 8px; }
.discrete{
  display:inline-block; padding:5px 10px;
  color: var(--muted); text-decoration:none; font-weight:600;
  transition: color .2s ease;
}
.discrete:hover{ color: var(--primary); }

.upload-section{ margin: 12px 0 8px; }

.drag-drop-area{
  width:100%; height:110px;
  border:2px dashed var(--border);
  border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  margin-bottom: 14px; font-size:.95rem; color: var(--muted);
  background: var(--tile-bg);
  cursor:pointer;
  transition: background .2s, border-color .2s, color .2s;

  &:hover{ background: var(--hover); border-color: var(--primary); color: var(--text); }
  &:active{ background: color-mix(in oklab, var(--hover) 60%, var(--tile-bg)); }
}

#file-upload{ display:none; }

.upload-section label{
  display:inline-block; padding:10px 18px;
  background: var(--primary); color:#fff; font-weight:700; border-radius:8px;
  cursor:pointer; transition: transform .08s ease, filter .2s ease;
}
.upload-section label:hover{ filter: brightness(.95); transform: translateY(-1px); }
.upload-section label:active{ filter: brightness(.9); transform: translateY(0); }

.file-name{
  margin-top: 14px; font-size:.95rem; color: var(--muted);
  p{ margin: 4px 0; }
  strong{ color: var(--text); }
}

button{
  margin: 12px 0 4px;
  padding: 10px 20px;
  background: var(--primary);
  color:#fff; border:none; border-radius:8px; font-weight:600; cursor:pointer;
  transition: transform .08s ease, filter .2s ease;
}
button:disabled{ opacity:.6; cursor:not-allowed; }
button:hover:not(:disabled){ filter: brightness(.95); transform: translateY(-1px); }
button:active:not(:disabled){ filter: brightness(.9); transform: translateY(0); }

h3{ margin-top: 16px; font-size: 1.05rem; }
ul{ padding-left: 18px; text-align:left; }

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

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .window {
    width: calc(100vw - 32px);
    margin: 16px;
    padding: 20px;
    
    h1 {
      font-size: 1.6rem;
      margin: 6px 0 14px;
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
    margin: 10px 0 6px;
    
    .drag-drop-area {
      height: 90px;
      margin-bottom: 12px;
      font-size: 0.9rem;
    }
    
    label {
      padding: 14px 18px;
      font-size: 16px; /* Verhindert Auto-Zoom auf iOS */
      width: 100%;
      text-align: center;
      border-radius: 12px;
      box-sizing: border-box;
    }
  }
  
  .file-name {
    margin-top: 12px;
    font-size: 0.9rem;
    
    p {
      margin: 3px 0;
    }
  }
  
  button {
    margin: 10px 0 3px;
    padding: 14px 20px;
    font-size: 16px; /* Verhindert Auto-Zoom */
    width: 100%;
    border-radius: 12px;
  }
  
  h3 {
    margin-top: 14px;
    font-size: 1rem;
  }
  
  ul {
    padding-left: 16px;
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
    .drag-drop-area {
      height: 70px;
      font-size: 0.85rem;
    }
    
    label {
      padding: 12px 16px;
    }
  }
  
  .sample-table th {
    padding: 4px 2px;
    font-size: 0.7rem;
  }
  
  button {
    padding: 12px 18px;
  }
  
  .info-box {
    padding: 10px;
  }
}
</style>
