const crypto = require("crypto");
const BewerberEmailDocument = require("./models/BewerberEmailDocument");
const R2Service = require("./R2Service");
const { sendBewerberInvitationEmail } = require("./EmailService");

const INVITATION_TYPES = new Set([
  "vertrag",
  "vertrag_service",
  "vertrag_logistik",
]);
const INVITATION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function hashSecret(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createAccessCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getPublicInvitationUrl(accessToken) {
  const baseUrl = (process.env.BEWERBER_PUBLIC_BASE_URL || process.env.APP_URL || "https://straightmonitor.com")
    .replace(/\/$/, "");
  return `${baseUrl}/bewerbung/${accessToken}`;
}

async function getInvitationAttachments({ documentIds, teamKey }) {
  const ids = [...new Set((documentIds || []).map(String))];
  if (!ids.length) return [];

  const documents = await BewerberEmailDocument.find({
    _id: { $in: ids },
    teamKey,
    isActive: true,
  }).lean();

  if (documents.length !== ids.length) {
    throw new Error("Mindestens ein ausgewähltes Dokument ist nicht für dieses Team verfügbar.");
  }

  return Promise.all(documents.map(async (document) => ({
    id: document._id,
    name: document.name,
    contentType: document.contentType,
    content: (await R2Service.downloadFile(document.key)).toString("base64"),
  })));
}

async function sendInvitation({ bewerber, type, appointmentAt, documentIds, senderName }) {
  if (!INVITATION_TYPES.has(type)) {
    throw new Error("Ungültiger Einladungstyp.");
  }

  const appointment = new Date(appointmentAt);
  if (Number.isNaN(appointment.getTime()) || appointment <= new Date()) {
    throw new Error("Bitte einen zukünftigen Termin für die Einladung wählen.");
  }

  const attachments = await getInvitationAttachments({ documentIds, teamKey: bewerber.teamKey });
  const accessToken = crypto.randomBytes(32).toString("base64url");
  const accessCode = createAccessCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);

  await sendBewerberInvitationEmail({
    bewerber,
    type,
    appointmentAt: appointment,
    publicUrl: getPublicInvitationUrl(accessToken),
    accessCode,
    senderName,
    attachments,
  });

  for (const invitation of bewerber.invitations) {
    if (!invitation.revokedAt && !invitation.submittedAt && invitation.expiresAt > now) {
      invitation.revokedAt = now;
    }
  }

  bewerber.invitations.push({
    type,
    recipient: bewerber.email,
    appointmentAt: appointment,
    senderName,
    sentAt: now,
    expiresAt,
    accessTokenHash: hashSecret(accessToken),
    accessCodeHash: hashSecret(accessCode),
    attachmentDocumentIds: attachments.map((attachment) => attachment.id),
  });
  bewerber.status = "eingeladen";
  await bewerber.save();

  return {
    invitation: bewerber.invitations.at(-1),
    attachmentCount: attachments.length,
  };
}

module.exports = {
  INVITATION_TYPES,
  hashSecret,
  sendInvitation,
};