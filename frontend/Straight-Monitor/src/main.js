import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useTheme } from '@/stores/theme';
import router from './router';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck, faSortDown, faSortUp, faList, faPersonThroughWindow, faPersonCircleExclamation, faUserPlus, faPeopleLine, faFileInvoice, faTable, faSun, faMoon, faChevronUp, faChevronDown, faTags, faIdBadge, faUsers, faListCheck, faSpinner, faClipboardCheck, faExternalLinkAlt, faTicketAlt, faEnvelope, faMobileAlt, faFileAlt, faBars, faChartLine, faHistory, faTools, faSignOutAlt, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { faCircleXmark } from '@fortawesome/free-regular-svg-icons';
library.add(
  // Bestehende Icons
  faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, 
  faCheck, faSortDown, faSortUp, faList, faPersonThroughWindow, faPersonCircleExclamation, 
  faUserPlus, faPeopleLine, faFileInvoice, faTable, faSun, faMoon,
  // Neue Icons
  faChevronUp, faChevronDown, faTags, faIdBadge, faUsers, faListCheck,
  faSpinner, faClipboardCheck, faExternalLinkAlt, faTicketAlt, faEnvelope, faMobileAlt, faFileAlt,
  // Mobile Menu Icons
  faBars, faChartLine, faHistory, faTools, faSignOutAlt,
  // Calendar Icon
  faCalendarAlt,
  // Regular Icons
  faCircleXmark
);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).component('font-awesome-icon', FontAwesomeIcon);

// Theme initialisieren (nachdem Pinia hängt!)
useTheme(pinia).init();

app.mount('#app');