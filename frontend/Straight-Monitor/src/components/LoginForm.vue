<template>
      <h4>Wir sind <span>Straightforward</span></h4>
      <p>Schön, dass du hier bist. Bitte melde dich an.</p>
      <div class="floating-label">
        <input
          placeholder="Email"
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
      <button type="submit" @click="submitLogin">Log in</button>
      <a class="discrete" @click="$emit('switch-to-register')">
      Register
    </a>
   
</template>

<script>
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

export default {
  name: 'LoginForm',
  components: {
    FontAwesomeIcon,
  },
  emits: ['switch-to-register'],
  data() {
    return {
      email: '',
      password: '',
    };
  },
  methods: {
    async submitLogin() {
      try {
        const res = await axios.post('http://localhost:5050/api/users/login', {
          email: this.email,
          password: this.password,
        });

        // Save the token to localStorage
        const token = res.data.token;
        localStorage.setItem('token', token);
        console.log('Login successful:', res.data);

        // Redirect to the dashboard
        this.$router.push('/dashboard');
        
      } catch (err) {
        console.error('Login error:', err.response?.data?.msg || err.message);
        // Display error message in UI if needed
      }
    },
  },
};
</script>

<style scoped lang="scss">
 $primary: rgb(182,157,230); 	
@import '@/assets/styles/login.scss';
</style>
