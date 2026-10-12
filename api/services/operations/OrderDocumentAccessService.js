const User = require('../../models/System/User');

async function canAccessOfficeDocument(document, user) {
  if (document.audience !== 'office_roles') return true;
  const allowedRoles = document.allowedRoles?.length ? document.allowedRoles : ['ADMIN', 'VERTRIEB'];
  const currentUser = await User.findById(user?._id || user?.id).select('role roles').lean();
  const roles = new Set([currentUser?.role, ...(currentUser?.roles || [])]
    .filter(Boolean).map(role => String(role).toUpperCase()));
  return allowedRoles.some(role => roles.has(role));
}

module.exports = { canAccessOfficeDocument };
