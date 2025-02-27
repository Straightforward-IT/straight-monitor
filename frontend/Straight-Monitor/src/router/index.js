import { createRouter, createWebHistory } from 'vue-router';
import '../assets/styles/main.scss'; 
import Home from '../components/Home.vue';
import Verlauf from '../components/Verlauf.vue';
import Auswertung from '../components/Auswertung.vue';
import ExcelFormatierung from '../components/ExcelFormatierung.vue';
import EmailConfirmation from '../components/EmailConfirmation.vue';
import Personal from '../components/Personal.vue';
import FlipCreate from '../components/FlipCreate.vue';
import FlipExit from '../components/FlipExit.vue';
import Frame from '../components/Frame.vue'; 

import { jwtDecode } from "jwt-decode";

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Frame',
    component: Frame,
    meta: { requiresAuth: true }, 
  },{
    path: '/verlauf',
    name: 'Verlauf',
    component: Verlauf,
    meta: { requiresAuth: true },
  },{
    path: '/auswertung',
    name: 'Auswertung',
    component: Auswertung,
    meta: { requiresAuth: true },
  },{
    path: '/excelFormatierung',
    name: 'ExcelFormatierung',
    component: ExcelFormatierung,
    meta: { requiresAuth: true},
  },
  {
    path: '/confirm-email',
    name: 'EmailConfirmation',
    component: EmailConfirmation,
    meta: { requiresAuth: false},
  },
  {
    path: '/personal',
    name: 'Personal',
    component: Personal,
    meta: { requiresAuth: true},
  },
  {
    path: '/flip/benutzer-erstellen/:id?',
    name: 'BenutzerErstellen',
    component: FlipCreate,
    meta: { requiresAuth: true},
  },
  {
    path: '/flip/austritte',
    name: 'Austritte',
    component: FlipExit,
    meta: { requiresAuth: true},
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

function tokenIsExpired(token) {
  try {
    const decoded = jwtDecode(token); 
    const currentTime = Date.now() / 1000; 
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Invalid token:', error);
    return true; 
  }
}

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token'); 


  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!token || tokenIsExpired(token)) {
      localStorage.removeItem('token'); 
      return next({ path: '/', query: { redirect: to.fullPath } }); 
    }
  }

  if (to.path === '/' && token && !tokenIsExpired(token)) {
    return next({ path: '/dashboard' });
  }
  next();
});

export default router;
