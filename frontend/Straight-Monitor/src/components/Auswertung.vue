<template>
  <div class="window">
    <a class="discrete" @click="switchToDashboard">Zurück</a>
    <h1>Auswertung Jobangebote</h1>
    <div class="header-inputs">
      <form @submit.prevent="addRow" class="form-grid">
        <label>
          Datum und Uhrzeit:
          <input v-model="headerData.timestamp" type="text" placeholder="Datum und Uhrzeit eingeben" />
        </label>
        <label>
          Personalnummer:
          <input v-model="headerData.personalnummer" type="text" placeholder="Personalnummer eingeben" />
        </label>
        <label>
          Name:
          <input v-model="headerData.name" type="text" placeholder="Nachname, Vorname eingeben" />
        </label>
        <label>
          Zeitraum von:
          <input v-model="headerData.fromDate" type="date" />
        </label>
        <label>
          Zeitraum bis:
          <input v-model="headerData.toDate" type="date" />
        </label>
        <label>
          Geschäftsstelle:
          <input v-model="headerData.geschaeftsstelle" type="text" placeholder="Geschäftsstelle eingeben" />
        </label>
        <label>
          Personalstatus:
          <input v-model="headerData.personalStatus" type="text" placeholder="Personalstatus eingeben" />
        </label>
        <label>
          Listentitel:
          <input v-model="headerData.listTitle" type="text" placeholder="Listentitel eingeben" />
        </label>
      </form>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Eventtitel</th>
            <th>Job</th>
            <th>Stunden</th>
            <th>Position</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index">
            <td><input v-model="row.datum" type="text" /></td>
            <td><input v-model="row.eventtitel" type="text" /></td>
            <td><input v-model="row.job" type="text" /></td>
            <td><input v-model="row.stunden" type="number" step="0.01" /></td>
            <td><input v-model="row.position" type="text" /></td>
            <td>
              <button @click="deleteRow(index)">Löschen</button>
            </td>
          </tr>
        </tbody>
      </table>
      <button @click="addRow">Zeile hinzufügen</button>
    </div>

    <div class="actions">
      <button @click="generatePDF">PDF Herunterladen</button>
    </div>
  </div>
</template>

<script>
import jsPDF from "jspdf";
import "jspdf-autotable";

export default {
  name: "Auswertung",
  data() {
    return {
      headerData: {
        timestamp: new Date().toLocaleString(),
        personalnummer: "",
        name: "",
        fromDate: "",
        toDate: "",
        geschaeftsstelle: "",
        personalStatus: "Mitarbeiter/in",
        listTitle: "Angebot - Abgelehnt vom Bewerber",
      },
      rows: [
        { datum: "", eventtitel: "", job: "", stunden: "0.00", position: "" },
      ],
    };
  },
  methods: {
    addRow() {
  if (this.rows.length > 0) {
    const lastRow = this.rows[this.rows.length - 1];
    // Create a copy of the last row
    const newRow = { ...lastRow };
    this.rows.push(newRow);
  } else {
    // If no rows exist, add an empty default row
    this.rows.push({
      datum: "",
      eventtitel: "",
      job: "",
      stunden: "0.00",
      position: "",
    });
  }
},
    deleteRow(index) {
      this.rows.splice(index, 1);
    },
    formatDate(date) {
    if (!date) return "";
    const parsedDate = new Date(date);
    const day = parsedDate.getDate().toString().padStart(2, "0");
    const month = (parsedDate.getMonth() + 1).toString().padStart(2, "0");
    const year = parsedDate.getFullYear();
    return `${day}.${month}.${year}`;
  },
  formatDateTime(dateTime) {
    if (!dateTime) return "";
    const parsedDate = new Date(dateTime);
    const day = parsedDate.getDate().toString().padStart(2, "0");
    const month = (parsedDate.getMonth() + 1).toString().padStart(2, "0");
    const year = parsedDate.getFullYear();
    const hours = parsedDate.getHours().toString().padStart(2, "0");
    const minutes = parsedDate.getMinutes().toString().padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  },
    generatePDF() {
  const doc = new jsPDF("landscape");

  // 1. Header: Auswertung Jobangebote (Bold, Right-aligned)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const currentTimestamp = this.formatDateTime(
    this.headerData.timestamp || new Date()
  );
  doc.text("Auswertung Jobangebote", 10, 10);
  doc.setFontSize(10);
  doc.text(currentTimestamp, 270, 10, { align: "right" });

  // 2. Personalnummer and Name
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Personalnummer: ${this.headerData.personalnummer}        ${this.headerData.name}`,
    10,
    20
  );

  // 3. Zeitraum von - bis
  const fromDate = this.formatDate(this.headerData.fromDate);
  const toDate = this.formatDate(this.headerData.toDate);
  doc.text(`Zeitraum von: ${fromDate}        bis: ${toDate}`, 10, 30);

  // 4. Geschäftsstelle and Personalstatus
  doc.text(
    `Geschäftsstelle: ${this.headerData.geschaeftsstelle}        Personalstatus: ${this.headerData.personalStatus}`,
    10,
    40
  );

  // 5. Empty line
  doc.text("", 10, 50);

  // 6. Listentitel
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(this.headerData.listTitle, 10, 60);

  // 7. Add Table
  doc.autoTable({
    head: [["Datum", "Eventtitel", "Job", "Stunden", "Position"]],
    body: this.rows.map((row) => [
      this.formatDate(row.datum) || "",
      row.eventtitel || "",
      row.job || "",
      typeof row.stunden === "number"
        ? row.stunden.toFixed(2).replace(".", ",")
        : (row.stunden || "").toString().replace(".", ","),
      row.position || "",
    ]),
    startY: 70,
  });

  // Download PDF
  doc.save("Auswertung_Jobangebote.pdf");
},
    beforeUnloadHandler(event) {
      event.preventDefault();
      event.returnValue = ""; 
    },
    switchToDashboard() {
  const userConfirmed = window.confirm(
    "Sind Sie sicher, dass Sie zur Dashboard-Seite zurückkehren möchten? Alle ungespeicherten Änderungen gehen verloren."
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

<style scoped lang="scss"> 
$primary: #f69e6f;

.window {
  width: 1600px;
  margin: auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
}

h1,
h2 {
  text-align: center;
  margin-bottom: 15px;
}

.header-inputs {
  margin-bottom: 20px;

  .form-grid {
    margin: auto;
    width: 800px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  label {
    display: flex;
    flex-direction: column;
  }

  input {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }
}

.table-container {
  margin-top: 20px;

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: center;
  }
}

.actions {
  text-align: center;
  margin-top: 20px;
}

button {
  margin: 5px;
  padding: 10px 15px;
  background-color: $primary;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: $primary;
  &:hover {
      transform: translateY(-3px);
      box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.15);
    }
}
</style>
