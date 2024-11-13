<template>
    <div class="email-confirmation">
      <div class="confirmation-container">
        <h2>Email Bestätigung</h2>
  
        <div v-if="confirmationMessage" class="message">
          <p>{{ confirmationMessage }}</p>
        </div>
        <div v-else>
          <p>Bitte warten, deine E-Mail wird bestätigt...</p>
        </div>
  
        <div v-if="!token">
          <p>Kein Bestätigungstoken gefunden.</p>
          <p>Gib deine E-Mail ein, um die Bestätigung erneut zu senden.</p>
          <input
            type="email"
            v-model="email"
            placeholder="E-Mail eingeben"
            class="email-input"
          />
          <button @click="resendConfirmation" :disabled="isResending">
            Bestätigung erneut senden
          </button>
        </div>
  
        <router-link v-if="token" to="/" class="app-link">Zur App</router-link>
      </div>
    </div>
  </template>
  
  <script>
  import api from "@/utils/api";
  
  export default {
    name: "EmailConfirmation",
    data() {
      return {
        confirmationMessage: null,
        email: "",
        token: this.$route.query.token,
        isResending: false
      };
    },
    async mounted() {
      if (this.token) {
        try {
          const response = await api.post("/api/users/confirm-email", { token: this.token });
          this.confirmationMessage = response.data.msg;
        } catch (error) {
          console.error("Confirmation failed:", error);
          this.confirmationMessage = error.response?.data?.msg || "Fehler bei der Bestätigung der E-Mail.";
        }
      }
    },
    methods: {
      async resendConfirmation() {
        if (!this.email) {
          alert("Bitte E-Mail eingeben.");
          return;
        }
  
        this.isResending = true;
  
        try {
          const response = await api.post("/api/users/resend-confirmation", { email: this.email });
          this.confirmationMessage = response.data.msg;
        } catch (error) {
          console.error("Error resending confirmation:", error);
          this.confirmationMessage = error.response?.data?.msg || "Fehler beim erneuten Senden der Bestätigung.";
        } finally {
          this.isResending = false;
        }
      }
    }
  };
  </script>
  
  <style scoped lang="scss">
  .email-confirmation {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f8f8f8;
  }
  
  .confirmation-container {
    max-width: 400px;
    width: 100%;
    background-color: #fff;
    padding: 30px;
    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    text-align: center;
  }
  
  h2 {
    font-size: 1.5rem;
    color: #333;
    margin-bottom: 15px;
  }
  
  .message {
    color: #4CAF50;
    font-weight: bold;
    margin-bottom: 20px;
  }
  
  .app-link {
    display: inline-block;
    margin-top: 20px;
    padding: 10px 20px;
    color: #fff;
    background-color: #4CAF50;
    border-radius: 5px;
    text-decoration: none;
    font-weight: bold;
    transition: background-color 0.3s ease;
  }
  
  .app-link:hover {
    background-color: #43a047;
  }
  
  .email-input {
    width: 100%;
    padding: 8px;
    font-size: 1rem;
    margin-top: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  button {
    display: inline-block;
    margin-top: 15px;
    padding: 10px 20px;
    color: #fff;
    background-color: #4CAF50;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  
  button:disabled {
    background-color: #ddd;
    cursor: not-allowed;
  }
  
  button:hover:not(:disabled) {
    background-color: #43a047;
  }
  </style>
  