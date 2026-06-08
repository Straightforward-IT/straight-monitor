import { computed, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import apiPublic from '@/utils/api-public';

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return JSON.parse(atob(padded));
}

async function generatePKCE() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return { verifier, challenge };
}

function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(value => value.toString(16).padStart(2, '0')).join('');
}

export function usePublicOidcAuth(options = {}) {
  const route = useRoute();
  const sessionKey = options.sessionKey || 'oidc_session';
  const configPath = options.configPath || '/api/oidc/config';
  const callbackPath = options.callbackPath || '/api/oidc/callback';
  const pkceKeyPrefix = options.pkceKeyPrefix || 'oidc';
  const pkceVerifierKey = `${pkceKeyPrefix}_pkce_verifier`;
  const oidcStateKey = `${pkceKeyPrefix}_state`;
  const redirectUriKey = `${pkceKeyPrefix}_redirect_uri`;
  const api = apiPublic;

  const oidcEmail = ref('');
  const sessionToken = ref('');
  const loading = ref(true);
  const error = ref('');

  const legacyEmail = computed(() => firstQueryValue(route.query.email) || '');
  const legacyToken = computed(() => firstQueryValue(route.query.token) || '');

  const email = computed(() => oidcEmail.value || legacyEmail.value || '');
  const token = computed(() => sessionToken.value || legacyToken.value || '');

  const interceptorId = api.interceptors.request.use((config) => {
    if (token.value) config.headers['x-public-token'] = token.value;
    return config;
  });

  onUnmounted(() => {
    api.interceptors.request.eject(interceptorId);
  });

  function saveSession(nextToken, nextEmail) {
    try {
      const payload = decodeJwtPayload(nextToken);
      sessionStorage.setItem(sessionKey, JSON.stringify({ token: nextToken, email: nextEmail, exp: payload.exp }));
    } catch {
      // Ignore storage/decode failures; the in-memory session still works for this page load.
    }
  }

  function loadStoredSession() {
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session.token || !session.email) return null;
      if (session.exp && session.exp < Date.now() / 1000) {
        sessionStorage.removeItem(sessionKey);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async function redirectToOIDC(promptValue = 'none') {
    let authEndpoint;
    let clientId;

    try {
      const response = await api.get(configPath);
      authEndpoint = response.data.authorization_endpoint;
      clientId = response.data.client_id;
      if (!clientId) {
        error.value = 'OIDC ist noch nicht konfiguriert. Bitte wende dich an den Administrator.';
        loading.value = false;
        return;
      }
    } catch {
      error.value = 'Login-Konfiguration konnte nicht geladen werden.';
      loading.value = false;
      return;
    }

    const { verifier, challenge } = await generatePKCE();
    const state = generateState();
    const redirectUri = window.location.origin + window.location.pathname;

    sessionStorage.setItem(pkceVerifierKey, verifier);
    sessionStorage.setItem(oidcStateKey, state);
    sessionStorage.setItem(redirectUriKey, redirectUri);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: promptValue,
    });

    window.location.href = `${authEndpoint}?${params}`;
  }

  async function handleOIDCCallback(code, returnedState) {
    const expectedState = sessionStorage.getItem(oidcStateKey);
    const verifier = sessionStorage.getItem(pkceVerifierKey);
    const redirectUri = sessionStorage.getItem(redirectUriKey);

    sessionStorage.removeItem(oidcStateKey);
    sessionStorage.removeItem(pkceVerifierKey);
    sessionStorage.removeItem(redirectUriKey);
    window.history.replaceState({}, '', window.location.pathname);

    if (returnedState !== expectedState) {
      error.value = 'Sicherheitsvalidierung fehlgeschlagen. Bitte die Seite neu laden.';
      loading.value = false;
      return;
    }

    if (!verifier || !redirectUri) {
      error.value = 'Sitzungsdaten fehlen. Bitte die Seite neu laden.';
      loading.value = false;
      return;
    }

    try {
      const response = await api.post(callbackPath, { code, code_verifier: verifier, redirect_uri: redirectUri });
      oidcEmail.value = response.data.email;
      sessionToken.value = response.data.session_token;
      saveSession(response.data.session_token, response.data.email);
    } catch (requestError) {
      error.value = requestError.response?.data?.msg || 'Login fehlgeschlagen.';
      loading.value = false;
    }
  }

  async function initializeAuth() {
    loading.value = true;
    error.value = '';

    const queryCode = firstQueryValue(route.query.code);
    const queryState = firstQueryValue(route.query.state);
    const queryError = firstQueryValue(route.query.error);

    if (queryCode) {
      await handleOIDCCallback(queryCode, queryState);
      loading.value = false;
      return !error.value;
    }

    if (queryError) {
      window.history.replaceState({}, '', window.location.pathname);
      if (queryError === 'login_required' || queryError === 'interaction_required') {
        await redirectToOIDC('login');
        return false;
      }
      error.value = `Login-Fehler: ${queryError}`;
      loading.value = false;
      return false;
    }

    const session = loadStoredSession();
    if (session) {
      oidcEmail.value = session.email;
      sessionToken.value = session.token;
      loading.value = false;
      return true;
    }

    if (legacyEmail.value && legacyToken.value) {
      loading.value = false;
      return true;
    }

    await redirectToOIDC('none');
    return false;
  }

  return {
    api,
    email,
    token,
    loading,
    error,
    initializeAuth,
    redirectToOIDC,
  };
}
