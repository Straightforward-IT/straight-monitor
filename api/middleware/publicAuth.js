require('dotenv').config();

/**
 * Middleware for "semi-public" routes.
 * Validates the FLIP_PUBLIC_JWT token passed via:
 *   - Query parameter: ?token=...
 *   - Header: x-public-token
 */
module.exports = function publicAuth(req, res, next) {
  const expected = process.env.FLIP_PUBLIC_JWT;

  if (!expected) {
    return res.status(500).json({ msg: 'FLIP_PUBLIC_JWT not configured on server' });
  }

  const token = req.query.token || req.headers['x-public-token'];

  if (!token) {
    return res.status(401).json({ msg: 'Kein Zugangstoken vorhanden' });
  }

  if (token !== expected) {
    return res.status(403).json({ msg: 'Ungültiger Zugangstoken' });
  }

  next();
};
