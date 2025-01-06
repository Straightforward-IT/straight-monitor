<template>
    <div class="window">
      <div class="leftAlign" style="text-align: left">
        <a class="discrete" @click="switchToDashboard">Zurück</a>
      </div>
  
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
        <p>Hochgeladen: <strong v-if="fileName">{{ fileName }}</strong></p>
        <p>Verarbeitet: <strong v-if="verarbeitet" >✓</strong></p>
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
            alert("Fehler beim Hochladen der Datei.");
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
              const averageFormula = { f: `=AVERAGE(I${rangeStart}:I${rangeEnd})*100` };
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
          const averageFormula = { f: `=AVERAGE(I${rangeStart}:I${rangeEnd})*100` };
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
  
<style scoped>
.window {
  width: 600px;
  margin: auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.upload-section {
  margin: 10px;
}

#file-upload {
  display: none;
}
.file-name {
  margin-top: 15px;
  font-size: 14px;
  color: gray;
}
.file-name p {
  margin: 0;
}
.file-name strong {
  color: #000;
}


.upload-section label {
  display: inline-block;
  padding: 10px 20px;
  background-color: #f69e6f;
  color: white;
  font-size: 14px;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  transition: background-color 0.3s ease;
}

.upload-section label:hover {
  background-color: #e6584f;
}

.upload-section label:active {
  background-color: #cc5045;
}

.drag-drop-area {
  width: 100%;
  height: 100px;
  border: 2px dashed gray;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  font-size: 14px;
  color: gray;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.drag-drop-area:hover {
  background-color: #f3f3f3;
  color: #000;
}

.drag-drop-area:active {
  background-color: #e0e0e0;
  border-color: #cc5045;
}


button {
  margin: 10px;
  padding: 10px 20px;
  background-color: #f69e6f;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #f69e6f;
}
</style>
