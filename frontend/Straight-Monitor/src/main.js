import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useTheme } from '@/stores/theme';
import router from './router';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, faCheck, faStarHalfStroke, faBoxOpen, faSort, faSortDown, faSortUp, faList, faPersonThroughWindow, faPersonCircleExclamation, faTableList, faUserPlus, faPeopleLine, faFileInvoice, faTable, faSun, faMoon, faChevronUp, faChevronDown, faChevronLeft, faChevronRight, faTags, faIdBadge, faUsers, faListCheck, faSpinner, faClipboardCheck, faExternalLinkAlt, faExternalLink, faTicketAlt, faEnvelope, faMobileAlt, faFileAlt, faBars, faChartLine, faHistory, faTools, faSignOutAlt, faCalendarAlt, faCalendarDays, faCopy, faLink, faUnlink, faRotateRight, faHourglassHalf, faPaperPlane, faClock, faCalendar, faHeart, faKeyboard, faCodeBranch, faUser, faUnlock, faLock, faTrophy, faDice, faHome, faArrowLeft, faInbox, faStar, faUserTie, faGraduationCap, faBuilding, faBullseye, faSortAlphaDown, faSortAlphaUp, faSortNumericDown, faSortNumericUp, faPaperclip, faChartBar as faChartBarSolid, faInfoCircle, faClipboard, faAddressBook, faPhone, faPen, faHandPointer, faTrash, faObjectGroup, faChartPie, faClipboardList, faBriefcase, faFilePen, faLocationDot, faFileLines, faFileCircleCheck, faMagnifyingGlass, faHashtag, faMapPin, faCircleCheck, faEllipsisVertical, faComment, faCommentDots, faToggleOn, faToggleOff, faArrowUpFromBracket,
  faFilePdf, faCloudArrowUp, faFloppyDisk, faFont, faUpload, faRotateLeft, faDownload, faCircleExclamation, faCheckSquare, faSave, 
  faThLarge,
  faFileImport,
  faFileCirclePlus,
  faBookmark,
  faGripVertical,
  faUserXmark,
  faCircleXmark as faCircleXmarkSolid,
  faImagePortrait,
  faCamera,
  faFolderOpen,
  faStickyNote,
  faCircleHalfStroke,
  faUmbrellaBeach,
  faBriefcaseMedical,
  faCalendarDay,
  faEraser,
  faAddressCard,
  faCircleDot,
  faCircleQuestion,
  faMinus,
  faExpand,
  faExpandAlt,
  faExpandArrowsAlt,
  faCompressAlt,
  faSliders,
  faBullhorn,
  faTableColumns,
  faEuroSign, faHandshake, faBan,
  faQuestion,
  faBinoculars,
  faTableCells} from '@fortawesome/free-solid-svg-icons';
import { faChartBar, faCircleXmark, faCircle, faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
library.add(
  // Bestehende Icons
  faCartShopping, faWarehouse, faShirt, faTimeline, faPlus, faTimes, faDolly, faPencil, 
  faCheck, faSort, faSortDown, faSortUp, faList, faPersonThroughWindow, faPersonCircleExclamation, faStickyNote,
  faUserPlus, faPeopleLine, faFileInvoice, faTable, faSun, faMoon, faTableList, faStarHalfStroke, faBoxOpen, faImagePortrait, faFolderOpen,
  // Neue Icons
  faChevronUp, faChevronDown, faChevronLeft, faChevronRight, faTags, faIdBadge, faUsers, faListCheck, faChartBar, faChartBarSolid, faMinus,
  faSpinner, faClipboardCheck, faExternalLinkAlt, faExternalLink, faTicketAlt, faEnvelope, faMobileAlt, faFileAlt,
  faCopy, faLink, faUnlink, faRotateRight, faHourglassHalf, faClock, faPaperPlane, faCalendar, faCalendarAlt, faCalendarDays,
  faUnlock, faLock, faTrophy, faDice, faInbox, faStar, faUserTie, faGraduationCap, faFileCirclePlus, faCircleQuestion,
  // Customer & Sort Icons
  faBuilding, faBullseye, faSortAlphaDown, faSortAlphaUp, faSortNumericDown, faSortNumericUp, faPaperclip,
  // Customer Card Icons
  faInfoCircle, faClipboard, faAddressBook, faPhone, faPen, faHandPointer, faTrash, faThLarge, faFileImport, faBookmark, faGripVertical,
  // Merge Icon
  faObjectGroup, faAddressCard, faBinoculars, faTableCells,
  // Pie Chart Icon
  faChartPie,
  // Mobile Menu Icons
  faBars, faChartLine, faHistory, faTools, faSignOutAlt, faExpand, faExpandAlt, faExpandArrowsAlt, faCompressAlt,
  // Footer Icons
  faHeart, faKeyboard, faCodeBranch, faUser, faEuroSign, faQuestion,
  // 404 Page Icons
  faHome, faArrowLeft,
  // Public portal icons
  faClipboardList, faBriefcase, faFilePen, faLocationDot, faFileLines, faFileCircleCheck, faCircleDot, faTableColumns,
  faMagnifyingGlass, faHashtag, faMapPin, faCircleCheck,
  faEllipsisVertical, faComment, faCommentDots, faSliders, faBullhorn,
  faToggleOn, faToggleOff,
  faArrowUpFromBracket,
  // PDF Builder Icons
  faFilePdf, faCloudArrowUp, faFloppyDisk, faFont, faUpload, faRotateLeft, faDownload, faCircleExclamation,
  // Regular Icons
  faCircleXmark, faCircle, faStarRegular,
  // Solid variants (needed alongside regular)
  faCircleXmarkSolid, faUserXmark,
  faCamera,
  faCircleHalfStroke,
  faUmbrellaBeach,
  faBriefcaseMedical,
  faCalendarDay,
  faEraser,
  faHandshake, faBan,
  faBinoculars
);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).component('font-awesome-icon', FontAwesomeIcon);

// Theme initialisieren (nachdem Pinia hängt!)
useTheme(pinia).init();

app.mount('#app');