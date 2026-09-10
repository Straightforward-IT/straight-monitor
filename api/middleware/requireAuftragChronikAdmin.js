const User = require('../models/System/User');
const asyncHandler = require('./AsyncHandler');

function isChronikAdmin(user) {
  return [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .some(role => String(role || '').toUpperCase() === 'ADMIN');
}

module.exports = asyncHandler(async (req, res, next) => {
  const id = req.user?.id || req.user?._id;
  const user = id ? await User.findById(id).select('name email role roles locationV2 locationAccess').lean() : null;
  if (!user) return res.status(401).json({ message: 'Anmeldung erforderlich.' });
  if (!isChronikAdmin(user)) return res.status(403).json({ message: 'Die Auftragschronik ist derzeit nur für Admins verfügbar.' });
  req.chronikUser = user;
  next();
});
module.exports.isChronikAdmin = isChronikAdmin;
