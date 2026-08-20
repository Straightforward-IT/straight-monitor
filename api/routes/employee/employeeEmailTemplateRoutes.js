const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../../middleware/AsyncHandler");
const auth = require("../../middleware/auth");
const EmployeeEmailTemplate = require("../../models/EmployeeEmailTemplate");
const BewerberEmailDocument = require("../../models/System/BewerberEmailDocument");
const Location = require("../../models/System/Location");
const User = require("../../models/System/User");
const {
  PLACEHOLDERS,
  prepareTemplate,
  renderPreview,
} = require("../../services/employee/EmployeeEmailTemplateService");
const {
  listTemplateFolderMessages,
  getTemplateMessage,
} = require("../../services/integrations/GraphService");
const logger = require("../../utils/logger");

const router = express.Router();
const TEAM_KEY = "hamburg";

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function loadLocation(locationId) {
  if (!isValidId(locationId)) {
    const error = new Error("Ungültiger Standort.");
    error.statusCode = 400;
    throw error;
  }
  const location = await Location.findOne({ _id: locationId, isActive: true })
    .select("_id nameFull shortName color emailTemplateSource")
    .lean();
  if (!location) {
    const error = new Error("Der Standort wurde nicht gefunden oder ist inaktiv.");
    error.statusCode = 404;
    throw error;
  }
  return location;
}

async function resolveAttachmentIds(rawIds) {
  if (!Array.isArray(rawIds) || !rawIds.length) return [];
  const ids = [...new Set(rawIds.map(String))].filter(isValidId);
  if (!ids.length) return [];
  const found = await BewerberEmailDocument.find({
    _id: { $in: ids },
    teamKey: TEAM_KEY,
    isActive: true,
  }).select("_id").lean();
  if (found.length !== ids.length) {
    const error = new Error("Mindestens ein Anhang wurde nicht gefunden.");
    error.statusCode = 400;
    throw error;
  }
  return found.map((doc) => doc._id);
}

router.use(auth);
router.use(asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("role roles").lean();
  if (!user || (user.role !== "ADMIN" && !user.roles?.includes("ADMIN"))) {
    return res.status(403).json({ message: "Zugriff verweigert - nur für Admins." });
  }
  next();
}));

/* --------------------------- Quellen-Konfiguration ------------------------ */
router.get("/source-config/:locationId", asyncHandler(async (req, res) => {
  const location = await loadLocation(req.params.locationId);
  res.json({
    data: {
      mailboxUpn: location.emailTemplateSource?.mailboxUpn || "",
      folderId: location.emailTemplateSource?.folderId || "",
    },
  });
}));

router.put("/source-config/:locationId", asyncHandler(async (req, res) => {
  await loadLocation(req.params.locationId);
  const mailboxUpn = String(req.body.mailboxUpn || "").trim().toLowerCase();
  const folderId = String(req.body.folderId || "").trim();
  if ((mailboxUpn && !folderId) || (!mailboxUpn && folderId)) {
    return res.status(400).json({ message: "Postfach und Ordner-ID müssen gemeinsam gesetzt werden." });
  }
  const updated = await Location.findByIdAndUpdate(
    req.params.locationId,
    { $set: { emailTemplateSource: { mailboxUpn, folderId } } },
    { new: true }
  ).select("emailTemplateSource").lean();
  res.json({
    data: {
      mailboxUpn: updated.emailTemplateSource?.mailboxUpn || "",
      folderId: updated.emailTemplateSource?.folderId || "",
    },
  });
}));

/* ------------------------------- Vorschläge ------------------------------- */
router.get("/suggestions", asyncHandler(async (req, res) => {
  const location = await loadLocation(req.query.locationId);
  const source = location.emailTemplateSource || {};
  if (!source.mailboxUpn || !source.folderId) {
    return res.status(409).json({ message: "Für diesen Standort ist keine E-Mail-Quelle konfiguriert." });
  }
  try {
    const messages = await listTemplateFolderMessages({
      userPrincipalName: source.mailboxUpn,
      folderId: source.folderId,
      top: Number(req.query.top) || 50,
    });
    res.json({ data: messages });
  } catch (error) {
    logger.error("Vorlagen-Vorschläge konnten nicht geladen werden.", error);
    res.status(502).json({ message: "Die E-Mails konnten nicht aus dem Postfach geladen werden." });
  }
}));

router.get("/suggestions/:messageId", asyncHandler(async (req, res) => {
  const location = await loadLocation(req.query.locationId);
  const source = location.emailTemplateSource || {};
  if (!source.mailboxUpn || !source.folderId) {
    return res.status(409).json({ message: "Für diesen Standort ist keine E-Mail-Quelle konfiguriert." });
  }
  try {
    const message = await getTemplateMessage({
      userPrincipalName: source.mailboxUpn,
      folderId: source.folderId,
      messageId: req.params.messageId,
    });
    res.json({ data: message });
  } catch (error) {
    logger.error("Vorlagen-E-Mail konnte nicht geladen werden.", error);
    res.status(502).json({ message: "Die E-Mail konnte nicht geladen werden." });
  }
}));

/* -------------------------------- Vorlagen -------------------------------- */
router.get("/", asyncHandler(async (req, res) => {
  const filter = { teamKey: TEAM_KEY };
  if (req.query.locationId) {
    if (!isValidId(req.query.locationId)) return res.status(400).json({ message: "Ungültiger Standort." });
    filter.locationV2 = req.query.locationId;
  }
  const templates = await EmployeeEmailTemplate.find(filter)
    .populate("locationV2", "nameFull shortName color")
    .populate("attachments", "name contentType size locationV2")
    .sort({ locationV2: 1, name: 1 })
    .lean();
  res.json({ data: templates, placeholders: PLACEHOLDERS });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Vorlagen-ID." });
  const template = await EmployeeEmailTemplate.findOne({ _id: req.params.id, teamKey: TEAM_KEY })
    .populate("locationV2", "nameFull shortName color")
    .populate("attachments", "name contentType size locationV2")
    .lean();
  if (!template) return res.status(404).json({ message: "Vorlage nicht gefunden." });
  res.json({ data: template, placeholders: PLACEHOLDERS });
}));

router.post("/", asyncHandler(async (req, res) => {
  const location = await loadLocation(req.body.locationId);
  const prepared = prepareTemplate(req.body);
  const attachments = await resolveAttachmentIds(req.body.attachments);

  const template = await EmployeeEmailTemplate.create({
    teamKey: TEAM_KEY,
    locationV2: location._id,
    ...prepared,
    attachments,
    sourceMessageId: req.body.sourceMessageId ? String(req.body.sourceMessageId) : null,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });
  await template.populate("locationV2", "nameFull shortName color");
  await template.populate("attachments", "name contentType size locationV2");
  res.status(201).json({ data: template });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Vorlagen-ID." });
  const template = await EmployeeEmailTemplate.findOne({ _id: req.params.id, teamKey: TEAM_KEY });
  if (!template) return res.status(404).json({ message: "Vorlage nicht gefunden." });

  if (req.body.locationId !== undefined) {
    const location = await loadLocation(req.body.locationId);
    template.locationV2 = location._id;
  }
  const prepared = prepareTemplate(req.body);
  template.name = prepared.name;
  template.subjectTemplate = prepared.subjectTemplate;
  template.htmlTemplate = prepared.htmlTemplate;
  template.attachments = await resolveAttachmentIds(req.body.attachments);
  if (req.body.sourceMessageId !== undefined) {
    template.sourceMessageId = req.body.sourceMessageId ? String(req.body.sourceMessageId) : null;
  }
  template.updatedBy = req.user.id;
  await template.save();
  await template.populate("locationV2", "nameFull shortName color");
  await template.populate("attachments", "name contentType size locationV2");
  res.json({ data: template });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Vorlagen-ID." });
  const template = await EmployeeEmailTemplate.findOneAndDelete({ _id: req.params.id, teamKey: TEAM_KEY });
  if (!template) return res.status(404).json({ message: "Vorlage nicht gefunden." });
  res.status(204).end();
}));

router.post("/preview", asyncHandler(async (req, res) => {
  const prepared = prepareTemplate(req.body);
  const rendered = renderPreview(prepared, req.body.locationName ? { standort: req.body.locationName } : {});
  res.json({ data: rendered });
}));

router.use((error, _req, res, next) => {
  if (typeof error?.statusCode === "number") {
    return res.status(error.statusCode).json({ message: error.message });
  }
  next(error);
});

module.exports = router;
