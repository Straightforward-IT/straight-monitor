const MIME_TYPES = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
  txt: 'text/plain', md: 'text/plain', log: 'text/plain', json: 'application/json',
  xml: 'text/xml', html: 'text/plain', htm: 'text/plain', csv: 'text/csv', tsv: 'text/tab-separated-values',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
};

export const MAX_TEXT_BYTES = 1024 * 1024;
export const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024;
export const MAX_SHEET_ROWS = 500;
export const MAX_SHEET_COLUMNS = 100;

function decode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function documentFilename(url = '', fallback = 'Dokument') {
  try {
    const parsed = new URL(url, 'https://document.invalid');
    const disposition = parsed.searchParams.get('response-content-disposition') || '';
    const filename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
      || disposition.match(/filename="([^"]+)"/i)?.[1];
    return decode(filename || parsed.pathname.split('/').pop() || fallback);
  } catch { return fallback; }
}

export function documentFormat(filename = '', contentType = '') {
  const extension = filename.split('.').pop().toLowerCase();
  const mime = contentType.split(';')[0].trim().toLowerCase();
  // Markup is always displayed as escaped text, never as an executable document.
  if (['html', 'htm', 'xml'].includes(extension) || ['text/html', 'application/xhtml+xml', 'text/xml', 'application/xml'].includes(mime)) {
    return { kind: 'text', mime: 'text/plain', label: 'Text' };
  }
  const type = mime && mime !== 'application/octet-stream' ? mime : (MIME_TYPES[extension] || mime);
  if (type === 'application/pdf') return { kind: 'pdf', mime: type, label: 'PDF' };
  if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(extension)
    || /spreadsheet|ms-excel|text\/(csv|tab-separated-values)/.test(type)) {
    return { kind: 'spreadsheet', mime: type, label: 'Tabelle' };
  }
  // SVG remains in an <img>; it is never inserted as markup or into an iframe.
  if (/^image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml)$/.test(type)) return { kind: 'image', mime: type, label: 'Bild' };
  if (type.startsWith('audio/')) return { kind: 'audio', mime: type, label: 'Audio' };
  if (type.startsWith('video/')) return { kind: 'video', mime: type, label: 'Video' };
  if (type.startsWith('text/') || /^(application\/json|application\/.*\+json)$/.test(type)) {
    return { kind: 'text', mime: type, label: 'Text' };
  }
  return { kind: 'unsupported', mime: type || 'application/octet-stream', label: extension === filename.toLowerCase() ? 'Datei' : extension.toUpperCase() };
}

/** Signed R2 URLs carry their own authorization. Never send the app token to R2. */
export function validateDocumentUrl(value, baseUrl = window.location.href) {
  const url = new URL(value, baseUrl);
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) && !(url.protocol === 'blob:' && url.origin === base.origin)) {
    throw new Error('Dieser Dokumentlink wird nicht unterstützt.');
  }
  if (url.username || url.password) throw new Error('Ungültiger Dokumentlink.');
  return url.href;
}

export async function fetchDocumentBlob(url, signal) {
  const response = await fetch(validateDocumentUrl(url), {
    signal, credentials: 'omit', referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`Dokument konnte nicht geladen werden (HTTP ${response.status}).`);
  return response.blob();
}

export function triggerDocumentDownload(url, filename) {
  const link = document.createElement('a');
  link.href = validateDocumentUrl(url);
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Bound rendered cells even when a workbook declares a huge sparse range. */
export function worksheetPreview(sheet, utils) {
  const range = utils.decode_range(sheet['!ref'] || 'A1');
  const fullRange = utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
  range.e.r = Math.min(range.e.r, range.s.r + MAX_SHEET_ROWS - 1);
  range.e.c = Math.min(range.e.c, range.s.c + MAX_SHEET_COLUMNS - 1);
  return {
    rows: sheet['!ref'] ? utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', range, blankrows: true }) : [],
    truncated: fullRange.e.r > range.e.r || fullRange.e.c > range.e.c,
  };
}
