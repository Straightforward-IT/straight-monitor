const sanitizeHtml = require("sanitize-html");
const BewerberEmailTemplate = require("../models/System/BewerberEmailTemplate");

const PLACEHOLDERS = Object.freeze({
  "bewerber.vorname": "Vorname des Bewerbers",
  "bewerber.nachname": "Nachname des Bewerbers",
  termin: "Formatierter Termin",
  link: "Link zur Selbstauskunft",
  zugangscode: "Sechsstelliger Zugangscode",
  absender: "Name des Absenders",
  standort: "Name des Standorts",
  standortEmail: "E-Mail-Adresse des Standorts",
  standortTelefon: "Telefonnummer des Standorts",
});

const SYSTEM_SUBJECTS = Object.freeze({
  vertrag: "Einladung zur Vertragsunterschrift",
  vertrag_service: "Einladung zur Vertragsunterschrift und Service-Schulung",
  vertrag_logistik: "Einladung zur Vertragsunterschrift und Logistik-Schulung",
});

function getSystemTemplate(type) {
  const trainingText = type === "vertrag_service"
    ? "<p>Im Anschluss startet die Service-Schulung und wird voraussichtlich bis ca. 21:00 Uhr andauern.</p>"
    : type === "vertrag_logistik"
      ? "<p>Im Anschluss startet die Logistik-Schulung und wird voraussichtlich bis ca. 21:00 Uhr andauern. In der Logistik brauchst du Stahlkappenschuhe (Sicherheitsstufe 2) und Arbeitshandschuhe. Das Kautionspaket beinhaltet zwei schwarze T-Shirts, einen schwarzen Pullover, eine Logistikhose, ein Cuttermesser und einen Helm.</p>"
      : "";
  return {
    subjectTemplate: SYSTEM_SUBJECTS[type] || SYSTEM_SUBJECTS.vertrag,
    htmlTemplate: `<div style="font-family:Arial,sans-serif;color:#222;max-width:640px;margin:0 auto;line-height:1.55">
      <p>Hallo {{bewerber.vorname}},</p>
      <p>vielen Dank für das angenehme Gespräch. Wie im Vorstellungsgespräch besprochen, findet deine Vertragsunterschrift bei uns am folgenden Termin statt:</p>
      <p style="font-size:17px;font-weight:700">{{termin}} Uhr bei uns im Office</p>
      ${trainingText}
      <p>Bitte bestätige uns kurz per E-Mail den oben stehenden Termin. Sollte sich etwas an deinen Plänen ändern, gib uns bitte Bescheid und wir finden gemeinsam einen neuen Termin.</p>
      <p>Für die Vertragsunterschrift benötigen wir einige Unterlagen. Die ausgewählten Unterlagen findest du im Anhang dieser E-Mail.</p>
      <p>Bitte ergänze vor dem Termin deine persönlichen Angaben über den folgenden Link:</p>
      <p style="margin:24px 0"><a href="{{link}}" style="display:inline-block;background-color:#e8730a;color:#fff;padding:12px 20px;text-decoration:none;font-weight:700">Angaben ergänzen</a></p>
      <p>Dein Zugangscode: <strong style="font-size:18px">{{zugangscode}}</strong></p>
      <p>Falls noch Fragen offen sind, kannst du uns jederzeit kontaktieren.</p>
      <p>Wir freuen uns auf deine Teilnahme und verbleiben mit bestem Gruß,<br><br>{{absender}}<br><strong>Team {{standort}}</strong></p>
      <hr style="margin:24px 0">
      <p style="font-size:12px;color:#666">{{standort}}<br>{{standortEmail}}<br>{{standortTelefon}}</p>
      <p style="font-size:10px;color:#888">H. &amp; P. Straightforward GmbH · Berlin HRB 180342 B · Managing Partners: Daniel Hansen &amp; Christian Peßler · VAT no.: DE308384616</p>
    </div>`,
  };
}

const ALLOWED_TAGS = [
  "a", "b", "br", "div", "em", "h1", "h2", "h3", "hr", "i", "li", "ol",
  "p", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
];

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
    throw new Error(`Unbekannte Platzhalter: ${unknown.join(", ")}`);
  }
}

function sanitizeTemplate(htmlTemplate) {
  return sanitizeHtml(String(htmlTemplate || ""), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "style", "target"],
      div: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      hr: ["style"],
      p: ["style"],
      span: ["style"],
      table: ["style", "cellpadding", "cellspacing"],
      td: ["style", "colspan", "rowspan"],
      th: ["style", "colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^[a-z]+$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^[a-z]+$/i],
        "font-family": [/^[\w\s,'"-]+$/],
        "font-size": [/^\d+(?:\.\d+)?(?:px|rem|em|%)$/],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/],
        "line-height": [/^\d+(?:\.\d+)?(?:px|rem|em|%)?$/],
        margin: [/^[\d\s.%-]+(?:px|rem|em|%)?$/],
        padding: [/^[\d\s.%-]+(?:px|rem|em|%)?$/],
        "text-align": [/^(?:left|right|center)$/],
        "text-decoration": [/^(?:none|underline)$/],
      },
    },
  });
}

function prepareTemplate({ subjectTemplate, htmlTemplate }) {
  const subject = String(subjectTemplate || "").trim();
  const html = String(htmlTemplate || "").trim();
  if (!subject || !html) throw new Error("Betreff und HTML-Inhalt sind erforderlich.");
  validatePlaceholders(subject, html);
  return { subjectTemplate: subject, htmlTemplate: sanitizeTemplate(html) };
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

function renderTemplate(template, values) {
  validatePlaceholders(template.subjectTemplate, template.htmlTemplate);
  const requiredValues = new Set(extractPlaceholderNames(`${template.subjectTemplate} ${template.htmlTemplate}`));
  const missingValues = [...requiredValues].filter((name) => !Object.hasOwn(values, name));
  if (missingValues.length) throw new Error(`Fehlende Platzhalterwerte: ${missingValues.join(", ")}`);
  return {
    subject: renderSubject(template.subjectTemplate, values),
    html: renderHtml(template.htmlTemplate, values),
  };
}

async function resolveTemplate({ teamKey, locationId, type }) {
  const locationCandidates = locationId ? [locationId, null] : [null];
  const templates = await BewerberEmailTemplate.find({
    teamKey,
    type,
    locationV2: { $in: locationCandidates },
  }).lean();
  const local = locationId
    ? templates.find((template) => String(template.locationV2) === String(locationId))
    : null;
  const global = templates.find((template) => !template.locationV2);
  const template = local || global || null;
  return {
    template: template || getSystemTemplate(type),
    source: local ? "location" : global ? "global" : "system",
    templateId: template?._id || null,
  };
}

module.exports = {
  PLACEHOLDERS,
  getSystemTemplate,
  prepareTemplate,
  renderTemplate,
  resolveTemplate,
};
