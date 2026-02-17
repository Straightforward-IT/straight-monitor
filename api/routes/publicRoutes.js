const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/AsyncHandler");
const publicAuth = require("../middleware/publicAuth");
const Mitarbeiter = require("../models/Mitarbeiter");
const Einsatz = require("../models/Einsatz");
const Auftrag = require("../models/Auftrag");
const { EventReport } = require("../models/Classes/FlipDocs");
const logger = require("../utils/logger");

// All routes in this file require FLIP_PUBLIC_JWT
router.use(publicAuth);

// ──────────────────────────────────────────────
// GET /api/public/mitarbeiter?email=...
// Finds Mitarbeiter by email, returns basic info
// ──────────────────────────────────────────────
router.get(
  "/mitarbeiter",
  asyncHandler(async (req, res) => {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ msg: "Email parameter is required" });
    }

    const mitarbeiter = await Mitarbeiter.findOne({ email: email.toLowerCase().trim() })
      .select("_id vorname nachname email personalnr eventreports")
      .lean();

    if (!mitarbeiter) {
      return res.status(404).json({ msg: "Mitarbeiter nicht gefunden" });
    }

    res.json(mitarbeiter);
  })
);

// ──────────────────────────────────────────────
// GET /api/public/einsaetze?personalNr=...
// Gets Einsätze for a Mitarbeiter (past events only)
// Enriches with Auftrag info (eventTitel, Kunde etc.)
// ──────────────────────────────────────────────
router.get(
  "/einsaetze",
  asyncHandler(async (req, res) => {
    const { personalNr } = req.query;
    if (!personalNr) {
      return res.status(400).json({ msg: "personalNr parameter is required" });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Only past einsätze (datumBis <= today)
    const einsaetze = await Einsatz.find({
      personalNr: parseInt(personalNr),
      datumBis: { $lte: today },
    })
      .sort({ datumBis: -1 })
      .lean();

    if (!einsaetze.length) {
      return res.json([]);
    }

    // Get unique auftragNrs to enrich with Auftrag details
    const auftragNrs = [...new Set(einsaetze.map((e) => e.auftragNr))];
    const auftraege = await Auftrag.find({ auftragNr: { $in: auftragNrs } })
      .select("auftragNr eventTitel kundenNr geschSt eventLocation eventOrt vonDatum bisDatum")
      .lean();

    const auftragMap = {};
    auftraege.forEach((a) => {
      auftragMap[a.auftragNr] = a;
    });

    // Merge
    const enriched = einsaetze.map((e) => ({
      ...e,
      auftrag: auftragMap[e.auftragNr] || null,
    }));

    res.json(enriched);
  })
);

// ──────────────────────────────────────────────
// POST /api/public/eventreport
// Submit an EventReport from the public Flip page
// ──────────────────────────────────────────────
router.post(
  "/eventreport",
  asyncHandler(async (req, res) => {
    const {
      location,
      kunde,
      auftragnummer,
      name_teamleiter,
      mitarbeiter_anzahl,
      datum,
      puenktlichkeit,
      erscheinungsbild,
      team,
      mitarbeiter_job,
      feedback_auftraggeber,
      sonstiges,
      teamleiter_email,
    } = req.body;

    if (!datum || !name_teamleiter || !kunde || !location) {
      return res.status(400).json({ msg: "Pflichtfelder fehlen (datum, name_teamleiter, kunde, location)" });
    }

    // Find the Teamleiter by email
    let teamleiter = null;
    if (teamleiter_email) {
      teamleiter = await Mitarbeiter.findOne({ email: teamleiter_email.toLowerCase().trim() });
    }

    const eventReport = new EventReport({
      location,
      kunde,
      auftragnummer: auftragnummer || "",
      name_teamleiter,
      mitarbeiter_anzahl: mitarbeiter_anzahl || "",
      datum,
      puenktlichkeit: puenktlichkeit || "",
      erscheinungsbild: erscheinungsbild || "",
      team: team || "",
      mitarbeiter_job: mitarbeiter_job || "",
      feedback_auftraggeber: feedback_auftraggeber || "",
      sonstiges: sonstiges || "",
      teamleiter: teamleiter?._id,
      assigned: !!teamleiter,
    });

    await eventReport.save();
    logger.info(`✅ Public EventReport created: ${eventReport._id} by ${name_teamleiter}`);

    // Link to Mitarbeiter if found
    if (teamleiter) {
      teamleiter.eventreports.push(eventReport._id);
      await teamleiter.save();
    }

    res.status(201).json({ msg: "EventReport erfolgreich gespeichert", id: eventReport._id });
  })
);

module.exports = router;
