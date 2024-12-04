import { createRouter, createWebHistory } from 'vue-router';
import Home from '../components/Home.vue';
import Verlauf from '../components/Verlauf.vue';
import Auswertung from '../components/Auswertung.vue';
import ExcelFormatierung from '../components/ExcelFormatierung.vue';
import EmailConfirmation from '../components/EmailConfirmation.vue';
import Personal from '../components/Personal.vue';
import '../assets/styles/main.scss'; 
import Frame from '../components/Frame.vue'; // Import the Frame component
// @ts-ignore  
import { jwtDecode } from "jwt-decode";

// Define your routes
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
  }
];

// Create the router
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Function to check if token is expired
function tokenIsExpired(token) {
  try {
    const decoded = jwtDecode(token); // Use jwt-decode
    const currentTime = Date.now() / 1000; // Current time in seconds
    return decoded.exp < currentTime; // Check if token is expired
  } catch (error) {
    console.error('Invalid token:', error);
    return true; // Consider invalid tokens as expired
  }
}

// Add a navigation guard to check for authentication
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token'); // Check if the token exists

  // If trying to access a protected route without a token or with an expired token
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!token || tokenIsExpired(token)) {
      localStorage.removeItem('token'); // Remove the invalid or expired token
      return next({ path: '/', query: { redirect: to.fullPath } }); // Redirect to home if no token or expired
    }
  }

  // If already logged in and trying to access '/', redirect to '/dashboard'
  if (to.path === '/' && token && !tokenIsExpired(token)) {
    return next({ path: '/dashboard' });
  }

  // If no issues, proceed as normal
  next();
});

export default router;
