<template>
  <div class="window">
    <div class="controls">
      <!-- Sort Controls -->
      <label for="sort">Sort By:</label>
      <select v-model="sortBy" @change="sortLogs">
        <option value="benutzer">Benutzer</option>
        <option value="standort">Standort</option>
        <option value="art">Art</option>
        <option value="timestamp">Timestamp</option>
      </select>
    </div>

    <!-- Logs Display -->
    <div v-for="log in sortedLogs" :key="log._id" class="log-card">
      <div class="log-header" @click="toggleExpand(log)">
        <p><strong>Benutzer:</strong> {{ log.benutzerMail }}</p>
        <p><strong>Standort:</strong> {{ log.standort }}</p>
        <p><strong>Art:</strong> {{ log.art }}</p>
        <p><strong>Timestamp:</strong> {{ new Date(log.timestamp).toLocaleString() }}</p>
        <!-- Expand/Collapse Indicator -->
        <font-awesome-icon
          :icon="log.isExpanded ? ['fas', 'sort-up'] : ['fas', 'sort-down']"
        />
      </div>

      <!-- Expanded Item Details -->
      <div v-if="log.isExpanded" class="log-details">
        <div v-for="item in log.items" :key="item.itemId" class="item-detail">
          <p><strong>Bezeichnung:</strong> {{ item.bezeichnung }}</p>
          <p><strong>Größe:</strong> {{ item.groesse }}</p>
          <p><strong>Anzahl:</strong> {{ item.anzahl }}</p>
        </div>
        <p><strong>Anmerkung:</strong> {{ log.anmerkung || 'Keine' }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

export default {
  name: "Verlauf",
  components: {
    FontAwesomeIcon,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userName: "",
      userID: "",
      userLocation: "",
      logs: [],
      sortBy: "timestamp",
    };
  },
  computed: {
    sortedLogs() {
      return this.logs.slice().sort((a, b) => {
        if (this.sortBy === "timestamp") {
          return new Date(b.timestamp) - new Date(a.timestamp);
        } else if (this.sortBy === "benutzer") {
          return a.benutzerMail.localeCompare(b.benutzerMail);
        } else if (this.sortBy === "standort") {
          return a.standort.localeCompare(b.standort);
        } else if (this.sortBy === "art") {
          return a.art.localeCompare(b.art);
        }
      });
    },
  },
  methods: {
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
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
    async fetchLogs() {
      try {
        const response = await api.get("/api/monitoring");
        this.logs = response.data.map((log) => ({ ...log, isExpanded: false }));
      } catch (error) {
        console.error("Fehler beim Abrufen der Logs:", error);
      }
    },
    toggleExpand(log) {
      log.isExpanded = !log.isExpanded;
    },
    sortLogs() {
      // Trigger computed sorting on sort change
      this.sortedLogs;
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchLogs();
  },
};
</script>

<style scoped lang="scss">
.window {
  padding: 20px;
  background-color: #ccc;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.log-card {
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 15px;
  margin-bottom: 10px;
  cursor: pointer;
  background-color: #f9f9f9;

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .log-details {
    margin-top: 10px;
    padding-left: 15px;
    border-top: 1px solid #ddd;
  }
}
</style>
