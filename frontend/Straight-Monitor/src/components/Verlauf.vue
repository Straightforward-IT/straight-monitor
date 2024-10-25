<template>
  <div class="verlauf">
    <div class="sidebar">
      <a class="back-link" @click="$router.push('/dashboard')">Zurück</a>
      <div class="controls">
        <button @click="switchTo('graph')" :class="{ active: currentAnsicht === 'graph' }">Graph</button>
        <button @click="switchTo('table')" :class="{ active: currentAnsicht === 'table' }">Tabelle</button>
        <button @click="switchTo('overview')" :class="{ active: currentAnsicht === 'overview' }">Übersicht</button>
      </div>
    </div>

    <div class="view">
      <component :is="currentAnsichtComponent" :items="items" :monitorings="monitorings"></component>
    </div>
  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from "@/utils/api";
import GraphView from './GraphView.vue';
import TableView from './TableView.vue';
import OverviewView from './OverviewView.vue';

export default {
  name: "Verlauf",
  components: {
    FontAwesomeIcon,
    GraphView,
    TableView,
    OverviewView,
  },
  props: {
    isModalOpen: Boolean,
  },
  data() {
    return {
      token: localStorage.getItem('token') || null,
      currentAnsicht: 'graph',
      items: [],
      monitorings: [],
      selectedTimeRange: 'totalTime',
    };
  },
  computed: {
    currentAnsichtComponent() {
      return this.currentAnsicht === 'table' ? 'TableView' : 
             this.currentAnsicht === 'overview' ? 'OverviewView' : 
             'GraphView';
    }
  },
  methods: {
    setAxiosAuthToken() {
      api.defaults.headers.common['x-auth-token'] = this.token;
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me");
          if (response.status === 401) {
            this.$router.push("/");
          }
          this.userEmail = response.data.email;
          this.userID = response.data._id;
          this.userName = response.data.name;
          this.searchQuery = response.data.location;
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerdaten:", error);
          this.$router.push("/");
        }
      } else {
        this.$router.push("/");
      }
    },
    async fetchItems() {
      try {
        const response = await api.get("/api/items");
        this.items = response.data;
        console.log("Items fetched.");
      } catch (error) {
        console.error("Fehler beim Abrufen der Artikel:", error);
      }
    },
    async fetchMonitoringLogs() {
      if (this.token) {
        try {
          const response = await api.get("/api/monitoring");
          this.monitorings = response.data;
          console.log("Logs fetched.");
        } catch (error) {
          console.error("Fehler beim Abrufen der Logs:", error);
        }
      } else {
        this.$router.push("/");
      }
    },
    switchTo(view) {
      this.currentAnsicht = view;
    },
    updateTimeRange() {
      console.log('Selected time range:', this.selectedTimeRange);
      
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchItems();
    this.fetchMonitoringLogs();
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/dashboard.scss";

.verlauf {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background: #f8f8f8;

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background-color: #ffffff;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    width: auto;
    
    .back-link {
      color: #555;
      font-size: 16px;
      text-decoration: none;
      cursor: pointer;
      margin-bottom: 20px;
      &:hover {
        text-decoration: underline;
      }
    }

    .controls {
      display: flex;
      flex-direction: column;
      gap: 10px;

      button {
        padding: 10px;
        border: none;
        background-color: #ddd;
        cursor: pointer;
        text-align: left;
        border-radius: 5px;
        &.active {
          background-color: #b69de6;
          color: white;
        }
      }
    }
  }

  .view {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    align-items: center;
    padding: 20px;
    background: #f8f8f8;

    .time-range-dropdown {
      margin-top: 20px;
      align-self: flex-end;
      select {
        padding: 5px;
        font-size: 14px;
      }
    }
  }
}
</style>
