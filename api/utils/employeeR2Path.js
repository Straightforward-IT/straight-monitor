function getEmployeeR2Prefix(employee) {
  const prefix = typeof employee === 'string'
    ? employee
    : employee?.r2Prefix || (employee?._id ? `employees/${employee._id}` : '');
  const normalizedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');

  if (!/^employees\/[a-f\d]{24}$/i.test(normalizedPrefix)) {
    throw new Error('A valid employee R2 prefix is required.');
  }

  return normalizedPrefix;
}

/**
 * Build the canonical virtual directory tree for employee-owned R2 objects.
 * R2 prefixes represent directories; no placeholder objects are required.
 */
function buildEmployeeR2Tree(employee) {
  const root = getEmployeeR2Prefix(employee);
  return {
    root,
    profile: `${root}/profile`,
    documents: `${root}/documents`,
    uploads: `${root}/documents/uploads`,
    payroll: `${root}/documents/payroll`,
    signatures: `${root}/signatures`,
  };
}

function buildEmployeeR2Path(employee, area, fileName = '') {
  const allowedAreas = new Set(['documents', 'documents/uploads', 'documents/payroll', 'profile', 'signatures']);
  if (!allowedAreas.has(area)) {
    throw new Error(`Unsupported employee R2 area: ${area}`);
  }

  const tree = buildEmployeeR2Tree(employee);
  const basePath = tree[area.split('/').pop()] || `${tree.root}/${area}`;
  if (!fileName) return basePath;

  const safeFileName = String(fileName).replace(/^\/+/, '');
  if (!safeFileName || safeFileName.includes('..') || safeFileName.includes('/')) {
    throw new Error('Employee R2 file name must be a single path segment.');
  }

  return `${basePath}/${safeFileName}`;
}

module.exports = { getEmployeeR2Prefix, buildEmployeeR2Tree, buildEmployeeR2Path };