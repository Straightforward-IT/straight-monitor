<template>
  <div class="shortcuts">
    <h4>Tools</h4>
    <div class="shortcut-container">
      <!-- <span class="list-item" @click="openAuswertung">
        <img
          src="@/assets/SF_002.png"
          id="auswertung"
          alt="Auswertung Logo"
          class="item-list-sf"
        />
        <label for="auswertung">
          <p>Auswertung</p>
        </label>
      </span> -->
      <span class="list-item" @click="openTeamleiterExcel">
        <img
          src="@/assets/SF_002.png"
          id="teamleiter-excel"
          alt="Straightforward Logo"
          class="item-list-sf"
        />
        <label for="teamleiter-excel">
          <p>Teamleiter Excel</p>
        </label>
      </span>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";

export default {
  name: "Tools",
  emits: ["open-tools-bar"],
  props: {
    isToolBarOpen: Boolean,
  },
  methods: {
    openAuswertung() {
      this.$router.push("/auswertung");
    },
    openTeamleiterExcel() {
      this.$router.push("/excelFormatierung");
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/dashboard.scss";

.shortcuts {
  text-align: center;
}

h4 {
  font-size: 20px;
  margin-bottom: 20px;
}

.shortcut-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
}

.list-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;
}

label {
  text-align: center;
  font-size: 14px;
}
</style>
