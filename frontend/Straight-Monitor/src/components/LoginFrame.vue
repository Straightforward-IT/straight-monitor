<template>
  <div class="session">
    <header class="Header-Banner">
      <!-- Header content goes here -->
    </header>
    <div class="left">
      <img src="@/assets/SF_000.svg" alt="Logo" class="logo-svg" />
    </div>
    <form @submit.prevent="submitLogin" class="log-in" autocomplete="off">
      <!-- Bedingtes Rendering basierend auf dem currentForm Zustand -->
      <LoginForm v-if="currentForm === 'login'" @switch-to-register="switchToRegister"/>
      <RegisterForm v-else @switch-to-login="switchToLogin"/>
    </form>
  </div>
</template>

<script>
import axios from 'axios';
import LoginForm from './LoginForm.vue';
import RegisterForm from './RegisterForm.vue';

export default {
  name: 'LoginFrame',
  components: {
    LoginForm,
    RegisterForm,
  },
  data() {
    return {
      currentForm: 'login', // Standardmäßig Login-Form anzeigen
    };
  },
  methods: {
    // Methode zum Wechseln zum Register-Formular
    switchToRegister() {
      this.currentForm = 'register';
    },
    // Methode zum Wechseln zum Login-Formular
    switchToLogin() {
      this.currentForm = 'login';
    },
    /*
    async submitLogin() {
      try {
        const res = await axios.post('http://localhost:5050/api/users/login', {
          email: this.email,
          password: this.password,
        });

        // Token speichern
        const token = res.data.token;
        localStorage.setItem('token', token);
        console.log('Login erfolgreich:', res.data);

        // Weiterleitung zum Dashboard
        this.$router.push('/dashboard');
        
      } catch (err) {
        console.error('Login-Fehler:', err.response?.data?.msg || err.message);
      }
    },*/
  },
};
</script>

<style scoped lang="scss">
 $primary: rgb(182,157,230); 	
@import '@/assets/styles/login.scss';
</style>
