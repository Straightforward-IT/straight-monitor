<template>
  <div class="window">
    <h1>Excel Formatierung</h1>
    <div class="upload-section">
      <div class="drag-drop-area" @dragover.prevent @drop="handleDragAndDrop">
        Drag and drop your file here
      </div>
      <label for="file-upload">Oder Manuell Upload</label>
      <input
        id="file-upload"
        type="file"
        @change="handleFileUpload"
        accept=".xlsx, .xls"
      />
    </div>

    <div class="file-name">
      <p>
        Hochgeladen: <strong v-if="fileName">{{ fileName }}</strong>
      </p>
      <p>Verarbeitet: <strong v-if="verarbeitet">✓</strong></p>
    </div>

    <div class="actions">
      <button @click="downloadProcessedExcel" :disabled="!processedData">
        Download Excel
      </button>
    </div>
  </div>
</template>

<script>
import * as XLSX from "xlsx";
import FileSaver from "file-saver";
import api from "../utils/api";

export default {
  name: "ExcelFormatierung",
  data() {
    return {
      token: localStorage.getItem("token") || null,
      processedData: null,
      fileName: "",
      verarbeitet: false,
    };
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
    handleFileUpload(event) {
      const file = event.target.files[0];
      this.fileName = file.name;
      this.uploadFileToServer(file);
    },
    handleDragAndDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      this.fileName = file.name;
      this.uploadFileToServer(file);
    },
    uploadFileToServer(file) {
      const formData = new FormData();
      formData.append("file", file);

      api
        .post("/api/personal/upload-teamleiter", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((response) => {
          const { headers, rows } = response.data;
          this.processExcelData([headers, ...rows]);
        })
        .catch((error) => {
          console.error("Error uploading file:", error);
          alert(
            "Fehler beim Hochladen der Datei. Möglicherweise ist die Datei beschädigt."
          );
        });
    },
    processExcelData(data) {
      const headers = data[0];
      const rows = data.slice(1);
      const personalNrIndex = headers.indexOf("PERSONALNR");
      const anzahlMitarbeiterIndex = headers.indexOf("ANZAHL_MITARBEITER");
      const reportsIndex = headers.length;

      // Add a new column for "REPORTS"
      headers.push("QUOTE IN %");

      const processedRows = [];
      const personalNrMap = {};
      let currentPersonalNr = null;
      let startIndex = 1; // Tracks the current row index in the output

      rows.forEach((row) => {
        // Convert dates in Column A
        if (row[0] && typeof row[0] === "number") {
          const date = new Date(Math.round((row[0] - 25569) * 86400 * 1000)); // Excel to JS date
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          row[0] = `${day}.${month}.${year}`; // Format as dd.mm.yyyy
        }

        const personalNr = row[personalNrIndex];

        // Check if PERSONALNR group has changed
        if (personalNr !== currentPersonalNr) {
          if (currentPersonalNr !== null) {
            // Add a blank row with the AVERAGE formula for the previous group
            const rangeStart = personalNrMap[currentPersonalNr][0] + 1; // +1 to account for headers
            const rangeEnd = personalNrMap[currentPersonalNr][1] + 1; // +1 to account for headers
            const averageFormula = {
              f: `=AVERAGE(I${rangeStart}:I${rangeEnd})*100`,
            };
            const blankRow = Array(headers.length).fill("");
            blankRow[reportsIndex] = averageFormula;
            processedRows.push(blankRow);
            startIndex++;
          }

          // Update the map with the start of a new group
          currentPersonalNr = personalNr;
          personalNrMap[personalNr] = [startIndex];
        }

        // Add the current row and update the last index for this group
        processedRows.push(row);
        startIndex++;
        personalNrMap[personalNr][1] = startIndex - 1;
      });

      // Add a blank row with the AVERAGE formula for the last group
      if (currentPersonalNr !== null) {
        const rangeStart = personalNrMap[currentPersonalNr][0] + 1;
        const rangeEnd = personalNrMap[currentPersonalNr][1] + 1;
        const averageFormula = {
          f: `=AVERAGE(I${rangeStart}:I${rangeEnd})*100`,
        };
        const blankRow = Array(headers.length).fill("");
        blankRow[reportsIndex] = averageFormula;
        processedRows.push(blankRow);
      }

      // Save processed data
      this.processedData = [headers, ...processedRows];
      this.verarbeitet = true;
    },
    downloadProcessedExcel() {
      if (!this.processedData) return;

      const worksheet = XLSX.utils.aoa_to_sheet(this.processedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Formatierte Daten");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });
      FileSaver.saveAs(blob, "Excel_Formatiert.xlsx");
      this.resetState();
    },
    resetState() {
      this.fileName = "";
      this.verarbeitet = false;
      this.processedData = null;
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
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
  },
};
</script>
<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* nutzt globale Theme-Variablen direkt */
.window{
  width: 600px;
  margin: 30px auto;
  padding: 30px;
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,.12);
  text-align: center;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial;

  h1{
    margin-bottom: 22px;
    font-size: 2.0rem;
    color: var(--text);
  }
}

.leftAlign{ text-align:left; margin-bottom: 16px; }
.discrete{
  display:inline-block; padding:6px 10px;
  color: var(--muted); text-decoration:none; font-weight:600;
  transition: color .2s ease;
}
.discrete:hover{ color: var(--primary); }

.upload-section{
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);

  label{
    display:inline-block;
    padding: 12px 20px;
    background: var(--primary);
    color:#fff; font-weight:600; border-radius:8px; cursor:pointer;
    transition: transform .08s ease, filter .2s ease;
  }
  label:hover{ filter: brightness(.95); transform: translateY(-1px); }
  label:active{ filter: brightness(.9); transform: translateY(0); }

  input[type="file"]{ display:none; }
}

.drag-drop-area{
  width:100%; height:120px;
  border:2px dashed var(--border);
  border-radius: 10px;
  display:flex; align-items:center; justify-content:center;
  margin-bottom:16px; font-size:1.05rem; color: var(--muted);
  background: var(--tile-bg);
  cursor:pointer;
  transition: background .2s, border-color .2s, color .2s;

  &:hover{
    background: var(--hover);
    border-color: var(--primary);
    color: var(--text);
  }
  &:active{
    background: color-mix(in oklab, var(--hover) 60%, var(--tile-bg));
  }
}

.file-name{
  margin: 18px 0 24px;
  font-size: .95rem;
  background: var(--panel);
  border:1px solid var(--border);
  border-radius:10px;
  padding: 12px;
  color: var(--muted);
  box-shadow: 0 1px 3px rgba(0,0,0,.03);

  p{ margin: 6px 0; }
  strong{ color: var(--text); }
}

.actions{
  margin-top: 0;
  button{
    padding: 12px 24px;
    background: var(--primary);
    color:#fff; border:none; border-radius:8px; font-weight:600;
    cursor:pointer; transition: transform .08s ease, filter .2s ease;
  }
  button:disabled{ opacity:.6; cursor:not-allowed; }
  button:hover:not(:disabled){ filter: brightness(.95); transform: translateY(-1px); }
  button:active:not(:disabled){ filter: brightness(.9); transform: translateY(0); }
}

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .window {
    width: calc(100vw - 32px);
    margin: 16px;
    padding: 20px;
    
    h1 {
      font-size: 1.6rem;
      margin-bottom: 18px;
    }
  }
  
  .upload-section {
    padding: 16px;
    
    label {
      padding: 14px 20px;
      font-size: 16px; /* Verhindert Auto-Zoom auf iOS */
      width: 100%;
      text-align: center;
      box-sizing: border-box;
    }
  }
  
  .drag-drop-area {
    height: 100px;
    font-size: 1rem;
    margin-bottom: 14px;
  }
  
  .file-name {
    margin: 16px 0 20px;
    padding: 10px;
    font-size: 0.9rem;
    
    p {
      margin: 4px 0;
    }
  }
  
  .actions {
    button {
      padding: 14px 24px;
      font-size: 16px; /* Verhindert Auto-Zoom */
      width: 100%;
      border-radius: 12px;
    }
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
  }
  
  .drag-drop-area {
    height: 80px;
    font-size: 0.9rem;
  }
}
</style>
