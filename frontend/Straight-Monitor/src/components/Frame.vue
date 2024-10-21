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
    <div class="left" v-if="currentComponent != 'Verlauf'">
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

      <div>
        <component
          :is="currentComponent"
          ref="currentComponentRef"
          :isModalOpen="isModalOpen"
          @update-modal="handleModalUpdate"
          @switch-to-bestand="switchToBestand"
          @switch-to-verlauf="switchToVerlauf"
        ></component>
      </div>
    </form>

    <!-- Desktop Shortcuts -->
    <div v-if="currentComponent === 'Bestand' && !isMobile" class="right">
      <Shortcuts
        :isModalOpen="isModalOpen"
        @update-modal="handleModalUpdate"
        @itemsUpdated="handleItemsUpdated"
      />
    </div>
  </div>
</template>

<script>import Banner from "./LoginBanner.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import axios from "axios";
import Dashboard from "./Dashboard.vue";
import Bestand from "./Bestand.vue"; // Import Bestand component
import Shortcuts from "./Shortcuts.vue";
import Verlauf from "./Verlauf.vue"; // Import Verlauf component

export default {
  name: "Frame",
  emits: ["fetch-items"],
  components: {
    Dashboard,
    Bestand,
    Verlauf,
    Banner,
    FontAwesomeIcon,
    Shortcuts,
  },
  data() {
    return {
      currentComponent: "Dashboard", // Set the initial component to Dashboard
      userEmail: "",
      isModalOpen: false,
      isMobile: false,
    };
  },
  computed: {
    formWidth() {
      if (this.currentComponent === "Dashboard") {
        return "220px";
      } else if (this.isMobile) {
        return "280px";
      } else if (this.currentComponent === "Bestand"){
        return "500px";
      } else {
        return "1200px"
      }
    },
    currentComponentRef() {
      if (this.currentComponent === "Bestand") return "bestandComponent";
      if (this.currentComponent === "Verlauf") return "verlaufComponent";
      return null;
    },
  },
  methods: {
    detectMobile() {
      this.isMobile = window.innerWidth <= 768;
    },
    handleResize() {
      this.detectMobile();
    },
    handleItemsUpdated() {
      if (this.currentComponent === "Bestand") {
        this.$refs.bestandComponent.fetchItems();
      } else if (this.currentComponent === "Verlauf") {
        this.$refs.verlaufComponent.fetchItems();
      }
    },
    handleModalUpdate(state) {
      this.isModalOpen = state;
      console.log("State updated to: ", state);
    },
    async fetchUserData() {
      const token = localStorage.getItem("token"); // Assuming the token is stored in localStorage

      if (token) {
        try {
          const response = await axios.get(
            "https://straight-monitor-684d4006140b.herokuapp.com/api/users/me",
            {
              headers: {
                "x-auth-token": token,
              },
            }
          );
          this.userEmail = response.data.email; // Update with the email from the response
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        console.error("No token found");
      }
    },
    switchToBestand() {
      console.log("Switching to Bestand component");
      this.currentComponent = "Bestand"; // Switch to Bestand component
    },
    switchToVerlauf() {
      console.log("Switching to Verlauf component");
      this.currentComponent = "Verlauf"; // Switch to Verlauf component
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

<style>
@import "@/assets/styles/dashboard.scss";

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
