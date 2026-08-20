const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const asyncHandler = require("../../middleware/AsyncHandler");
const { findInvitationByToken, secretsMatch } = require("../../services/employee/BewerberInvitationService");
const { sendBewerberSubmittedEmail } = require("../../services/integrations/EmailService");
const R2Service = require("../../services/integrations/R2Service");
const logger = require("../../utils/logger");
const { pickEditableFields: pickAllowedFields } = require("../../services/employee/BewerberFields");

const router = express.Router();
const SESSION_COOKIE = "bewerber_invitation_session";
const MAX_FAILED_ATTEMPTS = 5;
const MAX_SESSION_MS = 2 * 60 * 60 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// Cross-site cookie (frontend on straightmonitor.com, API on Heroku) requires SameSite=None; Secure.
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PRODUCTION ? "none" : "lax",
  secure: IS_PRODUCTION,
  path: "/",
};
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);
const DOCUMENT_CATEGORIES = new Set(["studienbescheinigung", "sonstiges"]);
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_DOCUMENT_TYPES.has(file.mimetype)) {
      const error = new Error("Nur PDF-, Word-, JPEG- oder PNG-Dateien sind erlaubt.");
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

function invitationState(invitation) {
  const now = new Date();
  if (invitation.submittedAt) return "submitted";
  if (invitation.revokedAt) return "revoked";
  if (invitation.expiresAt <= now) return "expired";
  return "active";
}

function pickEditableFields(source = {}) {
  return pickAllowedFields(source, { exclude: ["locationV2"] });
}

function publicApplicant(bewerber, invitation) {
  const values = pickEditableFields(bewerber.toObject({ getters: false, virtuals: false }));
  return {
    ...values,
    documents: bewerber.documents.map((document) => ({
      _id: document._id,
      name: document.name,
      contentType: document.contentType,
      size: document.size,
      category: document.category,
      uploadedAt: document.uploadedAt,
    })),
    invitation: {
      type: invitation.type,
      appointmentAt: invitation.appointmentAt,
      expiresAt: invitation.expiresAt,
    },
  };
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const entry = cookies.find((part) => part.trim().startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.trim().slice(name.length + 1)) : "";
}

function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
}

const requireInvitationSession = asyncHandler(async (req, res, next) => {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return res.status(401).json({ message: "Bitte den Zugangscode erneut eingeben." });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    clearSession(res);
    return res.status(401).json({ message: "Die Formularsitzung ist abgelaufen." });
  }
  if (payload.purpose !== "bewerber-invitation" || payload.accessToken !== req.params.accessToken) {
    return res.status(403).json({ message: "Diese Sitzung gehört nicht zu dieser Einladung." });
  }
  const result = await findInvitationByToken(req.params.accessToken);
  if (!result || invitationState(result.invitation) !== "active") {
    clearSession(res);
    return res.status(410).json({ message: "Diese Einladung ist nicht mehr aktiv." });
  }
  if (String(result.bewerber._id) !== payload.bewerberId || String(result.invitation._id) !== payload.invitationId) {
    clearSession(res);
    return res.status(403).json({ message: "Die Formularsitzung ist ungültig." });
  }
  req.publicBewerber = result.bewerber;
  req.publicInvitation = result.invitation;
  next();
});

router.get("/invitations/:accessToken", asyncHandler(async (req, res) => {
  const result = await findInvitationByToken(req.params.accessToken);
  if (!result) return res.status(404).json({ message: "Einladung nicht gefunden.", state: "invalid" });
  const state = invitationState(result.invitation);
  const status = state === "active" ? 200 : 410;
  res.status(status).json({ data: { state, expiresAt: result.invitation.expiresAt } });
}));

router.post("/invitations/:accessToken/verify", asyncHandler(async (req, res) => {
  const code = String(req.body.code || "").trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: "Bitte den sechsstelligen Zugangscode eingeben." });
  const result = await findInvitationByToken(req.params.accessToken);
  if (!result) return res.status(404).json({ message: "Einladung nicht gefunden." });
  const { bewerber, invitation } = result;
  if (invitationState(invitation) !== "active") return res.status(410).json({ message: "Diese Einladung ist nicht mehr aktiv." });

  if (!secretsMatch(code, invitation.accessCodeHash)) {
    invitation.failedAttempts += 1;
    if (invitation.failedAttempts >= MAX_FAILED_ATTEMPTS) invitation.revokedAt = new Date();
    await bewerber.save();
    return res.status(401).json({
      message: invitation.revokedAt ? "Die Einladung wurde nach zu vielen Fehlversuchen gesperrt." : "Der Zugangscode ist nicht korrekt.",
      attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - invitation.failedAttempts),
    });
  }

  const now = new Date();
  if (!invitation.openedAt) invitation.openedAt = now;
  if (bewerber.status === "eingeladen") bewerber.status = "formular_geoeffnet";
  invitation.failedAttempts = 0;
  await bewerber.save();
  const maxAge = Math.max(1000, Math.min(MAX_SESSION_MS, invitation.expiresAt.getTime() - now.getTime()));
  const session = jwt.sign({
    bewerberId: String(bewerber._id),
    invitationId: String(invitation._id),
    accessToken: req.params.accessToken,
    purpose: "bewerber-invitation",
  }, process.env.JWT_SECRET, { expiresIn: Math.floor(maxAge / 1000) });
  res.cookie(SESSION_COOKIE, session, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge,
  });
  res.json({ data: publicApplicant(bewerber, invitation) });
}));

router.get("/invitations/:accessToken/form", requireInvitationSession, asyncHandler(async (req, res) => {
  res.json({ data: publicApplicant(req.publicBewerber, req.publicInvitation) });
}));

router.patch("/invitations/:accessToken/form", requireInvitationSession, asyncHandler(async (req, res) => {
  const values = pickEditableFields(req.body);
  Object.assign(req.publicBewerber, values);
  await req.publicBewerber.save();
  res.json({ data: publicApplicant(req.publicBewerber, req.publicInvitation) });
}));

router.post("/invitations/:accessToken/documents", requireInvitationSession, documentUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Keine Datei hochgeladen." });
  const category = String(req.body.category || "sonstiges");
  if (!DOCUMENT_CATEGORIES.has(category)) return res.status(400).json({ message: "Ungültige Dokumentkategorie." });
  const extension = req.file.originalname.includes(".") ? `.${req.file.originalname.split(".").pop().toLowerCase()}` : "";
  const key = `bewerber-candidate-documents/${req.publicBewerber._id}/${crypto.randomUUID()}${extension}`;
  await R2Service.uploadFile(key, req.file.buffer, req.file.mimetype);
  try {
    req.publicBewerber.documents.push({ name: req.file.originalname, key, contentType: req.file.mimetype, size: req.file.size, category });
    await req.publicBewerber.save();
    const document = req.publicBewerber.documents.at(-1);
    res.status(201).json({ data: { _id: document._id, name: document.name, contentType: document.contentType, size: document.size, category: document.category, uploadedAt: document.uploadedAt } });
  } catch (error) {
    await R2Service.deleteFile(key).catch((cleanupError) => logger.error(`Bewerber-Nachweis konnte nicht bereinigt werden: ${key}`, cleanupError));
    throw error;
  }
}));

router.delete("/invitations/:accessToken/documents/:documentId", requireInvitationSession, asyncHandler(async (req, res) => {
  const document = req.publicBewerber.documents.id(req.params.documentId);
  if (!document) return res.status(404).json({ message: "Dokument nicht gefunden." });
  const key = document.key;
  document.deleteOne();
  await req.publicBewerber.save();
  await R2Service.deleteFile(key).catch((cleanupError) => {
    logger.error(`Entfernter Bewerber-Nachweis blieb in R2 zurück: ${key}`, cleanupError);
  });
  res.status(204).end();
}));

router.post("/invitations/:accessToken/submit", requireInvitationSession, asyncHandler(async (req, res) => {
  const values = pickEditableFields(req.body);
  Object.assign(req.publicBewerber, values);
  const now = new Date();
  req.publicBewerber.status = "eingereicht";
  req.publicBewerber.submittedAt = now;
  req.publicInvitation.submittedAt = now;
  await req.publicBewerber.save();
  clearSession(res);
  logger.info(`Bewerber-Selbstauskunft eingereicht: ${req.publicBewerber._id}`);
  await req.publicBewerber.populate("locationV2", "nameFull shortName contact");
  await sendBewerberSubmittedEmail({
    bewerber: req.publicBewerber,
    invitation: req.publicInvitation,
  }).catch((mailError) => {
    logger.error(`Bewerber-Einreichbenachrichtigung fehlgeschlagen: ${req.publicBewerber._id}`, mailError);
  });
  res.json({ message: "Vielen Dank. Deine Angaben wurden erfolgreich übermittelt." });
}));

router.use((error, _req, res, next) => {
  if (!(error instanceof multer.MulterError)) return next(error);
  const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  const message = error.code === "LIMIT_FILE_SIZE"
    ? "Die Datei darf maximal 10 MB groß sein."
    : error.message;
  res.status(status).json({ message });
});

module.exports = router;
