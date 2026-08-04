/**
 * signaturR2Path.js
 *
 * Builds the R2 key prefix for a signature document.
 *
 * Directory structure:
 *   Signatures/{location}/kunden/{kuerzel-or-name}/{typKey}/
 *   Signatures/{location}/mitarbeiter/{name}/{typKey}/
 *   Signatures/{location}/sonstige/{typKey}/
 *
 * Files placed under each prefix:
 *   signed-{submissionId}.pdf   — signed document
 *   audit-{submissionId}.pdf    — DocuSeal audit trail
 */

/**
 * Build an R2 key prefix for a signature document.
 *
 * @param {object} opts
 * @param {'Kunde'|'Mitarbeiter'|null} opts.entityType
 * @param {string}  opts.entityIdentifier  kuerzel (Kunde) or "{vorname}-{nachname}" (Mitarbeiter)
 * @param {string}  opts.locationIdentifier Location shortName or name
 * @param {string}  opts.typKey            e.g. 'stundenliste', 'auerv'
 * @param {string}  [opts.entityPrefix]    previously persisted entity base folder
 * @returns {string} R2 key prefix without trailing slash
 */
function buildSignaturR2Prefix({
  locationIdentifier,
  entityType,
  entityIdentifier,
  entityPrefix,
  typKey,
} = {}) {
  const basePrefix = entityPrefix || buildSignaturEntityR2Prefix({
    locationIdentifier,
    entityType,
    entityIdentifier,
  });
  return `${String(basePrefix).replace(/\/+$/, '')}/${sanitizeSegment(typKey || 'dokument')}`;
}

function buildSignaturEntityR2Prefix({ locationIdentifier, entityType, entityIdentifier } = {}) {
  const safeLocation = sanitizeSegment(locationIdentifier || 'ohne-location');
  const safeId = sanitizeSegment(entityIdentifier || 'allgemein');

  if (entityType === 'Kunde') {
    return `Signatures/${safeLocation}/kunden/${safeId}`;
  }

  if (entityType === 'Mitarbeiter') {
    return `Signatures/${safeLocation}/mitarbeiter/${safeId}`;
  }

  return `Signatures/${safeLocation}/sonstige`;
}

/**
 * Sanitize a path segment for safe use in an R2 key.
 * - Strips diacritics (ü → u, ö → o, etc.)
 * - Replaces any non-alphanumeric character (except `-` and `_`) with `-`
 * - Collapses consecutive dashes
 * - Trims leading/trailing dashes
 * - Lowercases the result
 *
 * @param {string} str
 * @returns {string}
 */
function sanitizeSegment(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics (ü → u, ö → o, ä → a, etc.)
    .replace(/[^a-zA-Z0-9_\-]/g, '-')    // replace unsafe characters with dashes
    .replace(/-{2,}/g, '-')              // collapse consecutive dashes
    .replace(/^-+|-+$/g, '')             // trim leading/trailing dashes
    .toLowerCase();
}

/**
 * Format a Date as YYYY-MM-DD (UTC).
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = { buildSignaturR2Prefix, buildSignaturEntityR2Prefix, sanitizeSegment, formatDate };
