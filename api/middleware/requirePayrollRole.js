const User = require('../models/System/User');

const PAYROLL_ROLES = new Set(['ADMIN', 'PAYROLL']);

/**
 * Payroll contains particularly sensitive employee data. Authentication alone
 * is therefore not sufficient: every payroll route resolves the current user
 * from MongoDB and checks the live role assignment instead of trusting roles
 * embedded in an older JWT.
 */
module.exports = async function requirePayrollRole(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        code: 'PAYROLL_AUTH_REQUIRED',
        message: 'Anmeldung erforderlich.',
      });
    }

    const user = await User.findById(userId).select('_id name email role roles').lean();
    if (!user) {
      return res.status(401).json({
        code: 'PAYROLL_AUTH_REQUIRED',
        message: 'Benutzerkonto nicht gefunden.',
      });
    }

    const roles = new Set([user.role, ...(user.roles || [])].filter(Boolean));
    const permitted = [...roles].some((role) => PAYROLL_ROLES.has(String(role).toUpperCase()));

    if (!permitted) {
      return res.status(403).json({
        code: 'PAYROLL_ROLE_REQUIRED',
        message: 'Für diese Funktion ist die Rolle PAYROLL oder ADMIN erforderlich.',
      });
    }

    req.payrollUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports.PAYROLL_ROLES = PAYROLL_ROLES;
