<template>
  <main class="login-test-page">
    <section class="login-test-card" aria-label="Anmeldung">
      <header class="login-test-head">
        <div class="login-test-title">
          <img :src="logoImage" alt="" />
          <span>Monitor</span>
        </div>
        <nav class="login-test-segmented" aria-label="Anmeldeoptionen">
          <button
            type="button"
            :class="{ active: currentForm === 'login' }"
            :aria-pressed="currentForm === 'login'"
            @click="currentForm = 'login'"
          >
            Login
          </button>
          <button
            type="button"
            :class="{ active: currentForm === 'register' }"
            :aria-pressed="currentForm === 'register'"
            @click="currentForm = 'register'"
          >
            Registrieren
          </button>
        </nav>
      </header>

      <div class="login-test-content">
        <figure class="login-test-visual">
          <img
            :src="loginImage"
            alt="Straightforward Mitarbeiter im Einsatz"
          />
          <div class="login-test-visual-shade" aria-hidden="true"></div>
          <figcaption>
            <strong>Monitor</strong>
            <span>Willkommen zurück.</span>
          </figcaption>
        </figure>

        <div class="login-test-panel">
          <LoginForm
            v-if="currentForm === 'login'"
            @switch-to-register="currentForm = 'register'"
          />
          <RegisterForm
            v-else
            @switch-to-login="currentForm = 'login'"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import LoginForm from "@/components/LoginForm.vue";
import RegisterForm from "@/components/RegisterForm.vue";
import loginImage from "@/assets/SF_001.jpg";
import logoImage from "@/assets/SF_002.png";

const currentForm = ref("login");
</script>

<style lang="scss" src="../assets/styles/login.scss"></style>