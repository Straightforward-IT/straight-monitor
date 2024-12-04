import { createApp } from 'vue';
import App from './App.vue';
import router from './router'; 
import axios from 'axios'; // Import axios

// Import Font Awesome core
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck, faSortDown, faSortUp, faList, faPersonThroughWindow} from '@fortawesome/free-solid-svg-icons';

// Add the icons to the library
library.add(faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck, faSortDown, faSortUp, faList, faPersonThroughWindow);

// Create the Vue app
const app = createApp(App).component('font-awesome-icon', FontAwesomeIcon);

// Set up axios interceptor to catch 401 errors (Unauthorized)
axios.interceptors.response.use(
  response => response, 
  error => {
    if (error.response && error.response.status === 401) {
      
      localStorage.removeItem('token');
      router.push('/'); 
    }
    return Promise.reject(error); 
  }
);

app.use(router);
app.mount('#app');
