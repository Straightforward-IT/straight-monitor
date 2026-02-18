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
// Gets all Einsätze for a Mitarbeiter (past + future)
// Enriches with Auftrag info (eventTitel, Kunde etc.)
// ──────────────────────────────────────────────
router.get(
  "/einsaetze",
  asyncHandler(async (req, res) => {
    const { personalNr } = req.query;
    if (!personalNr) {
      return res.status(400).json({ msg: "personalNr parameter is required" });
    }

    // All einsätze (past and future) - filtering happens client-side
    const einsaetze = await Einsatz.find({
      personalNr: parseInt(personalNr),
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
// GET /api/public/einsatz-mitarbeiter?auftragNr=...
// Gets all Einsätze for an Auftrag, enriched with
// Mitarbeiter info (vorname, nachname, telefon),
// grouped by Schicht (idAuftragArbeitsschichten)
// ──────────────────────────────────────────────
router.get(
  "/einsatz-mitarbeiter",
  asyncHandler(async (req, res) => {
    const { auftragNr } = req.query;
    if (!auftragNr) {
      return res.status(400).json({ msg: "auftragNr parameter is required" });
    }

    const einsaetze = await Einsatz.find({ auftragNr: parseInt(auftragNr) })
      .sort({ idAuftragArbeitsschichten: 1, personalNr: 1 })
      .lean();

    if (!einsaetze.length) return res.json([]);

    // Collect all personalNrs to fetch Mitarbeiter in one query
    const personalNrs = [...new Set(einsaetze.map((e) => e.personalNr).filter(Boolean))];
    const mitarbeiterList = await Mitarbeiter.find({ personalnr: { $in: personalNrs } })
      .select("personalnr vorname nachname telefon")
      .lean();

    const maMap = {};
    mitarbeiterList.forEach((ma) => { maMap[ma.personalnr] = ma; });

    // Group by schicht (idAuftragArbeitsschichten)
    const schichtMap = {};
    einsaetze.forEach((e) => {
      const key = e.idAuftragArbeitsschichten ?? 0;
      if (!schichtMap[key]) {
        schichtMap[key] = {
          id: key,
          bezeichnung: e.schichtBezeichnung || null,
          uhrzeitVon: e.uhrzeitVon || null,
          uhrzeitBis: e.uhrzeitBis || null,
          treffpunkt: e.treffpunkt || null,
          mitarbeiter: []
        };
      }
      const ma = maMap[e.personalNr];
      schichtMap[key].mitarbeiter.push({
        personalNr: e.personalNr,
        vorname: ma?.vorname || null,
        nachname: ma?.nachname || null,
        telefon: ma?.telefon || null,
        bezeichnung: e.bezeichnung || null,
        checkedIn: false
      });
    });

    const result = Object.values(schichtMap).sort((a, b) => a.id - b.id);
    res.json(result);
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
