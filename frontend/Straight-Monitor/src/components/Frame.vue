<template>
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
      <a class="discrete" v-else @click="switchToDashboard">Zurück zum Dashboard</a>
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
      this.closeFlipBar();
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
     closeToolsBar(){
        this.toolsBarOpen = false;
    },
    closeFlipBar(){
      this.flipBarOpen = false;
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

<style scoped lang="scss">
@import "@/assets/styles/global.scss"; 


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


.top {
  display: block;
}

form {
  padding: 10px 30px;
  background: #fefefe;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 20px;
  width: 500px;

  h4 {
    margin-bottom: 20px;
    color: rgba(#000, 0.5);
    span {
      color: rgba(#000, 1);
      font-weight: 700;
    }
  }
  p {
    line-height: 155%;
    margin-bottom: 5px;
    font-size: 14px;
    color: #000;
    opacity: 0.65;
    font-weight: 400;
    max-width: 200px;
    margin-bottom: 40px;
  }
}

button {
  user-select: none;
  width: auto;
  border-radius: 24px;
  text-align: center;
  padding: 15px 40px;
  margin-top: 5px;
  color: #fff;
  font-size: 14px;
  margin-left: auto;
  font-weight: 500;
  box-shadow: 0px 2px 6px -1px rgba(0, 0, 0, 0.13);
  border: none;
  outline: 0;
}
.modal {
  z-index: 10;
}
.close-modal {
  position: absolute;
  cursor: pointer;
  bottom: 94%;
  left: 95%; /* Place the button at the top-right corner */
  background-color: white;
  color: #e3e3e3;
  border: 1px solid gray;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    color: #999;
  }
}

.floating-label {
  transition: all 0.3s ease;
  &:hover {
    cursor: pointer;
    transform: translateY(-3px);
    box-shadow: 0px 10px 20px 0px rgba(0, 0, 0, 0.2);
    &:active {
      transform: scale(0.99);
    }
  }
  button {
    margin-top: 0px;
  }
  .icon {
    height: 48px !important;
  }
}
.inactive {
  transition: unset;
  &:hover {
    cursor: unset;
    transform: unset;
    box-shadow: unset;
  }
  button {
    background-color: #e0e0e0;
  }
}


.floating-label {
  position: relative;
  margin-bottom: 10px;
  width: 100%;
  label {
    position: absolute;
    top: calc(50% - 7px);
    left: 0;
    opacity: 0;
    transition: all 0.3s ease;
    padding-left: 44px;
  }
  input {
    width: calc(100% - 44px);
    margin-left: auto;
    display: flex;
  }
  .icon {
    position: absolute;
    top: 0;
    left: 0;
    height: 56px;
    width: 44px;
    display: flex;
    svg {
      height: 30px;
      width: 30px;
      margin: auto;
      opacity: 0.15;
      transition: all 0.3s ease;
      path {
        transition: all 0.3s ease;
      }
    }
  }
  input:not(:placeholder-shown) {
    padding: 28px 0px 12px 0px;
  }
  input:not(:placeholder-shown) + label {
    transform: translateY(-10px);
    opacity: 0.7;
  }
  input:valid:not(:placeholder-shown) + label + .icon {
    svg {
      opacity: 1;
    }
  }
  input:not(:valid):not(:focus) + label + .icon {
    animation-name: shake-shake;
    animation-duration: 0.3s;
  }
}
$displacement: 3px;
@keyframes shake-shake {
  0% {
    transform: translateX(-$displacement);
  }
  20% {
    transform: translateX($displacement);
  }
  40% {
    transform: translateX(-$displacement);
  }
  60% {
    transform: translateX($displacement);
  }
  80% {
    transform: translateX(-$displacement);
  }
  100% {
    transform: translateX(0px);
  }
}
.session {
  display: flex;
  flex-direction: row;
  width: auto;
  height: auto;
  margin: auto auto;
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 0px 0px 20px 10px rgba(255, 255, 255, 0.2);
}
.left {
  width: 220px;
  height: auto;
  min-height: 100%;
  position: relative;
  background-image: url("@/assets/SF_001.jpg");
  background-position: 60% center;
  background-size: cover;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  box-shadow: 10px 0px 20px -5px rgba(0, 0, 0, 0.1);
  svg {
    height: 40px;
    width: auto;
    margin: 20px;
  }
}

.right {
  padding: 15px 15px;
  box-shadow: -10px 0px 20px -5px rgba(0, 0, 0, 0.1);
  background: #fefefe;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 20px;
  width: 160px;

  h4 {
    margin-bottom: 20px;
    color: rgba(#000, 0.5);
    span {
      color: rgba(#000, 1);
      font-weight: 700;
    }
  }

  .shortcut-container {
    font-size: 14px;
    color: #000;
    opacity: 0.65;
    font-weight: 400;

    .item-list-sf {
      width: 30px; /* Adjust the width as needed */
      height: auto; /* Maintain aspect ratio */
      margin: 5px;
      cursor: pointer;
    }
  }
}
.list-item {
  display: flex;
  flex-direction: row;
  align-items: center;
}

/* src/assets/base.scss or any global stylesheet */
.logo-svg .st01 {
  fill: #fff;
}
.icon-svg .st0 {
  fill: none;
}
.icon-svg .st1 {
  fill: #010101;
}

.logo-svg {
  width: 50px; /* Adjust the width as needed */
  height: auto; /* Maintain aspect ratio */
  margin: 20px 0px 0px 10px;
  /* Add other styles if needed */
}

html, body {
  height: 100vh;
  width: 100vw;
  margin: 0 0;
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
  margin-top: 4px;

  &:hover {
    border-bottom: solid 1px rgba(#000, 0.2);
  }
}

.top {
  display: block;
}
</style>
