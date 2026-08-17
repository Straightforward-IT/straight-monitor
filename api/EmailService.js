const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs = require("fs");
const path = require("path");
const msal = require("@azure/msal-node");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const registry = require("./config/registry");
const { buildInventoryRoutineContent } = require('./services/InventoryService');
const {
  renderTemplate,
  resolveTemplate,
} = require("./services/BewerberEmailTemplateService");

const BASE_URL = "https://straightmonitor.com";

// Banner-Anhang entfernt - keine Logos mehr in E-Mails

// 🔑 Sender-Normalisierung über Registry
function resolveSenderKey(key) {
  return registry.resolveKey(key || "it");
}

// 📤 Flexible Mail-Funktion (mit Absender-Auswahl)
async function sendMail(
  recipients,
  subject,
  content,
  senderKey = "it",
  additionalAttachments = [],
  replyTo = null
) {
  try {
    if (!Array.isArray(recipients)) recipients = [recipients];

    const sender = registry.getEmailSender(resolveSenderKey(senderKey)); // {address, clientId, clientSecret, authority}

    const cca = new msal.ConfidentialClientApplication({
      auth: {
        clientId: sender.clientId,
        clientSecret: sender.clientSecret,
        authority: sender.authority,
      },
    });

    const authResponse = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    const client = Client.init({
      authProvider: (done) => done(null, authResponse.accessToken),
    });

    const combinedAttachments = (additionalAttachments || []).map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentBytes: att.content,
      contentType: att.contentType || "application/pdf",
    }));

    const mail = {
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: content,
        },
        toRecipients: recipients.map((email) => ({
          emailAddress: { address: email },
        })),
        from: { emailAddress: { address: sender.address } },
        ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
        attachments: combinedAttachments,
      },
    };

    await client.api(`/users/${sender.address}/sendMail`).post(mail);
    console.log(
      `✅ Email sent from ${sender.address} to ${recipients.join(", ")}`
    );
  } catch (error) {
    console.error(
      "❌ Error sending email:",
      error?.response?.data || error.message
    );
    throw error;
  }
}

// 📧 Confirmation Mail
async function sendConfirmationEmail(user) {
  const confirmationToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "6h" }
  );

  const confirmUrl = `${BASE_URL}/confirm-email?token=${confirmationToken}`;
  const subject =
    "Bestätige deine E-Mail Adresse für den Straightforward Monitor";
  const content = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="font-weight: bold; color: #000;">Willkommen beim Straightforward Monitor!</h2>
      <p>Diese E-Mail dient zur Bestätigung deiner Registrierung. Bitte bestätige deine E-Mail Adresse, um dein Profil zu aktivieren.</p>
      <p>
        <a href="${confirmUrl}" style="color: #000; text-decoration: none; font-weight: bold;">
          <strong>Hier klicken, um die E-Mail Adresse zu bestätigen</strong>
        </a>
      </p>
      <hr />
      <p style="font-size: 12px; color: #666;">Falls du dich nicht registriert hast, ignoriere diese Nachricht.</p>
    </div>
  `;

  await sendMail(user.email, subject, content, "it");
}

// 📦 Send inventory update email for a specific team location
async function sendInventoryUpdateEmail(teamKey, recipients) {
  try {
    const standort = registry.getInventoryStandort(teamKey);
    const content = await buildInventoryRoutineContent(standort);
    if (!content) {
      console.warn(`[sendInventoryUpdate] Kein Standort gefunden für teamKey=${teamKey} standort=${standort}`);
      return { success: false, reason: 'location-not-found' };
    }
    console.log(`[sendInventoryUpdate] teamKey=${teamKey} standort=${standort} rows=${content.rows.length}`);
    await sendMail(
      recipients,
      `Bestands-Update vom ${new Date().toLocaleDateString('de-DE')} für Team ${content.location.nameFull}`,
      content.html,
      teamKey,
      [content.attachment]
    );
    return { success: true };
  } catch (error) {
    console.error(`❌ Error sending inventory update email for ${teamKey}:`, error?.response?.data || error.message);
    throw error;
  }
}

// 📦 Artikel-Update per E-Mail (Routinen)
async function sollRoutine() {
  const targets = registry.getRoutineTargetsForToday(new Date()); // [{key, recipients, weekday}]

  for (const t of targets) {
    try {
      await sendInventoryUpdateEmail(t.key, t.recipients);
    } catch (error) {
      console.error(
        `❌ Error sending routine email for ${t.key}:`,
        error?.response?.data || error.message
      );
    }
  }
}



// 📱 Flip Welcome Mail (nach erfolgreicher Flip-User-Erstellung)
async function sendFlipWelcomeEmail(email, vorname, senderKey = "it") {
  const subject = "Willkommen bei Straightforward – deine Flip App Zugangsdaten";
  const content = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 560px; margin: 0 auto;">

      <h2 style="margin: 0 0 12px; color: #111;">Willkommen bei Straightforward, ${vorname}!</h2>

      <p style="margin: 0 0 20px; line-height: 1.6;">
        Für die interne Kommunikation nutzen wir die <strong>Flip Mitarbeiter App</strong>.
        Lade sie dir jetzt herunter und melde dich mit deinen Zugangsdaten an.
      </p>

      <!-- Download Button -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px;">
        <tr>
          <td style="border-radius: 8px; background: #e8730a;">
            <a href="https://straightforward.flip-app.com"
               target="_blank"
               style="display: inline-block; padding: 13px 28px; font-size: 15px; font-weight: 700;
                      color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.2px;">
              Flip App öffnen / downloaden
            </a>
          </td>
        </tr>
      </table>

      <!-- Credentials -->
      <p style="margin: 0 0 12px; font-weight: 700; font-size: 15px; color: #111;">
        Deine Zugangsdaten für die Flip App:
      </p>

      <table style="border-collapse: collapse; width: 100%; max-width: 420px; margin: 0 0 20px;">
        <tr>
          <td style="padding: 11px 14px; background: #f4f4f4; font-weight: 600;
                     border: 1px solid #ddd; width: 130px; color: #555; font-size: 13px;">
            Benutzername
          </td>
          <td style="padding: 11px 14px; border: 1px solid #ddd; font-size: 14px; color: #111;">
            ${email}
          </td>
        </tr>
        <tr>
          <td style="padding: 11px 14px; background: #f4f4f4; font-weight: 600;
                     border: 1px solid #ddd; color: #555; font-size: 13px;">
            Passwort
          </td>
          <td style="padding: 11px 14px; border: 1px solid #ddd; font-family: monospace;
                     font-size: 14px; color: #111; letter-spacing: 1px;">
            password
          </td>
        </tr>
      </table>

      <!-- Warning -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"
             style="width: 100%; max-width: 420px; margin: 0 0 24px;
                    background: #fff8e1; border-left: 4px solid #f0ad4e; border-radius: 0 6px 6px 0;">
        <tr>
          <td style="padding: 12px 16px; font-size: 14px; color: #7a5200; line-height: 1.5;">
            ⚠️ <strong>Bitte ändere dein Passwort nach der ersten Anmeldung.</strong>
          </td>
        </tr>
      </table>

      <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px;" />
      <p style="font-size: 12px; color: #999; margin: 0;">
        Bei Fragen wende dich an dein Team-Office.
      </p>
    </div>
  `;
  await sendMail(email, subject, content, senderKey);
}

// ✍️ Signaturanfrage-E-Mail (schwarzweißes Styling)
function buildSignaturEmailHtml(name, documentTitle, signingLink) {
  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 40px 20px;border-bottom:3px solid #1a1a1a;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;font-weight:600;">Straightforward Hamburg</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">Hallo ${name},</p>
            <p style="margin:0 0 12px;font-size:20px;font-weight:700;line-height:1.4;color:#000000;">
              Straightforward Hamburg hat Sie dazu<br>eingeladen, zu unterschreiben:
            </p>
            <p style="margin:0 0 32px;font-size:18px;font-style:italic;color:#333333;border-left:3px solid #1a1a1a;padding-left:16px;">
              &ldquo;${documentTitle}&rdquo;
            </p>
            <p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.6;">
              Klicken Sie auf den unten stehenden Button, um das Dokument durchzulesen und zu unterschreiben:
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 36px;">
              <tr>
                <td style="background:#1a1a1a;">
                  <a href="${signingLink}" style="display:inline-block;padding:14px 36px;background:#1a1a1a;color:#ffffff;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                    DOKUMENT AUFRUFEN
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:12px;color:#999999;line-height:1.7;">
              Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
              <a href="${signingLink}" style="color:#1a1a1a;word-break:break-all;">${signingLink}</a>
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8e8;margin:0;"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;font-family:'Helvetica Neue',Arial,sans-serif;background:#fafafa;">
            <p style="margin:0 0 4px;font-size:12px;color:#555555;font-weight:700;">H. & P. Straightforward GmbH</p>
            <p style="margin:0 0 12px;font-size:11px;color:#999999;">Diese Nachricht wurde automatisch versandt – bitte antworten Sie nicht direkt auf diese E-Mail.</p>
            <p style="margin:0;font-size:10px;color:#bbbbbb;line-height:1.5;">
              H. & P. Straightforward GmbH · Berlin HRB 180342 B · Managing Partners: Daniel Hansen &amp; Christian Peßler
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

async function sendSignaturEmail(recipientEmail, name, documentTitle, signingLink, senderKey = 'it') {
  const subject = `Einladung zur Unterschrift: ${documentTitle}`;
  const content = buildSignaturEmailHtml(name, documentTitle, signingLink);
  await sendMail(recipientEmail, subject, content, senderKey);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAppointment(value) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildBewerberInvitationEmailHtml({ bewerber, type, appointmentAt, publicUrl, accessCode, senderName, teamKey }) {
  const team = registry.getTeam(teamKey);
  const branch = team.niederlassung || {};
  const appointment = formatAppointment(appointmentAt);
  const trainingText = type === "vertrag_service"
    ? "Im Anschluss startet die Service-Schulung und wird voraussichtlich bis ca. 21:00 Uhr andauern."
    : type === "vertrag_logistik"
      ? "Im Anschluss startet die Logistik-Schulung und wird voraussichtlich bis ca. 21:00 Uhr andauern. In der Logistik brauchst du Stahlkappenschuhe (Sicherheitsstufe 2) und Arbeitshandschuhe. Das Kautionspaket beinhaltet zwei schwarze T-Shirts, einen schwarzen Pullover, eine Logistikhose, ein Cuttermesser und einen Helm."
      : "";
  const salutation = escapeHtml(bewerber.vorname || "");
  const address = escapeHtml(branch.name || team.displayName || team.key);
  const phones = (branch.telefone || []).map(escapeHtml).join(" · ");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:640px;margin:0 auto;line-height:1.55;">
      <p>Hallo ${salutation},</p>
      <p>vielen Dank für das angenehme Gespräch. Wie im Vorstellungsgespräch besprochen, findet deine Vertragsunterschrift bei uns am folgenden Termin statt:</p>
      <p style="font-size:17px;font-weight:700;">${escapeHtml(appointment)} Uhr bei uns im Office</p>
      ${trainingText ? `<p>${escapeHtml(trainingText)}</p>` : ""}
      <p>Bitte bestätige uns kurz per E-Mail den oben stehenden Termin. Sollte sich etwas an deinen Plänen ändern, gib uns bitte Bescheid und wir finden gemeinsam einen neuen Termin.</p>
      <p>Für die Vertragsunterschrift benötigen wir einige Unterlagen. Die ausgewählten Unterlagen findest du im Anhang dieser E-Mail.</p>
      <p>Bitte ergänze vor dem Termin deine persönlichen Angaben über den folgenden Link:</p>
      <p style="margin:24px 0;"><a href="${escapeHtml(publicUrl)}" style="display:inline-block;background:#e8730a;color:#fff;padding:12px 20px;text-decoration:none;font-weight:700;">Angaben ergänzen</a></p>
      <p>Dein Zugangscode: <strong style="font-size:18px;letter-spacing:2px;">${escapeHtml(accessCode)}</strong></p>
      <p>Falls noch Fragen offen sind, kannst du uns jederzeit kontaktieren.</p>
      <p>Wir freuen uns auf deine Teilnahme und verbleiben mit bestem Gruß,<br><br>${escapeHtml(senderName)}<br><strong>Team ${address}</strong></p>
      <hr style="border:0;border-top:1px solid #ddd;margin:24px 0;">
      <p style="font-size:12px;color:#666;margin:0;">${escapeHtml(branch.name || team.displayName || team.key)}<br>${escapeHtml(team.email?.address || "")}<br>${phones}</p>
      <p style="font-size:10px;color:#888;margin-top:16px;">H. &amp; P. Straightforward GmbH · Berlin HRB 180342 B · Managing Partners: Daniel Hansen &amp; Christian Peßler · VAT no.: DE308384616</p>
    </div>
  `.trim();
}

async function sendBewerberInvitationEmail({ bewerber, type, appointmentAt, publicUrl, accessCode, senderName, attachments = [] }) {
  const team = registry.getTeam(bewerber.teamKey);
  const branch = team.niederlassung || {};
  const location = bewerber.locationV2?.nameFull ? bewerber.locationV2 : null;
  const locationId = location?._id || bewerber.locationV2 || null;
  const { template } = await resolveTemplate({
    teamKey: bewerber.teamKey,
    locationId,
    type,
  });
  const rendered = renderTemplate(template, {
    "bewerber.vorname": bewerber.vorname,
    "bewerber.nachname": bewerber.nachname,
    termin: formatAppointment(appointmentAt),
    link: publicUrl,
    zugangscode: accessCode,
    absender: senderName,
    standort: location?.nameFull || branch.name || team.displayName || team.key,
    standortEmail: location?.contact?.mainEmail || team.email?.address || "",
    standortTelefon: location?.contact?.phone || (branch.telefone || []).join(" · "),
  });
  await sendMail(bewerber.email, rendered.subject, rendered.html, bewerber.teamKey, attachments);
}

async function sendBewerberSubmittedEmail({ bewerber, invitation }) {
  const team = registry.getTeam(bewerber.teamKey);
  const location = bewerber.locationV2?.nameFull ? bewerber.locationV2 : null;
  const recipient = location?.contact?.mainEmail || team.email?.address;
  if (!recipient) throw new Error(`Keine Empfängeradresse für Team ${bewerber.teamKey} hinterlegt.`);
  const baseUrl = (process.env.APP_URL || BASE_URL).replace(/\/$/, "");
  const applicantName = `${escapeHtml(bewerber.vorname)} ${escapeHtml(bewerber.nachname)}`.trim();
  const content = `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
    <p>Die Selbstauskunft von <strong>${applicantName}</strong> wurde vollständig eingereicht.</p>
    <p>Einladungstyp: ${escapeHtml(invitation.type)}<br>Standort: ${escapeHtml(location?.nameFull || team.displayName || team.key)}<br>Eingereicht: ${escapeHtml(formatAppointment(bewerber.submittedAt))}</p>
    <p><a href="${escapeHtml(`${baseUrl}/personal?tab=bewerber&bewerber_id=${bewerber._id}`)}">Bewerber im Monitor öffnen</a></p>
  </div>`;
  await sendMail(recipient, `Bewerberdaten eingereicht: ${bewerber.vorname} ${bewerber.nachname}`, content, bewerber.teamKey);
}

module.exports = {
  sendMail,
  sendConfirmationEmail,
  sollRoutine,
  sendInventoryUpdateEmail,
  sendFlipWelcomeEmail,
  sendSignaturEmail,
  buildBewerberInvitationEmailHtml,
  sendBewerberInvitationEmail,
  sendBewerberSubmittedEmail,
};
