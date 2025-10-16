const express = require("express");

const router = express.Router();

const {
  Laufzettel,

  EventReport,

  EvaluierungMA,
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
  const { location, name_mitarbeiter, name_teamleiter, email, datum } = req.body;

  let mitarbeiter = await Mitarbeiter.findOne({ email });
  const teamleiterId = await findMitarbeiterByName(name_teamleiter);

  parsedBody = new Laufzettel({
    location,
    name_mitarbeiter,
    name_teamleiter,
    datum,
    mitarbeiter: mitarbeiter?.id,
    teamleiter: teamleiterId,
    assigned: !!(mitarbeiter?.id && teamleiterId),
  });

  await parsedBody.save();

  if (mitarbeiter?.id) {
    await assignMitarbeiter(parsedBody._id, mitarbeiter.id);
    
    let formattedDate = formatDateFromDatum(datum);
    const data = {
      name: `LZ [${formattedDate}] - TL: ${name_teamleiter}`,
      notes: `${name_mitarbeiter} hat am ${formattedDate} einen Laufzettel angefragt. Teamleiter: ${name_teamleiter}`,
    };

    if (mitarbeiter.asana_id) {
      try {
        await createSubtasksOnTask(mitarbeiter.asana_id, data);
      } catch (err) {
        console.error("❌ Fehler beim Erstellen des Subtasks:", err.message);
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

  if (teamleiterId) {
    const task = await assignTeamleiter(parsedBody._id, teamleiterId);
    if (task?.id) {
      parsedBody.task_id = task.id;
      await parsedBody.save();
    }
  }

  if (!teamleiterId || !mitarbeiter) {
    await sendMail(
      "it@straightforward.email",
      "Laufzettel konnte nicht assigned werden",
      `<h2>Laufzettel konnte nicht automatisch zugewiesen werden</h2>${parsedBody
        .toHtml()
        .replace(/\n/g, "<br />")}`
    );
  }
} else if (type === "event_report") {
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

        feedback_auftraggeber,

        sonstiges,
      } = req.body;

      let teamleiter = await Mitarbeiter.findOne({ email });

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

        teamleiter: teamleiter?._id,

        assigned: !!teamleiter,
      });

      await parsedBody.save();

      if (!teamleiter) {
        sendMail(
          "it@straightforward.email",

          "Eventreport konnte nicht assigned werden",

          `<h2>Neuer Eventreport eingegangen</h2>${parsedBody

            .toHtml()

            .replace(/\n/g, "<br />")}`
        );
      } else {
        await assignTeamleiter(parsedBody._id, teamleiter._id);
      }
    } else if (type === "evaluierung") {
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

      if (mitarbeiterId) {
        await assignMitarbeiter(parsedBody._id, mitarbeiterId);
      }

      if (!mitarbeiterId || !teamleiter?.id) {
        sendMail(
          "it@straightforward.email",

          "Evaluierung konnte nicht assigned werden",

          `<h2>Neue Evaluierung eingegangen</h2>${parsedBody

            .toHtml()

            .replace(/\n/g, "<br />")}`
        );
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

          const taskResponse = await getTaskById(mitarbeiter.asana_id);

          const task = taskResponse?.data || taskResponse; // fallback if data exists

          const taskId = task?.gid;

          if (!taskId) {
            console.warn(
              "⚠️ Kein gültiger Asana Task gefunden für",

              mitarbeiter.asana_id
            );

            return;
          }

          const subtaskResponse = await getSubtaskByTask(taskId);

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

<p><strong>Gefundener Subtask:</strong> ${matchingSubtask?.name || "Keiner"}</p>

<pre>${JSON.stringify(commentResponse, null, 2)}</pre>

`
            );
          } else {
            console.log("✅ Asana Kommentar erstellt:", commentResponse.gid);
          }
        }
      }

      if (teamleiter?.id) await assignTeamleiter(parsedBody._id, teamleiter.id);
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

    const models = [Laufzettel, EventReport, EvaluierungMA];

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
    }

    if (teamleiterResolved && !document.teamleiter) {
      await assignTeamleiter(documentId, teamleiterResolved);

      document.teamleiter = teamleiterResolved;
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
  const date = new Date(datum.unix * 1000); // Unix-Timestamp → ms

  const day = date.getDate().toString().padStart(2, "0");

  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

module.exports = router;
