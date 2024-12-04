const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const { Laufzettel, EventReport, EvaluierungMA } = require('../models/FlipDocs');

router.post("/send", async (req, res) => {
    try {
        const type = req.headers["document-type"]; // Inspect the document type
        let parsedBody;

        // Parse the body and create the appropriate document
        if (type === "laufzettel") {
            const { location, name, bogenNr, name_teamleiter, datum } = req.body;

            parsedBody = new Laufzettel({
                location,
                name,
                bogenNr,
                name_teamleiter,
                datum
            });

            // Save to MongoDB
            await parsedBody.save();
        } 

        else if (type === "event_report") {
            const { location, name, datum, kunde, puenktlichkeit, erscheinungsbild, team, mitarbeiter, feedback_auftraggeber, sonstiges } = req.body;

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
                sonstiges
            });

            // Save to MongoDB
            await parsedBody.save();
        } 

        else if (type === "evaluierung") {
            const { location, datum, kunde, name_teamleiter, name_mitarbeiter, puenktlichkeit, grooming, motivation, technische_fertigkeiten, lernbereitschaft, sonstiges } = req.body;

            parsedBody = new EvaluierungMA({
                location,
                datum,
                kunde,
                name_teamleiter,
                name_mitarbeiter,
                puenktlichkeit,
                grooming,
                motivation,
                technische_fertigkeiten,
                lernbereitschaft,
                sonstiges
            });

            // Save to MongoDB
            await parsedBody.save();
        } 

        else {
            return res.status(400).json({ error: "Invalid document type" });
        }

        // Respond with success
        res.status(201).json({ message: "Document saved successfully", document: parsedBody });

    } catch (err) {
        console.error("Error processing request:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
