<template>
  <div class="flip-login">
    <div v-if="status === 'loading'" class="state">
      <div class="spinner"></div>
      <p>Anmeldung läuft…</p>
    </div>
    <div v-else-if="status === 'error'" class="state error">
      <p>{{ errorMsg }}</p>
      <a href="/">Zum Login</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';

const router = useRouter();
const status = ref('loading');
const errorMsg = ref('');

// ── PKCE helpers ──────────────────────────────────────────────────────────
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

const SS_VERIFIER = 'fliplogin_pkce_verifier';
const SS_STATE    = 'fliplogin_state';
const REDIRECT_URI = window.location.origin + '/integration/monitor-login';

async function startOIDC() {
  let authEndpoint, clientId;
  try {
    const res = await api.get('/api/oidc/config');
    authEndpoint = res.data.authorization_endpoint;
    clientId = res.data.client_id;
    if (!clientId) throw new Error('OIDC nicht konfiguriert');
  } catch (e) {
    status.value = 'error';
    errorMsg.value = 'Login-Konfiguration konnte nicht geladen werden.';
    return;
  }

  const { verifier, challenge } = await generatePKCE();
  const state = generateState();

  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_STATE, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'none',
  });

  window.location.href = `${authEndpoint}?${params}`;
}

async function handleCallback(code, returnedState) {
  const expectedState = sessionStorage.getItem(SS_STATE);
  const verifier      = sessionStorage.getItem(SS_VERIFIER);

  sessionStorage.removeItem(SS_STATE);
  sessionStorage.removeItem(SS_VERIFIER);

  window.history.replaceState({}, '', '/integration/monitor-login');

  if (returnedState !== expectedState || !verifier) {
    status.value = 'error';
    errorMsg.value = 'Sicherheitsvalidierung fehlgeschlagen. Bitte erneut versuchen.';
    return;
  }

  try {
    const res = await api.post('/api/oidc/monitor-login', {
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
    });
    localStorage.setItem('token', res.data.token);
    router.push('/dashboard');
  } catch (err) {
    const msg = err.response?.data?.msg || 'Anmeldung fehlgeschlagen.';
    status.value = 'error';
    errorMsg.value = msg;
  }
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const state  = params.get('state');
  const error  = params.get('error');

  if (error) {
    // prompt=none schlug fehl (z.B. nicht in Flip eingeloggt)
    window.history.replaceState({}, '', '/integration/monitor-login');
    status.value = 'error';
    errorMsg.value = 'Automatische Anmeldung fehlgeschlagen. Bitte über Flip öffnen.';
    return;
  }

  if (code && state) {
    await handleCallback(code, state);
    return;
  }

  // Erster Aufruf — OIDC-Flow starten
  await startOIDC();
});
</script>

<style scoped lang="scss">
.flip-login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background: var(--bg);
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text);

  p { margin: 0; font-size: 1rem; color: var(--muted); }

  a {
    color: var(--primary);
    font-weight: 600;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  &.error p { color: var(--danger, #e53e3e); }
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
