<template>
  <div class="window">
    <div class="controls">
      <!-- Group By Controls -->
      <label>Group By:</label>
      <label>
        <input type="checkbox" v-model="groupBy.standort" @change="groupLogs" />
        Standort
      </label>
      <label>
        <input type="checkbox" v-model="groupBy.monat" @change="groupLogs" />
        Monat
      </label>
      <label>
        <input type="checkbox" v-model="groupBy.tag" @change="groupLogs" />
        Tag
      </label>
      <label>
        <input type="checkbox" v-model="groupBy.benutzer" @change="groupLogs" />
        Benutzer
      </label>
      <label>
        <input type="checkbox" v-model="groupBy.art" @change="groupLogs" />
        Art
      </label>
    </div>

    <!-- Grouped Logs -->
    <div v-if="Object.keys(groupedLogs).length > 0">
      <verlauf-group
        :grouped-data="groupedLogs"
        :active-groups="activeGroups"
        :level="0"
      ></verlauf-group>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import VerlaufGroup from "./VerlaufGroup.vue";

export default {
  name: "Verlauf",
  components: {
    FontAwesomeIcon,
    VerlaufGroup,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userName: "",
      userID: "",
      userLocation: "",
      logs: [],
      groupBy: {
        standort: true,
        monat: true,
        tag: true,
        benutzer: false,
        art: false,
      },
      groupedLogs: [],
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
        this.groupLogs(); // Automatically group after fetching
        console.log(this.logs);
      } catch (error) {
        console.error("Fehler beim Abrufen der Logs:", error);
      }
    },
    activeGroups() {
  return Object.keys(this.groupBy).filter((key) => this.groupBy[key]).map((key) => {
    // Map `benutzer` to `userID` for proper grouping
    return key === "benutzer" ? "benutzerMail" : key;
  });
},
    groupByKeys(data, keys) {
      if (keys.length === 0) return data;

      const [key, ...rest] = keys;
      const grouped = {};

      data.forEach((item) => {
        const groupKey =
          key === "monat"
            ? new Date(item.timestamp).toLocaleString("default", {
                month: "long",
              })
            : key === "tag"
            ? new Date(item.timestamp).toLocaleDateString()
            : item[key];

        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push(item);
      });

      Object.keys(grouped).forEach((groupKey) => {
        grouped[groupKey] = this.groupByKeys(grouped[groupKey], rest);
      });

      return grouped;
    },
    groupLogs() {
  const activeGroups = this.activeGroups();

  if (activeGroups.length > 0) {
    this.groupedLogs = this.groupByKeys(this.logs, activeGroups);
  } else {
    this.groupedLogs = this.logs;
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
$primary-accent: #ff7700; // Orange accent color
$background-gray: #f3f4f6; // Light gray background
$card-gray: #e2e3e8; // Slightly darker gray for cards
$text-dark: #333; // Dark text color
$text-light: #555; // Lighter text for details

input {
  height: unset;
  margin-right: 5px;
  margin-top: 5px;
  width: unset;
}

.window {
  padding: 20px;
  background-color: $background-gray;
  font-family: Arial, sans-serif;
  min-height: 100vh;
  width: 1000px;
  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    font-size: 14px;
    justify-content: space-between;

    label {
      font-weight: bold;
      color: $text-dark;
      padding: 10px;
    }

    select {
      padding: 5px 10px;
      border: 1px solid $card-gray;
      border-radius: 4px;
      background-color: white;
      font-size: 14px;
      color: $text-dark;
      transition: border-color 0.3s;

      &:hover {
        border-color: $primary-accent;
      }

      &:focus {
        outline: none;
        border-color: $primary-accent;
      }
    }
  }

  .log-card {
    border: 1px solid $card-gray;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 15px;
    cursor: help;
    background-color: white;
    box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.15);
    }

    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      p {
        margin: 0;
        font-size: 14px;
        color: $text-dark;

        &:last-child {
          margin-left: auto;
          font-weight: bold;
        }
      }

      .fa-icon {
        margin-left: 10px;
        font-size: 18px;
        color: $primary-accent;
        transition: transform 0.3s;

        &:hover {
          transform: rotate(180deg);
        }
      }
    }

    .log-details {
      margin-top: 15px;
      padding: 10px 15px;
      background-color: $card-gray;
      border-radius: 6px;

      .item-detail {
        margin-bottom: 10px;

        p {
          margin: 0 0 5px;
          font-size: 13px;
          color: $text-light;

          strong {
            color: $text-dark;
          }
        }
      }

      p:last-child {
        margin-top: 10px;
        font-size: 13px;
        font-style: italic;
        color: $text-dark;
      }
    }
  }
}
</style>
