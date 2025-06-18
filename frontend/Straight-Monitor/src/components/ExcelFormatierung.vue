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

.window {
  /* Assign Sass variables to CSS custom properties */
  --c-window-bg: #{$base-light-gray};
  --c-panel-bg: #ffffff;
  --c-primary: #{$base-primary};
  --c-primary-hover: #{$base-secondary-accent};
  --c-primary-active: #{$base-tertiary-accent};
  --c-border: #{$base-border-color};
  --c-text-dark: #{$base-text-dark};
  --c-text-medium: #{$base-straight-gray}; // Used for hints, drag/drop text
  --c-disabled-bg: #{$base-text-medium};
  --c-drag-drop-hover: #{color.adjust($base-light-gray, $lightness: 2%)};
  --c-drag-drop-active: #{color.adjust($base-light-gray, $lightness: -5%)};
  width: 600px;
  margin: 30px auto; /* More vertical space */
  padding: 30px; /* More internal padding */
  background-color: var(--c-window-bg);
  border-radius: 12px; /* Softer rounded corners */
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.15); /* More pronounced, soft shadow */
  text-align: center;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;

  h1 {
    color: var(--c-text-dark);
    margin-bottom: 25px; /* More space below heading */
    font-size: 2.2rem;
  }
}

.leftAlign {
  text-align: left;
  margin-bottom: 20px; /* Space between "Zurück" and H1 */
}

.discrete {
  margin: 15px;
  color: $base-text-medium;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s ease;
  &:hover {
    color: color.adjust($base-primary, $lightness: -10%);
  }
}

.upload-section {
  background-color: var(--c-panel-bg);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 25px; /* More padding inside the section */
  margin-bottom: 25px; /* Space below the upload section */
  box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.05); /* Subtle shadow */

  label {
    display: inline-block;
    padding: 12px 25px; /* More padding for button-like label */
    background-color: var(--c-primary);
    color: white;
    font-size: 1rem; /* Slightly larger font */
    font-weight: 600; /* Bolder text */
    border: none;
    border-radius: 8px; /* Softer corners */
    cursor: pointer;
    text-align: center;
    transition: background-color 0.3s ease, transform 0.1s ease;
    box-shadow: 0 4px 8px -2px rgba($base-primary, 0.3); /* Soft shadow for button */

    &:hover {
      background-color: var(--c-primary-hover);
      transform: translateY(-2px); /* Slight lift on hover */
      box-shadow: 0 6px 12px -3px rgba($base-primary, 0.4);
    }

    &:active {
      background-color: var(--c-primary-active);
      transform: translateY(0); /* Press down effect */
      box-shadow: 0 2px 4px rgba($base-primary, 0.2);
    }
  }

  input[type="file"] {
    display: none;
  }
}

.drag-drop-area {
  width: 100%;
  height: 120px; /* Taller drag area */
  border: 2px dashed var(--c-border);
  border-radius: 10px; /* Consistent with panel corners */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px; /* More space below */
  font-size: 1.05rem; /* Larger font */
  color: var(--c-text-medium);
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease,
    color 0.3s ease;

  &:hover {
    background-color: var(--c-drag-drop-hover);
    border-color: var(--c-primary); /* Primary color border on hover */
    color: var(--c-text-dark);
  }

  &:active {
    background-color: var(--c-drag-drop-active);
    border-color: var(--c-primary-active);
    color: var(--c-text-dark);
  }
}

.file-info {
  /* Changed class name from .file-name to .file-info for consistency */
  margin-top: 20px; /* More space above file info */
  margin-bottom: 30px; /* More space below file info */
  font-size: 0.95rem;
  color: var(--c-text-medium);
  background-color: var(--c-panel-bg);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 15px; /* Padding around info */
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.03);

  p {
    margin: 5px 0; /* Tighten line spacing for info */
  }
  strong {
    color: var(--c-text-dark);
    font-weight: 600;
  }
}

.actions {
  margin-top: 0; /* Actions buttons should align cleanly below file-info */
  button {
    padding: 14px 30px; /* Larger buttons */
    background-color: var(--c-primary);
    color: #fff;
    border: none;
    border-radius: 8px; /* Consistent rounded corners */
    cursor: pointer;
    font-size: 1.1rem; /* Larger font for main action */
    font-weight: 600;
    transition: background-color 0.3s ease, transform 0.1s ease,
      box-shadow 0.2s ease;
    box-shadow: 0 4px 10px -2px rgba($base-primary, 0.4);

    &:disabled {
      background-color: var(--c-disabled-bg);
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }

    &:hover:not(:disabled) {
      background-color: var(--c-primary-hover);
      transform: translateY(-2px);
      box-shadow: 0 6px 14px -4px rgba($base-primary, 0.5);
    }

    &:active:not(:disabled) {
      background-color: var(--c-primary-active);
      transform: translateY(0);
      box-shadow: 0 2px 5px rgba($base-primary, 0.3);
    }
  }
}
</style>
