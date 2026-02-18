import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useTheme } from '@/stores/theme';
import router from './router';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck, faSortDown, faSortUp, faList, faPersonThroughWindow, faPersonCircleExclamation, faUserPlus, faPeopleLine, faFileInvoice, faTable, faSun, faMoon, faChevronUp, faChevronDown, faChevronLeft, faChevronRight, faTags, faIdBadge, faUsers, faListCheck, faSpinner, faClipboardCheck, faExternalLinkAlt, faExternalLink, faTicketAlt, faEnvelope, faMobileAlt, faFileAlt, faBars, faChartLine, faHistory, faTools, faSignOutAlt, faCalendarAlt, faCalendarDays, faCopy, faLink, faUnlink, faRotateRight, faHourglassHalf, faPaperPlane, faClock, faCalendar, faHeart, faKeyboard, faCodeBranch, faUser, faUnlock, faLock, faTrophy, faDice, faHome, faArrowLeft, faInbox, faStar, faUserTie, faGraduationCap, faBuilding, faBullseye, faSortAlphaDown, faSortAlphaUp, faSortNumericDown, faSortNumericUp, faPaperclip, faChartBar as faChartBarSolid, faInfoCircle, faClipboard, faAddressBook, faPhone, faPen, faHandPointer, faTrash, faObjectGroup, faChartPie, faClipboardList, faBriefcase, faFilePen, faLocationDot, faFileLines, faFileCircleCheck, faMagnifyingGlass, faHashtag, faMapPin, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { faChartBar, faCircleXmark, faCircle } from '@fortawesome/free-regular-svg-icons';
library.add(
  // Bestehende Icons
  faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, 
  faCheck, faSortDown, faSortUp, faList, faPersonThroughWindow, faPersonCircleExclamation, 
  faUserPlus, faPeopleLine, faFileInvoice, faTable, faSun, faMoon,
  // Neue Icons
  faChevronUp, faChevronDown, faChevronLeft, faChevronRight, faTags, faIdBadge, faUsers, faListCheck, faChartBar, faChartBarSolid,
  faSpinner, faClipboardCheck, faExternalLinkAlt, faExternalLink, faTicketAlt, faEnvelope, faMobileAlt, faFileAlt,
  faCopy, faLink, faUnlink, faRotateRight, faHourglassHalf, faClock, faPaperPlane, faCalendar, faCalendarAlt, faCalendarDays,
  faUnlock, faLock, faTrophy, faDice, faInbox, faStar, faUserTie, faGraduationCap,
  // Customer & Sort Icons
  faBuilding, faBullseye, faSortAlphaDown, faSortAlphaUp, faSortNumericDown, faSortNumericUp, faPaperclip,
  // Customer Card Icons
  faInfoCircle, faClipboard, faAddressBook, faPhone, faPen, faHandPointer, faTrash,
  // Merge Icon
  faObjectGroup,
  // Pie Chart Icon
  faChartPie,
  // Mobile Menu Icons
  faBars, faChartLine, faHistory, faTools, faSignOutAlt,
  // Footer Icons
  faHeart, faKeyboard, faCodeBranch, faUser,
  // 404 Page Icons
  faHome, faArrowLeft,
  // Public portal icons
  faClipboardList, faBriefcase, faFilePen, faLocationDot, faFileLines, faFileCircleCheck,
  faMagnifyingGlass, faHashtag, faMapPin, faCircleCheck,
  // Regular Icons
  faCircleXmark, faCircle
);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).component('font-awesome-icon', FontAwesomeIcon);

// Theme initialisieren (nachdem Pinia hängt!)
useTheme(pinia).init();

app.mount('#app');