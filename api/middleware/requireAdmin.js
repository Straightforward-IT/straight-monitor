const User = require('../models/System/User');
const asyncHandler = require('./AsyncHandler');

function isAdmin(user) {
  return [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .some(role => String(role || '').toUpperCase() === 'ADMIN');
}

// Read the database record on every protected request so role revocation takes
// effect immediately instead of relying on the JWT's older role information.
module.exports = asyncHandler(async (req, res, next) => {
  const id = req.user?.id || req.user?._id;
  const user = id ? await User.findById(id).select('role roles').lean() : null;
  if (!user) return res.status(401).json({ message: 'Anmeldung erforderlich.' });
  if (!isAdmin(user)) return res.status(403).json({ message: 'Die Mitarbeiter- und Einsatzortkarte ist derzeit nur für Admins verfügbar.' });
  req.adminUser = user;
  next();
});

module.exports.isAdmin = isAdmin;
