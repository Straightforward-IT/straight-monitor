<template>
  <div class="window">
    <div class="leftAlign">
      <a class="discrete" @click="switchToDashboard">Zurück</a>
    </div>

    <h1>Lohnabrechnungen</h1>

    <div class="upload-section">
      <div class="dropdowns">
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
        Aufteilen & Herunterladen
      </button>
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
      pdfFile: null,
      excelFile: null,
      excelData: [],
      pdfName: "",
      excelName: "",
      stadt: "HH",
      monat: "01",
      fileCountValid: null,
      loading: false,
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
    formData.append("stadt_full", this.stadtFullName); 

  api
    .post("/api/personal/upload-lohnabrechnungen", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "x-auth-token": this.token
      },
      responseType: "blob", // ⬅️ wichtig! sonst wird die ZIP nicht richtig empfangen
    })
    .then((res) => {
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
  },
   mounted() {
      this.setAxiosAuthToken();
      this.fetchUserData();
         window.addEventListener('dragover', this.preventBrowserDefault);
    window.addEventListener('drop', this.preventBrowserDefault);
    },
      beforeUnmount() { // Für Vue 2 oder vor Vue 3.2; für Vue 3.2+ 'unmounted'
    window.removeEventListener('dragover', this.preventBrowserDefault);
    window.removeEventListener('drop', this.preventBrowserDefault);
  },
};
</script>

<style scoped lang="scss">
// Define Sass variables for base colors
$base-primary: #f69e6f; // Main action color (orange)
$base-secondary-accent: #e6584f; // Darker orange for hover
$base-tertiary-accent: #cc5045; // Even darker orange for active
$base-success: #4caf50; // Green for success/action button
$base-success-hover: #43a047; // Darker green for hover
$base-success-active: #388e3c; // Even darker green for active
$base-light-gray: #f9f9f9; // Window background
$base-panel-bg: #ffffff; // Panel background
$base-border-color: #e0e0e0; // General border color
$base-text-dark: #333333; // Main text color
$base-text-medium: #808080; // Medium gray for hints/disabled
$base-text-light: #a0a0a0; // Lighter gray for drag/drop hint
$base-error: #ff0000; // Error message color
$base-disabled-bg: #cccccc; // Disabled button background

.window {
  /* Assign Sass variables to CSS custom properties */
  --c-window-bg: #{$base-light-gray};
  --c-panel-bg: #{$base-panel-bg};
  --c-primary: #{$base-primary};
  --c-primary-hover: #{$base-secondary-accent};
  --c-primary-active: #{$base-tertiary-accent};
  --c-success: #{$base-success};
  --c-success-hover: #{$base-success-hover};
  --c-success-active: #{$base-success-active};
  --c-border: #{$base-border-color};
  --c-text-dark: #{$base-text-dark};
  --c-text-medium: #{$base-text-medium};
  --c-text-light: #{$base-text-light};
  --c-error: #{$base-error};
  --c-disabled-bg: #{$base-disabled-bg};
  --c-drag-drop-hover-bg: #{lighten($base-panel-bg, 2%)};
  --c-drag-drop-active-bg: #{darken($base-panel-bg, 5%)};


  width: 600px;
  margin: 30px auto;
  padding: 30px;
  background-color: var(--c-window-bg);
  border-radius: 12px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.15);
  text-align: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

  h1 {
    color: var(--c-text-dark);
    margin-bottom: 25px;
    font-size: 2.2rem;
  }
}

.leftAlign {
  text-align: left;
  margin-bottom: 20px; /* Space between "Zurück" and H1 */
}

.discrete {
  display: inline-block;
  padding: 5px 10px;
  color: var(--c-text-medium);
  text-decoration: none; /* No underline by default */
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.2s ease; /* Transition only color */

  &:hover {
    color: var(--c-primary); /* Primary color on hover */
    /* text-decoration: underline; -- Removed as requested */
  }
}

.upload-section {
  background-color: var(--c-panel-bg);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.05);

  label.upload-btn { /* Specificity for the upload buttons */
    display: inline-block;
    padding: 12px 25px;
    background-color: var(--c-primary);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.3s ease, transform 0.1s ease;
    box-shadow: 0 4px 8px -2px rgba($base-primary, 0.3);

    &:hover {
      background-color: var(--c-primary-hover);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px -3px rgba($base-primary, 0.4);
    }

    &:active {
      background-color: var(--c-primary-active);
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba($base-primary, 0.2);
    }
  }

  input[type="file"] {
    display: none;
  }
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 15px; /* More space between buttons */
  margin-top: 20px; /* More space from drag/drop area */
}

.drag-drop-area {
  width: 100%;
  height: 120px; /* Taller drag area */
  border: 2px dashed var(--c-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-medium);
  margin-top: 15px;
  font-size: 1.05rem; /* Larger font */
  background: var(--c-panel-bg); /* Use panel background color */
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;

  &:hover {
    background-color: var(--c-drag-drop-hover-bg);
    border-color: var(--c-primary); /* Primary color border on hover */
    color: var(--c-text-dark);
  }

  &:active {
    background-color: var(--c-drag-drop-active-bg);
    border-color: var(--c-primary-active);
    color: var(--c-text-dark);
  }
}

.dropdowns {
  display: flex;
  gap: 25px; /* More space between dropdown groups */
  justify-content: center;
  margin-bottom: 20px; /* More space below dropdowns */
}

.dropdown-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Align label and select to the left */
  gap: 8px; /* Space between label and select */

  label {
    font-size: 1rem;
    font-weight: 500;
    color: var(--c-text-dark);
  }
}

select {
  padding: 8px 12px; /* More padding */
  border-radius: 8px; /* Softer rounded corners */
  border: 1px solid var(--c-border);
  background-color: var(--c-window-bg); /* Use window background for select */
  color: var(--c-text-dark);
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--c-primary);
    box-shadow: 0 0 0 3px rgba($base-primary, 0.2);
  }
}

.actions button {
  background-color: var(--c-success); /* Use success color */
  color: white;
  padding: 14px 30px; /* Larger buttons */
  border: none;
  border-radius: 8px; /* Consistent rounded corners */
  font-size: 1.1rem; /* Larger font */
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 10px -2px rgba($base-success, 0.4);

  &:disabled {
    background-color: var(--c-disabled-bg);
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  &:hover:not(:disabled) {
    background-color: var(--c-success-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 14px -4px rgba($base-success, 0.5);
  }

  &:active:not(:disabled) {
    background-color: var(--c-success-active);
    transform: translateY(0);
    box-shadow: 0 2px 5px rgba($base-success, 0.3);
  }
}

.file-name {
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

.error {
  color: var(--c-error);
  margin-top: 10px;
  font-weight: 600;
}

.loader {
  margin-top: 20px; /* More space above loader */
  font-size: 1.05rem;
  color: var(--c-text-secondary);
  font-weight: 500;
}
</style>
