<template>
    <div class="window">
      <div class="leftAlign" style="text-align: left">
        <a class="discrete" @click="switchToDashboard">Zurück</a>
        <div class="controls">
          <button class="option">Evaluierung</button>
          <button class="option">Reports</button>
        </div>
      </div>
  
      <h1>Evaluierung</h1>
  
      <div class="grid">
        <!-- Left Column for Laufzettel -->
        <div class="column left">
          <h2>Laufzettel</h2>
          <ul>
            <li v-for="(doc, index) in documents.filter(doc => doc.type === 'laufzettel')" :key="index">
              {{ doc.name }} ({{ doc.location }})
            </li>
          </ul>
        </div>
  
        <!-- Middle Column (Blank for Now) -->
        <div class="column middle">
          <h2>Coming Soon</h2>
        </div>
  
        <!-- Right Column for Evaluierung MA -->
        <div class="column right">
          <h2>Evaluierung MA</h2>
          <ul>
            <li v-for="(doc, index) in documents.filter(doc => doc.type === 'evaluierung')" :key="index">
              {{ doc.name_teamleiter }} - {{ doc.kunde }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </template>
  
<script>
import api from "@/utils/api";

export default {
  name: "Personal",
  emits: [],
  props: {},
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userName: "",
      userID: "",
      userLocation: "",
      documents: [],
    };
  },
  methods: {
    async fetchDocuments() {
  try {
    // Fetch documents from the API
    const response = await api.get("/api/reports");
    this.documents = response.data.data; // Replace the documents array with fetched data
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
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchDocuments();
  },
};
</script>
<style scoped lang="scss">
.window {
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
}

.leftAlign {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  margin-bottom: 10px;
}

.controls {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.option {
  padding: 5px;
  border: unset;
  margin: 3px;
  border-radius: 5px;
  margin-top: unset;
  cursor: pointer;

  &:hover {
    transform: translateY(-1px);
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  margin-top: 20px;
}

.column {
  background: #ffffff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: left;
}

.column.left {
  border: 2px solid #0074d9; /* Blue border for left */
}

.column.middle {
  border: 2px dashed #cccccc; /* Dashed gray border for middle */
}

.column.right {
  border: 2px solid #2ecc40; /* Green border for right */
}

h2 {
  margin-bottom: 15px;
  color: #333333;
  font-size: 1.5rem;
}

ul {
  list-style: none;
  padding: 0;
}

ul li {
  margin: 10px 0;
  font-size: 1rem;
}
</style>
