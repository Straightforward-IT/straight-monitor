const express = require("express");
const router = express.Router();
const {
  Laufzettel,
  EventReport,
  EvaluierungMA,
} = require("../models/FlipDocs");
const { sendMail } = require("../EmailService"); // Ensure sendMail is properly imported

const Mitarbeiter = require("../models/Mitarbeiter");
const {
  findMitarbeiterByName,
  assignTeamleiter,
  assignMitarbeiter,
  assignTeamleiterUndMitarbeiter,
  getFlipTaskAssignments,
  markAssignmentAsCompleted,
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
    let parsedBody;

    if (!type) {
      return res
        .status(400)
        .json({ success: false, error: "Document type is required" });
    }

    if (type === "laufzettel") {
      const { location, name_mitarbeiter, name_teamleiter, datum } = req.body;

      const mitarbeiterId = await findMitarbeiterByName(name_mitarbeiter);
      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

      parsedBody = new Laufzettel({
        location,
        name_mitarbeiter,
        name_teamleiter,
        datum,
        mitarbeiter: mitarbeiterId,
        teamleiter: teamleiterId,
        assigned: !!(mitarbeiterId && teamleiterId),
      });

      await parsedBody.save();

      if (mitarbeiterId) {
        let formattedDate = formatDateFromDatum(datum);
        await assignMitarbeiter(parsedBody._id, mitarbeiterId);
        let data = {
          name: `LZ [${formattedDate}] - TL: ${name_teamleiter}`,
          notes: `${name_mitarbeiter} hat am ${formattedDate} einen Laufzettel angefragt. Teamleiter: ${name_teamleiter}`,
        };
        let mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);
        createSubtasksOnTask(mitarbeiter.asana_id, data);
      }
      if (teamleiterId) {
        const task = await assignTeamleiter(parsedBody._id, teamleiterId);
        if (task?.id) {
          parsedBody.task_id = task.id;
          await parsedBody.save();
        }
      }
    } else if (type === "event_report") {
      const {
        location,
        name_teamleiter,
        datum,
        kunde,
        puenktlichkeit,
        erscheinungsbild,
        team,
        mitarbeiter_job,
        feedback_auftraggeber,
        sonstiges,
      } = req.body;

      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

      parsedBody = new EventReport({
        location,
        name_teamleiter,
        datum,
        kunde,
        puenktlichkeit,
        erscheinungsbild,
        team,
        mitarbeiter_job,
        feedback_auftraggeber,
        sonstiges,
        teamleiter: teamleiterId,
        assigned: !!teamleiterId,
      });

      await parsedBody.save();
      if (teamleiterId) await assignTeamleiter(parsedBody._id, teamleiterId);
    } else if (type === "evaluierung") {
      const {
        location,
        laufzettel_id,
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
      } = req.body;

      const mitarbeiterId = await findMitarbeiterByName(name_mitarbeiter);
      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

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
        teamleiter: teamleiterId,
        assigned: !!(mitarbeiterId && teamleiterId),
        laufzettel: laufzettel_id || null,
      });

      await parsedBody.save();

      if (mitarbeiterId) {
        await assignMitarbeiter(parsedBody._id, mitarbeiterId);
      }

      /*
      // ✅ Flip assignment abschließen
      if (laufzettel_id && teamleiterId) {
        const laufzettel = await Laufzettel.findById(laufzettel_id);
        const teamleiter = await Mitarbeiter.findById(teamleiterId);
        const flipUserId = teamleiter?.flip_id;

        if (laufzettel?.task_id && flipUserId) {
          const assignments = await getFlipTaskAssignments(laufzettel.task_id);
          const assignment = assignments.find((a) => a.user_id === flipUserId);

          if (assignment && !assignment.completed) {
            await markAssignmentAsCompleted(assignment.id);
            console.log("✅ Flip Assignment marked as complete");
          } else {
            console.log("ℹ️ Assignment already completed or not found");
          }
        } else {
          console.log("⚠️ Kein Flip Task oder kein FlipUserId vorhanden");
        }
      }
*/

      // ✅ Asana Kommentar & Subtask abschließen
      if (mitarbeiterId) {
        const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);

        if (mitarbeiter?.asana_id) {
          const formattedDate = formatDateFromDatum(datum);
          const task = await getTaskById(mitarbeiter.asana_id);
          const subtaskResponse = await getSubtaskByTask(task.gid);
          const subtasks = Array.isArray(subtaskResponse?.data)
            ? subtaskResponse.data
            : [];

          const matchingSubtask = subtasks.find(
            (sub) =>
              (sub.name?.includes(formattedDate) &&
                sub.name?.includes(name_teamleiter)) ||
              sub.name?.includes(formattedDate) ||
              sub.name?.includes(name_teamleiter)
          );

          if (matchingSubtask) {
            if (!matchingSubtask.completed) {
              await completeTaskById(matchingSubtask.gid);
              console.log("✅ Asana Subtask marked complete");
            } else {
              console.log("ℹ️ Asana Subtask already completed");
            }
          } else {
            console.log("⚠️ No matching Asana Subtask found");
          }

          const data = {
            html_text: `<body><strong>Evaluierung erhalten</strong>\n\n${parsedBody.toHtml()}</body>`,
          };

          const commentResponse = await createStoryOnTask(task.gid, data);

          if (!commentResponse || !commentResponse.data?.gid) {
            console.log("📝 Kommentar Antwort Asana:", commentResponse);
            await sendMail(
              "it@straightforward.email",
              "❌ Fehler beim Kommentieren einer Evaluierung (Asana)",
              `
            <h2>Fehler beim Erstellen eines Kommentars</h2>
            <p><strong>Mitarbeiter:</strong> ${name_mitarbeiter}</p>
            <p><strong>Gesuchtes Datum:</strong> ${formattedDate}</p>
            <p><strong>Zieltask:</strong> ${task.gid}</p>
            <p><strong>Gefundener Subtask:</strong> ${
              matchingSubtask?.name || "Keiner"
            }</p>
            <pre>${JSON.stringify(commentResponse, null, 2)}</pre>
          `
            );
          } else {
            console.log("✅ Asana Kommentar erstellt:", commentResponse.gid);
          }
        }
      }

      if (teamleiterId) await assignTeamleiter(parsedBody._id, teamleiterId);
    } else {
      return res
        .status(400)
        .json({ success: false, error: "Invalid document type" });
    }

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
    const { documentId, teamleiterId, mitarbeiterId } = req.body;
    if (!documentId)
      return res
        .status(400)
        .json({ success: false, error: "Document ID is required" });

    let documentFound = null;
    const models = [Laufzettel, EventReport, EvaluierungMA];

    for (const model of models) {
      documentFound = await model.findById(documentId);
      if (documentFound) break;
    }

    if (!documentFound)
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    if (!teamleiterId && !mitarbeiterId) return res.status(400).json({ suc });
    if (teamleiterId) {
      await assignTeamleiter(documentId, teamleiterId);
    }
    if (mitarbeiterId) {
      await assignMitarbeiter(documentId, mitarbeiterId);
    }

    res.status(200).json({
      success: true,
      message: "Assignment successful",
      document: documentFound,
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
  const date = new Date(datum.unix * 1000); // Unix-Timestamp → ms

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

module.exports = router;
