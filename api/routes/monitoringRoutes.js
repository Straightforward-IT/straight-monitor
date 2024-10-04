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
/*router.post('/', async (req, res) => {
  const { item_id, bezeichnung, standort, anzahl, art, timestamp } = req.body;

  try {
    const newMonitoringLog = new Monitoring({
      item_id,
      bezeichnung,
      standort,
      anzahl,
      art,
      timestamp: timestamp || Date.now() // If no timestamp is provided, set current time
    });

    const savedMonitoringLog = await newMonitoringLog.save();
    res.json(savedMonitoringLog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
*/

// PUT (update) a specific monitoring log by ID
router.put("/:id", async (req, res) => {
  const { item_id, bezeichnung, standort, anzahl, art, timestamp } = req.body;

  try {
    let monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }

    // Update fields
    monitoringLog.item_id = item_id || monitoringLog.item_id;
    monitoringLog.bezeichnung = bezeichnung || monitoringLog.bezeichnung;
    monitoringLog.standort = standort || monitoringLog.standort;
    monitoringLog.anzahl = anzahl || monitoringLog.anzahl;
    monitoringLog.art = art || monitoringLog.art;
    monitoringLog.timestamp = timestamp || monitoringLog.timestamp;

    await monitoringLog.save();
    res.json(monitoringLog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE a specific monitoring log by ID
router.delete("/:id", async (req, res) => {
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

// Get logs for a specific item
router.get("/item/:itemId", async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ msg: "Item not found" });
    }
    const logs = await Monitoring.find({ itemId: req.params.itemId }).sort({
      timestamp: -1,
    });
    if (!logs) {
      return res.status(404).json({ msg: "Logs not found" });
    }
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
