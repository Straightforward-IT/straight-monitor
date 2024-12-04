const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const { Laufzettel, EventReport, EvaluierungMA } = require('../models/FlipDocs');


router.get("/", auth, async (req, res) => {
    try {
      const type = req.headers["document-type"]; // Optional document type header
      let documents = [];
  
      // Fetch documents based on the type, or fetch all if no type is specified
      if (type === "laufzettel") {
        documents = await Laufzettel.find(); // Fetch Laufzettel documents
      } else if (type === "event_report") {
        documents = await EventReport.find(); // Fetch EventReport documents
      } else if (type === "evaluierung") {
        documents = await EvaluierungMA.find(); // Fetch EvaluierungMA documents
      } else if (!type) {
        // Fetch all documents if no type is provided
        const laufzettelDocs = await Laufzettel.find();
        const eventReportDocs = await EventReport.find();
        const evaluierungDocs = await EvaluierungMA.find();
  
        // Combine all documents into a single array
        documents = [
          ...laufzettelDocs.map(doc => ({ type: "laufzettel", ...doc._doc })),
          ...eventReportDocs.map(doc => ({ type: "event_report", ...doc._doc })),
          ...evaluierungDocs.map(doc => ({ type: "evaluierung", ...doc._doc })),
        ];
      } else {
        return res.status(400).json({ error: "Invalid document type" });
      }
  
      // Respond with the documents
      res.status(200).json({
        success: true,
        data: documents,
      });
    } catch (err) {
      console.error("Error fetching documents:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
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
