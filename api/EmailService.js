const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs = require("fs");
const path = require("path");
const msal = require("@azure/msal-node");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Item = require("./models/Item");

const BASE_URL = "https://straightmonitor.com";

// 📎 Standard-Anhang (z. B. Banner)
const imagePath = path.join(__dirname, "assets", "Banner.png");
const base64Image = fs.readFileSync(imagePath).toString("base64");

// ✅ Nur ein Auth-Set für alle Adressen
const SHARED_AUTH = {
  clientId: process.env.EMAIL_CLIENT_ID_IT,
  clientSecret: process.env.EMAIL_SECRET_IT,
  authority: process.env.EMAIL_AUTHORITY_IT,
};

// ✅ Absender-Konfigurationen
const emailAccounts = {
  it: { address: "it@straightforward.email", ...SHARED_AUTH },
  teamhamburg: { address: "teamhamburg@straightforward.email", ...SHARED_AUTH },
  teamberlin: { address: "teamberlin@straightforward.email", ...SHARED_AUTH },
  teamkoeln: { address: "teamkoeln@straightforward.email", ...SHARED_AUTH },
};

// ✅ Mapping von Stadt → E-Mail-Absender
function safeSenderKey(key) {
  const map = {
    hamburg: "teamhamburg",
    berlin: "teamberlin",
    köln: "teamkoeln",
    koeln: "teamkoeln",
    it: "it",
  };
  return map[key?.toLowerCase()] || key;
}

// 📤 Flexible Mail-Funktion (mit Absender-Auswahl)
async function sendMail(recipients, subject, content, senderKey = "it", additionalAttachments = []) {
  try {
    if (!Array.isArray(recipients)) recipients = [recipients];

    senderKey = safeSenderKey(senderKey);
    const sender = emailAccounts[senderKey];

    if (!sender) throw new Error(`Unbekannter E-Mail-Absender: ${senderKey}`);

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
        toRecipients: recipients.map((email) => ({ emailAddress: { address: email } })),
        from: { emailAddress: { address: sender.address } },
        attachments: combinedAttachments,
      },
    };

    await client.api(`/users/${sender.address}/sendMail`).post(mail);
    console.log(`✅ Email sent successfully from ${sender.address} to ${recipients.join(", ")}`);
  } catch (error) {
    console.error("❌ Error sending email:", error);
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
  const subject = "Bestätige deine E-Mail Adresse für den Straightforward Monitor";
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

// 📦 Artikel-Update per E-Mail
async function sollRoutine() {
  const today = new Date().toLocaleString("en-US", { weekday: "long" });

  for (const location of locations) {
    if (location.enabled && location.weekdays.includes(today)) {
      try {
        const items = await getItems(location.name);
        location.items = items;
        const content = createRoutineContent(location);
        const senderKey = safeSenderKey(location.name);

        await sendMail(
          location.email,
          `Bestands-Update vom ${new Date().toLocaleDateString("de-DE")} für Team ${location.name}`,
          content,
          senderKey
        );
      } catch (error) {
        console.error(`❌ Error sending routine email for ${location.name}:`, error);
      }
    }
  }
}

// 📄 HTML-Content für Routinemails
function createRoutineContent(location) {
  const today = new Date().toLocaleDateString("de-DE");
  let content = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Bestands Update vom ${today} für Team ${location.name}</h2>
  `;

  const itemsWithSoll = location.items.filter((item) => item.soll > 0);
  const itemsWithZeroSoll = location.items.filter((item) => item.soll === 0);

  const sortedItems = itemsWithSoll.sort((a, b) => (b.anzahl / b.soll) - (a.anzahl / a.soll));

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
          <td>${item.bezeichnung}${item.groesse !== "onesize" ? ` ${item.groesse}` : ""}</td>
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
        ${itemsWithZeroSoll.map((item) => `<li>${item.bezeichnung}${item.groesse !== "onesize" ? ` ${item.groesse}` : ""}: ${item.anzahl}</li>`).join("")}
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
async function getItems(location) {
  try {
    return await Item.find({ standort: location });
  } catch (err) {
    console.error("Error fetching items for location:", location, err);
    return [];
  }
}

// 📍 Orte mit Routinen
const locations = [
  {
    name: "Hamburg",
    email: ["teamhamburg@straightforward.email", "einkauf@straightforward.email"],
    weekdays: ["Monday"],
    enabled: true,
  },
  {
    name: "Berlin",
    email: ["teamberlin@straightforward.email", "einkauf@straightforward.email"],
    weekdays: ["Monday"],
    enabled: true,
  },
  {
    name: "Köln",
    email: ["teamkoeln@straightforward.email", "einkauf@straightforward.email"],
    weekdays: ["Monday"],
    enabled: true,
  },
];

module.exports = {
  sendMail,
  sendConfirmationEmail,
  sollRoutine,
};
