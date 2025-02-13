<template>
  <h4>Registriere dich bei <span>Straightforward</span></h4>
  <p>Erstelle ein Konto, um loszulegen.</p>

  <!-- Standort -->
  <div class="floating-label">
    <select v-model="location" name="location" id="location">
      <option value="" disabled>Standort wählen</option>
      <option value="Berlin">Berlin</option>
      <option value="Hamburg">Hamburg</option>
      <option value="Köln">Köln</option>
    </select>
    <label for="location">Standort:</label>
  </div>

  <!-- Name -->
  <div class="floating-label">
    <input
      placeholder="Name"
      type="text"
      v-model="name"
      name="name"
      id="name"
      autocomplete="off"
    />
    <label for="name">Name:</label>
    <div class="icon">
      <!-- Add your icon here -->
    </div>
  </div>

  <!-- Email -->
  <div class="floating-label">
    <input
      :placeholder="emailError ? 'Nur Anmeldung mit @straightforward.email möglich' : 'Email'"
      :class="{ 'error-input': emailError }"
      type="email"
      v-model="email"
      @input="normalizeEmail"
      name="email"
      id="email"
      autocomplete="off"
    />
    <label for="email">Email:</label>
    <div class="icon">
      <!-- Add your icon here -->
    </div>
  </div>

  <!-- Passwort -->
  <div class="floating-label">
    <input
      placeholder="Passwort"
      type="password"
      v-model="password"
      name="password"
      id="password"
      autocomplete="off"
    />
    <label for="password">Passwort:</label>
    <div class="icon">
      <!-- Add your icon here -->
    </div>
  </div>

  <!-- Passwort Bestätigung -->
  <div class="floating-label">
    <input
      placeholder="Passwort bestätigen"
      type="password"
      v-model="confirmPassword"
      :class="{ 'error-input': passwordError }"
      name="confirm-password"
      id="confirm-password"
      autocomplete="off"
    />
    <label for="confirm-password">Passwort bestätigen:</label>
    <div class="icon">
      <!-- Add your icon here -->
    </div>
  </div>

  <button type="submit" @click="submitRegister()">Register</button>

  <!-- Link zum Login-Formular -->
  <a class="discrete" @click="$emit('switch-to-login')">Login</a>

  <!-- Confirmation Modal -->
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>Registrierung erfolgreich!</h3>
        <p>Bitte prüfe deine E-Mails, um dein Konto zu bestätigen.</p>
        <button @click="showModal = false">OK</button>
      </div>
    </div>
</template>

<script>
import api from "@/utils/api";

export default {
  name: "RegisterForm",
  components: {},
  emits: ["switch-to-login"],
  data() {
    return {
      name: "",
      email: "",
      location: "",
      password: "",
      confirmPassword: "",
      emailError: false,
      passwordError: false, 
      showEmailError: false, 
      showModal: false, 
    };
  },
  methods: {
    // Normalize the email input to lowercase
    normalizeEmail() {
      this.email = this.email.toLowerCase().trim();
    },

    // Submit registration form
    async submitRegister() {
      try {
        if (!this.email.endsWith("@straightforward.email")) {
          this.emailError = true;
          this.email = ""; 
          setTimeout(() => {
            this.emailError = false;
          }, 3000);
          return;
        }

        if (this.password !== this.confirmPassword) {
          this.passwordError = true; 
          return;
        }

        this.passwordError = false;

        await api.post("/api/users/register", {
          name: this.name,
          email: this.email,
          password: this.password,
          location: this.location,
        }, {
          withCredentials: true,
        });

        this.emailError = false;
        this.showModal = true; // Show confirmation modal

      } catch (err) {
        console.error("Registrierungsfehler:", err.response?.data?.msg || err.message);
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/login.scss";

/* Add red color to input when error occurs */
.error-input {
  border-color: red;
  &::placeholder {
    color: red;
    font-size: 10px;
  }
  
}

select {
  width: 100%;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

button {
  margin-top: 15px;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  width: 90%;
  max-width: 400px;
}

.modal-content h3 {
  color: #1d1d1d;
  margin-bottom: 10px;
}

.modal-content p {
  color: #333;
}
form{
  p{
    max-width: unset;
  }
}

.modal-content button {
  background-color: primary;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.modal-content button:hover {
  background-color: primary;
}
</style>
