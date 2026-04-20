/**
 * OIDC Authentication Routes
 *
 * Implements Authorization Code Flow with PKCE using Flip's Keycloak as IdP.
 *
 * Flow:
 *   1. Frontend generates PKCE code_verifier + code_challenge and redirects user
 *      to Keycloak authorization endpoint (with prompt=none for silent SSO).
 *   2. Keycloak redirects back to the app with ?code=...&state=...
 *   3. Frontend sends { code, code_verifier, redirect_uri } to POST /api/public/oidc/callback
 *   4. This route exchanges the code for an ID token, verifies it via JWKS,
 *      extracts the email, and returns a short-lived session JWT.
 *   5. The frontend stores the session JWT and uses it as x-public-token for
 *      all subsequent /api/public/* requests.
 *
 * Config (api/.env):
 *   FLIP_OIDC_CLIENT_ID   — provided by Flip/Sebastian (public client, no secret needed)
 *   FLIP_OIDC_REDIRECT_URI — registered redirect URI (e.g. https://your-domain.com/mitarbeiter/einsaetze)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middleware/AsyncHandler');
const logger = require('../utils/logger');
const User = require('../models/User');

const ISSUER = 'https://straightforward.flip-app.com/auth/realms/hpstraightforward';
const TOKEN_ENDPOINT = `${ISSUER}/protocol/openid-connect/token`;
const JWKS_URI = `${ISSUER}/protocol/openid-connect/certs`;

// ── JWKS cache ─────────────────────────────────────────────────────────────
let _jwksCache = null;
let _jwksCacheTime = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchJwks() {
  const now = Date.now();
  if (_jwksCache && now - _jwksCacheTime < JWKS_CACHE_TTL) return _jwksCache;
  const res = await fetch(JWKS_URI);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  _jwksCache = await res.json();
  _jwksCacheTime = now;
  return _jwksCache;
}

// Verify a Keycloak-signed JWT using the JWKS (no extra packages — uses Node.js crypto)
async function verifyIdToken(idToken) {
  const [headerB64] = idToken.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  const jwks = await fetchJwks();
  const jwk = jwks.keys.find(k => k.kid === header.kid && k.use === 'sig');
  if (!jwk) throw new Error('No matching signing key found in JWKS');

  // Convert JWK -> PEM using Node.js built-in crypto (no extra packages)
  const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const pem = pubKey.export({ type: 'spki', format: 'pem' });

  return jwt.verify(idToken, pem, {
    algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512'],
    issuer: ISSUER,
  });
}

// ── POST /api/public/oidc/callback ─────────────────────────────────────────
// Exchanges an authorization code for a verified session token.
// Body: { code, code_verifier, redirect_uri }
router.post(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, code_verifier, redirect_uri } = req.body;

    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({ msg: 'Missing required parameters: code, code_verifier, redirect_uri' });
    }

    const clientId = process.env.FLIP_OIDC_CLIENT_ID;
    if (!clientId) {
      logger.warn('OIDC: FLIP_OIDC_CLIENT_ID is not set — OIDC login unavailable');
      return res.status(503).json({ msg: 'OIDC ist noch nicht konfiguriert. Bitte wende dich an den Administrator.' });
    }

    // Exchange authorization code for token set
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier,
      redirect_uri,
    });

    let tokenSet;
    try {
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!tokenRes.ok) {
        const detail = await tokenRes.text();
        logger.error('OIDC token exchange failed:', detail);
        return res.status(400).json({ msg: 'Token-Austausch fehlgeschlagen', detail });
      }
      tokenSet = await tokenRes.json();
    } catch (err) {
      logger.error('OIDC token exchange error:', err.message);
      return res.status(502).json({ msg: 'Verbindung zu Keycloak fehlgeschlagen' });
    }

    const idToken = tokenSet.id_token;
    if (!idToken) {
      return res.status(400).json({ msg: 'Kein ID-Token in der Antwort' });
    }

    // Verify the ID token signature and claims via JWKS
    let claims;
    try {
      claims = await verifyIdToken(idToken);
    } catch (err) {
      logger.error('OIDC ID token verification failed:', err.message);
      return res.status(401).json({ msg: 'ID-Token ungültig', detail: err.message });
    }

    // Extract email — Keycloak uses 'email' or falls back to 'preferred_username'
    const email = claims.email || (claims.preferred_username?.includes('@') ? claims.preferred_username : null);
    if (!email) {
      return res.status(400).json({ msg: 'Kein E-Mail-Anspruch im Token gefunden' });
    }

    // Issue our own short-lived session JWT containing the verified email and Flip user ID
    // claims.sub from Flip's Keycloak realm IS the Flip user UUID (= flip_id in Mitarbeiter)
    const sessionToken = jwt.sign(
      { email, flip_id: claims.sub, source: 'oidc' },
      process.env.JWT_SECRET,
      { expiresIn: '12h', issuer: 'straight-monitor' }
    );

    logger.info(`OIDC login successful: ${email} (flip_id: ${claims.sub})`);
    return res.json({ session_token: sessionToken, email, flip_id: claims.sub });
  })
);

// ── POST /api/public/oidc/monitor-login ────────────────────────────────────
// Exchanges a Flip OIDC authorization code for a full Monitor session JWT.
// The email from the ID token is matched against User.email in the DB.
// If a confirmed User is found, the standard Monitor JWT is returned so the
// frontend can store it in localStorage and skip the login screen entirely.
// Body: { code, code_verifier, redirect_uri }
router.post(
  '/monitor-login',
  asyncHandler(async (req, res) => {
    const { code, code_verifier, redirect_uri } = req.body;

    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({ msg: 'Missing required parameters: code, code_verifier, redirect_uri' });
    }

    const clientId = process.env.FLIP_OIDC_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ msg: 'OIDC ist noch nicht konfiguriert.' });
    }

    // Exchange authorization code for token set
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier,
      redirect_uri,
    });

    let tokenSet;
    try {
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!tokenRes.ok) {
        const detail = await tokenRes.text();
        logger.error('OIDC monitor-login token exchange failed:', detail);
        return res.status(400).json({ msg: 'Token-Austausch fehlgeschlagen', detail });
      }
      tokenSet = await tokenRes.json();
    } catch (err) {
      logger.error('OIDC monitor-login token exchange error:', err.message);
      return res.status(502).json({ msg: 'Verbindung zu Keycloak fehlgeschlagen' });
    }

    const idToken = tokenSet.id_token;
    if (!idToken) {
      return res.status(400).json({ msg: 'Kein ID-Token in der Antwort' });
    }

    // Verify the ID token signature and claims via JWKS
    let claims;
    try {
      claims = await verifyIdToken(idToken);
    } catch (err) {
      logger.error('OIDC monitor-login ID token verification failed:', err.message);
      return res.status(401).json({ msg: 'ID-Token ungültig', detail: err.message });
    }

    const email = claims.email || (claims.preferred_username?.includes('@') ? claims.preferred_username : null);
    if (!email) {
      return res.status(400).json({ msg: 'Kein E-Mail-Anspruch im Token gefunden' });
    }

    // Look up a confirmed Monitor user with this email
    const user = await User.findOne({ email: email.toLowerCase() }).select('_id isConfirmed roles role');
    if (!user) {
      return res.status(404).json({ msg: 'Kein Monitor-Konto für diese Flip-E-Mail gefunden.' });
    }
    if (!user.isConfirmed) {
      return res.status(403).json({ msg: 'Monitor-Konto noch nicht bestätigt.' });
    }

    // Issue the standard Monitor JWT (same format as password login)
    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 });

    logger.info(`OIDC monitor auto-login: ${email} (user: ${user.id})`);
    return res.json({ token });
  })
);

// ── GET /api/public/oidc/config ────────────────────────────────────────────
// Returns the Keycloak authorization endpoint and client_id so the frontend
// can build the auth URL without hardcoding backend config.
router.get(
  '/config',
  asyncHandler(async (req, res) => {
    const clientId = process.env.FLIP_OIDC_CLIENT_ID;
    return res.json({
      authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
      client_id: clientId || null,
      configured: !!clientId,
    });
  })
);

module.exports = router;
