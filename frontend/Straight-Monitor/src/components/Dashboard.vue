<template>
    <h4>Straight <span>Dashboard</span></h4>
    <p>Benutzer: {{ userName }}</p>
    <div class="floating-label">
      <button @click="$emit('switch-to-bestand')">Bestand</button>
      <div class="icon">
        <font-awesome-icon :icon="['fas', 'warehouse']" />
      </div>
    </div>
    <div class="floating-label">
      <button @click="switchToVerlauf">Verlauf</button>
      <div class="icon">
        <font-awesome-icon :icon="['fas', 'timeline']" />
      </div>
    </div>
    <!-- <div class="floating-label">
      <button @click="switchToPersonal">Personal</button>
      <div class="icon">
        <font-awesome-icon :icon="['fas', 'person-through-window']" />
      </div>
    </div> -->
    <div class="floating-label">
      <button @click="$emit('open-tools-bar')">Tools</button>
      <div class="icon">
        <font-awesome-icon :icon="['fas', 'list']" />
      </div>
    </div>
    <div class="floating-label">
      <button @click="$emit('open-flip-bar')">Flip</button>
        <div class="icon">
        <img src="@/assets/flip_sw.png" alt="Flip Icon" />
      </div>
    </div>

   
  </template>
  
  <script>
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
  import api from '@/utils/api';

  export default {
    name: 'Dashboard',
    emits: ['switch-to-bestand', "update-modal", "switch-to-dashboard", "open-tools-bar", "open-flip-bar"],
    components: {
      FontAwesomeIcon,
    },
    data() {
      return {
        token: localStorage.getItem('token') || null,
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
      api.defaults.headers.common['x-auth-token'] = this.token;
    },
      async fetchUserData() {
        if (this.token) {
          try {
            
            const response = await api.get('/api/users/me', {
            });
            this.userName = response.data.name; 
          } catch (error) {
            console.error('Error fetching user data:', error);
            this.$router.push("/");
          }
        } else {
          console.error('No token found');
          this.$router.push("/");
        }
      },
      switchToVerlauf(){
        this.$router.push('/verlauf');
      },
      switchToPersonal(){
        this.$router.push('/personal')
      },
    },
    mounted() {
      this.setAxiosAuthToken();
      this.fetchUserData();
    },
  };
  </script>
  
  <style scoped lang="scss">
@import "@/assets/styles/global.scss"; 

.session {
  display: flex;
  flex-direction: row;
}

.left {
  display: block;
}



@media only screen and (max-width: 768px) {
  .left {
    display: none; /* Hide on mobile screens */
  }

  form {
    width: 100%;
    height: 100%;
  }
}

a.discrete {
  user-select: none;
  color: rgba(#000, 0.4);
  font-size: 14px;
  border-bottom: solid 1px rgba(#000, 0);
  cursor: pointer;
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 0px;

  &:hover {
    border-bottom: solid 1px rgba(#000, 0.2);
  }
}

.top {
  display: block;
}

form {
  padding: 40px 30px;
  background: #fefefe;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 20px;
  width: 500px;

  h4 {
    margin-bottom: 20px;
    color: rgba(#000, 0.5);
    span {
      color: rgba(#000, 1);
      font-weight: 700;
    }
  }
  p {
    line-height: 155%;
    margin-bottom: 5px;
    font-size: 14px;
    color: #000;
    opacity: 0.65;
    font-weight: 400;
    max-width: 200px;
    margin-bottom: 40px;
  }
}
a.discrete {
  user-select: none;
  color: rgba(#000, 0.4);
  font-size: 14px;
  border-bottom: solid 1px rgba(#000, 0);
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 40px;
  &:hover {
    border-bottom: solid 1px rgba(#000, 0.2);
  }
}

button {
  user-select: none;
  width: auto;
  min-width: 100px;
  border-radius: 24px;
  text-align: center;
  padding: 15px 40px;
  margin-top: 5px;
  background-color: $base-primary;
  color: #fff;
  font-size: 14px;
  margin-left: auto;
  font-weight: 500;
  box-shadow: 0px 2px 6px -1px rgba(0, 0, 0, 0.13);
  border: none;
  outline: 0;
}
.modal {
  z-index: 10;
}
.close-modal {
  position: absolute;
  cursor: pointer;
  bottom: 94%;
  left: 95%; /* Place the button at the top-right corner */
  background-color: white;
  color: #e3e3e3;
  border: 1px solid gray;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    color: #999;
  }
}

.floating-label {
  transition: all 0.3s ease;
  &:hover {
    cursor: pointer;
    transform: translateY(-3px);
    box-shadow: 0px 10px 20px 0px rgba(0, 0, 0, 0.2);
    &:active {
      transform: scale(0.99);
    }
  }
  button {
    margin-top: 0px;
  }
  .icon {
    height: 48px !important;
  }
}
.inactive {
  transition: unset;
  &:hover {
    cursor: unset;
    transform: unset;
    box-shadow: unset;
  }
  button {
    background-color: #e0e0e0;
  }
}

input,
.standort-dropdown {
  user-select: none;
  font-size: 16px;
  padding: 20px 0px;
  height: 56px;
  border: none;
  border-bottom: solid 1px rgba(0, 0, 0, 0.1);
  background: #fff;
  width: 280px;
  box-sizing: border-box;
  transition: all 0.3s linear;
  color: #000;
  font-weight: 400;
  &:focus {
    border-bottom: solid 1px $base-primary;
    outline: 0;
    box-shadow: 0 2px 6px -8px rgba($base-primary, 0.45);
  }
}

.standort-dropdown {
  height: unset;
}

.floating-label {
  position: relative;
  margin-bottom: 10px;
  width: 100%;
  label {
    position: absolute;
    top: calc(50% - 7px);
    left: 0;
    opacity: 0;
    transition: all 0.3s ease;
    padding-left: 44px;
  }
  input {
    width: calc(100% - 44px);
    margin-left: auto;
    display: flex;
  }
  .icon {
    position: absolute;
    top: 0;
    left: 0;
    height: 56px;
    width: 44px;
    display: flex;
    svg {
      height: 30px;
      width: 30px;
      margin: auto;
      opacity: 0.15;
      transition: all 0.3s ease;
      path {
        transition: all 0.3s ease;
      }
    }
  }
  input:not(:placeholder-shown) {
    padding: 28px 0px 12px 0px;
  }
  input:not(:placeholder-shown) + label {
    transform: translateY(-10px);
    opacity: 0.7;
  }
  input:valid:not(:placeholder-shown) + label + .icon {
    svg {
      opacity: 1;
      path {
        fill: $base-primary;
      }
    }
  }
  input:not(:valid):not(:focus) + label + .icon {
    animation-name: shake-shake;
    animation-duration: 0.3s;
  }
}
$displacement: 3px;
@keyframes shake-shake {
  0% {
    transform: translateX(-$displacement);
  }
  20% {
    transform: translateX($displacement);
  }
  40% {
    transform: translateX(-$displacement);
  }
  60% {
    transform: translateX($displacement);
  }
  80% {
    transform: translateX(-$displacement);
  }
  100% {
    transform: translateX(0px);
  }
}
.session {
  display: flex;
  flex-direction: row;
  width: auto;
  height: auto;
  margin: auto auto;
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 0px 0px 20px 10px rgba(255, 255, 255, 0.2);
}
.left {
  width: 220px;
  height: auto;
  min-height: 100%;
  position: relative;
  background-image: url("@/assets/SF_001.jpg");
  background-position: 60% center;
  background-size: cover;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  box-shadow: 10px 0px 20px -5px rgba(0, 0, 0, 0.1);
  svg {
    height: 40px;
    width: auto;
    margin: 20px;
  }
}

.right {
  padding: 15px 15px;
  box-shadow: -10px 0px 20px -5px rgba(0, 0, 0, 0.1);
  background: #fefefe;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 20px;
  width: 160px;

  h4 {
    margin-bottom: 20px;
    color: rgba(#000, 0.5);
    span {
      color: rgba(#000, 1);
      font-weight: 700;
    }
  }

  .shortcut-container {
    font-size: 14px;
    color: #000;
    opacity: 0.65;
    font-weight: 400;

    .item-list-sf {
      width: 30px; /* Adjust the width as needed */
      height: auto; /* Maintain aspect ratio */
      margin: 5px;
      cursor: pointer;
    }
  }
}
.list-item {
  display: flex;
  flex-direction: row;
  align-items: center;
}

/* src/assets/base.scss or any global stylesheet */
.logo-svg .st01 {
  fill: #fff;
}
.icon-svg .st0 {
  fill: none;
}
.icon-svg .st1 {
  fill: #010101;
}

.logo-svg {
  width: 50px; /* Adjust the width as needed */
  height: auto; /* Maintain aspect ratio */
  margin: 20px 0px 0px 10px;
  /* Add other styles if needed */
}

h4 {
  font-size: 24px;
  font-weight: 600;
  color: #000;
  opacity: 0.85;
}
label {
  font-size: 12.5px;
  color: #000;
  opacity: 0.8;
  font-weight: 400;
}
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
  