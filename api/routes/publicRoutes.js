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
const AsanaService = require("../AsanaService");
const { sendMail } = require("../EmailService");
const registry = require("../config/registry");

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
      });

    if (!mitarbeiter) {
      return res.status(404).json({ msg: "Mitarbeiter nicht gefunden" });
    }

    // Enrich laufzettel_submitted with status
    // v2 docs have status directly; v1 docs fall back to checking for linked EvaluierungMA
    const mitarbeiterObj = mitarbeiter.toObject();
    const v1Ids = mitarbeiterObj.laufzettel_submitted
      .filter(l => !l.version || l.version !== 'v2')
      .map(l => l._id);
    const bearbeitetSet = new Set();
    if (v1Ids.length > 0) {
      const evaluierungen = await EvaluierungMA.find(
        { laufzettel: { $in: v1Ids } },
        { laufzettel: 1 }
      ).lean();
      evaluierungen.forEach(e => bearbeitetSet.add(String(e.laufzettel)));
    }
    mitarbeiterObj.laufzettel_submitted = mitarbeiterObj.laufzettel_submitted.map(l => ({
      ...l,
      status: l.version === 'v2'
        ? (l.status || 'OFFEN')   // use the document's own status
        : (bearbeitetSet.has(String(l._id)) ? 'Bearbeitet' : 'Eingereicht')
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
      .select("personalnr vorname nachname telefon qualifikationen")
      .lean();

    // Resolve Teamleiter qualification (key 50055) to mark TL MAs
    const teamleiterQual = await Qualifikation.findOne({ qualificationKey: 50055 }).lean();
    const tlQualId = teamleiterQual ? String(teamleiterQual._id) : null;

    const maMap = {};
    mitarbeiterList.forEach((ma) => {
      ma._isTeamleiter = tlQualId
        ? (ma.qualifikationen || []).some((q) => String(q) === tlQualId)
        : false;
      maMap[ma.personalnr] = ma;
    });

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
        isTeamleiter: ma?._isTeamleiter || false,
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
      mitarbeiter_feedback,
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

    // Resolve mitarbeiter_feedback personalNr → ObjectId + collect full MA data for Asana
    let resolvedFeedback = [];
    let maByNr = {}; // personalNr → { _id, asana_id, vorname, nachname }
    if (Array.isArray(mitarbeiter_feedback) && mitarbeiter_feedback.length) {
      const personalNrs = mitarbeiter_feedback.map(f => String(f.personalNr)).filter(Boolean);
      const maLookup = await Mitarbeiter.find({ personalnr: { $in: personalNrs } })
        .select('_id personalnr asana_id vorname nachname').lean();
      maByNr = Object.fromEntries(maLookup.map(m => [String(m.personalnr), m]));
      resolvedFeedback = mitarbeiter_feedback
        .filter(f => f.text && f.text.trim())
        .map(f => ({
          mitarbeiter: maByNr[String(f.personalNr)]?._id || null,
          text: f.text.trim(),
        }));
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
      mitarbeiter_feedback: resolvedFeedback,
      feedback_auftraggeber: feedback_auftraggeber || "",
      sonstiges: sonstiges || "",
      teamleiter: teamleiter?._id,
      assigned: !!teamleiter,
    });

    await eventReport.save();
    logger.info(`✅ Public EventReport created: ${eventReport._id} by ${name_teamleiter}`);

    // v2: no array push – query-based referencing
    // Legacy: still push to eventreports array for v1 compat
    if (teamleiter && eventReport.version !== "v2") {
      teamleiter.eventreports.push(eventReport._id);
      await teamleiter.save();
    }

    res.status(201).json({ msg: "EventReport erfolgreich gespeichert", id: eventReport._id });

    // ── E-Mail: Event Report Benachrichtigung (fire-and-forget) ──
    (async () => {
      try {
        const recipients = registry.getEventReportRecipients(location);
        const fmtField = (v) => v && v.trim() ? v.trim() : '<span style="color:#999;">—</span>';
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
        const row = (label, value) =>
          `<tr><td style="padding:6px 12px 6px 0;font-size:0.85rem;color:#666;font-weight:600;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 0;font-size:0.9rem;color:#111;">${value}</td></tr>`;

        let maFeedbackHtml = '';
        if (Array.isArray(mitarbeiter_feedback) && mitarbeiter_feedback.length) {
          maFeedbackHtml = mitarbeiter_feedback
            .filter(f => f.text?.trim())
            .map(f => `<div style="margin:4px 0 8px;"><strong style="font-size:0.8rem;color:#555;">${f.name || f.personalNr}</strong><br/><span style="font-size:0.9rem;">${f.text.trim()}</span></div>`)
            .join('');
        }
        if (!maFeedbackHtml && mitarbeiter_job) maFeedbackHtml = fmtField(mitarbeiter_job);
        if (!maFeedbackHtml) maFeedbackHtml = '<span style="color:#999;">—</span>';

        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111;">
            <div style="background:#ff7518;padding:16px 24px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;color:#fff;font-size:1.1rem;">📋 Neuer Event Report</h2>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:0.85rem;">Eingereicht von ${name_teamleiter}</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px;">
              <table style="border-collapse:collapse;width:100%;">
                ${row('Datum', fmtDate(datum))}
                ${row('Standort', fmtField(location))}
                ${row('Kunde / Event', fmtField(kunde))}
                ${row('Auftragsnr.', fmtField(auftragnummer))}
                ${row('Teamleiter', fmtField(name_teamleiter))}
                ${row('Mitarbeiter Anz.', fmtField(mitarbeiter_anzahl))}
              </table>
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:16px 0;"/>
              <h3 style="font-size:0.9rem;margin:0 0 10px;color:#ff7518;">Bewertung</h3>
              <table style="border-collapse:collapse;width:100%;">
                ${row('Pünktlichkeit', fmtField(puenktlichkeit))}
                ${row('Erscheinungsbild', fmtField(erscheinungsbild))}
                ${row('Team', fmtField(team))}
              </table>
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:16px 0;"/>
              <h3 style="font-size:0.9rem;margin:0 0 10px;color:#ff7518;">Mitarbeiter & Job</h3>
              ${maFeedbackHtml}
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:16px 0;"/>
              <h3 style="font-size:0.9rem;margin:0 0 10px;color:#ff7518;">Feedback Auftraggeber</h3>
              <p style="margin:0;font-size:0.9rem;">${fmtField(feedback_auftraggeber)}</p>
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:16px 0;"/>
              <h3 style="font-size:0.9rem;margin:0 0 10px;color:#ff7518;">Sonstiges</h3>
              <p style="margin:0;font-size:0.9rem;">${fmtField(sonstiges)}</p>
            </div>
          </div>`;

        await sendMail(
          recipients,
          `Event Report: ${kunde} – ${fmtDate(datum)} (${location})`,
          html,
          'it'
        );
        logger.info(`📧 EventReport email sent to ${recipients.join(', ')} for ${name_teamleiter}`);
      } catch (emailErr) {
        logger.error('❌ EventReport email failed:', emailErr.message);
      }
    })();

    // ── Asana: Feedback-Subtask pro Mitarbeiter (fire-and-forget) ──
    if (resolvedFeedback.length && auftragnummer) {
      (async () => {
        try {
          // Auftrag-Infos laden
          const auftrag = await Auftrag.findOne({ auftragNr: Number(auftragnummer) }).lean();
          const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

          for (const fb of mitarbeiter_feedback.filter(f => f.text?.trim())) {
            const ma = maByNr[String(fb.personalNr)];
            if (!ma?.asana_id) continue;

            try {
              // 1) Subtasks des MA-Tasks holen
              const subtasksRes = await AsanaService.getSubtaskByTask(ma.asana_id);
              const subtasks = subtasksRes?.data || [];
              let feedbackTask = subtasks.find(s => s.name === 'Feedback');

              // 2) "Feedback"-Subtask erstellen falls nicht vorhanden
              if (!feedbackTask) {
                const created = await AsanaService.createSubtasksOnTask(ma.asana_id, {
                  name: 'Feedback',
                  notes: `Feedback von Laufzetteln und Event Reports für ${ma.vorname} ${ma.nachname}`,
                });
                feedbackTask = created?.data || created;
              }

              if (!feedbackTask?.gid) continue;

              // 3) Sub-subtask mit Feedback-Text + Links
              const eventTitle = auftrag?.eventTitel || kunde || `Auftrag #${auftragnummer}`;
              const eventDate = fmtDate(auftrag?.vonDatum || datum);
              const eventLocation = auftrag?.eventLocation || auftrag?.eventOrt || location || '';
              const subtaskName = `${eventTitle} – ${eventDate}${eventLocation ? ` (${eventLocation})` : ''}`;

              // HTML-Sonderzeichen escapen
              const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const feedbackText = esc(fb.text.trim());

              const baseUrl = 'https://straightmonitor.com';
              const auftragLink = auftragnummer
                ? `${baseUrl}/auftraege?auftragnr=${auftragnummer}&amp;focusDate=${encodeURIComponent(auftrag?.vonDatum || datum || '')}`
                : '';
              const teamleiterLink = teamleiter?._id
                ? `${baseUrl}/personal?mitarbeiter_id=${teamleiter._id}`
                : '';
              const berichtLink = `${baseUrl}/dokumente?docId=${eventReport._id}`;

              const htmlBody = [
                `Feedback von <strong>${esc(name_teamleiter)}</strong>:`,
                feedbackText,
                '',
                teamleiterLink ? `<a href="${teamleiterLink}">Teamleiter öffnen</a>` : null,
                auftragLink ? `<a href="${auftragLink}">Auftrag öffnen</a>` : null,
                `<a href="${berichtLink}">Bericht öffnen</a>`,
              ].filter(v => v != null).join('\n');

              await AsanaService.createSubtasksOnTask(feedbackTask.gid, {
                name: subtaskName,
                html_notes: `<body>${htmlBody}</body>`,
              });

              logger.info(`✅ Asana Feedback-Subtask created for MA ${ma.vorname} ${ma.nachname} (${ma.asana_id})`);
            } catch (asanaErr) {
              logger.warn(`⚠️ Asana Feedback failed for MA ${ma.personalnr}: ${asanaErr.message}`);
            }
          }
        } catch (err) {
          logger.warn(`⚠️ Asana Feedback routine failed: ${err.message}`);
        }
      })();
    }
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
// Merges evaluation fields into the existing Laufzettel (v2)
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

    // Resolve and update Laufzettel
    const laufzettel = await Laufzettel.findById(laufzettel_id);
    if (!laufzettel) {
      return res.status(404).json({ msg: "Laufzettel nicht gefunden" });
    }

    // Merge evaluation fields into the Laufzettel (v2)
    laufzettel.version = 'v2';
    laufzettel.status = 'ABGESCHLOSSEN';
    laufzettel.kunde = kunde;
    if (puenktlichkeit) laufzettel.puenktlichkeit = puenktlichkeit;
    if (grooming) laufzettel.grooming = grooming;
    if (motivation) laufzettel.motivation = motivation;
    if (technische_fertigkeiten) laufzettel.technische_fertigkeiten = technische_fertigkeiten;
    if (lernbereitschaft) laufzettel.lernbereitschaft = lernbereitschaft;
    if (sonstiges) laufzettel.sonstiges = sonstiges;
    if (datum) laufzettel.datum = new Date(datum);

    await laufzettel.save();
    logger.info(`✅ Public Evaluierung merged into Laufzettel ${laufzettel._id} by ${email}`);

    res.status(200).json({ msg: "Bewertung erfolgreich gespeichert", id: laufzettel._id });
  })
);

module.exports = router;
