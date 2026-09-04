const sanitizeHtml = require('sanitize-html');
const EinsatzinformationTemplate = require('../../models/Event/EinsatzinformationTemplate');

const PLACEHOLDERS = Object.freeze({
  'kunde.name': 'Kundenname',
  'kunde.kuerzel': 'Kundenkürzel',
  'auftrag.nummer': 'Auftragsnummer',
  'auftrag.titel': 'Auftragstitel',
  'auftrag.von': 'Auftrag von',
  'auftrag.bis': 'Auftrag bis',
  'einsatzort.name': 'Einsatzort',
  'einsatzort.strasse': 'Straße',
  'einsatzort.plz': 'PLZ',
  'einsatzort.ort': 'Ort',
  'einsatzort.adresse': 'Vollständige Adresse',
  'schicht.bezeichnung': 'Schichtbezeichnung',
  'schicht.datum': 'Schichtdatum',
  'schicht.von': 'Beginn',
  'schicht.bis': 'Ende',
  'schicht.zeitraum': 'Schichtzeitraum',
  'schicht.treffpunkt': 'Treffpunkt',
  'ansprechpartner.name': 'Ansprechpartner',
  'ansprechpartner.telefon': 'Telefon des Ansprechpartners',
  'ansprechpartner.email': 'E-Mail des Ansprechpartners',
  beruf: 'Beruf',
  qualifikation: 'Qualifikation',
  standort: 'Straight-Monitor-Standort',
});

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h3', 'h4'];

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeTemplate(value) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true),
    },
  }).trim();
}

function placeholderNames(value) {
  return [...String(value || '').matchAll(/{{([^{}]*)}}/g)].map(match => match[1].trim());
}

function prepareTemplate(value) {
  const sanitized = sanitizeTemplate(value);
  if (!sanitized) throw validationError('Ein Einsatzinformationstext ist erforderlich.');
  const unknown = [...new Set(placeholderNames(sanitized))].filter(name => !Object.hasOwn(PLACEHOLDERS, name));
  if (unknown.length) throw validationError(`Unbekannte Textmarken: ${unknown.join(', ')}`);
  const withoutTextmarks = sanitized.replace(/{{[^{}]*}}/g, '');
  if (/{{|}}/.test(withoutTextmarks)) throw validationError('Eine Textmarke ist unvollständig oder ungültig.');
  return sanitized;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
}

function shortTime(value) {
  const match = String(value || '').match(/^(\d{1,2}:\d{2})/);
  return match?.[1] || '';
}

function id(value) {
  return String(value?._id || value || '');
}

function buildPlaceholderValues({ kunde = {}, auftrag = {}, einsatzort = {}, schicht = {}, beruf = {}, qualifikation = {}, location = {} } = {}) {
  const adresse = einsatzort?.adresse || {};
  const locationName = einsatzort?.bezeichnung || auftrag.eventLocation || '';
  const strasse = adresse.strasse || auftrag.eventStrasse || '';
  const plz = adresse.plz || auftrag.eventPlz || '';
  const ort = adresse.ort || auftrag.eventOrt || '';
  const dateFrom = schicht.datumVon || auftrag.vonDatum;
  const dateTo = schicht.datumBis || schicht.datumVon || auftrag.bisDatum;
  const timeFrom = shortTime(schicht.uhrzeitVon);
  const timeTo = shortTime(schicht.uhrzeitBis);
  const dateRange = formatDate(dateFrom) === formatDate(dateTo)
    ? formatDate(dateFrom)
    : [formatDate(dateFrom), formatDate(dateTo)].filter(Boolean).join(' – ');
  const timeRange = [timeFrom, timeTo || (schicht.endeOffen ? 'Ende offen' : '')].filter(Boolean).join(' – ');

  return {
    'kunde.name': kunde.kundName || '',
    'kunde.kuerzel': kunde.kuerzel || '',
    'auftrag.nummer': auftrag.auftragNr || '',
    'auftrag.titel': auftrag.eventTitel || '',
    'auftrag.von': formatDate(auftrag.vonDatum),
    'auftrag.bis': formatDate(auftrag.bisDatum),
    'einsatzort.name': locationName,
    'einsatzort.strasse': strasse,
    'einsatzort.plz': plz,
    'einsatzort.ort': ort,
    'einsatzort.adresse': [locationName, strasse, [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    'schicht.bezeichnung': schicht.bezeichnung || '',
    'schicht.datum': dateRange,
    'schicht.von': timeFrom,
    'schicht.bis': timeTo || (schicht.endeOffen ? 'Ende offen' : ''),
    'schicht.zeitraum': [dateRange, timeRange].filter(Boolean).join(', '),
    'schicht.treffpunkt': [shortTime(schicht.treffpunkt), schicht.treffpunktOrt].filter(Boolean).join(' · '),
    'ansprechpartner.name': schicht.ansprechpartnerName || '',
    'ansprechpartner.telefon': schicht.ansprechpartnerTelefon || '',
    'ansprechpartner.email': schicht.ansprechpartnerEmail || '',
    beruf: beruf.designation || schicht.berufBezeichnung || '',
    qualifikation: qualifikation.designation || schicht.qualifikationBezeichnung || '',
    standort: location.shortName || location.nameFull || '',
  };
}

function renderTemplate(sourceHtml, values = {}) {
  const source = prepareTemplate(sourceHtml);
  const unresolved = new Set();
  const rendered = source.replace(/{{\s*([\w.]+)\s*}}/g, (_match, name) => {
    const value = values[name];
    if (value === undefined || value === null || String(value).trim() === '') unresolved.add(name);
    return escapeHtml(value);
  });
  return { renderedHtml: sanitizeTemplate(rendered), unresolvedPlaceholders: [...unresolved] };
}

function resolutionFor(template) {
  if (template.einsatzort && template.beruf && template.qualifikation) return 'einsatzort-beruf-qualifikation';
  if (template.einsatzort && template.beruf) return 'einsatzort-beruf';
  if (template.einsatzort && template.qualifikation) return 'einsatzort-qualifikation';
  if (template.einsatzort) return 'einsatzort';
  return 'kunde';
}

async function resolveTemplate({ kundeId, einsatzortId = null, berufId = null, qualifikationId = null }) {
  const templates = await EinsatzinformationTemplate.find({ kunde: kundeId, isActive: true })
    .sort({ updatedAt: -1 })
    .lean();
  const wantedSite = id(einsatzortId);
  const wantedJob = id(berufId);
  const wantedQualification = id(qualifikationId);
  const matches = (template, site, job, qualification) => (
    id(template.einsatzort) === site
    && id(template.beruf) === job
    && id(template.qualifikation) === qualification
  );
  const candidates = [
    [wantedSite, wantedJob, wantedQualification],
    [wantedSite, wantedJob, ''],
    [wantedSite, '', wantedQualification],
    [wantedSite, '', ''],
    ['', '', ''],
  ].filter((parts, index, all) => parts[0] || index === all.length - 1);
  for (const parts of candidates) {
    const template = templates.find(item => matches(item, ...parts));
    if (template) return { template, resolution: resolutionFor(template) };
  }
  return { template: null, resolution: null };
}

module.exports = {
  PLACEHOLDERS,
  buildPlaceholderValues,
  prepareTemplate,
  renderTemplate,
  resolveTemplate,
  sanitizeTemplate,
};
