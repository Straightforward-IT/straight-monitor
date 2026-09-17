'use strict';

const Mitarbeiter = require('../../models/Employee/Mitarbeiter');

function publicEmployeeError(code, message, statusCode) {
  return Object.assign(new Error(message), { code, statusCode, expose: true });
}

async function resolvePublicEmployee({ flipId, email }) {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  const emailClause = normalizedEmail
    ? { $or: [{ email: normalizedEmail }, { additionalEmails: normalizedEmail }] }
    : null;
  const query = flipId && emailClause
    ? { $and: [{ flip_id: flipId }, emailClause] }
    : flipId
      ? { flip_id: flipId }
      : emailClause;

  if (!query) throw publicEmployeeError('PUBLIC_EMPLOYEE_REQUIRED', 'Mitarbeiteridentität fehlt.', 401);

  const employees = await Mitarbeiter.find(query)
    .select('_id personalnr personalnrHistory vorname nachname flip_id email isActive')
    .limit(2)
    .lean();

  if (employees.length > 1) {
    throw publicEmployeeError('PUBLIC_EMPLOYEE_AMBIGUOUS', 'Die verifizierte Identität ist nicht eindeutig einem Mitarbeiter zugeordnet.', 409);
  }

  const employee = employees[0];
  if (!employee || employee.isActive === false) {
    throw publicEmployeeError('PUBLIC_EMPLOYEE_NOT_FOUND', 'Kein aktiver Mitarbeiter für diese Sitzung gefunden.', 404);
  }
  return employee;
}

module.exports = { resolvePublicEmployee };
