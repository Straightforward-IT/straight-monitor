const express = require("express");
const router = express.Router();
const Monitoring = require("../models/Monitoring");
const auth = require("../middleware/auth");
const Item = require("../models/Item");
const asyncHandler = require("../middleware/AsyncHandler");

// GET all monitoring logs
router.get("/", auth, asyncHandler( async (req, res) => {
    const monitoringLogs = await Monitoring.find();
    res.status(200).json(monitoringLogs);
}));

// GET a specific monitoring log by ID
router.get("/:id", auth, asyncHandler( async (req, res) => {
    const monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }
    res.status(200).json(monitoringLog);
}));

// POST a new monitoring log
router.post("/", auth, asyncHandler( async (req, res) => {
  const { userID, standort, art, items, anmerkung } = req.body;

    // Validate items structure
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ msg: "Items array is required" });
    }

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const newMonitoringLog = new Monitoring({
      benutzer: user._id,
      benutzerMail: user.email,
      standort,
      art,
      items,
      anmerkung,
      timestamp: Date.now()
    });

    const savedMonitoringLog = await newMonitoringLog.save();
    res.status(201).json(savedMonitoringLog);

}));

// PUT (update) a specific monitoring log by ID
router.put("/:id", auth, asyncHandler( async (req, res) => {
  const { standort, art, items, anmerkung, timestamp } = req.body;

 
    let monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }

    // Update fields
    monitoringLog.standort = standort || monitoringLog.standort;
    monitoringLog.art = art || monitoringLog.art;
    monitoringLog.items = items || monitoringLog.items;
    monitoringLog.anmerkung = anmerkung || monitoringLog.anmerkung;
    monitoringLog.timestamp = timestamp || monitoringLog.timestamp;

    await monitoringLog.save();
    res.status(200).json(monitoringLog);
 
}));

// DELETE a specific monitoring log by ID
router.delete("/:id", auth, asyncHandler( async (req, res) => {

    const monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }

    await monitoringLog.remove();
    res.status(200).json({ msg: "Monitoring log removed" });

}));

// GET logs for a specific item
router.get("/item/:itemId", asyncHandler( async (req, res) => {
    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ msg: "Item not found" });
    }

    const logs = await Monitoring.find({ "items.itemId": req.params.itemId }).sort({ timestamp: -1 });

    if (!logs || logs.length === 0) {
      return res.status(404).json({ msg: "Logs not found" });
    }
    res.status(200).json(logs);
}));

module.exports = router;
