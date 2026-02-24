require('dotenv').config();
const jwt = require('jsonwebtoken');

/**
 * Middleware for "semi-public" routes.
 *
 * Accepts two types of tokens (via ?token=... query param or x-public-token header):
 *
 * 1. OIDC session JWT — issued by POST /api/public/oidc/callback after verifying
 *    the user's Keycloak ID token. Contains { email, sub, source: 'oidc' }.
 *    The verified email is attached to req.oidcEmail for use in route handlers.
 *
 * 2. Static FLIP_PUBLIC_JWT — legacy shared secret (WPForms flow). Kept for
 *    backwards compatibility while OIDC is being rolled out.
 */
module.exports = function publicAuth(req, res, next) {
  const token = req.query.token || req.headers['x-public-token'];

  if (!token) {
    return res.status(401).json({ msg: 'Kein Zugangstoken vorhanden' });
  }

  // ── 1. Try OIDC session JWT (preferred) ──────────────────────────────────
  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'straight-monitor',
      });
      if (decoded.source === 'oidc' && decoded.email) {
        req.oidcEmail = decoded.email;
        req.oidcUser = decoded;
        return next();
      }
    } catch {
      // Not a valid OIDC session JWT — fall through to static token check
    }
  }

  // ── 2. Fall back to static FLIP_PUBLIC_JWT (legacy WPForms flow) ─────────
  const expected = process.env.FLIP_PUBLIC_JWT;
  if (!expected) {
    return res.status(500).json({ msg: 'FLIP_PUBLIC_JWT not configured on server' });
  }
  if (token !== expected) {
    return res.status(403).json({ msg: 'Ungültiger Zugangstoken' });
  }

  next();
};
