const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const asyncHandler = require("../middleware/AsyncHandler");
const auth = require("../middleware/auth");
const BewerberEmailDocument = require("../models/System/BewerberEmailDocument");
const BewerberEmailTemplate = require("../models/System/BewerberEmailTemplate");
const Location = require("../models/System/Location");
const User = require("../models/System/User");
const R2Service = require("../services/integrations/R2Service");
const {
  PLACEHOLDERS,
  prepareTemplate,
  renderTemplate,
  resolveTemplate,
} = require("../services/employee/BewerberEmailTemplateService");
const logger = require("../utils/logger");

const router = express.Router();
const TEAM_KEY = "hamburg";
const INVITATION_TYPES = new Set(["vertrag", "vertrag_service", "vertrag_logistik"]);
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_DOCUMENT_TYPES.has(file.mimetype)) {
      const error = new Error("Nur PDF- oder Word-Dokumente sind erlaubt.");
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function parseLocationId(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

async function validateLocation(locationId) {
  if (!locationId) return null;
  if (!isValidId(locationId)) throw new Error("Ungültiger Standort.");
  const location = await Location.findOne({ _id: locationId, isActive: true }).select("_id").lean();
  if (!location) throw new Error("Der Standort wurde nicht gefunden oder ist inaktiv.");
  return location._id;
}

function documentKey(file, locationId) {
  const extension = file.originalname.includes(".")
    ? `.${file.originalname.split(".").pop().toLowerCase()}`
    : "";
  return `bewerber-email-documents/${TEAM_KEY}/${locationId || "global"}/${crypto.randomUUID()}${extension}`;
}

router.use(auth);
router.use(asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("role roles").lean();
  if (!user || (user.role !== "ADMIN" && !user.roles?.includes("ADMIN"))) {
    return res.status(403).json({ message: "Zugriff verweigert - nur für Admins." });
  }
  next();
}));

router.get("/email-documents", asyncHandler(async (req, res) => {
  const locationId = parseLocationId(req.query.locationId);
  if (locationId && !isValidId(locationId)) {
    return res.status(400).json({ message: "Ungültiger Standort." });
  }
  const filter = { teamKey: TEAM_KEY, isActive: true };
  if (req.query.scope === "global") filter.locationV2 = null;
  else if (locationId) filter.locationV2 = locationId;

  const documents = await BewerberEmailDocument.find(filter)
    .populate("locationV2", "nameFull shortName color")
    .sort({ locationV2: 1, name: 1 })
    .lean();
  res.json({ data: documents });
}));

router.post("/email-documents", documentUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Keine Datei hochgeladen." });
  const locationV2 = await validateLocation(parseLocationId(req.body.locationId));
  const key = documentKey(req.file, locationV2);
  await R2Service.uploadFile(key, req.file.buffer, req.file.mimetype);
  let saved = false;
  try {
    const document = await BewerberEmailDocument.create({
      teamKey: TEAM_KEY,
      locationV2,
      name: req.body.name?.trim() || req.file.originalname,
      key,
      contentType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id,
    });
    await document.populate("locationV2", "nameFull shortName color");
    res.status(201).json({ data: document });
  } catch (error) {
    await R2Service.deleteFile(key).catch((cleanupError) => logger.error(`R2-Bereinigung fehlgeschlagen: ${key}`, cleanupError));
    throw error;
  }
}));

router.patch("/email-documents/:id", documentUpload.single("file"), asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Dokument-ID." });
  const document = await BewerberEmailDocument.findOne({ _id: req.params.id, teamKey: TEAM_KEY });
  if (!document) return res.status(404).json({ message: "Dokument nicht gefunden." });

  const locationV2 = req.body.locationId === undefined
    ? document.locationV2
    : await validateLocation(parseLocationId(req.body.locationId));
  const oldKey = document.key;
  let newKey = null;
  if (req.file) {
    newKey = documentKey(req.file, locationV2);
    await R2Service.uploadFile(newKey, req.file.buffer, req.file.mimetype);
  }

  try {
    if (req.body.name?.trim()) document.name = req.body.name.trim();
    document.locationV2 = locationV2;
    if (req.file) {
      document.key = newKey;
      document.contentType = req.file.mimetype;
      document.size = req.file.size;
    }
    if (req.body.isActive !== undefined) document.isActive = req.body.isActive === "true" || req.body.isActive === true;
    await document.save();
    saved = true;
    if (newKey) {
      await R2Service.deleteFile(oldKey).catch((cleanupError) => {
        logger.error(`Ersetzte Bewerbervorlage blieb in R2 zurück: ${oldKey}`, cleanupError);
      });
    }
    await document.populate("locationV2", "nameFull shortName color");
    res.json({ data: document });
  } catch (error) {
    if (newKey && !saved) await R2Service.deleteFile(newKey).catch((cleanupError) => logger.error(`R2-Bereinigung fehlgeschlagen: ${newKey}`, cleanupError));
    throw error;
  }
}));

router.get("/email-documents/:id/download", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Dokument-ID." });
  const document = await BewerberEmailDocument.findOne({ _id: req.params.id, teamKey: TEAM_KEY }).lean();
  if (!document) return res.status(404).json({ message: "Dokument nicht gefunden." });
  const url = await R2Service.getSignedDownloadUrl(document.key, 300, { filename: document.name });
  res.json({ data: { url } });
}));

router.delete("/email-documents/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Dokument-ID." });
  const document = await BewerberEmailDocument.findOne({ _id: req.params.id, teamKey: TEAM_KEY });
  if (!document) return res.status(404).json({ message: "Dokument nicht gefunden." });
  const key = document.key;
  await document.deleteOne();
  await R2Service.deleteFile(key).catch((cleanupError) => {
    logger.error(`Gelöschte Bewerbervorlage blieb in R2 zurück: ${key}`, cleanupError);
  });
  res.status(204).end();
}));

router.get("/email-templates/effective", asyncHandler(async (req, res) => {
  const locationId = parseLocationId(req.query.locationId);
  const type = String(req.query.type || "");
  if (!INVITATION_TYPES.has(type)) return res.status(400).json({ message: "Ungültiger Einladungstyp." });
  if (locationId) await validateLocation(locationId);

  const resolved = await resolveTemplate({ teamKey: TEAM_KEY, locationId, type });
  res.json({
    data: {
      template: resolved.template,
      templateId: resolved.templateId,
      source: resolved.source,
      placeholders: PLACEHOLDERS,
    },
  });
}));

router.put("/email-templates", asyncHandler(async (req, res) => {
  const locationId = parseLocationId(req.body.locationId);
  const type = String(req.body.type || "");
  if (!INVITATION_TYPES.has(type)) return res.status(400).json({ message: "Ungültiger Einladungstyp." });
  const locationV2 = await validateLocation(locationId);
  const prepared = prepareTemplate(req.body);

  const template = await BewerberEmailTemplate.findOneAndUpdate(
    { teamKey: TEAM_KEY, locationV2, type },
    {
      $set: { ...prepared, updatedBy: req.user.id },
      $setOnInsert: { createdBy: req.user.id },
    },
    { new: true, upsert: true, runValidators: true }
  ).populate("locationV2", "nameFull shortName color");
  res.json({ data: template });
}));

router.post("/email-templates/preview", asyncHandler(async (req, res) => {
  const prepared = prepareTemplate(req.body);
  const rendered = renderTemplate(prepared, {
    "bewerber.vorname": "Erika",
    "bewerber.nachname": "Mustermann",
    termin: "Donnerstag, 13.08.2026, 17:00",
    link: "https://straightmonitor.com/bewerbung/beispiel",
    zugangscode: "123456",
    absender: "Alex Beispiel",
    standort: req.body.locationName || "Hamburg",
    standortEmail: "teamhamburg@straightforward.email",
    standortTelefon: "+49 40 700 101 90",
  });
  res.json({ data: rendered });
}));

router.delete("/email-templates/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Vorlagen-ID." });
  const template = await BewerberEmailTemplate.findOneAndDelete({ _id: req.params.id, teamKey: TEAM_KEY });
  if (!template) return res.status(404).json({ message: "Vorlage nicht gefunden." });
  res.status(204).end();
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
