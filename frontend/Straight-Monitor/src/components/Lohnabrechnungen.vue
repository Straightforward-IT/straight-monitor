<template>
  <div class="window">
    <div class="leftAlign">
      <a class="discrete" @click="switchToDashboard">Zurück</a>
    </div>

    <h1>Lohnabrechnungen aufteilen</h1>

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
    },
};
</script>

<style scoped>
.window {
  width: 600px;
  margin: auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.15);
  text-align: center;
  font-family: sans-serif;
}

.leftAlign {
  text-align: left;
  margin-bottom: 1rem;
}

.upload-section {
  margin-bottom: 20px;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.upload-btn {
  background-color: #f69e6f;
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  display: inline-block;
  transition: background-color 0.3s ease;
}

.upload-btn:hover {
  background-color: #e6584f;
}

input[type="file"] {
  display: none;
}

.drag-drop-area {
  width: 100%;
  height: 100px;
  border: 2px dashed #aaa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #777;
  margin-top: 15px;
  font-size: 15px;
  background: #fff;
}

.drag-drop-area:hover {
  background: #f3f3f3;
  color: #000;
}

.dropdowns {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 15px;
}

.dropdown-group {
  display: flex;
  flex-direction: column;
  align-items: start;
}

select {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.actions button {
  background-color: #4caf50;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}

.actions button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.file-name {
  margin-top: 15px;
  font-size: 14px;
  color: gray;
}

.file-name strong {
  color: #000;
}

.error {
  color: red;
  margin-top: 10px;
}

.loader {
  margin-top: 15px;
  font-size: 15px;
  color: #555;
}

</style>
