const sanitizeHtml = require("sanitize-html");

const PLACEHOLDERS = Object.freeze({
  "mitarbeiter.vorname": "Vorname des Mitarbeiters",
  "mitarbeiter.nachname": "Nachname des Mitarbeiters",
  "mitarbeiter.email": "E-Mail-Adresse des Mitarbeiters",
  standort: "Name des Standorts",
  standortEmail: "E-Mail-Adresse des Standorts",
  standortTelefon: "Telefonnummer des Standorts",
  absender: "Name des Absenders",
  datum: "Datum",
  termin: "Formatierter Termin",
});

const SAMPLE_VALUES = Object.freeze({
  "mitarbeiter.vorname": "Erika",
  "mitarbeiter.nachname": "Mustermann",
  "mitarbeiter.email": "erika.mustermann@example.com",
  standort: "Hamburg",
  standortEmail: "teamhamburg@straightforward.email",
  standortTelefon: "+49 40 700 101 90",
  absender: "Alex Beispiel",
  datum: "13.08.2026",
  termin: "Donnerstag, 13.08.2026, 17:00",
});

const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "div", "em", "h1", "h2", "h3", "h4", "hr", "i",
  "img", "li", "ol", "p", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "u", "ul",
];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractPlaceholderNames(template = "") {
  return [...String(template).matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1]);
}

function validatePlaceholders(...templates) {
  const unknown = [...new Set(templates.flatMap(extractPlaceholderNames))]
    .filter((name) => !Object.hasOwn(PLACEHOLDERS, name));
  if (unknown.length) {
    throw badRequest(`Unbekannte Platzhalter: ${unknown.join(", ")}`);
  }
}

function sanitizeTemplate(htmlTemplate) {
  return sanitizeHtml(String(htmlTemplate || ""), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "style", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      div: ["style", "align"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      hr: ["style"],
      p: ["style", "align"],
      span: ["style"],
      blockquote: ["style"],
      table: ["style", "width", "align", "border", "cellpadding", "cellspacing", "bgcolor"],
      thead: ["style"],
      tbody: ["style"],
      tfoot: ["style"],
      tr: ["style", "bgcolor"],
      td: ["style", "colspan", "rowspan", "width", "align", "valign", "bgcolor"],
      th: ["style", "colspan", "rowspan", "width", "align", "valign", "bgcolor"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^[a-z]+$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^[a-z]+$/i],
        "font-family": [/^[\w\s,'"-]+$/],
        "font-size": [/^\d+(?:\.\d+)?(?:px|rem|em|%|pt)$/],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/],
        "font-style": [/^(?:normal|italic)$/],
        "line-height": [/^\d+(?:\.\d+)?(?:px|rem|em|%)?$/],
        margin: [/^[\d\s.%-]+(?:px|rem|em|%)?$/],
        "margin-top": [/^[\d.-]+(?:px|rem|em|%)?$/],
        "margin-bottom": [/^[\d.-]+(?:px|rem|em|%)?$/],
        padding: [/^[\d\s.%-]+(?:px|rem|em|%)?$/],
        width: [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        "max-width": [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        "text-align": [/^(?:left|right|center|justify)$/],
        "text-decoration": [/^(?:none|underline)$/],
        "border-collapse": [/^(?:collapse|separate)$/],
        border: [/^[\d\s.a-z#%()-]+$/i],
        "vertical-align": [/^(?:top|middle|bottom|baseline)$/],
      },
    },
  });
}

function prepareTemplate({ name, subjectTemplate, htmlTemplate }) {
  const trimmedName = String(name || "").trim();
  const subject = String(subjectTemplate || "").trim();
  const html = String(htmlTemplate || "").trim();
  if (!trimmedName) throw badRequest("Ein Vorlagenname ist erforderlich.");
  if (!subject || !html) throw badRequest("Betreff und HTML-Inhalt sind erforderlich.");
  validatePlaceholders(subject, html);
  return {
    name: trimmedName,
    subjectTemplate: subject,
    htmlTemplate: sanitizeTemplate(html),
  };
}

function renderHtml(template, values) {
  return String(template).replace(/{{\s*([\w.]+)\s*}}/g, (_match, name) => escapeHtml(values[name]));
}

function renderSubject(template, values) {
  return String(template)
    .replace(/{{\s*([\w.]+)\s*}}/g, (_match, name) => String(values[name] ?? ""))
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, " ")
    .trim();
}

function renderPreview({ subjectTemplate, htmlTemplate }, overrides = {}) {
  const values = { ...SAMPLE_VALUES, ...overrides };
  return {
    subject: renderSubject(subjectTemplate, values),
    html: renderHtml(sanitizeTemplate(htmlTemplate), values),
  };
}

module.exports = {
  PLACEHOLDERS,
  SAMPLE_VALUES,
  prepareTemplate,
  renderPreview,
  sanitizeTemplate,
};
