<template>
  <div class="auth-shell">
    <section class="auth-card">
      <header class="auth-head">
        <div class="brand">
          <img src="@/assets/SF_002.png" alt="Logo" />
          <span>Straightforward</span>
        </div>
        <nav class="segmented">
          <button :class="{active: currentForm==='login'}" @click="currentForm='login'">Login</button>
          <button :class="{active: currentForm==='register'}" @click="currentForm='register'">Registrieren</button>
        </nav>
      </header>

      <div class="auth-body">
        <LoginForm v-if="currentForm==='login'" @switch-to-register="currentForm='register'" />
        <RegisterForm v-else @switch-to-login="currentForm='login'" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import LoginForm from '@/components/LoginForm.vue';
import RegisterForm from '@/components/RegisterForm.vue';
import { jwtDecode } from 'jwt-decode';
import api from '@/utils/api';

const currentForm = ref('login');
const router = useRouter();

// ── PKCE helpers (Web Crypto API) ─────────────────────────────────────────
async function generatePKCE() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge };
}

function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// sessionStorage keys — prefixed to avoid collision with public monitor flow
const SS_VERIFIER = 'monitor_oidc_pkce_verifier';
const SS_STATE    = 'monitor_oidc_state';
const SS_REDIRECT = 'monitor_oidc_redirect_uri';

// ── Silent OIDC attempt ────────────────────────────────────────────────────
async function trySilentOIDC() {
  let authEndpoint, clientId;
  try {
    const res = await api.get('/api/oidc/config');
    authEndpoint = res.data.authorization_endpoint;
    clientId = res.data.client_id;
    if (!clientId) return; // OIDC not configured — show normal login
  } catch {
    return; // Cannot reach config endpoint — show normal login
  }

  const { verifier, challenge } = await generatePKCE();
  const state = generateState();
  const redirectUri = window.location.origin + '/';

  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_STATE, state);
  sessionStorage.setItem(SS_REDIRECT, redirectUri);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'none', // Silent — no UI shown; fails immediately if not logged in
  });

  window.location.href = `${authEndpoint}?${params}`;
}

// ── OIDC callback handler ──────────────────────────────────────────────────
async function handleOIDCCallback(code, returnedState) {
  const expectedState = sessionStorage.getItem(SS_STATE);
  const verifier      = sessionStorage.getItem(SS_VERIFIER);
  const redirectUri   = sessionStorage.getItem(SS_REDIRECT);

  sessionStorage.removeItem(SS_STATE);
  sessionStorage.removeItem(SS_VERIFIER);
  sessionStorage.removeItem(SS_REDIRECT);

  // Clean ?code= and ?state= from the URL without reloading
  window.history.replaceState({}, '', '/');

  if (returnedState !== expectedState) return; // State mismatch — show login form
  if (!verifier || !redirectUri) return;

  try {
    const res = await api.post('/api/oidc/monitor-login', {
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
    const token = res.data.token;
    if (!token) return;
    localStorage.setItem('token', token);
    const lastPath = localStorage.getItem('lastVisitedPath');
    if (lastPath && lastPath !== '/' && lastPath !== '/dashboard') {
      router.push(lastPath);
    } else {
      router.push('/dashboard');
    }
  } catch {
    // User has no Monitor account or account not confirmed — fall through to login form
  }
}

// Check if user is already logged in and redirect
onMounted(async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp > Date.now() / 1000) {
        const lastPath = localStorage.getItem('lastVisitedPath');
        if (lastPath && lastPath !== '/' && lastPath !== '/dashboard') {
          router.push(lastPath);
        } else {
          router.push('/dashboard');
        }
        return;
      }
    } catch {
      localStorage.removeItem('token');
    }
  }

  const params = new URLSearchParams(window.location.search);
  const code  = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    // login_required = user not logged in to Flip → show login form silently
    // other errors → same, just show the form
    window.history.replaceState({}, '', '/');
    return;
  }

  if (code && state) {
    await handleOIDCCallback(code, state);
    return;
  }

  // No code yet and no active Monitor session — attempt silent Flip SSO
  await trySilentOIDC();
});
</script>

<style scoped lang="scss">
// nutzt automatisch deine Variablen aus global.scss (per Vite additionalData)
.auth-shell{
  min-height:100dvh; display:grid; place-items:center; background:var(--bg);
  padding:24px;
  
  // Mobile: Less padding but keep centered
  @media (max-width: 768px) {
    padding: 16px;
    // Keep centered but with safe area consideration
    padding-top: max(16px, env(safe-area-inset-top, 16px));
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    min-height: 100vh; // Fallback for older browsers
    min-height: 100svh; // Small viewport height for mobile
    // Ensure it stays centered even on small screens
    place-items: center;
  }
}

.auth-card{
  width:min(520px, 100%); background:#fff; border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.10); overflow:hidden;
  border:1px solid $base-border-color;
  
  // Mobile: Full width with max constraints
  @media (max-width: 768px) {
    width: 100%;
    max-width: 400px;
    border-radius: 8px;
  }
  
  @media (max-width: 480px) {
    max-width: none;
    margin: 0;
  }
}

.auth-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px; background:$base-panel-bg; border-bottom:1px solid $base-border-color;
  
  // Mobile: Stack vertically for better space usage
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 12px;
    padding: 16px 12px;
  }
}

.brand{ 
  display:flex; align-items:center; gap:10px; font-weight:700; color:$base-text-dark;
  
  // Mobile: Smaller brand on mobile
  @media (max-width: 480px) {
    gap: 8px;
    font-size: 14px;
  }
}

.brand img{ 
  width:28px; 
  height:auto; 
  filter: brightness(1.2) opacity(0.7);
  
  // Mobile: Smaller logo
  @media (max-width: 480px) {
    width: 24px;
  }
}

.segmented{
  display:flex; gap:6px; background:$base-input-bg; padding:4px; border-radius:999px;
  border:1px solid $base-border-color;
  
  // Mobile: Full width buttons for easier touch
  @media (max-width: 480px) {
    width: 100%;
    max-width: 280px;
  }
}

.segmented button{
  appearance:none; border:0; background:transparent; padding:6px 12px; border-radius:999px; cursor:pointer;
  font-weight:600; color:$base-text-notsodark; font-size: 14px;
  
  // Mobile: Better touch targets
  @media (max-width: 480px) {
    flex: 1;
    padding: 8px 16px;
    font-size: 13px;
  }
}

.segmented button.active{
  background:$base-highlight-accent; color:$base-text-dark; border:1px solid mix($base-primary, $base-border-color, 40%);
}

.auth-body{ padding:18px 18px 22px; }
</style>
