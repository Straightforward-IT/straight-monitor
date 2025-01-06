const express = require("express");
const router = express.Router();
const { Laufzettel, EventReport, EvaluierungMA } = require("../models/FlipDocs");
const { findFlipUserByName, findMitarbeiterByName, assignTeamleiter, assignMitarbeiter, assignTeamleiterUndMitarbeiter } = require("../FlipService");
const Mitarbeiter = require("../models/Mitarbeiter");


router.post("/send", async (req, res) => {
    try {
        const type = req.headers["document-type"];

        let parsedBody;
        if (type === "laufzettel") {
            const { location, name_mitarbeiter, bogenNr, name_teamleiter, datum } = req.body;

            const mitarbeiterId = await findMitarbeiterByName(name_mitarbeiter);
            const teamleiterId = await findMitarbeiterByName(name_teamleiter);

            parsedBody = new Laufzettel({
                location,
                name_mitarbeiter,
                bogenNr,
                name_teamleiter,
                datum,
                mitarbeiter: mitarbeiterId,
                teamleiter: teamleiterId,
                assigned: !!(mitarbeiterId && teamleiterId),
            });
            await parsedBody.save();

            if (mitarbeiterId) {
                await assignMitarbeiter(parsedBody._id, mitarbeiterId);
            }

            if (teamleiterId) {
                await assignTeamleiter(parsedBody._id, teamleiterId);
            }
        } else if (type === "event_report") {
            const { location, name_teamleiter, datum, kunde, puenktlichkeit, erscheinungsbild, team, mitarbeiter_job, feedback_auftraggeber, sonstiges } = req.body;

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

            if (teamleiterId) {
                console.log("entered");
                await assignTeamleiter(parsedBody._id, teamleiterId);
               
            }
        } else if (type === "evaluierung") {
            const { location, name_teamleiter, datum, kunde, name_mitarbeiter, puenktlichkeit, grooming, motivation, technische_fertigkeiten, lernbereitschaft, sonstiges } = req.body;

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
            });
            await parsedBody.save();

            if (mitarbeiterId) {
                await assignMitarbeiter(parsedBody._id, mitarbeiterId);
            }

            if (teamleiterId) {
                await assignTeamleiter(parsedBody._id, teamleiterId);
            }
        } else {
            return res.status(400).json({ error: "Invalid document type" });
        }

        res.status(201).json({ message: "Document saved and assigned successfully", document: parsedBody });
    } catch (err) {
        console.error("Error processing request:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Manual assign route
router.post("/assign", async (req, res) => {
    try {
        const { documentId, teamleiterId, mitarbeiterId } = req.body;

        if (!documentId) {
            return res.status(400).json({ error: "Document ID is required" });
        }

        let documentFound = null;
        const models = [Laufzettel, EventReport, EvaluierungMA];

        // Find the document in one of the models
        for (const model of models) {
            documentFound = await model.findById(documentId);
            if (documentFound) break;
        }

        if (!documentFound) {
            return res.status(404).json({ error: "Document not found" });
        }

        // Assign teamleiter and/or mitarbeiter
        if (teamleiterId && mitarbeiterId) {
            await assignTeamleiterUndMitarbeiter(documentId, teamleiterId, mitarbeiterId);
        } else if (teamleiterId) {
            await assignTeamleiter(documentId, teamleiterId);
        } else if (mitarbeiterId) {
            await assignMitarbeiter(documentId, mitarbeiterId);
        } else {
            return res.status(400).json({ error: "At least one of teamleiterId or mitarbeiterId is required" });
        }

        // Update Mitarbeiter references
        if (mitarbeiterId) {
            const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);
            if (mitarbeiter) {
                const monthKey = new Date().toLocaleString('default', { month: 'long' });
                const yearKey = new Date().getFullYear();

                // Ensure the year exists
                let year = mitarbeiter.dokumente.find(y => y.jahr === yearKey);
                if (!year) {
                    year = { jahr: yearKey, monate: {} };
                    mitarbeiter.dokumente.push(year);
                }

                // Ensure the month exists
                const month = year.monate[monthKey] || {
                    laufzettel_received: [],
                    laufzettel_submitted: [],
                    eventreports: [],
                    evaluierungen_received: [],
                    evaluierungen_submitted: []
                };

                // Add the document reference
                if (documentFound instanceof Laufzettel) {
                    month.laufzettel_received.push(documentFound._id);
                } else if (documentFound instanceof EventReport) {
                    month.eventreports.push(documentFound._id);
                } else if (documentFound instanceof EvaluierungMA) {
                    month.evaluierungen_received.push(documentFound._id);
                }

                year.monate[monthKey] = month;
                await mitarbeiter.save();
            }
        }

        res.status(200).json({ message: "Assignment successful", document: documentFound });
    } catch (error) {
        console.error("Error during manual assignment:", error);
        res.status(500).json({ error: "Failed to assign teamleiter or mitarbeiter" });
    }
});


router.post("/test", async (req, res) => {
  try {
      const names = req.body.names; 
      
      const foundNames = [];
      const notFoundNames = [];

      for (const name of names) {
          const userId = await findFlipUserByName(name);
          if (userId) {
              foundNames.push({ name, userId });
          } else {
              notFoundNames.push(name);
          }
      }

      res.status(200).json({
          message: "Test completed",
          foundNames,
          notFoundNames,
      });
  } catch (error) {
      console.error("Error during /test route:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;