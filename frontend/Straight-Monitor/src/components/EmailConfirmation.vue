<template>
    <div class="email-confirmation">
      <h2>Email Bestätigung</h2>
      <div v-if="confirmationMessage" class="message">
        <p>{{ confirmationMessage }}</p>
      </div>
      <div v-else>
        <p>Bitte warten, deine E-Mail wird bestätigt...</p>
      </div>
    </div>
  </template>
  
  <script>
  import api from "@/utils/api";
  
  export default {
    name: "EmailConfirmation",
    data() {
      return {
        confirmationMessage: null
      };
    },
    async mounted() {
      const token = this.$route.query.token; // Capture token from URL
      if (token) {
        try {
          // Send token to the backend to confirm email
          const response = await api.post("/api/users/confirm-email", { token });
          this.confirmationMessage = response.data.msg;
        } catch (error) {
          console.error("Confirmation failed:", error);
          this.confirmationMessage = error.response?.data?.msg || "Fehler bei der Bestätigung der E-Mail.";
        }
      } else {
        this.confirmationMessage = "Kein Bestätigungstoken gefunden.";
      }
    }
  };
  </script>
  
  <style scoped lang="scss">
  .email-confirmation {
    padding: 20px;
    text-align: center;
  }
  .message {
    color: #4CAF50;
    font-weight: bold;
  }
  </style>
  