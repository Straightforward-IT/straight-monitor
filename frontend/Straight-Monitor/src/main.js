// Vue
import { createApp } from 'vue';
import { createPinia } from 'pinia';

// App
import App from './App.vue';
import router from './router';
import { useTheme } from '@/stores/theme';
import { useAuth } from '@/stores/auth';

// Modal Dock
import { createModalDock } from '@bleck-it/vue-modal-dock';
import '@bleck-it/vue-modal-dock/style.css';

// FontAwesome Core
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

// FontAwesome Brands
import { faMicrosoft } from '@fortawesome/free-brands-svg-icons';

// FontAwesome Regular
import {
  faChartBar,
  faCircle,
  faCircleXmark,
  faStar as faStarRegular,
} from '@fortawesome/free-regular-svg-icons';

// FontAwesome Solid
import {
  faAddressBook,
  faAddressCard,
  faArrowLeft,
  faArrowRight,
  faArrowDown,
  faArrowUp,
  faArrowUpFromBracket,
  faBan,
  faBars,
  faBell,
  faBinoculars,
  faBolt,
  faBookmark,
  faBoxArchive,
  faBoxOpen,
  faBriefcase,
  faBriefcaseMedical,
  faBuilding,
  faBullhorn,
  faBullseye,
  faCalculator,
  faCalendar,
  faCalendarAlt,
  faCalendarDay,
  faCalendarDays,
  faCalendarPlus,
  faCalendarWeek,
  faCamera,
  faCartShopping,
  faChartBar as faChartBarSolid,
  faChartLine,
  faChartPie,
  faCheck,
  faCheckDouble,
  faCheckSquare,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleCheck,
  faCircleDot,
  faCircleExclamation,
  faCircleHalfStroke,
  faCircleQuestion,
  faCircleXmark as faCircleXmarkSolid,
  faClipboard,
  faClipboardCheck,
  faClipboardList,
  faClock,
  faClockRotateLeft,
  faCloudArrowUp,
  faCode,
  faCodeBranch,
  faCoins,
  faComment,
  faCommentDots,
  faCompressAlt,
  faCopy,
  faDice,
  faDolly,
  faDownload,
  faEllipsisVertical,
  faEnvelope,
  faEnvelopeOpenText,
  faEraser,
  faEuroSign,
  faExpand,
  faExpandAlt,
  faExpandArrowsAlt,
  faExternalLink,
  faExternalLinkAlt,
  faEye,
  faEyeSlash,
  faFileAlt,
  faFileCircleCheck,
  faFileCirclePlus,
  faFileImport,
  faFileInvoice,
  faFileLines,
  faFilePdf,
  faFilePen,
  faFileSignature,
  faFilter,
  faFloppyDisk,
  faFolderOpen,
  faFolderTree,
  faFolder,
  faFont,
  faGear,
  faGlobe,
  faGraduationCap,
  faGripVertical,
  faHandPointer,
  faHandshake,
  faHashtag,
  faHeart,
  faHistory,
  faHome,
  faHourglassHalf,
  faIdBadge,
  faImagePortrait,
  faInbox,
  faInfoCircle,
  faKeyboard,
  faLayerGroup,
  faLink,
  faList,
  faListCheck,
  faLocationDot,
  faLock,
  faMagnifyingGlass,
  faMapPin,
  faMapLocationDot,
  faMinus,
  faMobileAlt,
  faMoneyBillWave,
  faMoon,
  faMousePointer,
  faObjectGroup,
  faPalette,
  faPaperPlane,
  faPaperclip,
  faPen,
  faPencil,
  faPeopleLine,
  faPercent,
  faPersonCircleExclamation,
  faPersonThroughWindow,
  faPhone,
  faPlus,
  faQuestion,
  faRotate,
  faRotateLeft,
  faRotateRight,
  faSave,
  faScissors,
  faShieldHalved,
  faShirt,
  faSignOutAlt,
  faSliders,
  faSort,
  faSortAlphaDown,
  faSortAlphaUp,
  faSortDown,
  faSortNumericDown,
  faSortNumericUp,
  faSortUp,
  faSpinner,
  faStar,
  faStarHalfStroke,
  faStickyNote,
  faSun,
  faTable,
  faTableCells,
  faTableColumns,
  faTableList,
  faTags,
  faThLarge,
  faTicketAlt,
  faTimeline,
  faTimes,
  faToggleOff,
  faToggleOn,
  faTools,
  faTrash,
  faTrophy,
  faUmbrellaBeach,
  faUnlink,
  faUnlock,
  faUpload,
  faUser,
  faUserPlus,
  faUserTie,
  faUserXmark,
  faUsers,
  faVial,
  faWarehouse,
} from '@fortawesome/free-solid-svg-icons';


// -----------------------------------------------------------------------------
// FontAwesome Library
// -----------------------------------------------------------------------------

library.add(
  // Brands
  faMicrosoft,

  // Regular
  faChartBar,
  faCircle,
  faCircleXmark,
  faStarRegular,

  // Solid
  faAddressBook,
  faAddressCard,
  faArrowLeft,
  faArrowRight,
  faArrowDown,
  faArrowUp,
  faArrowUpFromBracket,
  faBan,
  faBars,
  faBell,
  faBinoculars,
  faBolt,
  faBookmark,
  faBoxArchive,
  faBoxOpen,
  faBriefcase,
  faBriefcaseMedical,
  faBuilding,
  faBullhorn,
  faBullseye,
  faCalculator,
  faCalendar,
  faCalendarAlt,
  faCalendarDay,
  faCalendarDays,
  faCalendarPlus,
  faCalendarWeek,
  faCamera,
  faCartShopping,
  faChartBarSolid,
  faChartLine,
  faChartPie,
  faCheck,
  faCheckDouble,
  faCheckSquare,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleCheck,
  faCircleDot,
  faCircleExclamation,
  faCircleHalfStroke,
  faCircleQuestion,
  faCircleXmarkSolid,
  faClipboard,
  faClipboardCheck,
  faClipboardList,
  faClock,
  faClockRotateLeft,
  faCloudArrowUp,
  faCode,
  faCodeBranch,
  faCoins,
  faComment,
  faCommentDots,
  faCompressAlt,
  faCopy,
  faDice,
  faDolly,
  faDownload,
  faEllipsisVertical,
  faEnvelope,
  faEnvelopeOpenText,
  faEraser,
  faEuroSign,
  faExpand,
  faExpandAlt,
  faExpandArrowsAlt,
  faExternalLink,
  faExternalLinkAlt,
  faEye,
  faEyeSlash,
  faFileAlt,
  faFileCircleCheck,
  faFileCirclePlus,
  faFileImport,
  faFileInvoice,
  faFileLines,
  faFilePdf,
  faFilePen,
  faFileSignature,
  faFilter,
  faFloppyDisk,
  faFolderOpen,
  faFolderTree,
  faFolder,
  faFont,
  faGear,
  faGlobe,
  faGraduationCap,
  faGripVertical,
  faHandPointer,
  faHandshake,
  faHashtag,
  faHeart,
  faHistory,
  faHome,
  faHourglassHalf,
  faIdBadge,
  faImagePortrait,
  faInbox,
  faInfoCircle,
  faKeyboard,
  faLayerGroup,
  faLink,
  faList,
  faListCheck,
  faLocationDot,
  faLock,
  faMagnifyingGlass,
  faMapPin,
  faMapLocationDot,
  faMinus,
  faMobileAlt,
  faMoneyBillWave,
  faMoon,
  faMousePointer,
  faObjectGroup,
  faPalette,
  faPaperPlane,
  faPaperclip,
  faPen,
  faPencil,
  faPeopleLine,
  faPercent,
  faPersonCircleExclamation,
  faPersonThroughWindow,
  faPhone,
  faPlus,
  faQuestion,
  faRotate,
  faRotateLeft,
  faRotateRight,
  faSave,
  faScissors,
  faShieldHalved,
  faShirt,
  faSignOutAlt,
  faSliders,
  faSort,
  faSortAlphaDown,
  faSortAlphaUp,
  faSortDown,
  faSortNumericDown,
  faSortNumericUp,
  faSortUp,
  faSpinner,
  faStar,
  faStarHalfStroke,
  faStickyNote,
  faSun,
  faTable,
  faTableCells,
  faTableColumns,
  faTableList,
  faTags,
  faThLarge,
  faTicketAlt,
  faTimeline,
  faTimes,
  faToggleOff,
  faToggleOn,
  faTools,
  faTrash,
  faTrophy,
  faUmbrellaBeach,
  faUnlink,
  faUnlock,
  faUpload,
  faUser,
  faUserPlus,
  faUserTie,
  faUserXmark,
  faUsers,
  faVial,
  faWarehouse,
);


// -----------------------------------------------------------------------------
// Vue App
// -----------------------------------------------------------------------------

const app = createApp(App);
const pinia = createPinia();

app
  .use(pinia)
  .use(router)
  .use(
    createModalDock({
      maxModals: 12,

      theme: {
        accent: 'var(--primary)',
        accentContrast: '#ffffff',

        surface: 'var(--surface)',
        surfaceMuted: 'var(--hover)',

        text: 'var(--text)',
        textMuted: 'var(--muted)',

        border: 'var(--border)',

        fontFamily:
          '-apple-system, BlinkMacSystemFont, "San Francisco", Helvetica, Arial, sans-serif',
        fontSize: '14px',
        titleFontWeight: 400,

        dockRadius: '10px',
        itemRadius: '7px',
        controlRadius: '6px',

        dockBottom: '12px',

        dockBackground:
          'color-mix(in srgb, var(--surface) 90%, transparent)',
        itemBackground:
          'color-mix(in srgb, var(--tile-bg) 94%, transparent)',
        controlBackground:
          'color-mix(in srgb, var(--tile-bg) 88%, transparent)',

        focusRing:
          'color-mix(in srgb, var(--primary) 48%, transparent)',

        dockShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
        controlShadow: 'none',

        backdropFilter: 'blur(14px) saturate(115%)',
      },
    }),
  )
  .component('font-awesome-icon', FontAwesomeIcon);


// -----------------------------------------------------------------------------
// Initialisation
// -----------------------------------------------------------------------------

// Theme erst initialisieren, nachdem Pinia registriert wurde.
useTheme(pinia).init();

// Eruda costs ~150 KiB + >1 s main-thread on mobile — only load it when explicitly requested
// (?debug=1 once, or localStorage.eruda = '1'). Still restricted to ADMIN.
async function initializeErudaForAdmin() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1') localStorage.setItem('eruda', '1');
  if (params.get('debug') === '0') localStorage.removeItem('eruda');
  if (localStorage.getItem('eruda') !== '1') return;

  await router.isReady();

  const auth = useAuth(pinia);
  if (!auth.user && auth.token) await auth.fetchMe().catch(() => null);
  if (!auth.user?.roles?.includes('ADMIN')) return;

  const { default: eruda } = await import('eruda');
  eruda.init();
}

void initializeErudaForAdmin();

app.mount('#app');