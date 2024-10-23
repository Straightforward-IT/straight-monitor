const express = require("express");
const router = express.Router();
const Monitoring = require("../models/Monitoring");
const auth = require("../middleware/auth");
const Item = require("../models/Item");

// GET all monitoring logs
router.get("/", async (req, res) => {
  try {
    const monitoringLogs = await Monitoring.find();
    res.json(monitoringLogs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET a specific monitoring log by ID
router.get("/:id", async (req, res) => {
  try {
    const monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }
    res.json(monitoringLog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST a new monitoring log
router.post("/", auth, async (req, res) => {
  const { userID, standort, art, items, anmerkung } = req.body;

  try {
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
    res.json(savedMonitoringLog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT (update) a specific monitoring log by ID
router.put("/:id", auth, async (req, res) => {
  const { standort, art, items, anmerkung, timestamp } = req.body;

  try {
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
    res.json(monitoringLog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE a specific monitoring log by ID
router.delete("/:id", auth, async (req, res) => {
  try {
    const monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }

    await monitoringLog.remove();
    res.json({ msg: "Monitoring log removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET logs for a specific item
router.get("/item/:itemId", async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ msg: "Item not found" });
    }

    const logs = await Monitoring.find({ "items.itemId": req.params.itemId }).sort({ timestamp: -1 });

    if (!logs || logs.length === 0) {
      return res.status(404).json({ msg: "Logs not found" });
    }
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
