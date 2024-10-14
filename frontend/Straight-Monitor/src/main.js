import { createApp } from 'vue';
import App from './App.vue';
import router from './router'; 
import axios from 'axios'; // Import axios

// Import Font Awesome core
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck} from '@fortawesome/free-solid-svg-icons';

// Add the icons to the library
library.add(faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck);

// Create the Vue app
const app = createApp(App).component('font-awesome-icon', FontAwesomeIcon);

// Set up axios interceptor to catch 401 errors (Unauthorized)
axios.interceptors.response.use(
  response => response, // If the response is good, just return it
  error => {
    if (error.response && error.response.status === 401) {
      // If token is expired or invalid, log out the user
      localStorage.removeItem('token');
      router.push('/'); // Redirect to the home/login page
    }
    return Promise.reject(error); // Always reject the error
  }
);

app.use(router);
app.mount('#app');
