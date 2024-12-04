<template>
    <div class="window">
      <div class="leftAlign">
        <a class="discrete" @click="switchToDashboard">Zurück</a>
        <div class="controls">
          <button class="option">Evaluierung</button>
          <button class="option">Reports</button>
        </div>
      </div>
  
      <h1>Evaluierung</h1>
  
      <div class="filter">
        <label for="locationFilter">Filter by Location:</label>
        <select id="locationFilter" v-model="selectedLocation" @change="filterByLocation">
          <option value="">All Locations</option>
          <option v-for="(location, index) in uniqueLocations" :key="index" :value="location">
            {{ location }}
          </option>
        </select>
      </div>
  
      <div class="grid">
        <!-- Left Column for Laufzettel -->
        <div class="column left-column">
          <h2>Laufzettel</h2>
          <div
            v-for="(doc, index) in filteredDocuments.filter(doc => doc.type === 'laufzettel')"
            :key="index"
            class="card"
          >
            <div class="card-header" @click="toggleExpand(index, 'laufzettel')">
              <p><strong>MA Name: {{ doc.name }}</strong></p>
              <p>Bogen Nr: {{ doc.bogenNr }}</p>
              <p>Teamleiter: {{ doc.name_teamleiter }}</p>
              <p>{{ doc.datum }}</p>
            </div>
            <div class="card-body" v-if="expandedIndex === index && expandedType === 'laufzettel'">
              <!-- Expanded content can be added here -->
            </div>
          </div>
        </div>
  
        <!-- Middle Column (Blank for Now) -->
        <div class="column middle-column">
          <h2>Coming Soon</h2>
        </div>
  
        <!-- Right Column for Evaluierung MA -->
        <div class="column right-column">
          <h2>Evaluierung MA</h2>
          <div
            v-for="(doc, index) in filteredDocuments.filter(doc => doc.type === 'evaluierung')"
            :key="index"
            class="card"
          >
            <div class="card-header" @click="toggleExpand(index, 'evaluierung')">
              <p><strong>Teamleiter: {{ doc.name_teamleiter }}</strong></p>
              <p>{{ doc.kunde }}</p>
              <p>MA Name: {{ doc.name_mitarbeiter }}</p>
              <p>{{ doc.datum }}</p>
            </div>
            <div class="card-body" v-if="expandedIndex === index && expandedType === 'evaluierung'">
              <p>Pünktlichkeit: {{ doc.puenktlichkeit }}</p>
              <p>Grooming: {{ doc.grooming }}</p>
              <p>Motivation: {{ doc.motivation }}</p>
              <p>Technische Fertigkeiten: {{ doc.technische_fertigkeiten }}</p>
              <p>Lernbereitschaft: {{ doc.lernbereitschaft }}</p>
              <p>Sonstiges: {{ doc.sonstiges }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
<script>
import api from "@/utils/api";
export default {
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userName: "",
      userID: "",
      userLocation: "",
      documents: [],
      filteredDocuments: [],
      uniqueLocations: [],
      selectedLocation: "",
      expandedIndex: null,
      expandedType: null,
    };
  },
  computed: {
    filterByLocation() {
      if (this.selectedLocation) {
        this.filteredDocuments = this.documents.filter(
          doc => doc.location === this.selectedLocation
        );
      } else {
        this.filteredDocuments = this.documents; // Reset to all documents
      }
    },
  },
  methods: {
    async fetchDocuments() {
      try {
        const response = await api.get("/api/reports");
        this.documents = response.data.data;
        this.filteredDocuments = this.documents; // Initialize filteredDocuments
        this.uniqueLocations = [...new Set(this.documents.map(doc => doc.location))].filter(
          loc => loc
        ); // Extract unique locations
        console.log("Fetched documents:", this.documents);
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    },
    switchToDashboard() {
      this.$router.push("/");
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me");
          this.userEmail = response.data.email;
          this.userID = response.data._id;
          this.userName = response.data.name;
          this.userLocation = response.data.location;
          this.selectedLocation = this.userLocation;
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerdaten:", error);
          this.$router.push("/");
        }
      } else {
        this.$router.push("/");
      }
    },
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    toggleExpand(index, type) {
      if (this.expandedIndex === index && this.expandedType === type) {
        this.expandedIndex = null;
        this.expandedType = null;
      } else {
        this.expandedIndex = index;
        this.expandedType = type;
      }
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchDocuments();
  },
};


</script>
<style scoped lang="scss">.window {
    width: 100%;
    max-width: 1200px;
    margin: auto;
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 8px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
    text-align: center;
  }
  
  a.discrete {
    margin-left: unset;
    margin-right: 20px;
    text-decoration: none;
    font-weight: bold;
    cursor: pointer;

  }
  
  .leftAlign {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  
  .controls {
    display: flex;
    flex-direction: row;
    gap: 10px;
  }
  
  .option {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  
    &:hover {
      color: #ffffff;
      transform: translateY(-2px);
    }

    
  }
  
  .filter {
    margin: 20px 0;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .filter label {
    font-weight: bold;
    margin-right: 10px;
    font-size: 16px;
    color: #333333;
  }
  
  .filter select {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 14px;
    cursor: pointer;
  
    &:focus {
      border-color: #0074d9;
      outline: none;
    }
  }
  
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 20px;
  
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
  
  .column {
    padding: 15px;
    text-align: left;
  }
  
  .left-column {
    border-left: 4px solid #0074d9;
  }
  
  .middle-column {
    border-left: 4px dashed #cccccc;
  }
  
  .right-column {
    border-left: 4px solid #2ecc40;
  }
  
  .card {
    background: #ffffff;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-bottom: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease, transform 0.3s ease;
  
    &:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      transform: translateY(-2px);
    }
  }
  
  .card-header {
    cursor: pointer;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: #333333;
  }
  
  .card-header p {
    margin: 0;
  }
  
  .card-body {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 14px;
    color: #555555;
  }
  
  .card-body p {
    margin: 5px 0;
  }
  
  /* Headings */
  h1, h2 {
    color: #333333;
    font-weight: bold;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 20px;
  }
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 15px;
  }
  
  /* List Styling */
  ul {
    list-style: none;
    padding: 0;
  }
  
  ul li {
    font-size: 14px;
    margin: 10px 0;
    color: #555555;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .window {
      padding: 15px;
    }
  
    .card {
      padding: 10px;
    }
  
    .option {
      padding: 5px 10px;
      font-size: 12px;
    }
  
    .filter label {
      font-size: 14px;
    }
  
    .filter select {
      font-size: 12px;
    }
  
    h1 {
      font-size: 1.5rem;
    }
  
    h2 {
      font-size: 1.25rem;
    }
  }
  

</style>
