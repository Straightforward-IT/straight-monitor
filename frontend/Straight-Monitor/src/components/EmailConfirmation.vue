<template>
  <div class="email-confirmation">
    <div class="confirmation-container">
      <h2>Bestätigung</h2>

      <!-- Status / Server-Nachricht -->
      <div v-if="token || confirmationMessage">
        <div v-if="confirmationMessage" class="message">
          <p>{{ confirmationMessage }}</p>
        </div>
        <div v-else class="status">
          <p>Bitte warten, deine E-Mail wird bestätigt …</p>
        </div>
      </div>

      <!-- Kein Token -> Resend -->
      <div v-if="!token" class="resend">
        <p>Kein Bestätigungstoken gefunden.</p>
        <p>Gib deine E-Mail ein, um die Bestätigung erneut zu senden.</p>

        <input
          type="email"
          v-model.trim="email"
          placeholder="E-Mail eingeben"
          class="email-input"
          autocomplete="email"
        />
        <button
          @click="resendConfirmation"
          :disabled="isResending || !validEmail"
          :aria-busy="isResending"
        >
          {{ isResending ? "Sende …" : "Bestätigung erneut senden" }}
        </button>
      </div>

      <router-link to="/" class="app-link">Zur App</router-link>
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
      token: this.$route.query.token || null,
      isResending: false
    };
  },
  computed: {
    validEmail() {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email || "");
    }
  },
  async mounted() {
    if (this.token) {
      try {
        const { data } = await api.post("/api/users/confirm-email", { token: this.token });
        this.confirmationMessage = data.msg || "E-Mail erfolgreich bestätigt.";
      } catch (error) {
        console.error("Confirmation failed:", error);
        this.confirmationMessage =
          error.response?.data?.msg || "Fehler bei der Bestätigung der E-Mail.";
      }
    }
  },
  methods: {
    async resendConfirmation() {
      if (!this.validEmail) {
        alert("Bitte eine gültige E-Mail eingeben.");
        return;
      }
      this.isResending = true;
      try {
        const { data } = await api.post("/api/users/resend-confirmation", { email: this.email });
        this.confirmationMessage = data.msg || "Bestätigung wurde erneut gesendet.";
      } catch (error) {
        console.error("Error resending confirmation:", error);
        if (error.response?.status === 400) {
          this.confirmationMessage = "Diese E-Mail wurde bereits bestätigt. Du kannst dich einloggen.";
        } else {
          this.confirmationMessage =
            error.response?.data?.msg || "Fehler beim erneuten Senden der Bestätigung.";
        }
      } finally {
        this.isResending = false;
      }
    }
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";
/* nutzt die globalen CSS-Variablen wie --bg, --panel, --text, --border, --primary, --muted, --shadow … */

.email-confirmation{
  min-height: 100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background: var(--bg);
  color: var(--text);
  padding: 16px;
}

.confirmation-container{
  width: 100%;
  max-width: 420px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,.15));
  padding: 24px;
  text-align: center;
}

h2{
  margin: 0 0 10px;
  font-size: 1.5rem;
}

.status p{ color: var(--muted); }

.message{
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 10%, var(--panel));
  color: var(--text);
  font-weight: 600;
  margin-bottom: 16px;
}

.resend{
  margin-top: 10px;
}

.email-input{
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg, var(--panel));
  color: var(--text);
  transition: border-color .2s, box-shadow .2s;
}
.email-input:focus{
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
}

button{
  display:inline-block;
  margin-top: 12px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform .08s, filter .2s, box-shadow .2s;
  box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--primary) 50%, transparent);
}
button:hover:not(:disabled){
  filter: brightness(.96);
  transform: translateY(-1px);
}
button:disabled{
  opacity: .6;
  cursor: not-allowed;
  transform: none;
}

.app-link{
  display:inline-block;
  margin-top: 16px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  transition: transform .08s, filter .2s, box-shadow .2s;
  box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--primary) 50%, transparent);
}
.app-link:hover{
  filter: brightness(.96);
  transform: translateY(-1px);
}
</style>
