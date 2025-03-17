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
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.vfs;

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
      const lastRow = this.rows[this.rows.length - 1] || {
        datum: "",
        eventtitel: "",
        job: "",
        stunden: "0.00",
        position: "",
      };
      this.rows.push({ ...lastRow });
    },
    deleteRow(index) {
      this.rows.splice(index, 1);
    },
    formatDate(date) {
      if (!date) return "";
      const parsedDate = new Date(date);
      return parsedDate.toLocaleDateString("de-DE");
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
      const tableBody = [
        ["Datum", "Eventtitel", "Job", "Stunden", "Position"],
        ...this.rows.map((row) => [
          this.formatDate(row.datum),
          row.eventtitel,
          row.job,
          parseFloat(row.stunden).toFixed(2).replace(".", ","),
          row.position,
        ]),
      ];

      const docDefinition = {
        pageOrientation: "landscape",
        content: [
          {
            text: "Auswertung Jobangebote",
            style: "header",
          },
          {
            text: this.formatDateTime(this.headerData.timestamp || new Date()),
            alignment: "right",
            margin: [0, 0, 0, 10],
          },
          {
            columns: [
              {
                text: `Personalnummer: ${this.headerData.personalnummer || "-"}`,
              },
              {
                text: `Name: ${this.headerData.name || "-"}`,
                alignment: "right",
              },
            ],
            margin: [0, 0, 0, 5],
          },
          {
            text: `Zeitraum: ${
              this.formatDate(this.headerData.fromDate) || "-"
            } bis ${this.formatDate(this.headerData.toDate) || "-"}`,
          },
          {
            text: `Geschäftsstelle: ${
              this.headerData.geschaeftsstelle || "-"
            }`,
          },
          {
            text: `Personalstatus: ${this.headerData.personalStatus || "-"}`,
            margin: [0, 0, 0, 10],
          },
          {
            text: this.headerData.listTitle,
            style: "subheader",
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "*", "*", "auto", "*"],
              body: tableBody,
            },
            layout: "lightHorizontalLines",
          },
        ],
        styles: {
          header: { fontSize: 16, bold: true },
          subheader: { fontSize: 12, bold: true },
        },
      };

      pdfMake.createPdf(docDefinition).download("Auswertung_Jobangebote.pdf");
    },
    beforeUnloadHandler(event) {
      event.preventDefault();
      event.returnValue = "";
    },
    switchToDashboard() {
      if (
        confirm(
          "Sind Sie sicher, dass Sie zur Dashboard-Seite zurückkehren möchten? Alle ungespeicherten Änderungen gehen verloren."
        )
      ) {
        this.$router.push("/");
      }
    },
  },
  mounted() {
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  },
  beforeDestroy() {
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
