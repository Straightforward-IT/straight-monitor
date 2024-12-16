const express = require("express");
const router = express.Router();
const { Laufzettel, EventReport, EvaluierungMA } = require("../models/FlipDocs");
const { findFlipUserByName } = require("../FlipService");

router.post("/send", async (req, res) => {
    try {
        const type = req.headers["document-type"];

        
        let parsedBody;
        if (type === "laufzettel") {
            const { location, name, bogenNr, name_teamleiter, datum } = req.body;

            const mitarbeiterId = await findFlipUserByName(name);
            const teamleiterId = await findFlipUserByName(name_teamleiter);

            parsedBody = new Laufzettel({
                location,
                name,
                bogenNr,
                name_teamleiter,
                datum,
                mitarbeiter: mitarbeiterId,
                teamleiter: teamleiterId,
                assigned: !!(mitarbeiterId && teamleiterId),
            });
            await parsedBody.save();
        } else if (type === "event_report") {
            const { location, name, datum, kunde, puenktlichkeit, erscheinungsbild, team, mitarbeiter, feedback_auftraggeber, sonstiges } = req.body;
             

            const teamleiterId = await findFlipUserByName(name);

            parsedBody = new EventReport({
                location,
                name,
                datum,
                kunde,
                puenktlichkeit,
                erscheinungsbild,
                team,
                mitarbeiter,
                feedback_auftraggeber,
                sonstiges,
                teamleiter: teamleiterId,
                assigned: !!teamleiterId,
            });
            await parsedBody.save();
        } else if (type === "evaluierung") {
            const { location, name, datum, kunde, name_mitarbeiter, puenktlichkeit, grooming, motivation, technische_fertigkeiten, lernbereitschaft, sonstiges } = req.body;
             
            const mitarbeiterId = await findFlipUserByName(name_mitarbeiter);
            const teamleiterId = await findFlipUserByName(name);

            parsedBody = new EvaluierungMA({
                location,
                name,
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
        } else {
            return res.status(400).json({ error: "Invalid document type" });
        }

        res.status(201).json({ message: "Document saved successfully", document: parsedBody });
    } catch (err) {
        console.error("Error processing request:", err);
        res.status(500).json({ error: "Internal Server Error" });
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