'use strict';

const PAYROLL_OWNED_ROOTS = new Set(['paychex_id', 'integrations']);

/**
 * Paychex linkage and sync checkpoints are payroll-owned. Generic employee
 * CRUD must never be able to redirect a provider identity or forge sync state.
 */
function stripPayrollOwnedEmployeeFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  for (const key of Object.keys(input)) {
    if (PAYROLL_OWNED_ROOTS.has(key)
        || key === 'integrations.paychex'
        || key.startsWith('integrations.paychex.')) {
      delete input[key];
    }
  }
  return input;
}

module.exports = stripPayrollOwnedEmployeeFields;
module.exports.PAYROLL_OWNED_ROOTS = PAYROLL_OWNED_ROOTS;
