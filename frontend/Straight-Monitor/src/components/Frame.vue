<template>
  <Banner v-if="!isMobile" />

  <!-- Mobile Shortcuts -->
  <div v-if="isMobile && currentComponent === 'Bestand'" class="top">
    <Shortcuts
      :isModalOpen="isModalOpen"
      @update-modal="handleModalUpdate"
      @itemsUpdated="handleItemsUpdated"
    />
  </div>

  <div class="session">
    <div class="left">
      <img src="@/assets/SF_000.svg" alt="Logo" class="logo-svg" />
    </div>

    <form :style="{ width: formWidth }" @submit.prevent>
      <!-- Conditional rendering for the 'Logout' and 'Zurück' links -->
      <a
        class="discrete"
        v-if="currentComponent === 'Dashboard'"
        @click="logout"
        >Logout</a
      >
      <a class="discrete" v-else @click="switchToDashboard">Zurück</a>
        <div v-if="currentComponent === 'Dashboard'">
          <Dashboard
            ref="dashboardComponent"
            @switch-to-bestand="switchToBestand"
            @open-tools-bar="toggleToolsBar"
            @open-flip-bar=toggleFlipBar
          />
        </div>
        <div v-if="currentComponent === 'Bestand'">
          <Bestand
            ref="bestandComponent"
            :isModalOpen="isModalOpen"
            @update-modal="handleModalUpdate"
          />
        </div>
    </form>
    <!-- Desktop Shortcuts -->
    <div v-if="currentComponent === 'Bestand' && !isMobile" class="right">
      <Shortcuts
        ref="shortcutsComponent"
        :isModalOpen="isModalOpen"
        @update-modal="handleModalUpdate"
        @itemsUpdated="handleItemsUpdated"
      />
    </div>
    <div v-if="toolsBarOpen" class="right">
      <Tools
      :isToolBarOpen="toolsBarOpen"
      ref="toolsComponent"
      />
    </div>
    <div v-if="flipBarOpen" class="right">
      <FlipActions
      :isFlipBarOpen="flipBarOpen"
      ref="flipComponent"
      />
    </div>
  </div>
</template>

<script>
import Banner from "./LoginBanner.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import Dashboard from "./Dashboard.vue";
import Bestand from "./Bestand.vue"; // Import Bestand component
import Shortcuts from "./Shortcuts.vue";
import Tools from "./Tools.vue"
import FlipActions from "./FlipActions.vue";

export default {
  name: "Frame",
  emits: ["fetch-items"],
  components: {
    Dashboard,
    Bestand,
    Banner,
    FontAwesomeIcon,
    Shortcuts,
    Tools,
    FlipActions
  },
  data() {
    return {
      currentComponent: "Dashboard", // Set the initial component to Dashboard
      userEmail: "",
      isModalOpen: false,
      isMobile: false,
      toolsBarOpen: false,
      flipBarOpen: false,
    };
  },
  computed: {
    formWidth() {
      if (this.currentComponent === "Dashboard") {
        return "220px";
      } else if (this.isMobile) {
        return "280px";
      } else if (this.currentComponent === "Bestand") {
        return "500px";
      } else {
        return "1200px";
      }
    }
  },
  methods: {
    detectMobile() {
      this.isMobile = window.innerWidth <= 768;
    },
    handleResize() {
      this.detectMobile();
    },
    handleItemsUpdated() {
      if (this.currentComponent === "Bestand" && this.$refs.bestandComponent) {
        this.$refs.bestandComponent.fetchItems();
      }
    },
    closeToolsBar(){
        this.toolsBarOpen = false;
    },
    handleModalUpdate(state) {
      this.isModalOpen = state;
      console.log("State updated to: ", state);
    },
    async fetchUserData() {
      const token = localStorage.getItem("token"); // Assuming the token is stored in localStorage

      if (token) {
        try {
          const response = await api.get("/api/users/me", {
            headers: {
              "x-auth-token": token,
            },
          });
          this.userEmail = response.data.email; // Update with the email from the response
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        console.error("No token found");
      }
    },
    switchToBestand() {
      this.closeToolsBar();
      console.log("Switching to Bestand component");
      this.currentComponent = "Bestand"; // Switch to Bestand component
    },
    toggleToolsBar(){
      console.log("Toggling Tools Bar");
      this.toolsBarOpen = !this.toolsBarOpen;
    },
    toggleFlipBar(){
      console.log("Toggling Flip Bar");
      this.flipBarOpen = !this.flipBarOpen;
    },
    switchToDashboard() {
      this.currentComponent = "Dashboard"; // Switch back to Dashboard
    },
    logout() {
      // Perform logout action
      localStorage.removeItem("token"); // Clear token
      this.$router.push("/"); // Redirect to home or login page
    },
  },
  mounted() {
    this.detectMobile();
    window.addEventListener("resize", this.handleResize);
    this.fetchUserData();
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
  },
};
</script>

<style lang="scss">
@import "@/assets/styles/dashboard.scss";

html, body {
  height: 100vh;
  width: 100vw;
  margin: 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background: #323231;
}

.session {
  display: flex;
  flex-direction: row;
}

.left {
  display: block;
}



@media only screen and (max-width: 768px) {
  .left {
    display: none; /* Hide on mobile screens */
  }

  form {
    width: 100%;
    height: 100%;
  }
}

a.discrete {
  user-select: none;
  color: rgba(#000, 0.4);
  font-size: 14px;
  border-bottom: solid 1px rgba(#000, 0);
  cursor: pointer;
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 0px;

  &:hover {
    border-bottom: solid 1px rgba(#000, 0.2);
  }
}

.top {
  display: block;
}
</style>
