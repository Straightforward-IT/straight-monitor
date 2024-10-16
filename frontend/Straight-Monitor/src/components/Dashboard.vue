<template>
    <h4>Straight <span>Dashboard</span></h4>
    <p>Benutzer: {{ userName }}</p>
    <div class="floating-label">
      <button @click="$emit('switch-to-bestand')">Bestand</button>
      <div class="icon">
        <font-awesome-icon :icon="['fas', 'warehouse']" />
      </div>
    </div>
    <div class="floating-label inactive">
      <button @click="$emit('switch-to-verlauf')">Verlauf</button>
      <div class="icon">
        <font-awesome-icon :icon="['fas', 'timeline']" />
      </div>
      
    </div>
    <div class="floating-label inactive">
      <button>Flip</button>
        <div class="icon">
        <img src="@/assets/flip_sw.png" alt="Flip Icon" />
      </div>
    </div>
   
  </template>
  
  <script>
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
  import axios from 'axios';
  
  export default {
    name: 'Dashboard',
    emits: ['switch-to-bestand', "update-modal", "switch-to-dashboard", , "switch-to-verlauf"],
    components: {
      FontAwesomeIcon,
    },
    data() {
      return {
        token: localStorage.getItem('x-auth-token') || null,
        userName: '   ',
      };
    },
    watch: {
    token(newToken){
      if (newToken) {
        localStorage.setItem('token', newToken);
      }else{
        localStorage.removeItem('token');
      }
    }
  },
    methods: {
      setAxiosAuthToken(){
      axios.defaults.headers.common['x-auth-token'] = this.token;
    },
      setAxiosAuthToken(){
      axios.defaults.headers.common['x-auth-token'] = this.token;
    },
      async fetchUserData() {
        const token = localStorage.getItem('token'); // Assuming the token is stored in localStorage
  
        if (this.token) {
          try {
            const response = await axios.get('https://straight-monitor-684d4006140b.herokuapp.com/api/users/me', {
            });
            this.userName = response.data.name; // Update with the email from the response
          } catch (error) {
            console.error('Error fetching user data:', error);
            this.$router.push("/");
          }
        } else {
          console.error('No token found');
          this.$router.push("/");
        }
      },
    },
    mounted() {
      this.fetchUserData();
      this.setAxiosAuthToken();
      this.setAxiosAuthToken();
    },
  };
  </script>
  
  <style scoped lang="scss">
  @import '@/assets/styles/dashboard.scss';
  $primary: #f5f5f5;
  button {
    flex-grow: 1;
    width: 100%;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 5px;
    cursor: pointer;
    text-align: center;

    
  }

  img{
    height: 35px;
    width: 35px;
    margin: auto;
    margin-top: 2px;
    margin-right: 5px;
    opacity: 0.30;
    transition: opacity 0.3s;
  }
  
  </style>
  