const express = require("express");
const router = express.Router();
const { Laufzettel, EventReport, EvaluierungMA } = require("../models/FlipDocs");
const { 
    findFlipUserByName, 
    findMitarbeiterByName, 
    assignTeamleiter, 
    assignMitarbeiter, 
    assignTeamleiterUndMitarbeiter 
} = require("../FlipService");
const Mitarbeiter = require("../models/Mitarbeiter");
const asyncHandler = require("../middleware/AsyncHandler");

// 📌 Create or Update a Document
router.post("/send", asyncHandler(async (req, res) => {
    const type = req.headers["document-type"];
    let parsedBody;

    if (!type) {
        return res.status(400).json({ success: false, error: "Document type is required" });
    }

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
        if (mitarbeiterId) await assignMitarbeiter(parsedBody._id, mitarbeiterId);
        if (teamleiterId) await assignTeamleiter(parsedBody._id, teamleiterId);

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
        if (teamleiterId) await assignTeamleiter(parsedBody._id, teamleiterId);

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
        if (mitarbeiterId) await assignMitarbeiter(parsedBody._id, mitarbeiterId);
        if (teamleiterId) await assignTeamleiter(parsedBody._id, teamleiterId);
    } else {
        return res.status(400).json({ success: false, error: "Invalid document type" });
    }

    res.status(201).json({ success: true, message: "Document saved and assigned successfully", document: parsedBody });
}));

// 📌 Assign Teamleiter & Mitarbeiter
router.post("/assign", asyncHandler(async (req, res) => {
    const { documentId, teamleiterId, mitarbeiterId } = req.body;
    if (!documentId) return res.status(400).json({ success: false, error: "Document ID is required" });

    let documentFound = null;
    const models = [Laufzettel, EventReport, EvaluierungMA];

    for (const model of models) {
        documentFound = await model.findById(documentId);
        if (documentFound) break;
    }

    if (!documentFound) return res.status(404).json({ success: false, error: "Document not found" });

    if (teamleiterId && mitarbeiterId) {
        await assignTeamleiterUndMitarbeiter(documentId, teamleiterId, mitarbeiterId);
    } else if (teamleiterId) {
        await assignTeamleiter(documentId, teamleiterId);
    } else if (mitarbeiterId) {
        await assignMitarbeiter(documentId, mitarbeiterId);
    } else {
        return res.status(400).json({ success: false, error: "At least one of teamleiterId or mitarbeiterId is required" });
    }

    res.status(200).json({ success: true, message: "Assignment successful", document: documentFound });
}));

// 📌 Test Route
router.post("/test", asyncHandler(async (req, res) => {
    const { names } = req.body;
    if (!names || !Array.isArray(names)) return res.status(400).json({ success: false, error: "Invalid names array" });

    const foundNames = [];
    const notFoundNames = [];

    for (const name of names) {
        const userId = await findMitarbeiterByName(name);
        if (userId) foundNames.push({ name, userId });
        else notFoundNames.push(name);
    }

    res.status(200).json({ success: true, message: "Test completed", foundNames, notFoundNames });
}));

module.exports = router;
