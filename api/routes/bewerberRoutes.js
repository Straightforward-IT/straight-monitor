const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const crypto = require("crypto");
const asyncHandler = require("../middleware/AsyncHandler");
const auth = require("../middleware/auth");
const Bewerber = require("../models/Bewerber");
const Mitarbeiter = require("../models/Mitarbeiter");
const BewerberEmailDocument = require("../models/BewerberEmailDocument");
const User = require("../models/User");
const { INVITATION_TYPES, sendInvitation } = require("../BewerberInvitationService");
const { findAllTasks } = require("../AsanaService");
const R2Service = require("../R2Service");
const registry = require("../config/registry");
const logger = require("../utils/logger");

const router = express.Router();
const ENABLED_TEAM_KEY = "hamburg";
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
      return callback(new Error("Nur PDF- oder Word-Dokumente sind erlaubt."));
    }
    callback(null, true);
  },
});

const EDITABLE_FIELDS = new Set([
  "anrede",
  "vorname",
  "nachname",
  "email",
  "telefon",
  "strasse",
  "plz",
  "ort",
  "wohnsitz",
  "staatsangehoerigkeit",
  "familienstand",
  "geburtsdatum",
  "bevorzugterBereich",
  "erfahrungGastronomieLogistik",
  "aktuellesAnstellungsverhaeltnis",
  "verfuegbarAb",
  "verfuegbarBis",
  "verfuegbarkeit",
  "bemerkungen",
  "fuehrerscheine",
  "eigenesAuto",
  "nutzungsberechtigung",
  "reisebereitschaft",
  "deutschlandticket",
  "hat70TageGearbeitet",
  "tage70Regelung",
  "studiumStatus",
]);

function pickEditableFields(source = {}) {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => EDITABLE_FIELDS.has(key))
  );
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

router.use(auth);

// GET /api/bewerber/suggestions
router.get("/suggestions", asyncHandler(async (_req, res) => {
  const projectId = registry.getAsanaProjectId(ENABLED_TEAM_KEY);
  const tasks = await findAllTasks({
    project: projectId,
    completed_since: "now",
    opt_fields: "gid,name,permalink_url,created_at,due_on",
  });
  const taskIds = tasks.map((task) => task.gid).filter(Boolean);
  const [bewerber, mitarbeiter] = await Promise.all([
    Bewerber.find({ asana_id: { $in: taskIds } }).select("asana_id").lean(),
    Mitarbeiter.find({ asana_id: { $in: taskIds } }).select("asana_id").lean(),
  ]);
  const linkedTaskIds = new Set([
    ...bewerber.map((entry) => entry.asana_id),
    ...mitarbeiter.map((entry) => entry.asana_id),
  ]);

  res.json({
    data: tasks
      .filter((task) => !linkedTaskIds.has(task.gid))
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
      .slice(0, 12)
      .map((task) => ({
        gid: task.gid,
        name: task.name || "Unbenannte Asana-Aufgabe",
        permalinkUrl: task.permalink_url || "",
        createdAt: task.created_at || null,
        dueOn: task.due_on || null,
      })),
  });
}));

// GET /api/bewerber/email-documents
router.get("/email-documents", asyncHandler(async (_req, res) => {
  const documents = await BewerberEmailDocument.find({
    teamKey: ENABLED_TEAM_KEY,
    isActive: true,
  })
    .select("name contentType size createdAt updatedAt")
    .sort({ name: 1 })
    .lean();

  res.json({ data: documents });
}));

// POST /api/bewerber/email-documents
router.post("/email-documents", documentUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Keine Datei hochgeladen." });

  const extension = req.file.originalname.includes(".")
    ? `.${req.file.originalname.split(".").pop().toLowerCase()}`
    : "";
  const key = `bewerber-email-documents/${ENABLED_TEAM_KEY}/${crypto.randomUUID()}${extension}`;

  await R2Service.uploadFile(key, req.file.buffer, req.file.mimetype);
  try {
    const document = await BewerberEmailDocument.create({
      teamKey: ENABLED_TEAM_KEY,
      name: req.file.originalname,
      key,
      contentType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id,
    });
    res.status(201).json({ data: document });
  } catch (error) {
    await R2Service.deleteObject(key).catch((cleanupError) => {
      logger.error(`Bewerber-E-Mail-Dokument konnte nicht aus R2 bereinigt werden: ${key}`, cleanupError);
    });
    throw error;
  }
}));

// GET /api/bewerber/email-documents/:id/download
router.get("/email-documents/:id/download", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Dokument-ID." });

  const document = await BewerberEmailDocument.findOne({
    _id: req.params.id,
    teamKey: ENABLED_TEAM_KEY,
    isActive: true,
  }).lean();
  if (!document) return res.status(404).json({ message: "Dokument nicht gefunden." });

  const url = await R2Service.getSignedDownloadUrl(document.key, 300, { filename: document.name });
  res.json({ data: { url } });
}));

// DELETE /api/bewerber/email-documents/:id
router.delete("/email-documents/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Dokument-ID." });

  const document = await BewerberEmailDocument.findOne({
    _id: req.params.id,
    teamKey: ENABLED_TEAM_KEY,
    isActive: true,
  });
  if (!document) return res.status(404).json({ message: "Dokument nicht gefunden." });

  await R2Service.deleteObject(document.key);
  await document.deleteOne();
  res.status(204).end();
}));

// GET /api/bewerber?status=...&search=...
router.get("/", asyncHandler(async (req, res) => {
  const filter = { teamKey: ENABLED_TEAM_KEY };
  if (req.query.status) filter.status = req.query.status;

  if (req.query.search?.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const search = new RegExp(escaped, "i");
    filter.$or = [{ vorname: search }, { nachname: search }, { email: search }, { telefon: search }];
  }

  const bewerber = await Bewerber.find(filter)
    .select("+invitations.accessTokenHash +invitations.accessCodeHash")
    .sort({ createdAt: -1 })
    .lean();

  for (const entry of bewerber) {
    for (const invitation of entry.invitations || []) {
      delete invitation.accessTokenHash;
      delete invitation.accessCodeHash;
    }
  }

  res.json({ data: bewerber });
}));

// GET /api/bewerber/asana/:asanaId
router.get("/asana/:asanaId", asyncHandler(async (req, res) => {
  const bewerber = await Bewerber.findOne({
    teamKey: ENABLED_TEAM_KEY,
    asana_id: req.params.asanaId,
  }).lean();

  if (!bewerber) return res.status(404).json({ message: "Bewerber nicht gefunden." });
  res.json({ data: bewerber });
}));

// POST /api/bewerber
router.post("/", asyncHandler(async (req, res) => {
  const { asana_id, asana_permalink, teamKey = ENABLED_TEAM_KEY } = req.body;
  if (teamKey !== ENABLED_TEAM_KEY) {
    return res.status(400).json({ message: "Der Bewerber-Workflow ist aktuell nur für Hamburg aktiviert." });
  }

  const values = pickEditableFields(req.body);
  if (!values.vorname?.trim() || !values.nachname?.trim() || !values.email?.trim()) {
    return res.status(400).json({ message: "Vorname, Nachname und E-Mail sind erforderlich." });
  }

  if (asana_id) {
    const existing = await Bewerber.findOne({ asana_id }).select("_id").lean();
    if (existing) {
      return res.status(409).json({ message: "Für diese Asana-Aufgabe existiert bereits ein Bewerber.", id: existing._id });
    }
  }

  const bewerber = await Bewerber.create({
    ...values,
    asana_id: asana_id?.trim() || undefined,
    asana_permalink: asana_permalink?.trim() || "",
    teamKey: ENABLED_TEAM_KEY,
    createdBy: req.user.id,
  });

  logger.info(`Bewerber erstellt: ${bewerber._id} (${bewerber.email})`);
  res.status(201).json({ data: bewerber });
}));

// POST /api/bewerber/:id/invitations
router.post("/:id/invitations", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Bewerber-ID." });

  const { type, appointmentAt, documentIds = [] } = req.body;
  if (!INVITATION_TYPES.has(type)) {
    return res.status(400).json({ message: "Ungültiger Einladungstyp." });
  }
  if (!Array.isArray(documentIds) || documentIds.some((id) => !isValidId(id))) {
    return res.status(400).json({ message: "Die ausgewählten Dokumente sind ungültig." });
  }

  const [bewerber, sender] = await Promise.all([
    Bewerber.findOne({ _id: req.params.id, teamKey: ENABLED_TEAM_KEY }),
    User.findById(req.user.id).select("name email").lean(),
  ]);
  if (!bewerber) return res.status(404).json({ message: "Bewerber nicht gefunden." });
  if (!sender) return res.status(401).json({ message: "Benutzerkonto nicht gefunden." });

  try {
    const result = await sendInvitation({
      bewerber,
      type,
      appointmentAt,
      documentIds,
      senderName: sender.name?.trim() || sender.email,
    });
    logger.info(`Bewerber-Einladung versendet: ${bewerber._id} (${bewerber.email})`);
    res.status(201).json({
      data: {
        invitation: result.invitation,
        attachmentCount: result.attachmentCount,
      },
    });
  } catch (error) {
    logger.error(`Bewerber-Einladung fehlgeschlagen: ${bewerber._id}`, error);
    res.status(400).json({ message: error.message || "Einladung konnte nicht versendet werden." });
  }
}));

// GET /api/bewerber/:id
router.get("/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Bewerber-ID." });
  const bewerber = await Bewerber.findOne({ _id: req.params.id, teamKey: ENABLED_TEAM_KEY }).lean();
  if (!bewerber) return res.status(404).json({ message: "Bewerber nicht gefunden." });
  res.json({ data: bewerber });
}));

// PATCH /api/bewerber/:id
router.patch("/:id", asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: "Ungültige Bewerber-ID." });
  const values = pickEditableFields(req.body);
  if (Object.keys(values).length === 0) {
    return res.status(400).json({ message: "Keine bearbeitbaren Felder übermittelt." });
  }

  const bewerber = await Bewerber.findOne({ _id: req.params.id, teamKey: ENABLED_TEAM_KEY });
  if (!bewerber) return res.status(404).json({ message: "Bewerber nicht gefunden." });

  Object.assign(bewerber, values);
  await bewerber.save();
  res.json({ data: bewerber });
}));

module.exports = router;