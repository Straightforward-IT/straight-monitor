const express = require("express");

const router = express.Router();
const logger = require("../utils/logger");
const auth = require("../middleware/auth");

const {
  Laufzettel,
  LAUFZETTEL_STATUS,
  EventReport,
  EvaluierungMA,
  VerlosungEintrag,
  Verlosung,
  GUTSCHEIN_TYPES,
  GRAVUR_TYPES,
  VERLOSUNG_STATUS,
} = require("../models/Classes/FlipDocs");

const { sendMail } = require("../EmailService"); // Ensure sendMail is properly imported

const Mitarbeiter = require("../models/Mitarbeiter");

const {
  findMitarbeiterByName,

  assignTeamleiter,

  assignMitarbeiter,

  assignTeamleiterUndMitarbeiter,

  getFlipTaskAssignments,

  markAssignmentAsCompleted,

  assignVerlosungEintrag,
} = require("../FlipService");

const {
  getTaskById,

  getStoriesByTask,

  getStoryById,

  createStoryOnTask,

  getSubtaskByTask,

  createSubtasksOnTask,

  completeTaskById,
} = require("../AsanaService");

const asyncHandler = require("../middleware/AsyncHandler");

// 📌 Create or Update a Document

router.post(
  "/send",

  asyncHandler(async (req, res) => {
    const type = req.headers["document-type"];

    logger.debug(`📨 WPForms Webhook received: ${type}`, {
      body: req.body,
      headers: req.headers,
    });

    let parsedBody;

    if (!type) {
      logger.warn("⚠️ Document type missing in WPForms webhook");
      return res

        .status(400)

        .json({ success: false, error: "Document type is required" });
    }

    if (type === "laufzettel") {
      logger.info("📋 Processing Laufzettel (v2)...");
      const { location, name_mitarbeiter, name_teamleiter, email, datum } =
        req.body;

      logger.debug("Laufzettel data:", {
        location,
        name_mitarbeiter,
        name_teamleiter,
        email,
        datum,
      });

      const mitarbeiter = await Mitarbeiter.findOne({ email });
      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

      // v2: Refs auf dem Laufzettel sind Source of Truth (keine Array-Pushes auf Mitarbeiter)
      parsedBody = new Laufzettel({
        location,
        name_mitarbeiter,
        name_teamleiter,
        datum,
        mitarbeiter: mitarbeiter?.id,
        teamleiter: teamleiterId,
        assigned: !!(mitarbeiter?.id && teamleiterId),
        status: LAUFZETTEL_STATUS.OFFEN,
      });

      await parsedBody.save();
      logger.info(`✅ Laufzettel v2 created: ${parsedBody._id}`);

      // Asana Subtask für Mitarbeiter
      if (mitarbeiter?.id) {
        let formattedDate = formatDateFromDatum(datum);
        const data = {
          name: `LZ [${formattedDate}] - TL: ${name_teamleiter}`,
          notes: `${name_mitarbeiter} hat am ${formattedDate} einen Laufzettel angefragt. Teamleiter: ${name_teamleiter}`,
        };

        if (mitarbeiter.asana_id) {
          try {
            logger.info(`Creating Asana subtask for Mitarbeiter: ${mitarbeiter.asana_id}`);
            await createSubtasksOnTask(mitarbeiter.asana_id, data);
            logger.info("✅ Asana subtask created successfully");
          } catch (err) {
            logger.error("❌ Fehler beim Erstellen des Subtasks:", err.message);
            await sendMail(
              "it@straightforward.email",
              "❌ Fehler beim Erstellen eines Subtasks (Laufzettel)",
              `<h2>Subtask konnte nicht erstellt werden</h2>
          <p><strong>Mitarbeiter:</strong> ${mitarbeiter.vorname} ${mitarbeiter.nachname}</p>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          <pre>${err.message}</pre>`
            );
          }
        } else {
          await sendMail(
            "it@straightforward.email",
            "⚠️ Mitarbeiter ohne Asana-ID beim Laufzettel",
            `<h2>Subtask konnte nicht erstellt werden</h2>
        <p>Der Mitarbeiter <strong>${mitarbeiter.vorname} ${mitarbeiter.nachname}</strong> (${mitarbeiter.email}) hat keine <code>asana_id</code>.</p>`
          );
        }
      }

      // Flip Task für Teamleiter
      if (teamleiterId) {
        logger.info(`Creating Flip task for Teamleiter: ${teamleiterId}`);
        await assignTeamleiter(parsedBody._id, teamleiterId);
      }

      if (!teamleiterId || !mitarbeiter) {
        logger.warn(
          `⚠️ Laufzettel could not be fully assigned. Teamleiter: ${!!teamleiterId}, Mitarbeiter: ${!!mitarbeiter}`
        );
        await sendMail(
          "it@straightforward.email",
          "Laufzettel konnte nicht assigned werden",
          `<h2>Laufzettel konnte nicht automatisch zugewiesen werden</h2>${parsedBody
            .toHtml()
            .replace(/\n/g, "<br />")}`
        );
      }
    } else if (type === "event_report") {
      logger.info("📊 Processing Event Report (v2)...");
      const {
        location,
        name_teamleiter,
        email,
        datum,
        kunde,
        puenktlichkeit,
        erscheinungsbild,
        team,
        mitarbeiter_job,
        mitarbeiter_anzahl,
        feedback_auftraggeber,
        sonstiges,
      } = req.body;

      let teamleiter = await Mitarbeiter.findOne({ email });

      // v2: Ref auf dem EventReport ist Source of Truth (kein Array-Push auf Mitarbeiter)
      parsedBody = new EventReport({
        location,
        name_teamleiter,
        datum,
        kunde,
        puenktlichkeit,
        erscheinungsbild,
        team,
        mitarbeiter_job,
        mitarbeiter_anzahl,
        feedback_auftraggeber,
        sonstiges,
        teamleiter: teamleiter?._id,
        assigned: !!teamleiter,
      });

      await parsedBody.save();
      logger.info(`✅ Event Report v2 created: ${parsedBody._id}`);

      if (!teamleiter) {
        sendMail(
          "it@straightforward.email",
          "Eventreport konnte nicht assigned werden",
          `<h2>Neuer Eventreport eingegangen</h2>${parsedBody
            .toHtml()
            .replace(/\n/g, "<br />")}`
        );
      }
    } else if (type === "evaluierung") {
      logger.info("📝 Processing Evaluierung...");
      const {
        location,
        laufzettel_id,
        name_teamleiter,
        email,
        datum,
        kunde,
        name_mitarbeiter,
        puenktlichkeit,
        grooming,
        motivation,
        technische_fertigkeiten,
        lernbereitschaft,
        sonstiges,
      } = req.body;

      logger.debug("Evaluierung data:", {
        name_mitarbeiter,
        name_teamleiter,
        laufzettel_id,
        datum,
      });

      // ── v2: Laufzettel direkt updaten (wenn laufzettel_id vorhanden) ──
      if (laufzettel_id) {
        const laufzettel = await Laufzettel.findById(laufzettel_id);

        if (!laufzettel) {
          logger.warn(`⚠️ Laufzettel not found: ${laufzettel_id}`);
          return res.status(404).json({
            success: false,
            error: `Laufzettel ${laufzettel_id} nicht gefunden`,
          });
        }

        if (laufzettel.version === "v2") {
          logger.info(`📝 v2: Updating Laufzettel ${laufzettel_id} with Evaluierung...`);

          // Evaluierung-Felder auf dem Laufzettel setzen
          laufzettel.kunde = kunde;
          laufzettel.puenktlichkeit = puenktlichkeit;
          laufzettel.grooming = grooming;
          laufzettel.motivation = motivation;
          laufzettel.technische_fertigkeiten = technische_fertigkeiten;
          laufzettel.lernbereitschaft = lernbereitschaft;
          laufzettel.sonstiges = sonstiges;
          laufzettel.status = LAUFZETTEL_STATUS.ABGESCHLOSSEN;

          await laufzettel.save();
          parsedBody = laufzettel;
          logger.info(`✅ Laufzettel v2 ${laufzettel._id} → ABGESCHLOSSEN`);

          // Asana Subtask abschließen + Kommentar
          const mitarbeiterId = laufzettel.mitarbeiter?._id || laufzettel.mitarbeiter;
          if (mitarbeiterId) {
            const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);
            if (mitarbeiter?.asana_id) {
              const formattedDate = formatDateFromDatum(datum || laufzettel.datum);
              const taskResponse = await getTaskById(mitarbeiter.asana_id);
              const task = taskResponse?.data || taskResponse;
              const taskId = task?.gid;

              if (taskId) {
                // Subtask suchen und abschließen
                const subtaskResponse = await getSubtaskByTask(taskId);
                const subtasks = Array.isArray(subtaskResponse?.data) ? subtaskResponse.data : [];
                const matchingSubtask = subtasks.find(
                  (sub) =>
                    (sub.name?.includes(formattedDate) && sub.name?.includes(name_teamleiter)) ||
                    sub.name?.includes(formattedDate) ||
                    sub.name?.includes(name_teamleiter)
                );

                if (matchingSubtask && !matchingSubtask.completed) {
                  await completeTaskById(matchingSubtask.gid);
                  logger.info("✅ Asana Subtask marked complete");
                }

                // Kommentar erstellen
                const commentData = {
                  html_text: `<body><strong>Evaluierung erhalten</strong>\n\n${laufzettel.toHtml()}</body>`,
                };
                const commentResponse = await createStoryOnTask(task.gid, commentData);
                if (commentResponse?.data?.gid) {
                  logger.info("✅ Asana Kommentar erstellt:", commentResponse.data.gid);
                } else {
                  logger.error("❌ Fehler beim Kommentieren (Asana)");
                }
              }
            }
          }

          // Response direkt senden (kein Legacy-Flow)
          return res.status(200).json({
            success: true,
            message: "Laufzettel v2 mit Evaluierung abgeschlossen",
            document: parsedBody,
          });
        }
      }

      // ── Legacy (v1): EvaluierungMA als eigenes Dokument erstellen ──
      logger.info("📝 Legacy v1: Creating separate EvaluierungMA...");
      const mitarbeiterId = await findMitarbeiterByName(name_mitarbeiter);
      let teamleiter = await Mitarbeiter.findOne({ email });

      parsedBody = new EvaluierungMA({
        location,
        name_teamleiter,
        datum,
        kunde,
        name_mitarbeiter,
        puenktlichkeit,
        grooming,
        motivation,
        technische_fertigkeiten,
        lernbereitschaft,
        sonstiges,
        mitarbeiter: mitarbeiterId,
        teamleiter: teamleiter?.id,
        assigned: !!(mitarbeiterId && teamleiter?.id),
        laufzettel: laufzettel_id || null,
      });

      await parsedBody.save();
      logger.info(`✅ EvaluierungMA (legacy) created: ${parsedBody._id}`);

      if (mitarbeiterId) {
        logger.debug(`Assigning Evaluierung to Mitarbeiter: ${mitarbeiterId}`);
        await assignMitarbeiter(parsedBody._id, mitarbeiterId);
      }

      if (!mitarbeiterId || !teamleiter?.id) {
        logger.warn(
          `⚠️ Evaluierung could not be fully assigned. Mitarbeiter: ${!!mitarbeiterId}, Teamleiter: ${!!teamleiter?.id}`
        );
        sendMail(
          "it@straightforward.email",
          "Evaluierung konnte nicht assigned werden",
          `<h2>Neue Evaluierung eingegangen</h2>${parsedBody
            .toHtml()
            .replace(/\n/g, "<br />")}`
        );
      }

      // ✅ Asana Kommentar & Subtask abschließen (Legacy)
      if (mitarbeiterId) {
        logger.info("Processing Asana workflow for Evaluierung (legacy)...");
        const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);

        if (mitarbeiter?.asana_id) {
          const formattedDate = formatDateFromDatum(datum);
          const taskResponse = await getTaskById(mitarbeiter.asana_id);
          const task = taskResponse?.data || taskResponse;
          const taskId = task?.gid;

          if (taskId) {
            const subtaskResponse = await getSubtaskByTask(taskId);
            const subtasks = Array.isArray(subtaskResponse?.data) ? subtaskResponse.data : [];

            const matchingSubtask = subtasks.find(
              (sub) =>
                (sub.name?.includes(formattedDate) && sub.name?.includes(name_teamleiter)) ||
                sub.name?.includes(formattedDate) ||
                sub.name?.includes(name_teamleiter)
            );

            if (matchingSubtask && !matchingSubtask.completed) {
              await completeTaskById(matchingSubtask.gid);
              logger.info("✅ Asana Subtask marked complete");
            }

            const data = {
              html_text: `<body><strong>Evaluierung erhalten</strong>\n\n${parsedBody.toHtml()}</body>`,
            };
            const commentResponse = await createStoryOnTask(task.gid, data);
            if (!commentResponse?.data?.gid) {
              logger.error("❌ Fehler beim Kommentieren einer Evaluierung (Asana)");
              await sendMail(
                "it@straightforward.email",
                "❌ Fehler beim Kommentieren einer Evaluierung (Asana)",
                `<h2>Fehler beim Erstellen eines Kommentars</h2>
<p><strong>Mitarbeiter:</strong> ${name_mitarbeiter}</p>
<p><strong>Gesuchtes Datum:</strong> ${formattedDate}</p>
<pre>${JSON.stringify(commentResponse, null, 2)}</pre>`
              );
            } else {
              logger.info("✅ Asana Kommentar erstellt:", commentResponse.data.gid);
            }
          }
        }
      }

      if (teamleiter?.id) await assignTeamleiter(parsedBody._id, teamleiter.id);
    } else if (type === "verlosung") {
      logger.info("🎉 Processing Verlosung...");
      const { email, location, name_mitarbeiter, gutschein_type, gravur_type } = req.body;

      logger.debug("Verlosung data:", {
        email,
        location,
        name_mitarbeiter,
        gutschein_type,
        gravur_type,
      });

      if (!email || !name_mitarbeiter || !gutschein_type) {
        logger.warn("⚠️ Verlosung: Missing required fields");
        return res.status(400).json({
          success: false,
          error: "email, name_mitarbeiter, and gutschein_type are required",
        });
      }

      // ✅ Validate gutschein_type gegen Enum
      if (!Object.values(GUTSCHEIN_TYPES).includes(gutschein_type)) {
        logger.warn(`⚠️ Invalid gutschein_type: ${gutschein_type}`);
        return res.status(400).json({
          success: false,
          error: `Invalid gutschein_type. Must be one of: ${Object.keys(GUTSCHEIN_TYPES).join(", ")}`,
        });
      }

      // ✅ Validiere gravur_type wenn gutschein_type === GRAVUR
      if (gutschein_type === GUTSCHEIN_TYPES.GRAVUR) {
        if (!gravur_type) {
          logger.warn("⚠️ Verlosung GRAVUR: gravur_type is required");
          return res.status(400).json({
            success: false,
            error: "gravur_type is required for GRAVUR Gutscheine",
          });
        }

        // 🔄 Konvertiere gravur_type zu lowercase für Enum-Vergleich
        const normalizedGravurType = gravur_type.toLowerCase();
        if (!Object.values(GRAVUR_TYPES).includes(normalizedGravurType)) {
          logger.warn(`⚠️ Invalid gravur_type: ${gravur_type}`);
          return res.status(400).json({
            success: false,
            error: `Invalid gravur_type. Must be one of: ${Object.values(GRAVUR_TYPES).join(", ")}`,
          });
        }
      }

      // 🔍 Mitarbeiter by Email oder Name auflösen
      let mitarbeiter = await Mitarbeiter.findOne({ email });
      if (!mitarbeiter) {
        const mitarbeiterId = await findMitarbeiterByName(name_mitarbeiter);
        if (mitarbeiterId) {
          mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);
        }
      }

      // ✅ Duplikat-Prüfung: Prüfe ob Mitarbeiter bereits für diesen Gutschein-Typ teilgenommen hat
      if (mitarbeiter?.id) {
        const existingEntry = await VerlosungEintrag.findOne({
          mitarbeiter: mitarbeiter.id,
          gutschein_type,
        });

        if (existingEntry) {
          logger.warn(
            `⚠️ Duplicate Verlosung entry: ${mitarbeiter.vorname} ${mitarbeiter.nachname} has already entered ${gutschein_type}`
          );
          return res.status(409).json({
            success: false,
            error: `Mitarbeiter has already entered the ${gutschein_type} raffle. Each user can only enter once per raffle type.`,
            existingEntryId: existingEntry._id,
          });
        }
      }

      parsedBody = new VerlosungEintrag({
        email,
        location,
        name_mitarbeiter,
        gutschein_type,
        gravur_type: gutschein_type === GUTSCHEIN_TYPES.GRAVUR ? gravur_type.toLowerCase() : undefined,
        mitarbeiter: mitarbeiter?.id,
        assigned: !!mitarbeiter?.id,
      });

      await parsedBody.save();
      logger.info(`✅ VerlosungEintrag created: ${parsedBody._id}`);

      // 🎯 Suche nach passender offener Verlosung und füge Eintrag hinzu
      const matchingVerlosung = await Verlosung.findOne({
        gutschein_type,
        status: VERLOSUNG_STATUS.OFFEN,
        $and: [
          {
            $or: [
              { start_date: { $exists: false } },
              { start_date: null },
              { start_date: { $lte: new Date() } }
            ]
          },
          {
            $or: [
              { end_date: { $exists: false } },
              { end_date: null },
              { end_date: { $gte: new Date() } }
            ]
          }
        ]
      }).sort({ erstellt_am: -1 });

      if (matchingVerlosung) {
        // Prüfen ob Eintrag nicht schon in der Liste ist
        if (!matchingVerlosung.eintraege.includes(parsedBody._id)) {
          matchingVerlosung.eintraege.push(parsedBody._id);
          await matchingVerlosung.save();
          logger.info(`✅ VerlosungEintrag ${parsedBody._id} added to Verlosung ${matchingVerlosung._id} (${matchingVerlosung.titel})`);
        }
      } else {
        logger.warn(`⚠️ No matching open Verlosung found for ${gutschein_type}. VerlosungEintrag created but not linked.`);
      }

      if (mitarbeiter?.id) {
        logger.debug(`Assigning Verlosung to Mitarbeiter: ${mitarbeiter._id}`);
        await assignVerlosungEintrag(parsedBody._id, mitarbeiter.id);
      } else {
        // 📧 Benachrichtigung an IT nur wenn Zuweisung nicht klappt
        logger.warn(
          `⚠️ Verlosung could not be assigned. Mitarbeiter not found: ${name_mitarbeiter}`
        );
        await sendMail(
          "it@straightforward.email",
          "⚠️ Verlosung konnte nicht zugewiesen werden",
          `<h2>Verlosung konnte nicht automatisch zugewiesen werden</h2>
${parsedBody.toHtml().replace(/\n/g, "<br />")}`
        );
      }
    } else {
      logger.error(`Invalid document type: ${type}`);
      return res

        .status(400)

        .json({ success: false, error: "Invalid document type" });
    }

    logger.info(`✅ WPForms webhook processed successfully: ${type}`);
    res.status(201).json({
      success: true,

      message: "Document saved and assigned successfully",

      document: parsedBody,
    });
  })
);

// 📌 Assign Teamleiter & Mitarbeiter

router.post(
  "/assign",

  asyncHandler(async (req, res) => {
    const {
      documentId,
      teamleiterId,
      mitarbeiterId,
      name_teamleiter,
      name_mitarbeiter,
    } = req.body;

    if (!documentId) {
      return res
        .status(400)
        .json({ success: false, error: "Document ID is required" });
    }

    const models = [Laufzettel, EventReport, EvaluierungMA, VerlosungEintrag];

    let document = null;

    let documentType = null;

    for (const model of models) {
      document = await model.findById(documentId);

      if (document) {
        documentType = model.modelName;

        break;
      }
    }

    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    // 🔍 Mitarbeiter und Teamleiter ggf. auflösen

    let mitarbeiterResolved = mitarbeiterId;

    let teamleiterResolved = teamleiterId;

    if (!mitarbeiterResolved && name_mitarbeiter) {
      mitarbeiterResolved = await findMitarbeiterByName(name_mitarbeiter);
    }

    if (!teamleiterResolved && name_teamleiter) {
      teamleiterResolved = await findMitarbeiterByName(name_teamleiter);
    }

    if (!mitarbeiterResolved && !teamleiterResolved) {
      return res.status(400).json({
        success: false,

        error: "No valid teamleiterId or mitarbeiterId or name provided",
      });
    }

    // 🔧 Zuweisungen

    if (mitarbeiterResolved && !document.mitarbeiter) {
      await assignMitarbeiter(documentId, mitarbeiterResolved);

      document.mitarbeiter = mitarbeiterResolved;
      
      // Update name with actual name from Mitarbeiter document
      const mitarbeiterDoc = await Mitarbeiter.findById(mitarbeiterResolved);
      if (mitarbeiterDoc) {
        document.name_mitarbeiter = `${mitarbeiterDoc.vorname} ${mitarbeiterDoc.nachname}`;
        logger.debug(`Updated name_mitarbeiter to: ${document.name_mitarbeiter}`);
      }
    }

    if (teamleiterResolved && !document.teamleiter) {
      await assignTeamleiter(documentId, teamleiterResolved);

      document.teamleiter = teamleiterResolved;
      
      // Update name with actual name from Mitarbeiter document
      const teamleiterDoc = await Mitarbeiter.findById(teamleiterResolved);
      if (teamleiterDoc) {
        document.name_teamleiter = `${teamleiterDoc.vorname} ${teamleiterDoc.nachname}`;
        logger.debug(`Updated name_teamleiter to: ${document.name_teamleiter}`);
      }
    }

    // 💼 Zusätzliche Aufgaben je nach Dokumenttyp

    if (documentType === "Laufzettel") {
      const mitarbeiter = await Mitarbeiter.findById(document.mitarbeiter);

      const formattedDate = formatDateFromDatum(document.datum);

      const data = {
        name: `LZ [${formattedDate}] - TL: ${document.name_teamleiter}`,

        notes: `${document.name_mitarbeiter} hat am ${formattedDate} einen Laufzettel angefragt.`,
      };

      await createSubtasksOnTask(mitarbeiter.asana_id, data);
    }

    if (documentType === "EvaluierungMA") {
      const mitarbeiter = await Mitarbeiter.findById(document.mitarbeiter);

      if (mitarbeiter?.asana_id) {
        const formattedDate = formatDateFromDatum(document.datum);

        const task = await getTaskById(mitarbeiter.asana_id);

        const subtaskResponse = await getSubtaskByTask(task.gid);

        const subtasks = Array.isArray(subtaskResponse?.data)
          ? subtaskResponse.data
          : [];

        const matchingSubtask = subtasks.find(
          (sub) =>
            sub.name?.includes(formattedDate) &&
            sub.name?.includes(document.name_teamleiter)
        );

        if (matchingSubtask && !matchingSubtask.completed) {
          await completeTaskById(matchingSubtask.gid);
        }

        const data = {
          html_text: `<body><strong>Evaluierung erhalten</strong>\n\n${document.toHtml()}</body>`,
        };

        await createStoryOnTask(task.gid, data);
      }

      // Flip Task ggf. abschließen

      const laufzettel = await Laufzettel.findById(document.laufzettel);

      const teamleiter = await Mitarbeiter.findById(document.teamleiter);

      const flipUserId = teamleiter?.flip_id;

      if (laufzettel?.task_id && flipUserId) {
        const assignments = await getFlipTaskAssignments(laufzettel.task_id);

        const assignment = assignments.find((a) => a.user_id === flipUserId);

        if (assignment && !assignment.completed) {
          await markAssignmentAsCompleted(assignment.id);
        }
      }
    }

    await document.save();

    res.status(200).json({
      success: true,

      message: "Zuweisung und Folgeaktionen abgeschlossen",

      document,
    });
  })
);

// 📌 Test Route

router.post(
  "/test",

  asyncHandler(async (req, res) => {
    const { names } = req.body;

    if (!names || !Array.isArray(names))
      return res

        .status(400)

        .json({ success: false, error: "Invalid names array" });

    const foundNames = [];

    const notFoundNames = [];

    for (const name of names) {
      const userId = await findMitarbeiterByName(name);

      if (userId) foundNames.push({ name, userId });
      else notFoundNames.push(name);
    }

    res.status(200).json({
      success: true,

      message: "Test completed",

      foundNames,

      notFoundNames,
    });
  })
);

const formatDateFromDatum = (datum) => {
  let date;

  // Handle verschiedene Input-Formate
  if (datum instanceof Date) {
    date = datum;
  } else if (typeof datum === "string") {
    // ISO-String oder andere String-Formate
    date = new Date(datum);
  } else if (datum && typeof datum === "object" && datum.unix) {
    // Unix-Timestamp in Millisekunden
    date = new Date(datum.unix * 1000);
  } else if (typeof datum === "number") {
    // Direkt als Unix-Timestamp (Millisekunden)
    date = new Date(datum);
  } else {
    // Fallback
    date = new Date();
  }

  // Validierung
  if (isNaN(date.getTime())) {
    console.warn("⚠️ Ungültiges Datum-Format:", datum);
    date = new Date();
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

// 📌 GET - Alle Dokumente (Laufzettel, EventReport, Evaluierung)
router.get(
  "/reports",
  auth,
  asyncHandler(async (req, res) => {
    logger.debug("Fetching all reports (Laufzettel, EventReport, Evaluierung)");

    // .lean() is critical here: prevents Mongoose from applying schema defaults
    // (e.g. version: 'v2') to old documents that don't have the field in the DB.
    // Without lean(), every old Laufzettel/EventReport would appear as version 'v2'.
    const [laufzettel, eventReports, evaluierungen] = await Promise.all([
      Laufzettel.find().lean().sort({ datum: -1 }),
      EventReport.find().lean().sort({ datum: -1 }),
      EvaluierungMA.find().lean().sort({ datum: -1 }),
    ]);

    const formatDoc = (doc, type) => {
      let personen = [];
      if (doc.name_mitarbeiter) personen.push(doc.name_mitarbeiter);
      if (doc.name_teamleiter) personen.push(doc.name_teamleiter);
      
      // Remove duplicates and join
      const personenStr = [...new Set(personen)].join(", ");

      // v2 Laufzettel: Status vom Dokument, sonst assigned-basiert
      let status;
      if (doc.version === "v2" && doc.status) {
        status = doc.status; // OFFEN / ABGESCHLOSSEN
      } else {
        status = doc.assigned ? "Zugewiesen" : "Offen";
      }

      return {
        _id: doc._id,
        docType: type,
        version: doc.version || "v1",
        bezeichnung: doc.location || type,
        datum: doc.datum || doc.date,
        personen: personenStr,
        status,
        assigned: doc.assigned,
        updatedAt: doc.updatedAt, // Include for cache sync
        details: doc, // Full object for details view
      };
    };

    const allDocs = [
      ...laufzettel.map((d) => formatDoc(d, "Laufzettel")),
      ...eventReports.map((d) => formatDoc(d, "Event-Bericht")),
      ...evaluierungen.map((d) => formatDoc(d, "Evaluierung")),
    ];

    // Sort by date desc
    allDocs.sort((a, b) => new Date(b.datum) - new Date(a.datum));

    logger.info(`✅ Fetched ${allDocs.length} total documents`);

    res.status(200).json({
      success: true,
      count: allDocs.length,
      data: allDocs,
    });
  })
);

/**
 * Sync endpoint for incremental document updates
 * Returns only documents updated since the provided timestamp
 */
router.get(
  "/reports/sync",
  auth,
  asyncHandler(async (req, res) => {
    const { since } = req.query;
    
    if (!since) {
      return res.status(400).json({ 
        success: false, 
        message: "Parameter 'since' is required (ISO date string)" 
      });
    }
    
    const sinceDate = new Date(since);
    
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid date format for 'since' parameter" 
      });
    }
    
    logger.debug(`Syncing documents since ${sinceDate.toISOString()}`);
    
    // .lean() prevents schema defaults (version: 'v2') from applying to old docs
    const [laufzettel, eventReports, evaluierungen] = await Promise.all([
      Laufzettel.find({ updatedAt: { $gt: sinceDate } }).lean(),
      EventReport.find({ updatedAt: { $gt: sinceDate } }).lean(),
      EvaluierungMA.find({ updatedAt: { $gt: sinceDate } }).lean(),
    ]);

    const formatDoc = (doc, type) => {
      let personen = [];
      if (doc.name_mitarbeiter) personen.push(doc.name_mitarbeiter);
      if (doc.name_teamleiter) personen.push(doc.name_teamleiter);
      const personenStr = [...new Set(personen)].join(", ");

      let status;
      if (doc.version === "v2" && doc.status) {
        status = doc.status;
      } else {
        status = doc.assigned ? "Zugewiesen" : "Offen";
      }

      return {
        _id: doc._id,
        docType: type,
        version: doc.version || "v1",
        bezeichnung: doc.location || type,
        datum: doc.datum || doc.date,
        personen: personenStr,
        status,
        assigned: doc.assigned,
        updatedAt: doc.updatedAt,
        details: doc,
      };
    };

    const updated = [
      ...laufzettel.map((d) => formatDoc(d, "Laufzettel")),
      ...eventReports.map((d) => formatDoc(d, "Event-Bericht")),
      ...evaluierungen.map((d) => formatDoc(d, "Evaluierung")),
    ];
    
    logger.info(`✅ Sync found ${updated.length} updated documents`);

    res.status(200).json({
      success: true,
      updated,
      deleted: [],
      syncedAt: new Date().toISOString()
    });
  })
);

// 📌 GET alle Verlosungen (mit optionalem Filtering)
router.get(
  "/verlosung/all",
  asyncHandler(async (req, res) => {
    const { gutschein_type, gravur_type, assigned } = req.query;

    logger.debug("Fetching Verlosungen with filters:", {
      gutschein_type,
      gravur_type,
      assigned,
    });

    // Build filter object
    const filter = {};

    if (gutschein_type) {
      filter.gutschein_type = gutschein_type.toUpperCase();
    }

    if (gravur_type) {
      filter.gravur_type = gravur_type.toLowerCase();
    }

    if (assigned !== undefined) {
      filter.assigned = assigned === "true";
    }

    const verlosungenEintraege = await VerlosungEintrag.find(filter).populate(
      "mitarbeiter",
      "vorname nachname email"
    );

    logger.info(`✅ Fetched ${verlosungenEintraege.length} Verlosungen`);

    res.status(200).json({
      success: true,
      count: verlosungenEintraege.length,
      data: verlosungenEintraege,
    });
  })
);

// 📌 GET Verlosungen gruppiert nach Gutschein-Typ
router.get(
  "/verlosung/grouped",
  asyncHandler(async (req, res) => {
    logger.debug("Fetching Verlosungen grouped by gutschein_type");

    const verlosungenEintraege = await VerlosungEintrag.find().populate(
      "mitarbeiter",
      "vorname nachname email"
    );

    // Group by gutschein_type
    const grouped = {};

    for (const verlosungEintrag of verlosungenEintraege) {
      const type = verlosungEintrag.gutschein_type;

      if (!grouped[type]) {
        grouped[type] = {
          type,
          count: 0,
          assigned: 0,
          items: [],
        };
      }

      grouped[type].count++;

      if (verlosungEintrag.assigned) {
        grouped[type].assigned++;
      }

      grouped[type].items.push(verlosungEintrag);
    }

    logger.info(`✅ Grouped ${verlosungenEintraege.length} Verlosungen by type`);

    res.status(200).json({
      success: true,
      grouped,
    });
  })
);

// 📌 GET Verlosungen mit Gravur-Typ (für GRAVUR Gutscheine)
router.get(
  "/verlosung/gravur/overview",
  asyncHandler(async (req, res) => {
    logger.debug("Fetching Gravur Verlosungen overview");

    const gravurVerlosungen = await VerlosungEintrag.find({
      gutschein_type: GUTSCHEIN_TYPES.GRAVUR,
    }).populate("mitarbeiter", "vorname nachname email");

    // Group by gravur_type
    const grouped = {
      [GRAVUR_TYPES.CUTTERMESSER]: {
        type: GRAVUR_TYPES.CUTTERMESSER,
        count: 0,
        assigned: 0,
        items: [],
      },
      [GRAVUR_TYPES.KELLNERMESSER]: {
        type: GRAVUR_TYPES.KELLNERMESSER,
        count: 0,
        assigned: 0,
        items: [],
      },
    };

    for (const verlosungEintrag of gravurVerlosungen) {
      const gravurType = verlosungEintrag.gravur_type;

      if (grouped[gravurType]) {
        grouped[gravurType].count++;

        if (verlosungEintrag.assigned) {
          grouped[gravurType].assigned++;
        }

        grouped[gravurType].items.push(verlosungEintrag);
      }
    }

    logger.info(
      `✅ Fetched ${gravurVerlosungen.length} Gravur Verlosungen (${grouped[GRAVUR_TYPES.CUTTERMESSER].count} Cuttermesser, ${grouped[GRAVUR_TYPES.KELLNERMESSER].count} Kellnermesser)`
    );

    res.status(200).json({
      success: true,
      total: gravurVerlosungen.length,
      grouped,
    });
  })
);

// 📌 GET einzelne Verlosung nach ID
router.get(
  "/verlosung/details/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    logger.debug(`Fetching Verlosung details for ID: ${id}`);

    const verlosungEintrag = await VerlosungEintrag.findById(id).populate(
      "mitarbeiter",
      "vorname nachname email"
    );

    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    logger.info(`✅ Fetched Verlosung: ${verlosungEintrag._id}`);

    res.status(200).json({
      success: true,
      data: verlosungEintrag,
    });
  })
);

// ============================================
// 📌 VERLOSUNG MANAGEMENT ROUTES (Neue Verlosungen)
// ============================================

// 📌 POST - Neue Verlosung erstellen
router.post(
  "/verlosung/create",
  asyncHandler(async (req, res) => {
    const { 
      titel, 
      beschreibung, 
      gutschein_type, 
      gravur_type,
      start_date,
      end_date,
      anzahl_gewinner
    } = req.body;

    logger.debug("Creating Verlosung:", {
      titel,
      gutschein_type,
      gravur_type,
      anzahl_gewinner,
    });

    if (!titel || !gutschein_type) {
      logger.warn("⚠️ Verlosung: Missing required fields");
      return res.status(400).json({
        success: false,
        error: "titel and gutschein_type are required",
      });
    }

    // Validate anzahl_gewinner
    if (anzahl_gewinner && (anzahl_gewinner < 1 || !Number.isInteger(anzahl_gewinner))) {
      logger.warn(`⚠️ Invalid anzahl_gewinner: ${anzahl_gewinner}`);
      return res.status(400).json({
        success: false,
        error: "anzahl_gewinner must be a positive integer",
      });
    }

    // Validate gutschein_type
    if (!Object.values(GUTSCHEIN_TYPES).includes(gutschein_type)) {
      logger.warn(`⚠️ Invalid gutschein_type: ${gutschein_type}`);
      return res.status(400).json({
        success: false,
        error: `Invalid gutschein_type`,
      });
    }

    const verlosung = new Verlosung({
      titel,
      beschreibung,
      gutschein_type,
      gravur_type: gutschein_type === GUTSCHEIN_TYPES.GRAVUR ? gravur_type : undefined,
      start_date,
      end_date,
      anzahl_gewinner: anzahl_gewinner || 1,
    });

    await verlosung.save();
    logger.info(`✅ Verlosung created: ${verlosung._id} (${anzahl_gewinner || 1} Gewinner)`);

    res.status(201).json({
      success: true,
      message: "Verlosung erstellt",
      data: verlosung,
    });
  })
);

// 📌 GET - Alle Verlosungen mit optional Filtern
router.get(
  "/verlosung/list",
  asyncHandler(async (req, res) => {
    const { status, gutschein_type } = req.query;

    logger.debug("Fetching Verlosungen:", { status, gutschein_type });
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (gutschein_type) {
      const upperType = gutschein_type.toUpperCase();
      // Validate gutschein_type if provided
      if (!Object.values(GUTSCHEIN_TYPES).includes(upperType)) {
        logger.warn(`⚠️ Invalid gutschein_type: ${gutschein_type}`);
        return res.status(400).json({
          success: false,
          error: "Invalid gutschein_type provided",
        });
      }
      filter.gutschein_type = upperType;
    }

    const verlosungen = await Verlosung.find(filter)
      .populate("eintraege gewinner gewinner_mitarbeiter")
      .sort({ erstellt_am: -1 });

    logger.info(`✅ Fetched ${verlosungen.length} Verlosungen`);

    res.status(200).json({
      success: true,
      count: verlosungen.length,
      data: verlosungen,
    });
  })
);

// 📌 GET - Einzelne Verlosung mit Details
router.get(
  "/verlosung/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    logger.debug(`Fetching Verlosung: ${id}`);

    const verlosung = await Verlosung.findById(id).populate(
      "eintraege gewinner gewinner_mitarbeiter"
    );

    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    logger.info(`✅ Fetched Verlosung: ${id}`);

    res.status(200).json({
      success: true,
      data: verlosung,
    });
  })
);

// 📌 PUT - Verlosung schließen
router.put(
  "/verlosung/:id/close",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    logger.debug(`Closing Verlosung: ${id}`);

    const verlosung = await Verlosung.findById(id);

    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    if (verlosung.status !== VERLOSUNG_STATUS.OFFEN) {
      logger.warn(
        `⚠️ Verlosung cannot be closed. Current status: ${verlosung.status}`
      );
      return res.status(400).json({
        success: false,
        error: `Verlosung ist nicht offen (Status: ${verlosung.status})`,
      });
    }

    verlosung.status = VERLOSUNG_STATUS.GESCHLOSSEN;
    verlosung.geschlossen_am = new Date();
    await verlosung.save();

    logger.info(`✅ Verlosung closed: ${id}`);

    res.status(200).json({
      success: true,
      message: "Verlosung geschlossen",
      data: verlosung,
    });
  })
);

// 📌 POST - Gewinner ziehen
router.post(
  "/verlosung/:id/draw",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    logger.debug(`Drawing winner for Verlosung: ${id}`);

    const verlosung = await Verlosung.findById(id).populate(
      "eintraege gewinner_mitarbeiter"
    );

    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    if (verlosung.status !== VERLOSUNG_STATUS.GESCHLOSSEN) {
      logger.warn(
        `⚠️ Cannot draw winner. Verlosung status: ${verlosung.status}`
      );
      return res.status(400).json({
        success: false,
        error: `Verlosung muss geschlossen sein um Gewinner zu ziehen (Status: ${verlosung.status})`,
      });
    }

    if (!verlosung.eintraege || verlosung.eintraege.length === 0) {
      logger.warn(`⚠️ No participants for Verlosung: ${id}`);
      return res.status(400).json({
        success: false,
        error: "Keine Teilnehmer in dieser Verlosung",
      });
    }

    const anzahlGewinner = verlosung.anzahl_gewinner || 1;

    if (verlosung.eintraege.length < anzahlGewinner) {
      logger.warn(
        `⚠️ Not enough participants. Required: ${anzahlGewinner}, Available: ${verlosung.eintraege.length}`
      );
      return res.status(400).json({
        success: false,
        error: `Nicht genügend Teilnehmer. Benötigt: ${anzahlGewinner}, Verfügbar: ${verlosung.eintraege.length}`,
      });
    }

    // Zufälligen Gewinner ziehen (nur einen!)
    const randomIndex = Math.floor(Math.random() * verlosung.eintraege.length);
    const winnerEintrag = verlosung.eintraege[randomIndex];
    
    // Populate mitarbeiter to get flip_id
    await winnerEintrag.populate('mitarbeiter');
    
    const mitarbeiter = winnerEintrag.mitarbeiter;
    
    if (!mitarbeiter) {
      logger.warn(`⚠️ Winner entry has no associated Mitarbeiter: ${winnerEintrag._id}`);
      return res.status(400).json({
        success: false,
        error: "Gewinner-Eintrag hat keinen zugeordneten Mitarbeiter",
      });
    }

    // FlipUser-Daten holen, falls flip_id vorhanden
    let flipUserData = null;
    if (mitarbeiter.flip_id) {
      try {
        const { findFlipUserById } = require('../FlipService');
        flipUserData = await findFlipUserById(mitarbeiter.flip_id);
        logger.debug(`FlipUser data fetched for ${mitarbeiter.flip_id}:`, flipUserData);
      } catch (error) {
        logger.warn(`⚠️ Could not fetch FlipUser for ${mitarbeiter.flip_id}:`, error.message);
      }
    }

    logger.info(
      `🎯 Winner drawn for Verlosung ${id}: ${mitarbeiter.vorname} ${mitarbeiter.nachname} (${winnerEintrag._id})`
    );

    res.status(200).json({
      success: true,
      message: "Gewinner gezogen - Bitte bestätigen",
      gewinner: {
        eintrag_id: winnerEintrag._id,
        mitarbeiter_id: mitarbeiter._id,
        flip_id: mitarbeiter.flip_id,
        vorname: mitarbeiter.vorname,
        nachname: mitarbeiter.nachname,
        email: mitarbeiter.email,
        flip_user: flipUserData, // Vollständige FlipUser-Daten
      },
      verlosung_status: {
        bereits_gezogen: verlosung.gewinner ? 1 : 0,
        noch_zu_ziehen: anzahlGewinner - (verlosung.gewinner ? 1 : 0),
        gesamt: anzahlGewinner,
      },
    });
  })
);

// 📌 POST - Gewinner bestätigen
router.post(
  "/verlosung/:id/confirm-winner",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { eintrag_id } = req.body;

    logger.debug(`Confirming winner for Verlosung: ${id}, Eintrag: ${eintrag_id}`);
    logger.debug(`Request body:`, req.body);

    if (!eintrag_id) {
      logger.warn(`⚠️ Missing eintrag_id in request body`);
      return res.status(400).json({
        success: false,
        error: "eintrag_id is required",
      });
    }

    const verlosung = await Verlosung.findById(id);

    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    // Gewinner-Eintrag holen und validieren
    const winnerEintrag = await VerlosungEintrag.findById(eintrag_id).populate('mitarbeiter');
    
    if (!winnerEintrag) {
      return res.status(404).json({
        success: false,
        error: "Gewinner-Eintrag nicht gefunden",
      });
    }

    // Prüfen ob dieser Eintrag zur Verlosung gehört
    const eintragBelongsToVerlosung = verlosung.eintraege.some(e => {
      const eId = e._id ? e._id.toString() : e.toString();
      return eId === eintrag_id.toString();
    });
    
    if (!eintragBelongsToVerlosung) {
      logger.warn(`⚠️ Eintrag ${eintrag_id} gehört nicht zu Verlosung ${id}`);
      logger.debug(`Verlosung eintraege:`, verlosung.eintraege.map(e => e.toString ? e.toString() : e));
      return res.status(400).json({
        success: false,
        error: "Dieser Eintrag gehört nicht zu dieser Verlosung",
      });
    }

    const anzahlGewinner = verlosung.anzahl_gewinner || 1;
    
    // Initialisiere gewinner_liste falls noch nicht vorhanden
    if (!verlosung.gewinner_liste) {
      verlosung.gewinner_liste = [];
    }

    // Prüfen ob bereits genug Gewinner bestätigt wurden
    if (verlosung.gewinner_liste.length >= anzahlGewinner) {
      return res.status(400).json({
        success: false,
        error: "Alle Gewinner wurden bereits gezogen",
      });
    }

    // Gewinner zur Liste hinzufügen
    verlosung.gewinner_liste.push({
      eintrag: winnerEintrag._id,
      mitarbeiter: winnerEintrag.mitarbeiter._id,
      bestaetigt_am: new Date(),
    });

    // Beim ersten Gewinner auch das alte Feld setzen (backwards compatibility)
    if (verlosung.gewinner_liste.length === 1) {
      verlosung.gewinner = winnerEintrag._id;
      verlosung.gewinner_mitarbeiter = winnerEintrag.mitarbeiter._id;
    }

    // Status auf ABGESCHLOSSEN setzen, wenn alle Gewinner gezogen wurden
    if (verlosung.gewinner_liste.length >= anzahlGewinner) {
      verlosung.status = VERLOSUNG_STATUS.ABGESCHLOSSEN;
      verlosung.abgeschlossen_am = new Date();
    }

    await verlosung.save();

    const populatedVerlosung = await Verlosung.findById(id)
      .populate('eintraege gewinner gewinner_mitarbeiter')
      .populate({
        path: 'gewinner_liste.eintrag',
        select: '-__v',
      })
      .populate({
        path: 'gewinner_liste.mitarbeiter',
        select: 'vorname nachname email flip_id',
      });

    logger.info(
      `✅ Winner confirmed for Verlosung ${id}: ${winnerEintrag.mitarbeiter.vorname} ${winnerEintrag.mitarbeiter.nachname} (${verlosung.gewinner_liste.length}/${anzahlGewinner})`
    );

    res.status(200).json({
      success: true,
      message: verlosung.gewinner_liste.length >= anzahlGewinner 
        ? "Alle Gewinner bestätigt - Verlosung abgeschlossen!"
        : `Gewinner ${verlosung.gewinner_liste.length}/${anzahlGewinner} bestätigt`,
      verlosung_abgeschlossen: verlosung.gewinner_liste.length >= anzahlGewinner,
      gewinner_bestaetigt: {
        vorname: winnerEintrag.mitarbeiter.vorname,
        nachname: winnerEintrag.mitarbeiter.nachname,
      },
      verlosung_status: {
        bereits_gezogen: verlosung.gewinner_liste.length,
        noch_zu_ziehen: anzahlGewinner - verlosung.gewinner_liste.length,
        gesamt: anzahlGewinner,
      },
      data: populatedVerlosung,
    });
  })
);

// 📌 DELETE - Verlosung löschen
router.delete(
  "/verlosung/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    logger.debug(`Deleting Verlosung: ${id}`);

    const { Verlosung } = require("../models/Classes/FlipDocs");

    // Erst die Verlosung holen, um die Einträge zu kennen
    const verlosung = await Verlosung.findById(id);

    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    // Alle zugehörigen VerlosungEinträge löschen
    if (verlosung.eintraege && verlosung.eintraege.length > 0) {
      const eintragIds = verlosung.eintraege.map(e => e._id ? e._id : e);
      const deleteResult = await VerlosungEintrag.deleteMany({
        _id: { $in: eintragIds }
      });
      logger.info(`🗑️ Deleted ${deleteResult.deletedCount} VerlosungEinträge for Verlosung ${id}`);
    }

    // Jetzt die Verlosung löschen
    await Verlosung.findByIdAndDelete(id);

    logger.info(`✅ Verlosung deleted: ${id} (including ${verlosung.eintraege?.length || 0} entries)`);

    res.status(200).json({
      success: true,
      message: "Verlosung und alle Einträge gelöscht",
      deleted_entries: verlosung.eintraege?.length || 0,
    });
  })
);

// 📌 GET Verlosungen eines spezifischen Typs mit Statistiken (MUST BE LAST for /verlosung/:gutschein_type to not shadow /verlosung/list)
router.get(
  "/verlosung/:gutschein_type",
  asyncHandler(async (req, res) => {
    const { gutschein_type } = req.params;
    const normalizedType = gutschein_type.toUpperCase();

    logger.debug(`Fetching Verlosungen of type: ${normalizedType}`);

    // Validate gutschein_type
    if (!Object.values(GUTSCHEIN_TYPES).includes(normalizedType)) {
      logger.warn(`⚠️ Invalid gutschein_type: ${normalizedType}`);
      return res.status(400).json({
        success: false,
        error: `Invalid gutschein_type. Must be one of: ${Object.keys(
          GUTSCHEIN_TYPES
        ).join(", ")}`,
      });
    }

    const verlosungenEintraege = await VerlosungEintrag.find({
      gutschein_type: normalizedType,
    }).populate("mitarbeiter", "vorname nachname email");

    const assigned = verlosungenEintraege.filter((v) => v.assigned).length;
    const notAssigned = verlosungenEintraege.length - assigned;

    logger.info(`✅ Fetched ${verlosungenEintraege.length} ${normalizedType} Verlosungen`);

    res.status(200).json({
      success: true,
      type: normalizedType,
      statistics: {
        total: verlosungenEintraege.length,
        assigned,
        notAssigned,
        assignedPercentage:
          verlosungenEintraege.length > 0
            ? ((assigned / verlosungenEintraege.length) * 100).toFixed(2)
            : "0",
      },
      data: verlosungenEintraege,
    });
  })
);

// ============================================
// 📌 MIGRATION: Laufzettel v1 → v2
// Mergt alte EvaluierungMA-Dokumente in die zugehörigen Laufzettel
// und konvertiert sie in das v2-Format.
//
// Stufe 1: EvaluierungMA mit direkter laufzettel-Referenz
// Stufe 2: Fuzzy-Match via mitarbeiter + teamleiter + datum (±24h)
//
// Query-Params:
//   ?dry_run=true  → nur analysieren, nichts speichern
// ============================================
router.post(
  "/migrate/v1-to-v2",
  auth,
  asyncHandler(async (req, res) => {
    const dryRun = req.query.dry_run === "true";
    logger.info(`🔄 Migration v1→v2 gestartet (dry_run=${dryRun})`);

    const results = {
      dry_run: dryRun,
      stage1: { matched: 0, skipped_already_v2: 0, laufzettel_not_found: 0, items: [] },
      stage2: { matched: 0, no_match: 0, items: [] },
      unmatched_evaluierungen: [],
    };

    // ──────────────────────────────────────────────────
    // STUFE 1: EvaluierungMA mit direkter Laufzettel-Ref
    // ──────────────────────────────────────────────────
    const evalWithRef = await EvaluierungMA.find({
      laufzettel: { $exists: true, $ne: null },
    }).lean();

    logger.info(`📋 Stufe 1: ${evalWithRef.length} Evaluierungen mit laufzettel-Referenz gefunden`);

    const migratedLaufzettelIds = new Set();

    for (const ev of evalWithRef) {
      const laufzettelId = ev.laufzettel?._id || ev.laufzettel;
      const lz = await Laufzettel.findById(laufzettelId).lean();

      if (!lz) {
        logger.warn(`⚠️ Laufzettel ${laufzettelId} nicht gefunden (EvaluierungMA: ${ev._id})`);
        results.stage1.laufzettel_not_found++;
        results.stage1.items.push({
          evaluierung_id: ev._id,
          laufzettel_id: laufzettelId,
          reason: "laufzettel_not_found",
        });
        continue;
      }

      if (lz.version === "v2") {
        logger.debug(`⏭️ Laufzettel ${lz._id} ist bereits v2 – übersprungen`);
        results.stage1.skipped_already_v2++;
        results.stage1.items.push({
          evaluierung_id: ev._id,
          laufzettel_id: lz._id,
          reason: "already_v2",
        });
        migratedLaufzettelIds.add(lz._id.toString());
        continue;
      }

      results.stage1.matched++;
      migratedLaufzettelIds.add(lz._id.toString());
      results.stage1.items.push({
        evaluierung_id: ev._id,
        laufzettel_id: lz._id,
        reason: "migrated",
      });

      if (!dryRun) {
        await Laufzettel.findByIdAndUpdate(lz._id, {
          $set: {
            version: "v2",
            status: LAUFZETTEL_STATUS.ABGESCHLOSSEN,
            kunde: ev.kunde,
            puenktlichkeit: ev.puenktlichkeit,
            grooming: ev.grooming,
            motivation: ev.motivation,
            technische_fertigkeiten: ev.technische_fertigkeiten,
            lernbereitschaft: ev.lernbereitschaft,
            sonstiges: ev.sonstiges,
            // Referenzen aus Evaluierung übernehmen falls im Laufzettel leer
            ...((!lz.mitarbeiter && ev.mitarbeiter) && { mitarbeiter: ev.mitarbeiter }),
            ...((!lz.teamleiter && ev.teamleiter) && { teamleiter: ev.teamleiter }),
          },
        });
        logger.info(`✅ Stufe 1: Laufzettel ${lz._id} → v2 (EvaluierungMA: ${ev._id})`);
      } else {
        logger.info(`[DRY RUN] Stufe 1: Laufzettel ${lz._id} würde → v2`);
      }
    }

    // ──────────────────────────────────────────────────
    // STUFE 2: Fuzzy-Match (kein laufzettel-Ref)
    // Matching via mitarbeiter + teamleiter + datum (±24h)
    // ──────────────────────────────────────────────────
    const evalWithoutRef = await EvaluierungMA.find({
      $or: [
        { laufzettel: { $exists: false } },
        { laufzettel: null },
      ],
    }).lean();

    logger.info(`📋 Stufe 2: ${evalWithoutRef.length} Evaluierungen ohne laufzettel-Referenz`);

    for (const ev of evalWithoutRef) {
      const mitarbeiterId = ev.mitarbeiter?._id || ev.mitarbeiter;
      const teamleiterId = ev.teamleiter?._id || ev.teamleiter;
      const datum = ev.datum ? new Date(ev.datum) : null;

      // Fuzzy-Match benötigt mindestens eine Personen-Referenz + Datum
      if (!datum || (!mitarbeiterId && !teamleiterId)) {
        logger.debug(`⏭️ EvaluierungMA ${ev._id}: nicht genug Infos für Fuzzy-Match`);
        results.stage2.no_match++;
        results.unmatched_evaluierungen.push({ evaluierung_id: ev._id, reason: "insufficient_data" });
        continue;
      }

      // ±24h Fenster um das Datum
      const dayStart = new Date(datum);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(datum);
      dayEnd.setHours(23, 59, 59, 999);

      const query = {
        datum: { $gte: dayStart, $lte: dayEnd },
        version: { $ne: "v2" },
      };
      if (mitarbeiterId) query.mitarbeiter = mitarbeiterId;
      if (teamleiterId) query.teamleiter = teamleiterId;

      // Namen-Fallback falls keine ObjectId-Refs vorhanden
      if (!mitarbeiterId && ev.name_mitarbeiter) {
        query.name_mitarbeiter = { $regex: new RegExp(ev.name_mitarbeiter.trim(), "i") };
      }
      if (!teamleiterId && ev.name_teamleiter) {
        query.name_teamleiter = { $regex: new RegExp(ev.name_teamleiter.trim(), "i") };
      }

      const candidates = await Laufzettel.find(query).lean();

      // Noch nicht durch Stufe 1 migrierte Kandidaten bevorzugen
      const notYetMigrated = candidates.filter((c) => !migratedLaufzettelIds.has(c._id.toString()));
      const candidate = notYetMigrated[0] || candidates[0];

      if (!candidate) {
        logger.debug(`❌ Stufe 2: Kein Match für EvaluierungMA ${ev._id}`);
        results.stage2.no_match++;
        results.unmatched_evaluierungen.push({
          evaluierung_id: ev._id,
          name_mitarbeiter: ev.name_mitarbeiter,
          name_teamleiter: ev.name_teamleiter,
          datum: ev.datum,
          reason: "no_laufzettel_match",
        });
        continue;
      }

      results.stage2.matched++;
      migratedLaufzettelIds.add(candidate._id.toString());
      results.stage2.items.push({
        evaluierung_id: ev._id,
        laufzettel_id: candidate._id,
        match_basis: {
          mitarbeiter: !!mitarbeiterId,
          teamleiter: !!teamleiterId,
          datum: datum.toISOString(),
        },
      });

      if (!dryRun) {
        await Laufzettel.findByIdAndUpdate(candidate._id, {
          $set: {
            version: "v2",
            status: LAUFZETTEL_STATUS.ABGESCHLOSSEN,
            kunde: ev.kunde,
            puenktlichkeit: ev.puenktlichkeit,
            grooming: ev.grooming,
            motivation: ev.motivation,
            technische_fertigkeiten: ev.technische_fertigkeiten,
            lernbereitschaft: ev.lernbereitschaft,
            sonstiges: ev.sonstiges,
            ...((!candidate.mitarbeiter && mitarbeiterId) && { mitarbeiter: mitarbeiterId }),
            ...((!candidate.teamleiter && teamleiterId) && { teamleiter: teamleiterId }),
          },
        });
        logger.info(
          `✅ Stufe 2: Laufzettel ${candidate._id} → v2 (via Fuzzy-Match, EvaluierungMA: ${ev._id})`
        );
      } else {
        logger.info(`[DRY RUN] Stufe 2: Laufzettel ${candidate._id} würde → v2`);
      }
    }

    const summary = {
      stage1_migrated: results.stage1.matched,
      stage1_already_v2: results.stage1.skipped_already_v2,
      stage1_not_found: results.stage1.laufzettel_not_found,
      stage2_matched: results.stage2.matched,
      stage2_no_match: results.stage2.no_match,
      total_migrated: results.stage1.matched + results.stage2.matched,
      unmatched_count: results.unmatched_evaluierungen.length,
    };

    logger.info(`✅ Migration abgeschlossen:`, summary);

    res.status(200).json({
      success: true,
      dry_run: dryRun,
      summary,
      details: results,
    });
  })
);

// 📌 POST - Test-Teilnehmer zu Verlosung hinzufügen
router.post(
  "/verlosung/:id/add-test-participants",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { mitarbeiter_ids, count = 50 } = req.body;

    logger.debug(`Adding test participants to Verlosung ${id}`, { count });

    // Verlosung suchen
    const verlosung = await Verlosung.findById(id);
    if (!verlosung) {
      logger.warn(`⚠️ Verlosung not found: ${id}`);
      return res.status(404).json({
        success: false,
        error: "Verlosung not found",
      });
    }

    // Mitarbeiter laden
    let mitarbeiterToAdd;
    if (mitarbeiter_ids && mitarbeiter_ids.length > 0) {
      // Spezifische Mitarbeiter
      mitarbeiterToAdd = await Mitarbeiter.find({ _id: { $in: mitarbeiter_ids } });
    } else {
      // Zufällige Mitarbeiter mit flip_id
      const allMitarbeiter = await Mitarbeiter.find({ flip_id: { $exists: true, $ne: null } });
      
      if (allMitarbeiter.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Keine Mitarbeiter mit Flip-ID gefunden",
        });
      }

      // Shuffle und nimm die ersten N
      const shuffled = allMitarbeiter.sort(() => Math.random() - 0.5);
      mitarbeiterToAdd = shuffled.slice(0, Math.min(count, shuffled.length));
    }

    logger.debug(`Found ${mitarbeiterToAdd.length} Mitarbeiter to add`);

    // Erstelle Einträge für jeden Mitarbeiter
    const createdEntries = [];
    for (const ma of mitarbeiterToAdd) {
      // Prüfe ob bereits ein Eintrag für diesen Mitarbeiter existiert
      const existing = await VerlosungEintrag.findOne({
        gutschein_type: verlosung.gutschein_type,
        gravur_type: verlosung.gravur_type || undefined,
        mitarbeiter: ma._id,
      });

      if (existing) {
        logger.debug(`VerlosungEintrag already exists for Mitarbeiter ${ma._id}`);
        // Wenn noch nicht in Verlosung, hinzufügen
        if (!verlosung.eintraege.includes(existing._id)) {
          verlosung.eintraege.push(existing._id);
          createdEntries.push(existing);
        }
        continue;
      }

      // Neuen Eintrag erstellen
      const eintrag = new VerlosungEintrag({
        name_mitarbeiter: `${ma.vorname} ${ma.nachname}`,
        email: ma.email || `${ma.vorname}.${ma.nachname}@test.de`.toLowerCase(),
        location: ma.standort || 'Hamburg',
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Letzten 30 Tage
        gutschein_type: verlosung.gutschein_type,
        gravur_type: verlosung.gravur_type,
        mitarbeiter: ma._id,
        assigned: true,
      });

      await eintrag.save();
      logger.info(`✅ Test VerlosungEintrag created: ${eintrag._id} for ${ma.vorname} ${ma.nachname}`);

      // Zur Verlosung hinzufügen
      verlosung.eintraege.push(eintrag._id);
      createdEntries.push(eintrag);
    }

    // Verlosung speichern
    await verlosung.save();

    logger.info(`✅ ${createdEntries.length} Test-Teilnehmer zu Verlosung ${id} hinzugefügt`);

    res.status(200).json({
      success: true,
      message: `${createdEntries.length} Test-Teilnehmer hinzugefügt`,
      count: createdEntries.length,
      verlosung_id: verlosung._id,
      total_eintraege: verlosung.eintraege.length,
    });
  })
);

module.exports = router;
