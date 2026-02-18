const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/AsyncHandler");
const publicAuth = require("../middleware/publicAuth");
const Mitarbeiter = require("../models/Mitarbeiter");
const Einsatz = require("../models/Einsatz");
const Auftrag = require("../models/Auftrag");
const Qualifikation = require("../models/Qualifikation");
const { EventReport, Laufzettel, EvaluierungMA } = require("../models/Classes/FlipDocs");
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
      .select("_id vorname nachname email personalnr eventreports laufzettel_submitted laufzettel_received evaluierungen_submitted")
      .populate({
        path: "laufzettel_submitted",
        populate: [
          { path: "mitarbeiter", select: "vorname nachname" },
          { path: "teamleiter", select: "vorname nachname" }
        ]
      })
      .populate({
        path: "laufzettel_received",
        populate: [
          { path: "mitarbeiter", select: "vorname nachname" },
          { path: "teamleiter", select: "vorname nachname" }
        ]
      })
      .populate({
        path: "evaluierungen_submitted",
        populate: [
          { path: "mitarbeiter", select: "vorname nachname" },
          { path: "teamleiter", select: "vorname nachname" }
        ]
      });

    if (!mitarbeiter) {
      return res.status(404).json({ msg: "Mitarbeiter nicht gefunden" });
    }

    // Enrich laufzettel_submitted with status
    const laufzettelIds = (mitarbeiter.laufzettel_submitted || []).map(l => l._id);
    const evaluierungen = await EvaluierungMA.find(
      { laufzettel: { $in: laufzettelIds } },
      { laufzettel: 1 }
    ).lean();
    const bearbeitetSet = new Set(evaluierungen.map(e => String(e.laufzettel)));

    const mitarbeiterObj = mitarbeiter.toObject();
    mitarbeiterObj.laufzettel_submitted = mitarbeiterObj.laufzettel_submitted.map(l => ({
      ...l,
      status: bearbeitetSet.has(String(l._id)) ? "Bearbeitet" : "Eingereicht"
    }));

    res.json(mitarbeiterObj);
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

// ──────────────────────────────────────────────
// GET /api/public/einsatz-teamleiter?auftragNr=...
// Returns Mitarbeiter on the job who have qualification key 50055 (Teamleiter)
// ──────────────────────────────────────────────
router.get(
  "/einsatz-teamleiter",
  asyncHandler(async (req, res) => {
    const { auftragNr } = req.query;
    if (!auftragNr) {
      return res.status(400).json({ msg: "auftragNr parameter is required" });
    }

    // All personalNrs on this job
    const einsaetze = await Einsatz.find({ auftragNr: parseInt(auftragNr) })
      .select("personalNr")
      .lean();

    if (!einsaetze.length) return res.json([]);

    const personalNrs = [...new Set(einsaetze.map((e) => e.personalNr).filter(Boolean))];

    // Resolve the Teamleiter qualification ObjectId (key 50055)
    const teamleiterQual = await Qualifikation.findOne({ qualificationKey: 50055 }).lean();

    // Filter Mitarbeiter on the job who hold the Teamleiter qualification
    const query = { personalnr: { $in: personalNrs } };
    if (teamleiterQual) {
      query.qualifikationen = teamleiterQual._id;
    }

    const mitarbeiterList = await Mitarbeiter.find(query)
      .select("personalnr vorname nachname email")
      .lean();

    res.json(mitarbeiterList);
  })
);

// ──────────────────────────────────────────────
// POST /api/public/laufzettel
// Submit a Laufzettel from a non-Teamleiter Mitarbeiter
// ──────────────────────────────────────────────
router.post(
  "/laufzettel",
  asyncHandler(async (req, res) => {
    const { email, auftragNr, teamleiter_email } = req.body;

    if (!email || !auftragNr || !teamleiter_email) {
      return res.status(400).json({ msg: "Pflichtfelder fehlen (email, auftragNr, teamleiter_email)" });
    }

    // Resolve Mitarbeiter (submitter)
    const mitarbeiter = await Mitarbeiter.findOne({ email: email.toLowerCase().trim() });
    if (!mitarbeiter) {
      return res.status(404).json({ msg: "Mitarbeiter nicht gefunden" });
    }

    // Resolve Teamleiter
    const teamleiter = await Mitarbeiter.findOne({ email: teamleiter_email.toLowerCase().trim() });
    if (!teamleiter) {
      return res.status(404).json({ msg: "Teamleiter nicht gefunden" });
    }

    // Fetch Auftrag for location/kunde info
    const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) })
      .select("eventTitel eventLocation eventOrt kundenNr geschSt vonDatum")
      .lean();

    const location = auftrag?.eventLocation || auftrag?.eventOrt || "";
    const datum = auftrag?.vonDatum ? new Date(auftrag.vonDatum) : new Date();

    const laufzettel = new Laufzettel({
      location,
      name_mitarbeiter: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`.trim(),
      name_teamleiter: `${teamleiter.vorname} ${teamleiter.nachname}`.trim(),
      mitarbeiter: mitarbeiter._id,
      teamleiter: teamleiter._id,
      assigned: true,
      datum,
    });

    await laufzettel.save();
    logger.info(`✅ Public Laufzettel created: ${laufzettel._id} by ${mitarbeiter.email}`);

    // Link to both Mitarbeiter
    mitarbeiter.laufzettel_submitted.push(laufzettel._id);
    await mitarbeiter.save();

    teamleiter.laufzettel_received.push(laufzettel._id);
    await teamleiter.save();

    res.status(201).json({ msg: "Laufzettel erfolgreich eingereicht", id: laufzettel._id });
  })
);

// ──────────────────────────────────────────────
// POST /api/public/evaluierung
// Submit an EvaluierungMA linked to a Laufzettel
// ──────────────────────────────────────────────
router.post(
  "/evaluierung",
  asyncHandler(async (req, res) => {
    const {
      email,          // Teamleiter email (submitter)
      laufzettel_id,
      kunde,
      datum,
      puenktlichkeit,
      grooming,
      motivation,
      technische_fertigkeiten,
      lernbereitschaft,
      sonstiges,
    } = req.body;

    if (!email || !laufzettel_id || !kunde) {
      return res.status(400).json({ msg: "Pflichtfelder fehlen (email, laufzettel_id, kunde)" });
    }

    // Resolve Teamleiter (submitter)
    const teamleiter = await Mitarbeiter.findOne({ email: email.toLowerCase().trim() });
    if (!teamleiter) {
      return res.status(404).json({ msg: "Teamleiter nicht gefunden" });
    }

    // Resolve Laufzettel with mitarbeiter info
    const laufzettel = await Laufzettel.findById(laufzettel_id).lean();
    if (!laufzettel) {
      return res.status(404).json({ msg: "Laufzettel nicht gefunden" });
    }

    // Resolve Mitarbeiter from Laufzettel
    const mitarbeiter = laufzettel.mitarbeiter
      ? await Mitarbeiter.findById(
          typeof laufzettel.mitarbeiter === "object" ? laufzettel.mitarbeiter._id ?? laufzettel.mitarbeiter : laufzettel.mitarbeiter
        )
      : null;

    const evaluierung = new EvaluierungMA({
      location: laufzettel.location || "",
      datum: datum ? new Date(datum) : (laufzettel.datum || new Date()),
      kunde,
      name_teamleiter: laufzettel.name_teamleiter,
      name_mitarbeiter: laufzettel.name_mitarbeiter,
      puenktlichkeit: puenktlichkeit || "",
      grooming: grooming || "",
      motivation: motivation || "",
      technische_fertigkeiten: technische_fertigkeiten || "",
      lernbereitschaft: lernbereitschaft || "",
      sonstiges: sonstiges || "",
      teamleiter: teamleiter._id,
      mitarbeiter: mitarbeiter?._id || null,
      laufzettel: laufzettel._id,
      assigned: true,
    });

    await evaluierung.save();
    logger.info(`✅ Public Evaluierung created: ${evaluierung._id} by ${email}`);

    // Link to Teamleiter evaluierungen_submitted
    teamleiter.evaluierungen_submitted.push(evaluierung._id);
    await teamleiter.save();

    // Link to Mitarbeiter evaluierungen_received
    if (mitarbeiter) {
      mitarbeiter.evaluierungen_received.push(evaluierung._id);
      await mitarbeiter.save();
    }

    res.status(201).json({ msg: "Evaluierung erfolgreich eingereicht", id: evaluierung._id });
  })
);

module.exports = router;
