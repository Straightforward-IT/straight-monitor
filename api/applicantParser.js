// applicantParser.js
// Port der Zapier-Python-Logik -> Node.js (ohne externe Deps)

const SERVICE_KEYWORDS = [
  "service", "servicemitarbeiter", "kellner", "kellnerin", "theke", "bar", "blitzlichtgewitter",
];
const LOGISTIK_KEYWORDS = [
  "logistik", "logistiker", "lager", "eventhand", "eventhands", "aufbau", "abbau", "fahrer", "backline",
];

/* ----------------------------- Helpers ----------------------------- */

// sehr robuste HTML->Text Konvertierung (ähnlich zu deinem htmlToText)
function htmlToText(html = "") {
  if (!html) return "";
  let s = String(html);

  // echte <br> als Zeilenumbrüche
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Linebreaks für Block-Tags
  s = s
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<li>/gi, "• ");

  // Styles/Scripts/Comments raus
  s = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // alle anderen Tags strippen
  s = s.replace(/<[^>]+>/g, "");

  // Entities (kleines Set, reicht hier)
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  // mehrere Umbrüche einkürzen
  s = s.replace(/\n{2,}/g, "\n");

  return s.replace(/\u00A0/g, " ").trim();
}


function findEmail(text = "") {
  const pattern = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
  const emails = (text || "").match(pattern) || [];
  if (!emails.length) return null;

  for (const e of emails) {
    const low = e.toLowerCase();
    if (!low.includes("noreply") && !low.includes("no-reply") && !low.includes("indeedemail.com")) {
      return low;
    }
  }
  return emails[0].toLowerCase();
}

function normalizePhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace(/[^\d]/g, "");
    return "+" + digits;
  }
  if (cleaned.startsWith("0")) {
    const digits = cleaned.replace(/\D/g, "").slice(1);
    return digits ? "+49" + digits : null;
  }
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits;
}

// Zero-widths, Soft-Hyphen etc. entfernen + Control/Combining (wie Python-Version)
function cleanInvisibleChars(text = "") {
  let s = String(text);
  // bekannte Zero-Width/Soft Hyphen usw.
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u180E]/g, "");
  // Entferne Kontrollen außer \n und \t
  s = s.replace(/[^\S\n\t]/g, (m) => (m === "\n" || m === "\t" ? m : "")); // konservativ
  // Entferne *zusätzlich* Unicode-Kontroll-/Format-Zeichen
  s = s.replace(/[\p{Cf}\p{Cc}\p{Cs}\p{Co}\p{Cn}]/gu, "");
  // Entferne Combining marks
  s = s.replace(/[\p{Mn}\p{Me}]/gu, "");
  return s;
}

function compactBlankLines(text = "") {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  let empty = 0;
  for (let ln of lines) {
    if (ln.trim() === "") {
      empty++;
      if (empty <= 1) out.push("");
    } else {
      empty = 0;
      out.push(ln.trimEnd());
    }
  }
  return out.join("\n").trim();
}

function detectProvider(subject = "", sender = "", bodyText = "") {
  const s = (subject || "").toLowerCase();
  const f = (sender || "").toLowerCase();
  const b = (bodyText || "").toLowerCase();

  if (
    s.includes("indeed") ||
    f.includes("indeed") ||
    b.includes("indeedemail.com") ||
    s.includes("[wichtig] neue bewerbung")
  ) return "indeed";

  if (s.includes("[recrudo]") || f.includes("recrudo") || b.includes("recrudo.com")) return "recrudo";

  if (f.includes("studentjob.de") || b.includes("studentjob.de")) return "studentjob";

  if (f.includes("gelegenheitsjobs.de") || b.includes("gelegenheitsjobs.de") || s.includes("gelegenheitsjobs"))
    return "gelegenheitsjobs";

  if (s.includes("kontaktformular der webseite straightforward.de") || b.includes("straightforward.services/bewerber"))
    return "kontaktformular";

  return "unknown";
}

function detectStelle(subject = "", bodyText = "") {
  const txt = `${subject || ""} ${bodyText || ""}`.toLowerCase();
  if (SERVICE_KEYWORDS.some((k) => txt.includes(k))) return "S";
  if (LOGISTIK_KEYWORDS.some((k) => txt.includes(k))) return "L";
  return null;
}

/* -------------------- Indeed-spezifische Helfer -------------------- */

function stripPrefixes(s = "") {
  return s.replace(/^\s*(wg:|aw:|re:|fwd:|fw:)\s*/i, "").trim();
}
function normalizeDashes(s = "") {
  return s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]+/g, "-");
}

// HTML-Name finden (ohne DOM-Lib; gezielte Patterns)
function extractIndeedNameFromHtml(html = "") {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = htmlToText(h1Match[1]).replace(/\s+/g, " ").trim();
    if (/hat sich beworben/i.test(text)) {
      return text.replace(/hat sich beworben\s*$/i, "").trim();
    }
    const m = text.match(/Neue Nachricht von\s+(.+)/i);
    if (m) return m[1].trim();
  }

  const h2aMatch = html.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
  if (h2aMatch) {
    const name = htmlToText(h2aMatch[1]).trim();
    if (name) return name;
  }

  // generisch
  const tagPattern = /<(h1|h2|p|div|span)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = tagPattern.exec(html))) {
    const tx = htmlToText(m[2]).replace(/\s+/g, " ").trim();
    const mm = tx.match(/^Neue Nachricht von\s+(.+)$/i);
    if (mm) return mm[1].trim();
  }
  return null;
}

function extractIndeedNameFromPlaintext(plain = "") {
  const lines = String(plain).split(/\r?\n/);
  for (const raw of lines) {
    const ln = raw.trim();
    let m = ln.match(/^Neue Nachricht von\s+(.+)$/i);
    if (m) return m[1].trim();
    m = ln.match(/^(.+?)\s+hat sich beworben$/i);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function parseIndeedSubject(subject = "") {
  const out = { name: null, job_title: null };
  if (!subject) return out;
  const s0 = normalizeDashes(stripPrefixes(subject));
  const m = s0.match(
    /^(?<job>.+?)\s*-\s*(?<name>.+?)\s+hat\s+sich\s+(?:über\s+)?indeed\b.*$/i
  );
  if (m && m.groups) {
    out.job_title = (m.groups.job || "").trim().replace(/[-–—]\s*$/, "");
    out.name = (m.groups.name || "").trim();
  }
  return out;
}

function extractIndeedJoblineFromText(plain = "") {
  const lines = String(plain).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const ln of lines) {
    if ((ln.includes("•") || ln.includes("·")) && !/^(einstellungen verwalten|©|indeed|datenschutzerklärung)/i.test(ln)) {
      const parts = ln.split(/\s*[•·]\s*/).map((p) => p.trim().replace(/[.\s]+$/, "")).filter(Boolean);
      if (parts.length >= 2) {
        const [job, loc, company] = parts;
        if (job && !/^(indeed|einstellungen)/i.test(job)) {
          return { job, loc: loc || null, company: company || null };
        }
      }
    }
  }
  return { job: null, loc: null, company: null };
}

function extractIndeedMessageFromText(plain = "") {
  if (!plain) return null;
  const lines = String(plain).split(/\r?\n/).map((x) => x.replace(/\s+$/, ""));
  let start = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^Neue Nachricht von\b/i.test(lines[i].trim())) {
      start = i + 1;
      break;
    }
  }
  if (start == null) return null;
  if (start < lines.length && /[•·]/.test(lines[start])) start += 1;

  const stop = [
    "Über Indeed antworten", "Erreichen Sie von überall", "Diese Nachricht ist Teil",
    "Einstellungen verwalten", "Datenschutzerklärung", "Nutzungsbedingungen",
    "Indeed verarbeitet", "Stellenanzeigen", "Kandidaten", "Stellenanzeige schalten",
  ].map((x) => x.toLowerCase());

  const out = [];
  for (let i = start; i < lines.length; i++) {
    const st = lines[i].trim();
    if (!st) continue;
    if (stop.some((t) => st.toLowerCase().includes(t))) break;
    out.push(st);
    if (out.length > 30) break;
  }
  const msg = out.join("\n").trim();
  return msg || null;
}

function extractIndeedFields(html, subject, plainText) {
  const nameHtml = extractIndeedNameFromHtml(html);
  const nameText = extractIndeedNameFromPlaintext(plainText);
  const subjInfo = parseIndeedSubject(subject);

  const full_name = nameHtml || nameText || subjInfo.name || null;
  let { job, loc, company } = extractIndeedJoblineFromText(plainText);
  if (!job && subjInfo.job_title) job = subjInfo.job_title;
  const msg = extractIndeedMessageFromText(plainText);

  return {
    full_name,
    job_title: job || null,
    job_location: loc || null,
    company: company || null,
    indeed_message: msg,
    subject_used_as_fallback: Boolean(subjInfo.name && !(nameHtml || nameText)),
  };
}

function parseKeyValueLines(text = "", keys = []) {
  const out = {};
  const lines = String(text).split(/\r?\n/).map((x) => x.trim());
  for (const ln of lines) {
    for (const key of keys) {
      const m = ln.match(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.*)$`, "i"));
      if (m) { out[key] = m[1].trim(); break; }
    }
  }
  return out;
}

/* ----------------------- Provider-Extractors ----------------------- */

function extractRecrudo(plain) {
  const fields = {
    Vorname: null, Nachname: null, "E-Mail": null, Rufnummer: null, Wohnort: null, Alter: null,
  };
  for (const k of Object.keys(fields)) {
    const m = String(plain).match(new RegExp(`${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+)`, "i"));
    if (m) fields[k] = m[1].trim();
  }
  const vor = (fields.Vorname || "").trim();
  const nach = (fields.Nachname || "").trim();
  const full_name = `${vor} ${nach}`.trim() || null;
  const email = findEmail(fields["E-Mail"] || plain);
  const telefon = normalizePhone(fields.Rufnummer || "");
  const stadt = fields.Wohnort || null;
  const alter = fields.Alter || null;

  return { full_name, email, telefon, stadt, alter };
}

function extractStudentjob(plain) {
  const mName = String(plain).match(/^Name\s*:\s*(.+)$/im);
  const name = mName ? mName[1].trim() : null;

  const mMail = String(plain).match(/^E-?Mail\s*:\s*(.+)$/im);
  const mailRaw = mMail ? mMail[1].trim() : "";

  const mPhone = String(plain).match(/^Telefonnummer\s*:\s*(.+)$/im);
  const phoneRaw = mPhone ? mPhone[1].trim() : "";

  const mCity = String(plain).match(/^Stadt\s*:\s*(.+)$/im);
  const stadt = mCity ? mCity[1].trim() : null;

  const mAge = String(plain).match(/^Geburtsdatum\s*:\s*(.+)$|^Alter\s*:\s*(.+)$/im);
  const alter = mAge ? (mAge[1] || mAge[2] || "").trim() : null;

  return {
    full_name: name || null,
    email: findEmail(mailRaw || plain),
    telefon: normalizePhone(phoneRaw),
    stadt, alter,
  };
}

function extractGelegenheitsjobs(plain) {
  const lines = String(plain).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  let name = null, email = null, telefon = null, stadt = null;

  const mCity = String(plain).match(/(Einsatzort|Ort)\s*:\s*([^\n]+)/i);
  if (mCity) stadt = mCity[2].trim();

  let salIdx = null;
  const salPat = /^(herr|frau)\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})$/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(salPat);
    if (m) { name = m[2].trim(); salIdx = i; break; }
  }
  if (salIdx != null) {
    const window = lines.slice(salIdx, Math.min(salIdx + 8, lines.length));
    for (const ln of window) { const e = findEmail(ln); if (e) { email = e; break; } }
    if (!telefon) {
      for (const ln of window) {
        const m = ln.match(/(\+?\d[\d\s\/\-\(\)]{5,}\d)/);
        if (m) { telefon = normalizePhone(m[1]); break; }
      }
    }
  }

  if (!name) {
    const mName = String(plain).match(/^Name\s*:\s*(.+)$/im);
    if (mName) name = mName[1].trim();
    else {
      for (const ln of lines.slice(0, 15)) {
        if (ln.toLowerCase().startsWith("guten tag ")) continue;
        if (/^[A-Za-zÀ-ÖØ-öø-ÿ' -]{3,}$/.test(ln) && ln.split(/\s+/).length >= 2) { name = ln.trim(); break; }
      }
    }
  }
  if (!email) email = findEmail(plain);
  if (!telefon) {
    const m = String(plain).match(/(\+?\d[\d\s\/\-\(\)]{5,}\d)/);
    telefon = m ? normalizePhone(m[1]) : null;
  }

  return { full_name: name || null, email, telefon, stadt, alter: null };
}

function extractKontaktformular(plain) {
  // Wir lesen mehr Felder aus dem Formular
  const fields = parseKeyValueLines(plain, [
    "Vorname",
    "Name",
    "Alter",
    "Stadt",
    "Telefonnummer",
    "E-Mail Adresse",
    "Nachricht",
    "Stelle",
    "Status",
    "Erfahrung in der Gastronomie",
    "DGSVO",
    "Datum",
    "Zeit",
    "Seiten URL",
    "Benutzer Agent",
    "Remote IP",
    "Unterstützt von"
  ]);

  const vor = (fields["Vorname"] || "").trim();
  const nach = (fields["Name"] || "").trim();
  const full_name = `${vor} ${nach}`.trim() || null;

  const email = findEmail(fields["E-Mail Adresse"] || "");
  const telefon = normalizePhone(fields["Telefonnummer"] || "");
  const stadt = fields["Stadt"] || null;
  const alter = fields["Alter"] || null;
  const stelleRaw = (fields["Stelle"] || "").trim().toLowerCase();

  // Stelle → "S" / "L" / null
  let stelle = null;
  if (stelleRaw.includes("service")) stelle = "S";
  else if (stelleRaw.includes("logistik")) stelle = "L";

  // Alles andere als Zusatzinformationen zurückgeben,
  // damit wir daraus den Comment bauen können
  return {
    full_name,
    email,
    telefon,
    stadt,
    alter,
    stelle,
    extras: {
      Stelle: fields["Stelle"] || null,
      Status: fields["Status"] || null,
      "Erfahrung in der Gastronomie": fields["Erfahrung in der Gastronomie"] || null,
      Nachricht: fields["Nachricht"] || null,
      Datum: fields["Datum"] || null,
      Zeit: fields["Zeit"] || null,
      "Seiten URL": fields["Seiten URL"] || null,
      "Benutzer Agent": fields["Benutzer Agent"] || null,
      "Remote IP": fields["Remote IP"] || null,
      "Unterstützt von": fields["Unterstützt von"] || null,
      DGSVO: fields["DGSVO"] || null
    }
  };
}


/* ------------------------------- Main ------------------------------- */

function parseApplicantEmail({ subject = "", from = "", bodyHtml = "" }) {
  let plainText = htmlToText(bodyHtml);
  let provider = detectProvider(subject, from, plainText);

  if (provider === "indeed") {
    plainText = compactBlankLines(cleanInvisibleChars(plainText));
  }

  // Default-Erkennung
  let stelle = detectStelle(subject, plainText);

  let full_name = null, email = null, telefon = null, stadt = null, alter = null;
  let job_title = null, job_location = null, company = null, indeed_message = null, subject_used_as_fallback = false;
  let asana_comment = plainText; // Fallback: ganzer Klartext

  if (provider === "indeed") {
    const ex = extractIndeedFields(bodyHtml, subject, plainText);
    full_name = ex.full_name;
    job_title = ex.job_title;
    job_location = ex.job_location;
    company = ex.company;
    indeed_message = ex.indeed_message;
    subject_used_as_fallback = ex.subject_used_as_fallback;
  } else if (provider === "recrudo") {
    const ex = extractRecrudo(plainText);
    ({ full_name, email, telefon, stadt, alter } = ex);
  } else if (provider === "studentjob") {
    const ex = extractStudentjob(plainText);
    ({ full_name, email, telefon, stadt, alter } = ex);
  } else if (provider === "gelegenheitsjobs") {
    const ex = extractGelegenheitsjobs(plainText);
    ({ full_name, email, telefon, stadt, alter } = ex);
  } else if (provider === "kontaktformular") {
    const ex = extractKontaktformular(plainText);
    ({ full_name, email, telefon, stadt, alter } = ex);
    // Stelle aus Formular hat Vorrang vor Keyword-Erkennung
    if (ex.stelle) stelle = ex.stelle;

    // Schöner, strukturierter Comment aus den Extras
    const lines = [];
    const add = (label, val) => { if (val && String(val).trim()) lines.push(`${label}: ${String(val).trim()}`); };

    add("Stadt", stadt);
    add("Alter", alter);
    add("Status", ex.extras.Status);
    add("Erfahrung", ex.extras["Erfahrung in der Gastronomie"]);
    if (ex.extras.Nachricht) {
      lines.push("");
      lines.push("Nachricht:");
      lines.push(ex.extras.Nachricht.trim());
    }
    // Meta (optional, aber praktisch)
    const meta = [];
    if (ex.extras.Datum) meta.push(`Datum: ${ex.extras.Datum}`);
    if (ex.extras.Zeit) meta.push(`Zeit: ${ex.extras.Zeit}`);
    if (ex.extras["Seiten URL"]) meta.push(`URL: ${ex.extras["Seiten URL"]}`);
    if (meta.length) {
      lines.push("");
      lines.push(meta.join(" | "));
    }
    asana_comment = lines.join("\n").trim();
  } else {
    // unknown: best effort
    const mName = plainText.match(/^Name\s*:\s*(.+)$/im);
    if (mName) {
      full_name = mName[1].trim();
    } else {
      const top = plainText.split(/\r?\n/).slice(0, 10).map((x) => x.trim());
      for (const ln of top) {
        if (/^[A-Za-zÀ-ÖØ-öø-ÿ' -]{3,}$/.test(ln) && ln.split(/\s+/).length >= 2) { full_name = ln; break; }
      }
    }
    email = findEmail(plainText);
    const mPhone = plainText.match(/(\+?\d[\d\s\/\-\(\)]{5,}\d)/);
    telefon = mPhone ? normalizePhone(mPhone[1]) : null;
  }

  // Fallbacks
  if (!full_name) {
    const subjTry = parseIndeedSubject(subject);
    if (subjTry.name) full_name = subjTry.name;
  }

  const title_suffix = (stelle === "S" || stelle === "L") ? stelle : "?";
  const asana_title = `${full_name || "Unbekannt"} - ${title_suffix}`;

  // Task-Body: Kontaktmöglichkeiten + provider-spezifische Nachrichten
  const body_lines = [];
  if (telefon) body_lines.push(`Telefon: ${telefon}`);
  if (email) body_lines.push(`E-Mail: ${email}`);
  
  // Zusätzliche Nachrichten je Provider hinzufügen
  if (provider === "indeed" && indeed_message) {
    body_lines.push(""); // Leerzeile für Abstand
    body_lines.push("Nachricht des Bewerbers:");
    body_lines.push(indeed_message);
  } else if (provider === "kontaktformular" && extras && extras.Nachricht) {
    body_lines.push(""); // Leerzeile für Abstand
    body_lines.push("Nachricht:");
    body_lines.push(extras.Nachricht.trim());
  }
  // Hier kannst du weitere Provider hinzufügen, z.B. für studentjob oder recrudo, falls sie Nachrichten haben
  
  const asana_body = body_lines.join("\n");

  const due_date = new Date().toISOString().slice(0, 10);

  return {
    quelle: provider,
    full_name,
    stelle,
    email,
    telefon,
    stadt,
    alter,
    plain_text: plainText,
    asana_title,
    asana_body,             // **nur Telefon/E-Mail**
    asana_comment,          // **strukturierter Rest (beim Kontaktformular hübsch formatiert)**
    due_date,
    job_title,
    job_location,
    company,
    indeed_message,
    subject_used_as_fallback,
  };
}


module.exports = {
  parseApplicantEmail,
  // (optional) export helpers, falls du sie jwd. brauchst:
  htmlToText,
  findEmail,
  normalizePhone,
};
