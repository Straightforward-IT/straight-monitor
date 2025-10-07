import { createRouter, createWebHistory } from 'vue-router';
import '../assets/styles/main.scss';

import EmailConfirmation from '@/components/EmailConfirmation.vue';
import HomeLogin from '@/components/HomeLogin.vue'; // NEU

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
      { path: '', redirect: '/dashboard' }
    ]
  },
];

const router = createRouter({ history: createWebHistory(), routes });

function tokenIsExpired(token) {
  try { const d = jwtDecode(token); return d.exp < (Date.now() / 1000); }
  catch { return true; }
}

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  
  // Auth check
  if (to.matched.some(r => r.meta.requiresAuth)) {
    if (!token || tokenIsExpired(token)) {
      localStorage.removeItem('token');
      return next({ path: '/', query: { redirect: to.fullPath } });
    }
  }
  
  // Feature flag check für neue Pages
  const newPagesEnabled = import.meta.env.VITE_ENABLE_NEW_PAGES === 'true';
  const newPageRoutes = ['Personal', 'Dokumente'];
  
  if (!newPagesEnabled && newPageRoutes.includes(to.name)) {
    alert('Diese Funktion ist noch in Entwicklung und wird bald verfügbar sein.');
    return next('/dashboard');
  }
  
  if (to.path === '/' && token && !tokenIsExpired(token)) return next('/dashboard');
  next();
});

export default router;
