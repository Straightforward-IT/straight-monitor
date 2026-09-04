function getEmployeeR2Prefix(employee) {
  const prefix = typeof employee === 'string' ? employee : employee?.r2Prefix;
  const normalizedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');

  if (!/^employees\/[a-f\d]{24}$/i.test(normalizedPrefix)) {
    throw new Error('A valid employee R2 prefix is required.');
  }

  return normalizedPrefix;
}

function buildEmployeeR2Path(employee, area, fileName = '') {
  const allowedAreas = new Set(['documents', 'documents/uploads', 'documents/payroll', 'profile']);
  if (!allowedAreas.has(area)) {
    throw new Error(`Unsupported employee R2 area: ${area}`);
  }

  const basePath = `${getEmployeeR2Prefix(employee)}/${area}`;
  if (!fileName) return basePath;

  const safeFileName = String(fileName).replace(/^\/+/, '');
  if (!safeFileName || safeFileName.includes('..') || safeFileName.includes('/')) {
    throw new Error('Employee R2 file name must be a single path segment.');
  }

  return `${basePath}/${safeFileName}`;
}

module.exports = { getEmployeeR2Prefix, buildEmployeeR2Path };