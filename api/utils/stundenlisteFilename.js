function sanitizeFilenamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '');
}

function formatEventDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

function buildStundenlistePdfFilename(auftrag = {}, { signed = false } = {}) {
  const eventTitle = sanitizeFilenamePart(auftrag.eventTitel);
  const fallbackTitle = auftrag.auftragNr ? `Auftrag ${auftrag.auftragNr}` : 'Auftrag';
  const eventDate = formatEventDate(auftrag.vonDatum);
  const parts = ['Stundenliste', eventTitle || fallbackTitle, eventDate].filter(Boolean);
  if (signed) parts.push('unterschrieben');
  return `${parts.join(' - ')}.pdf`;
}

function contentDisposition(filename) {
  const asciiFallback = String(filename).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

module.exports = { buildStundenlistePdfFilename, contentDisposition };
