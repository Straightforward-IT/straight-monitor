const sanitizeHtml = require('sanitize-html');
const CustomerEmailTemplate = require('../../models/Customer/CustomerEmailTemplate');

const TEMPLATE_TYPES = Object.freeze({
  STUNDENLISTE_SIGNATURE: 'stundenliste-signature',
});

const PLACEHOLDERS = Object.freeze({
  'signaturkontakt.anrede': 'Anrede des Signaturkontakts',
  'signaturkontakt.vorname': 'Vorname des Signaturkontakts',
  'signaturkontakt.nachname': 'Nachname des Signaturkontakts',
  'signaturkontakt.name': 'Name des Signaturkontakts',
  'signaturkontakt.email': 'E-Mail des Signaturkontakts',
  'kunde.name': 'Kundenname',
  'kunde.kuerzel': 'Kundenkürzel',
  'kunde.nummer': 'Kundennummer',
  'auftrag.nummer': 'Auftragsnummer',
  'auftrag.titel': 'Auftragstitel',
  'auftrag.referenz': 'Auftragsreferenz',
  'auftrag.von': 'Auftrag von',
  'auftrag.bis': 'Auftrag bis',
  'einsatz.von': 'Einsatz von',
  'einsatz.bis': 'Einsatz bis',
  'einsatz.zeitraum': 'Einsatzzeitraum',
  'einsatzort.name': 'Einsatzort',
  'einsatzort.strasse': 'Straße',
  'einsatzort.plz': 'PLZ',
  'einsatzort.ort': 'Ort',
  'einsatzort.adresse': 'Vollständige Einsatzadresse',
  'signatur.dokumentname': 'Dokumentname',
  'signatur.link': 'Link zur Unterschrift',
  standort: 'Straight-Monitor-Standort',
});

const DEFAULTS = Object.freeze({
  [TEMPLATE_TYPES.STUNDENLISTE_SIGNATURE]: Object.freeze({
    type: TEMPLATE_TYPES.STUNDENLISTE_SIGNATURE,
    label: 'Stundenliste zur Unterschrift',
    description: 'Wird an den Signaturkontakt des Kunden gesendet, sobald die Stundenliste zur Unterschrift bereitsteht.',
    subjectTemplate: 'Stundenliste {{auftrag.nummer}} – Bitte um Unterschrift',
    htmlTemplate: '<p>{{signaturkontakt.anrede}},</p><p>bitte prüfen und unterschreiben Sie die Stundenliste für <strong>{{auftrag.titel}}</strong> (Auftrag {{auftrag.nummer}}).</p><p><a href="{{signatur.link}}">Stundenliste prüfen und unterschreiben</a></p><p>Vielen Dank und freundliche Grüße<br>{{standort}}</p>',
  }),
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
  return [...String(value || '').matchAll(/{{([^{}]*)}}/g)].map((match) => match[1].trim());
}

function validateTextmarks(value) {
  const unknown = [...new Set(placeholderNames(value))].filter((name) => !Object.hasOwn(PLACEHOLDERS, name));
  if (unknown.length) throw validationError(`Unbekannte Textmarken: ${unknown.join(', ')}`);
  const withoutTextmarks = String(value || '').replace(/{{[^{}]*}}/g, '');
  if (/{{|}}/.test(withoutTextmarks)) throw validationError('Eine Textmarke ist unvollständig oder ungültig.');
}

function prepareSubject(value) {
  const subject = sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (!subject) throw validationError('Ein Betreff ist erforderlich.');
  if (subject.length > 300) throw validationError('Der Betreff darf höchstens 300 Zeichen lang sein.');
  validateTextmarks(subject);
  return subject;
}

function prepareHtml(value) {
  validateTextmarks(value);
  const sanitized = sanitizeTemplate(value);
  if (!sanitized) throw validationError('Ein E-Mail-Text ist erforderlich.');
  validateTextmarks(sanitized);
  return sanitized;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin',
  });
}

function splitContactName(contact = {}) {
  const explicitFirst = String(contact.vorname || contact.firstName || '').trim();
  const explicitLast = String(contact.nachname || contact.lastName || '').trim();
  const fullName = String(contact.name || [explicitFirst, explicitLast].filter(Boolean).join(' ')).trim();
  if (explicitFirst || explicitLast) return { vorname: explicitFirst, nachname: explicitLast, name: fullName };
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    vorname: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
    nachname: parts.length > 1 ? parts.at(-1) : fullName,
    name: fullName,
  };
}

function buildValues({ kunde = {}, auftrag = {}, signaturkontakt = {}, signatur = {}, location = {} } = {}) {
  const contact = splitContactName(signaturkontakt);
  const von = formatDate(auftrag.vonDatum);
  const bis = formatDate(auftrag.bisDatum);
  const zeitraum = von === bis ? von : [von, bis].filter(Boolean).join(' – ');
  const ortName = auftrag.eventLocation || '';
  const plzOrt = [auftrag.eventPlz, auftrag.eventOrt].filter(Boolean).join(' ');
  return {
    'signaturkontakt.anrede': contact.name ? `Guten Tag ${contact.name}` : 'Guten Tag',
    'signaturkontakt.vorname': contact.vorname,
    'signaturkontakt.nachname': contact.nachname,
    'signaturkontakt.name': contact.name,
    'signaturkontakt.email': signaturkontakt.email || '',
    'kunde.name': kunde.kundName || '',
    'kunde.kuerzel': kunde.kuerzel || '',
    'kunde.nummer': kunde.kundenNr || '',
    'auftrag.nummer': auftrag.auftragNr || '',
    'auftrag.titel': auftrag.eventTitel || '',
    'auftrag.referenz': auftrag.referenz || '',
    'auftrag.von': von,
    'auftrag.bis': bis,
    'einsatz.von': von,
    'einsatz.bis': bis,
    'einsatz.zeitraum': zeitraum,
    'einsatzort.name': ortName,
    'einsatzort.strasse': auftrag.eventStrasse || '',
    'einsatzort.plz': auftrag.eventPlz || '',
    'einsatzort.ort': auftrag.eventOrt || '',
    'einsatzort.adresse': [ortName, auftrag.eventStrasse, plzOrt].filter(Boolean).join(', '),
    'signatur.dokumentname': signatur.dokumentname || '',
    'signatur.link': signatur.link || '',
    standort: location.shortName || location.nameFull || auftrag.geschSt || '',
  };
}

function replaceTextmarks(value, values, { html = false } = {}) {
  const unresolved = new Set();
  const rendered = String(value || '').replace(/{{\s*([\w.]+)\s*}}/g, (_match, name) => {
    const replacement = values[name];
    if (replacement === undefined || replacement === null || String(replacement).trim() === '') unresolved.add(name);
    return html ? escapeHtml(replacement) : String(replacement ?? '');
  });
  return { rendered, unresolvedPlaceholders: [...unresolved] };
}

function renderTemplate({ subjectTemplate, htmlTemplate }, values = {}) {
  const subjectSource = prepareSubject(subjectTemplate);
  const htmlSource = prepareHtml(htmlTemplate);
  const subject = replaceTextmarks(subjectSource, values);
  const html = replaceTextmarks(htmlSource, values, { html: true });
  return {
    subject: subject.rendered,
    renderedHtml: sanitizeTemplate(html.rendered),
    unresolvedPlaceholders: [...new Set([...subject.unresolvedPlaceholders, ...html.unresolvedPlaceholders])],
  };
}

function getDefault(type) {
  const template = DEFAULTS[type];
  if (!template) throw validationError('Unbekannter E-Mail-Vorlagentyp.');
  return template;
}

async function resolveTemplate(kundeId, type) {
  const defaultTemplate = getDefault(type);
  const override = kundeId
    ? await CustomerEmailTemplate.findOne({ kunde: kundeId, type, isActive: true }).lean()
    : null;
  return override
    ? { ...defaultTemplate, ...override, isDefault: false }
    : { ...defaultTemplate, version: null, isDefault: true };
}

async function renderResolvedTemplate({ kunde, auftrag, signaturkontakt, signatur, location, type }) {
  const template = await resolveTemplate(kunde?._id, type);
  return {
    ...renderTemplate(template, buildValues({ kunde, auftrag, signaturkontakt, signatur, location })),
    template,
  };
}

module.exports = {
  DEFAULTS,
  PLACEHOLDERS,
  TEMPLATE_TYPES,
  buildValues,
  getDefault,
  prepareHtml,
  prepareSubject,
  renderResolvedTemplate,
  renderTemplate,
  resolveTemplate,
  sanitizeTemplate,
  splitContactName,
};
