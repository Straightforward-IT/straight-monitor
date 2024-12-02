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

export default {
  name: "ExcelFormatierung",
  data() {
    return {
      uploadedFile: null,
      processedData: null,
      fileName: "",
      verarbeitet: false,
    };
  },
  methods: {
    handleFileUpload(event) {
      const file = event.target.files[0];
      this.fileName = file.name;
      this.readFile(file);
    },
    handleDragAndDrop(event) {
        event.preventDefault();
        event.stopPropagation();
      const file = event.dataTransfer.files[0];
      this.fileName = file.name;
      this.readFile(file);
    },

    readFile(file) {
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          this.processExcelData(jsonData);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    processExcelData(data) {
      const headers = data[0];
      const rows = data.slice(1);
      const personalNrIndex = headers.indexOf("PERSONALNR");
      const anzahlMitarbeiterIndex = headers.indexOf("ANZAHL_MITARBEITER");
      const reportsIndex = headers.length;

      // Add new "REPORTS" column
      headers.push("REPORTS");

      const processedRows = [];
      const personalNrMap = {};
      let currentPersonalNr = null;
      let startIndex = 1; // Tracks the current row index in the output

      rows.forEach((row, i) => {
        const personalNr = row[personalNrIndex];

        if (personalNr !== currentPersonalNr) {
          if (currentPersonalNr !== null) {
            // Add blank row with the AVERAGE formula for the previous group
            const rangeStart = personalNrMap[currentPersonalNr][0] + 1; // +1 to account for headers
            const rangeEnd = personalNrMap[currentPersonalNr][1] + 1; // +1 to account for headers
            const averageFormula = {
              f: `=AVERAGE(I${rangeStart}:I${rangeEnd})`,
            };
            const blankRow = Array(headers.length).fill("");
            blankRow[reportsIndex] = averageFormula;
            processedRows.push(blankRow);
            startIndex++;
          }

          // Update the map with the start of a new Mitarbeiter
          currentPersonalNr = personalNr;
          personalNrMap[personalNr] = [startIndex];
        }

        // Add the row and update the last index for this Mitarbeiter
        processedRows.push(row);
        startIndex++;
        personalNrMap[personalNr][1] = startIndex - 1; // Update the end index
      });

      // Handle the last Mitarbeiter
      if (currentPersonalNr !== null) {
        const rangeStart = personalNrMap[currentPersonalNr][0] + 1;
        const rangeEnd = personalNrMap[currentPersonalNr][1] + 1;
        const averageFormula = `=AVERAGE(I${rangeStart}:I${rangeEnd})`;
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
      this.fileName = "";
      this.verarbeitet = false;
      this.uploadedFile = null;
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
    // Add the beforeunload event listener
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  },
  beforeDestroy() {
    // Remove the beforeunload event listener
    window.removeEventListener("beforeunload", this.beforeUnloadHandler);
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
