<template>
  <div class="group-container">
    <template v-for="(group, key) in groupedData" :key="key">
      <!-- Group Header -->
      <div class="group-header" @click="toggleExpand(key)">
        <h4>{{ activeGroups[level] }} {{ key }}</h4>
        <font-awesome-icon
          :icon="expanded[key] ? ['fas', 'sort-down'] : ['fas', 'sort-up']"
        />
      </div>

      <!-- Group Children -->
      <div v-if="expanded[key]" class="group-children">
        <!-- Render Subgroups Recursively -->
        <verlauf-group
          v-if="isGroup(group)"
          :grouped-data="group"
          :active-groups="activeGroups"
          :level="level + 1"
        ></verlauf-group>

        <!-- Render Logs if Leaf Node -->
        <div v-else>
          <div
            v-for="log in group"
            :key="log._id"
            class="log-card"
            @click="toggleExpandLog(log)"
          >
            <div class="log-header">
              <p><strong>Benutzer:</strong> {{ log.benutzerMail }}</p>
              <p><strong>Standort:</strong> {{ log.standort }}</p>
              <p><strong>Art:</strong> {{ log.art }}</p>
              <p>
                <strong>Timestamp:</strong>
                {{ new Date(log.timestamp).toLocaleString() }}
              </p>
            </div>
            <!-- Expanded Item Details -->
            <div v-if="log.isExpanded" class="log-details">
              <div
                v-for="item in log.items"
                :key="item.itemId"
                class="item-detail"
              >
                <p><strong>Bezeichnung:</strong> {{ item.bezeichnung }}</p>
                <p><strong>Größe:</strong> {{ item.groesse }}</p>
                <p><strong>Anzahl:</strong> {{ item.anzahl }}</p>
              </div>
              <p><strong>Anmerkung:</strong> {{ log.anmerkung || "Keine" }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: "VerlaufGroup",
  props: {
    groupedData: Object,
    activeGroups: Array,
    level: Number,
  },
  data() {
    return {
      expanded: {}, // Reactive state for expanded groups
    };
  },
  methods: {
    toggleExpand(key) {
      this.expanded[key] = !this.expanded[key];
    },
    toggleExpandLog(log) {
      log.isExpanded = !log.isExpanded;
      console.log(this.expanded);
    },
    isGroup(group) {
      return typeof group === "object" && !Array.isArray(group);
    },
  },
};
</script>

<style scoped>
.group-container {
  margin-top: 15px;
  padding-left: 15px;
  border-left: 2px solid #1d1d1d6e;
}

.group-header {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #e2e3e8;
  border-radius: 5px;
  transition: background-color 0.3s;

  &:hover {
    background-color: #f9f9f9;
  }
}

h4{
    font-size: 16px;
}
.group-children {
  margin-top: 10px;
}

.log-card {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0;
  background-color: #f9f9f9;
}
</style>
