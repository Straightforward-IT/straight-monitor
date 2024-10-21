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

  <button type="submit" @click="submitRegister">Register</button>

  <!-- Link zum Login-Formular -->
  <a class="discrete" @click="$emit('switch-to-login')">Login</a>
</template>

<script>
import axios from "axios";

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
      emailError: false, // Error state for email
      passwordError: false, // Error state for password mismatch
      showEmailError: false, // Controls visibility of flying tag
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
        // Check if email ends with @straightforward.email
        if (!this.email.endsWith("@straightforward.email")) {
          this.emailError = true; // Set error state
          this.showEmailError = true; // Show flying tag
          this.email = ""; // Clear the email input field

          // Hide the flying tag after 3 seconds
          setTimeout(() => {
            this.showEmailError = false;
          }, 3000);
          return;
        }

        // Check if password and confirm password are equal
        if (this.password !== this.confirmPassword) {
          this.passwordError = true; // Set error state for mismatched passwords
          return;
        }

        // Clear error if passwords match
        this.passwordError = false;

        const res = await axios.post(
          "https://straight-monitor-684d4006140b.herokuapp.com/api/users/register",
          {
            name: this.name,
            email: this.email,
            password: this.password,
            location: this.location,
          },{
          withCredentials: true,
        }
        );

        // If valid, clear the error and proceed
        this.emailError = false;
        console.log("Registrierung erfolgreich:", res.data);

        // Save the token to localStorage
        const token = res.data.token;
        localStorage.setItem('token', token);

        // Redirect to the dashboard
        this.$router.push('/dashboard');
      } catch (err) {
        console.error(
          "Registrierungsfehler:",
          err.response?.data?.msg || err.message
        );
      }
    },
  },
};
</script>

<style scoped lang="scss">
$primary: rgb(182, 157, 230);
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
</style>
