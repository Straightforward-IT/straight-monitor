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
      <svg
        enable-background="new 0 0 100 100"
        version="1.1"
        viewBox="0 0 100 100"
        xml:space="preserve"
        xmlns="http://www.w3.org/2000/svg"
        class="icon-svg"
      >
        <g transform="translate(0 -952.36)">
          <path
            d="M50 960c-9.9 0-18 8.1-18 18s8.1 18 18 18 18-8.1 18-18-8.1-18-18-18zm0 5.3c7 0 12.7 5.7 12.7 12.7s-5.7 12.7-12.7 12.7-12.7-5.7-12.7-12.7 5.7-12.7 12.7-12.7zm-21.7 32.7c-3.8 0-7 3.1-7 7 0 11.7 9.3 21 21 21h14c11.7 0 21-9.3 21-21 0-3.9-3.2-7-7-7h-42zm0 5.4h42c.9 0 1.5.6 1.5 1.5 0 9.4-7.6 17-17 17h-14c-9.4 0-17-7.6-17-17 0-.8.6-1.4 1.5-1.5z"
          />
        </g>
      </svg>
    </div>
  </div>

  <!-- Email -->
  <div class="floating-label">
    <input
      :placeholder="
        emailError
          ? 'Nur Anmeldung mit @straightforward.email möglich'
          : 'Email'
      "
      :class="{ 'error-input': emailError }"
      type="email"
      v-model="email"
      name="email"
      id="email"
      autocomplete="off"
    />
    <label for="email">Email:</label>
    <div class="icon">
      <svg
        enable-background="new 0 0 100 100"
        version="1.1"
        viewBox="0 0 100 100"
        xml:space="preserve"
        xmlns="http://www.w3.org/2000/svg"
        class="icon-svg"
      >
        <g transform="translate(0 -952.36)">
          <path
            d="m17.5 977c-1.3 0-2.4 1.1-2.4 2.4v45.9c0 1.3 1.1 2.4 2.4 2.4h64.9c1.3 0 2.4-1.1 2.4-2.4v-45.9c0-1.3-1.1-2.4-2.4-2.4h-64.9zm2.4 4.8h60.2v1.2l-30.1 22-30.1-22v-1.2zm0 7l28.7 21c0.8 0.6 2 0.6 2.8 0l28.7-21v34.1h-60.2v-34.1z"
          />
        </g>
      </svg>
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
      <svg
        enable-background="new 0 0 24 24"
        version="1.1"
        viewBox="0 0 24 24"
        xml:space="preserve"
        xmlns="http://www.w3.org/2000/svg"
        class="icon-svg"
      >
        <rect class="st0" width="24" height="24" />
        <path class="st1" d="M19,21H5V9h14V21z M6,20h12V10H6V20z" />
        <path
          class="st1"
          d="M16.5,10h-1V7c0-1.9-1.6-3.5-3.5-3.5S8.5,5.1,8.5,7v3h-1V7c0-2.5,2-4.5,4.5-4.5s4.5,2,4.5,4.5V10z"
        />
        <path
          class="st1"
          d="m12 16.5c-0.8 0-1.5-0.7-1.5-1.5s0.7-1.5 1.5-1.5 1.5 0.7 1.5 1.5-0.7 1.5-1.5 1.5zm0-2c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5 0.5-0.2 0.5-0.5-0.2-0.5-0.5-0.5z"
        />
      </svg>
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
      emailError: false, // Error state for email
      showEmailError: false, // Controls visibility of flying tag
    };
  },
  methods: {
    async submitRegister() {
      try {
        // Check if the email ends with @straightforward.email
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

        const res = await axios.post(
          "http://localhost:5050/api/users/register",
          {
            name: this.name,
            email: this.email,
            password: this.password,
            location: this.location,
          }
        );

        // If valid, clear the error and proceed
        this.emailError = false;
        console.log("Registrierung erfolgreich:", res.data);

        // Weiterleitung nach erfolgreicher Registrierung
        this.$router.push("/dashboard");
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

</style>
