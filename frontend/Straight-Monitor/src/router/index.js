import { createRouter, createWebHistory } from 'vue-router';
import '../assets/styles/main.scss';
import { useAuth } from '@/stores/auth';
import { jwtDecode } from 'jwt-decode';

import EmailConfirmation from '@/components/EmailConfirmation.vue';
import HomeLogin from '@/components/HomeLogin.vue';
import PublicMitarbeiter from '@/components/public/PublicMitarbeiter.vue';
import PublicEinsaetze from '@/components/public/PublicEinsaetze.vue';
import TaskBestaetigen from '@/components/public/TaskBestaetigen.vue';
import FlipMonitorLogin from '@/components/FlipMonitorLogin.vue';

// Layout + Seiten (bestehend)
import MainLayout from '@/layouts/MainLayout.vue';
import Dashboard from '@/components/Dashboard.vue';
import Bestand from '@/components/Bestand.vue';
import Verlauf from '@/components/Verlauf.vue';
import Auswertung from '@/components/Auswertung.vue';
import ExcelFormatierung from '@/components/ExcelFormatierung.vue';
import Lohnabrechnungen from '@/components/Lohnabrechnungen.vue';
import Personal from '@/components/PeopleDocsModern.vue';
import Dokumente from '@/components/Dokumente.vue';
import FlipCreate from '@/components/FlipCreate.vue';
import FlipExit from '@/components/FlipExit.vue';
import FlipUserFix from '@/components/FlipUserFix.vue';
import VerlosungTool from '@/components/VerlosungTool.vue';
import DatenImport from '@/components/DatenImport.vue';
import AuftraegePage from '@/components/AuftraegePage.vue';
import KundenPage from '@/components/KundenPage.vue';
import TeamleiterAuswertung from '@/components/TeamleiterAuswertung.vue';
import DokumenteNachpflegen from '@/components/DokumenteNachpflegen.vue';
import PdfBuilder from '@/components/PdfBuilder.vue';
import PdfFormFill from '@/components/PdfFormFill.vue';
import PdfVorgaenge from '@/components/PdfVorgaenge.vue';
import PdfMitarbeiterForm from '@/components/PdfMitarbeiterForm.vue';
import DispoTable from '@/components/DispoTable.vue';
import UserManagement from '@/components/UserManagement.vue';
import NotFound from '@/components/NotFound.vue';

const routes = [
  { path: '/', name: 'Home', component: HomeLogin, meta: { requiresAuth: false } },
  { path: '/confirm-email', name: 'EmailConfirmation', component: EmailConfirmation, meta: { requiresAuth: false } },
  { path: '/integration/mitarbeiter/einsaetze', name: 'PublicEinsaetze', component: PublicEinsaetze, meta: { requiresAuth: false } },
  { path: '/integration/mitarbeiter/einsaetze/localhost', name: 'PublicEinsaetzesLocalhost', beforeEnter: () => { window.location.href = 'http://localhost:5173/integration/mitarbeiter/einsaetze'; return false; }, component: PublicEinsaetze, meta: { requiresAuth: false } },
  { path: '/integration/task-bestaetigen', name: 'TaskBestaetigen', component: TaskBestaetigen, meta: { requiresAuth: false } },
  { path: '/integration/monitor-login', name: 'FlipMonitorLogin', component: FlipMonitorLogin, meta: { requiresAuth: false } },
  { path: '/formular/:token', name: 'PdfMitarbeiterForm', component: PdfMitarbeiterForm, meta: { requiresAuth: false } },

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
      { path: 'flip/austritte', name: 'Austritte', component: FlipExit },
      { path: 'flip/user-fix', name: 'FlipUserFix', component: FlipUserFix },
      { path: 'verlosung', name: 'VerlosungTool', component: VerlosungTool },
      { path: 'daten-import', name: 'DatenImport', component: DatenImport },
      { path: 'auftraege', name: 'Auftraege', component: AuftraegePage },
      { path: 'kunden', name: 'Kunden', component: KundenPage, meta: { roles: ['VERTRIEB'] } },
      { path: 'teamleiter-auswertung', name: 'TeamleiterAuswertung', component: TeamleiterAuswertung },
      { path: 'dokumente-nachpflegen', name: 'DokumenteNachpflegen', component: DokumenteNachpflegen },
      { path: 'pdf-vorlagen', name: 'PdfVorlagen', component: PdfBuilder },
      { path: 'pdf-vorgaenge', name: 'PdfVorgaenge', component: PdfVorgaenge },
      { path: 'pdf-ausfuellen/:id', name: 'PdfAusfuellen', component: PdfFormFill },
      { path: 'dispo', name: 'Dispo', component: DispoTable },
      { path: 'benutzer-verwaltung', name: 'BenutzerVerwaltung', component: UserManagement, meta: { roles: ['ADMIN'] } },
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
