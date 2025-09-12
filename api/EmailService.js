const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs = require("fs");
const path = require("path");
const msal = require("@azure/msal-node");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Item = require("./models/Item");
const registry = require("./config/registry");

const BASE_URL = "https://straightmonitor.com";

// 📎 Standard-Anhang (z. B. Banner)
const imagePath = path.join(__dirname, "assets", "Banner.png");
const base64Image = fs.readFileSync(imagePath).toString("base64");

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
  additionalAttachments = []
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

    const baseAttachments = [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: "Banner.png",
        contentId: "bannerImage",
        contentBytes: base64Image,
      },
    ];

    const combinedAttachments = baseAttachments.concat(
      (additionalAttachments || []).map((att) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentBytes: att.content,
        contentType: att.contentType || "application/pdf",
      }))
    );

    const mail = {
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: `${content}<br><img src="cid:bannerImage" alt="Banner" style="width: 280px; height: auto;" />`,
        },
        toRecipients: recipients.map((email) => ({
          emailAddress: { address: email },
        })),
        from: { emailAddress: { address: sender.address } },
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

// 📦 Artikel-Update per E-Mail (Routinen)
async function sollRoutine() {
  const targets = registry.getRoutineTargetsForToday(new Date()); // [{key, recipients, weekday}]

  for (const t of targets) {
    try {
      const items = await getItems(t.key);
      console.log(
        `[sollRoutine] team=${t.key} recipients=${t.recipients.join(
          ","
        )} items=${items.length}`
      );
      const content = createRoutineContent({ name: t.key, items });
      console.log(`[sollRoutine] team=${t.key} contentLen=${content.length}`);

      await sendMail(
        t.recipients,
        `Bestands-Update vom ${new Date().toLocaleDateString(
          "de-DE"
        )} für Team ${t.key}`,
        content,
        t.key
      );
    } catch (error) {
      console.error(
        `❌ Error sending routine email for ${t.key}:`,
        error?.response?.data || error.message
      );
    }
  }
}

// 📄 HTML-Content für Routinemails (unverändert, nur location.name -> { name })
function createRoutineContent(location) {
  const today = new Date().toLocaleDateString("de-DE");
  let content = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Bestands Update vom ${today} für Team ${location.name}</h2>
  `;
  const items = location.items || [];
 if (items.length === 0) {
    content += `<p><em>Keine Artikel gefunden für diesen Standort.</em></p></div>`;
    return content;
  }
  const itemsWithSoll = location.items.filter((item) => item.soll > 0);
  const itemsWithZeroSoll = location.items.filter((item) => item.soll === 0);

  const sortedItems = itemsWithSoll.sort(
    (a, b) => b.anzahl / b.soll - a.anzahl / a.soll
  );

  if (sortedItems.length > 0) {
    content += `
      <h3>Items mit Soll</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left;">BEZEICHNUNG</th>
            <th style="text-align: right;">IST</th>
            <th style="text-align: right;">SOLL</th>
            <th style="text-align: right;">PROZENT</th>
          </tr>
        </thead>
        <tbody>
    `;
    sortedItems.forEach((item) => {
      const percentage = Math.round((item.anzahl / item.soll) * 100);
      const color = getPercentageColor(percentage);
      content += `
        <tr>
          <td>${item.bezeichnung}${
        item.groesse !== "onesize" ? ` ${item.groesse}` : ""
      }</td>
          <td style="text-align: right;">${item.anzahl}</td>
          <td style="text-align: right;">${item.soll}</td>
          <td style="text-align: right; background-color: ${color};">${percentage}%</td>
        </tr>
      `;
    });
    content += `</tbody></table>`;
  }

  if (itemsWithZeroSoll.length > 0) {
    content += `
      <h3>Items ohne Soll</h3>
      <ul>
        ${itemsWithZeroSoll
          .map(
            (item) =>
              `<li>${item.bezeichnung}${
                item.groesse !== "onesize" ? ` ${item.groesse}` : ""
              }: ${item.anzahl}</li>`
          )
          .join("")}
      </ul>
    `;
  }

  content += `</div>`;
  return content;
}

// 🔢 Farbe für Prozentwert
function getPercentageColor(percentage) {
  if (percentage >= 75) return "#02b504";
  if (percentage >= 50) return "#47ff49";
  if (percentage >= 25) return "#ffd647";
  return "#fb2a2a";
}

// 📥 Artikel laden
async function getItems(locationKey) {
  try {
      const standort = registry.getInventoryStandort(locationKey); 
    return await Item.find({ standort });
  } catch (err) {
    console.error(
      "Error fetching items for location:",
      locationKey,
      err.message
    );
    return [];
  }
}

module.exports = {
  sendMail,
  sendConfirmationEmail,
  sollRoutine,
};
