import { createRouter, createWebHistory } from 'vue-router';
import '../assets/styles/main.scss';
import { useAuth } from '@/stores/auth';
import { jwtDecode } from 'jwt-decode';

// Eager: first paint for unauthenticated users
import HomeLogin from '@/components/HomeLogin.vue';
import MainLayout from '@/layouts/MainLayout.vue';

// Lazy: every page becomes its own chunk (xlsx, pdfjs, konva, chart.js etc. leave the main bundle)
const EmailConfirmation = () => import('@/components/EmailConfirmation.vue');
const PublicEinsaetze = () => import('@/components/public/PublicEinsaetze.vue');
const CapacityCounter = () => import('@/components/public/CapacityCounter.vue');
const TaskBestaetigen = () => import('@/components/public/TaskBestaetigen.vue');
const FlipMonitorLogin = () => import('@/components/FlipMonitorLogin.vue');

const Dashboard = () => import('@/components/Dashboard.vue');
const Bestand = () => import('@/components/Bestand.vue');
const Verlauf = () => import('@/components/Verlauf.vue');
const Auswertung = () => import('@/components/Auswertung.vue');
const ExcelFormatierung = () => import('@/components/ExcelFormatierung.vue');
const Lohnabrechnungen = () => import('@/components/Lohnabrechnungen.vue');
const Personal = () => import('@/components/PeopleDocsModern.vue');
const Dokumente = () => import('@/components/Dokumente.vue');
const FlipCreate = () => import('@/components/FlipCreate.vue');
const BewerberCreate = () => import('@/components/BewerberCreate.vue');
const FlipExit = () => import('@/components/FlipExit.vue');
const FlipUserFix = () => import('@/components/FlipUserFix.vue');
const VerlosungTool = () => import('@/components/VerlosungTool.vue');
const DatenImport = () => import('@/components/DatenImport.vue');
const AuftraegePage = () => import('@/components/AuftraegePage.vue');
const KundenPage = () => import('@/components/KundenPage.vue');
const TeamleiterAuswertung = () => import('@/components/TeamleiterAuswertung.vue');
const DokumenteNachpflegen = () => import('@/components/DokumenteNachpflegen.vue');
const PdfBuilder = () => import('@/components/PdfBuilder.vue');
const PdfFormFill = () => import('@/components/PdfFormFill.vue');
const PdfVorgaenge = () => import('@/components/PdfVorgaenge.vue');
const DocuSealVorgaenge = () => import('@/components/DocuSealVorgaenge.vue');
const SignaturenPage = () => import('@/components/SignaturenPage.vue');
const PdfMitarbeiterForm = () => import('@/components/PdfMitarbeiterForm.vue');
const DispoTable = () => import('@/components/DispoTable.vue');
const UserManagement = () => import('@/components/UserManagement.vue');
const NotFound = () => import('@/components/NotFound.vue');

const routes = [
  { path: '/', name: 'Home', component: HomeLogin, meta: { requiresAuth: false } },
  { path: '/login-test', redirect: '/' },
  { path: '/confirm-email', name: 'EmailConfirmation', component: EmailConfirmation, meta: { requiresAuth: false } },
  { path: '/integration/mitarbeiter/einsaetze', name: 'PublicEinsaetze', component: PublicEinsaetze, meta: { requiresAuth: false } },
  { path: '/integration/mitarbeiter/einsaetze/localhost', name: 'PublicEinsaetzesLocalhost', beforeEnter: () => { window.location.href = 'http://localhost:5173/integration/mitarbeiter/einsaetze'; return false; }, component: PublicEinsaetze, meta: { requiresAuth: false } },
  { path: '/integration/capacity-counter', name: 'CapacityCounter', component: CapacityCounter, meta: { requiresAuth: false } },
  { path: '/integration/capacity-counter/einsaetze', redirect: to => ({ path: '/integration/capacity-counter', query: to.query }) },
  { path: '/integration/capacity-counter/localhost', name: 'CapacityCounterLocalhost', beforeEnter: () => { window.location.href = 'http://localhost:5173/integration/capacity-counter'; return false; }, component: CapacityCounter, meta: { requiresAuth: false } },
  { path: '/integration/task-bestaetigen', name: 'TaskBestaetigen', component: TaskBestaetigen, meta: { requiresAuth: false } },
  { path: '/integration/monitor-login', name: 'FlipMonitorLogin', component: FlipMonitorLogin, meta: { requiresAuth: false } },
  { path: '/formular/:token', name: 'PdfMitarbeiterForm', component: PdfMitarbeiterForm, meta: { requiresAuth: false } },
  { path: '/bewerbung/:accessToken', name: 'BewerberEinladung', component: () => import('@/components/public/BewerberInvitationForm.vue'), meta: { requiresAuth: false } },

  // Authentifizierter Bereich unter Layout:
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', name: 'Dashboard', component: Dashboard },
      { path: 'bestand',   name: 'Bestand',   component: Bestand },
      { path: 'verlauf',   name: 'Verlauf',   component: Verlauf },
      { path: 'auswertung', name: 'Auswertung', component: Auswertung },
      { path: 'excelFormatierung', name: 'ExcelFormatierung', component: ExcelFormatierung },
      { path: 'lohnabrechnungen', name: 'Lohnabrechnungen', component: Lohnabrechnungen, meta: { roles: ['VERTRIEB'] } },
      { path: 'personal', name: 'Personal', component: Personal },
      { path: 'dokumente', name: 'Dokumente', component: Dokumente },
      { path: 'flip/benutzer-erstellen/:id?', name: 'BenutzerErstellen', component: FlipCreate },
      { path: 'bewerber/erstellen/:id', name: 'BewerberErstellen', component: BewerberCreate },
      { path: 'flip/austritte', name: 'Austritte', component: FlipExit },
      { path: 'flip/user-fix', name: 'FlipUserFix', component: FlipUserFix },
      { path: 'verlosung', name: 'VerlosungTool', component: VerlosungTool },
      { path: 'daten-import', name: 'DatenImport', component: DatenImport },
      { path: 'auftraege', name: 'Auftraege', component: AuftraegePage },
      { path: 'kunden', name: 'Kunden', component: KundenPage },
      { path: 'teamleiter-auswertung', name: 'TeamleiterAuswertung', component: TeamleiterAuswertung },
      { path: 'dokumente-nachpflegen', name: 'DokumenteNachpflegen', component: DokumenteNachpflegen },
      { path: 'pdf-vorlagen', name: 'PdfVorlagen', component: PdfBuilder },
      { path: 'pdf-vorgaenge', name: 'PdfVorgaenge', component: PdfVorgaenge },
      { path: 'signaturen', name: 'SignaturenPage', component: SignaturenPage },
      { path: 'signaturen-legacy', name: 'DocuSealVorgaenge', component: DocuSealVorgaenge, meta: { roles: ['ADMIN'] } },
      { path: 'pdf-ausfuellen/:id', name: 'PdfAusfuellen', component: PdfFormFill },
      { path: 'dispo', name: 'Dispo', component: DispoTable },
      { path: 'benutzer-verwaltung', name: 'BenutzerVerwaltung', component: UserManagement, meta: { roles: ['ADMIN'] } },
      { path: 'payroll', name: 'Payroll', component: () => import('@/components/PayrollDashboard.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'mailbox-explorer', name: 'MailboxExplorer', component: () => import('@/components/GraphMailboxDashboard.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'onedrive-explorer', name: 'OneDriveExplorer', component: () => import('@/components/OneDriveDashboard.vue'), meta: { roles: ['ADMIN'] } },
      { path: '', redirect: '/dashboard' }
    ]
  },
  
  // 404 Catch-All Route (muss am Ende sein)
  { 
    path: '/:pathMatch(.*)*', 
    name: 'NotFound', 
    component: NotFound,
    meta: { requiresAuth: false }
  }
];

const router = createRouter({ history: createWebHistory(), routes });

function tokenIsExpired(token) {
  try { const d = jwtDecode(token); return d.exp < (Date.now() / 1000); }
  catch { return true; }
}

router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token');

  const auth = useAuth();
  
  // Auth check
  if (to.matched.some(r => r.meta.requiresAuth)) {
    if (!token || tokenIsExpired(token)) {
      auth.setToken(null); // Sync store state
      localStorage.removeItem('token');
      return next({ path: '/', query: { redirect: to.fullPath } });
    }
    
    // Ensure User Data is loaded
    if (token && !auth.user) {
      try {
        await auth.fetchMe();
      } catch (e) {
        console.error("Failed to fetch user in router", e);
      }
    }
  }
  
  // Role-based access guard (ADMIN is superuser)
  if (to.meta.roles?.length) {
    const userRoles = auth.user?.roles || [];
    const isAdmin = userRoles.includes('ADMIN');
    const hasRole = isAdmin || to.meta.roles.some(r => userRoles.includes(r));
    if (!hasRole) return next('/dashboard');
  }

  // Restore last visited page on login
  if (to.path === '/' && token && !tokenIsExpired(token)) {
    const lastPath = localStorage.getItem('lastVisitedPath');
    if (lastPath && lastPath !== '/' && lastPath !== '/dashboard') {
      return next(lastPath);
    }
    return next('/dashboard');
  }
  
  next();
});

// Note: Flip Bridge wird zentral in App.vue initialisiert
// Keine duplicate Initialisierung hier nötig

// Save last visited path (only for authenticated routes)
router.afterEach((to) => {
  if (to.matched.some(r => r.meta.requiresAuth) && to.path !== '/') {
    localStorage.setItem('lastVisitedPath', to.fullPath);
  }
});

export default router;
