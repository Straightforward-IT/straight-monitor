import { createRouter, createWebHistory } from 'vue-router';
import '../assets/styles/main.scss';
import { useAuth } from '@/stores/auth';

import EmailConfirmation from '@/components/EmailConfirmation.vue';
import HomeLogin from '@/components/HomeLogin.vue';

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
import VerlosungTool from '@/components/VerlosungTool.vue';
import DatenImport from '@/components/DatenImport.vue';
import AuftraegePage from '@/components/AuftraegePage.vue';
import NotFound from '@/components/NotFound.vue';

import { jwtDecode } from 'jwt-decode';

const routes = [
  { path: '/', name: 'Home', component: HomeLogin, meta: { requiresAuth: false } },
  { path: '/confirm-email', name: 'EmailConfirmation', component: EmailConfirmation, meta: { requiresAuth: false } },

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
      { path: 'lohnabrechnungen', name: 'Lohnabrechnungen', component: Lohnabrechnungen },
      { path: 'personal', name: 'Personal', component: Personal },
      { path: 'dokumente', name: 'Dokumente', component: Dokumente },
      { path: 'flip/benutzer-erstellen/:id?', name: 'BenutzerErstellen', component: FlipCreate },
      { path: 'flip/austritte', name: 'Austritte', component: FlipExit },
      { path: 'verlosung', name: 'VerlosungTool', component: VerlosungTool },
      { path: 'daten-import', name: 'DatenImport', component: DatenImport },
      { path: 'auftraege', name: 'Auftraege', component: AuftraegePage },
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

router.beforeEach(async (to, _from, next) => {
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
  
  // Feature flag check für neue Pages
  // const newPagesEnabled = import.meta.env.VITE_ENABLE_NEW_PAGES === 'true';
  const isAdmin = auth.user && auth.user.role === 'ADMIN'; 
  const newPageRoutes = ['Personal', 'Auftraege'];
  
  if (newPageRoutes.includes(to.name) && !isAdmin) {
    alert('Diese Funktion ist noch in Entwicklung und nur für Administratoren verfügbar.');
    return next('/dashboard');
  }
  
  if (to.path === '/' && token && !tokenIsExpired(token)) return next('/dashboard');
  next();
});

export default router;
