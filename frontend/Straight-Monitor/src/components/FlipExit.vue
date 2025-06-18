<template>
    <div class="window">
      <div class="leftAlign" style="text-align: left">
        <a class="discrete" @click="switchToDashboard">Zurück</a>
      </div>
      <h1>Flip Austritte</h1>
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

.window {
  width: 600px;
  margin: auto;
  padding: 20px;
  background-color: $base-panel-bg;
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
  color: $base-text-notsodark;
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
  background-color: $base-primary;
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
  background-color: $base-secondary-accent;
}

.upload-section label:active {
  background-color: $base-tertiary-accent;
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
  background-color: $base-input-bg;
  color: #000;
}

.drag-drop-area:active {
  background-color: $base-border-color;
  border-color: $base-tertiary-accent;
}


button {
  margin: 10px;
  padding: 10px 20px;
  background-color: $base-primary;
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
  background-color: $base-primary;
}
</style>
