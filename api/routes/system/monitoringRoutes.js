const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Monitoring = require("../../models/Monitoring");
const InventoryItem = require("../../models/Item_New");
const PaketVorlage = require("../../models/System/PaketVorlage");
const auth = require("../../middleware/auth");
const Item = require("../../models/Deprecated/Item");
const asyncHandler = require("../../middleware/AsyncHandler");
const {
  resolveActiveLocation,
  resolveLocationFromStandortName,
} = require('../../services/operations/LocationResolutionService');
const { findInventoryStock } = require('../../services/operations/InventoryService');
const {
  buildInventoryHistoryEvents,
  buildInventoryHistoryFilter,
} = require('../../services/operations/InventoryHistoryService');

// Reverses the stock effect of a single monitoring item.
// entnahme removed stock -> add it back; zugabe added stock -> remove it again.
async function revertItemStock(art, item, session) {
  if (!item?.stockId || art === 'änderung') return;
  const found = await findInventoryStock(item.stockId, session);
  if (!found) {
    throw Object.assign(new Error(`Bestandskombination für „${item.bezeichnung}“ nicht gefunden`), { statusCode: 409 });
  }
  const quantity = Number(item.anzahl || 0);
  const delta = art === 'entnahme' ? quantity : -quantity;
  found.stock.bestand = Math.max(0, found.stock.bestand + delta);
  await found.item.save({ session });
}

async function resolveMonitoringLocation(locationId, standort) {
  return (locationId ? await resolveActiveLocation(locationId) : null)
    || (standort ? await resolveLocationFromStandortName(standort) : null);
}

async function enrichPackageTemplateNames(logs) {
  const templateIds = logs
    .filter((log) => !log.packageTemplateName)
    .map((log) => log.anmerkung?.match(/\[Paketvorlage: ([a-f\d]{24})\]/i)?.[1])
    .filter(Boolean);
  const templates = templateIds.length
    ? await PaketVorlage.find({ _id: { $in: templateIds } }).select('name').lean()
    : [];
  const namesById = new Map(templates.map((template) => [String(template._id), template.name]));

  return logs.map((log) => ({
    ...log,
    packageTemplateName: log.packageTemplateName
      || namesById.get(String(log.packageTemplate || log.anmerkung?.match(/\[Paketvorlage: ([a-f\d]{24})\]/i)?.[1]))
      || null,
  }));
}

// GET all monitoring logs
router.get("/", auth, asyncHandler( async (req, res) => {
    const monitoringLogs = await Monitoring.find().lean();
    res.status(200).json(await enrichPackageTemplateNames(monitoringLogs));
}));

// GET recent monitoring logs for dashboard widget
router.get("/recent", auth, asyncHandler(async (req, res) => {
  const count = parseInt(req.query.count) || 3;
  const locationV2 = req.query.locationV2;
  const standort = req.query.standort;

  let filter = {};
  if (locationV2) {
    const location = await resolveActiveLocation(locationV2);
    if (!location) return res.status(400).json({ message: 'Standort nicht gefunden oder inaktiv.' });
    filter.$or = [{ locationV2: location._id }, { locationId: location._id }];
  } else if (standort && standort !== "Alle") {
    filter.standort = standort;
  }

  const logs = await Monitoring.find(filter)
    .sort({ timestamp: -1 })
    .limit(count)
    .lean();

  res.status(200).json(logs);
}));

// GET all monitoring logs for a specific Mitarbeiter
router.get("/mitarbeiter/:mitarbeiterId", auth, asyncHandler(async (req, res) => {
  const logs = await Monitoring.find({ mitarbeiter: req.params.mitarbeiterId })
    .sort({ timestamp: -1 })
    .lean();
  res.status(200).json(logs);
}));

// GET normalized monitoring history for an Item_New record
router.get("/inventory-item/:itemId", auth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) {
    return res.status(400).json({ message: "Artikel-ID ist ungültig" });
  }

  const item = await InventoryItem.findById(req.params.itemId).lean();
  if (!item) return res.status(404).json({ message: "Artikel nicht gefunden" });

  const createdAt = item.createdAt || item._id.getTimestamp?.() || new Date(0);
  const logs = await Monitoring.find(buildInventoryHistoryFilter({ ...item, createdAt }))
    .sort({ timestamp: 1 })
    .lean();

  const enrichedLogs = await enrichPackageTemplateNames(logs);
  const currentBestand = (item.bestaende || [])
    .filter((stock) => stock.isActive !== false)
    .reduce((total, stock) => total + Number(stock.bestand || 0), 0);

  res.json({
    item: {
      _id: item._id,
      bezeichnung: item.bezeichnung,
      createdAt,
      updatedAt: item.updatedAt,
      isActive: item.isActive,
      currentBestand,
      variationen: item.variationen || [],
      groessen: item.groessen || [],
    },
    events: buildInventoryHistoryEvents(item, enrichedLogs),
  });
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
  const { userID, standort, locationV2, locationId, art, items, anmerkung } = req.body;

    // Validate items structure
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ msg: "Items array is required" });
    }

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const location = await resolveMonitoringLocation(locationV2 || locationId, standort);
    if ((locationV2 || locationId) && !location) {
      return res.status(400).json({ message: 'Standort nicht gefunden oder inaktiv.' });
    }

    const newMonitoringLog = new Monitoring({
      benutzer: user._id,
      benutzerMail: user.email,
      standort: location?.nameFull || standort,
      locationV2: location?._id || null,
      locationId: location?._id || null,
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
  const { standort, locationV2, locationId, art, items, anmerkung, timestamp } = req.body;

 
    let monitoringLog = await Monitoring.findById(req.params.id);
    if (!monitoringLog) {
      return res.status(404).json({ msg: "Monitoring log not found" });
    }

    if (locationV2 !== undefined || locationId !== undefined || standort !== undefined) {
      const location = await resolveMonitoringLocation(locationV2 || locationId, standort);
      if ((locationV2 || locationId) && !location) {
        return res.status(400).json({ message: 'Standort nicht gefunden oder inaktiv.' });
      }
      monitoringLog.standort = location?.nameFull || standort || monitoringLog.standort;
      if (location) {
        monitoringLog.locationV2 = location._id;
        monitoringLog.locationId = location._id;
      }
    }

    monitoringLog.art = art || monitoringLog.art;
    monitoringLog.items = items || monitoringLog.items;
    monitoringLog.anmerkung = anmerkung || monitoringLog.anmerkung;
    monitoringLog.timestamp = timestamp || monitoringLog.timestamp;

    await monitoringLog.save();
    res.status(200).json(monitoringLog);
 
}));

// POST revert an entire monitoring entry (undo all not-yet-reverted items)
router.post("/:id/revert", auth, asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const monitoringLog = await Monitoring.findById(req.params.id).session(session);
      if (!monitoringLog) {
        throw Object.assign(new Error("Monitoring log not found"), { statusCode: 404 });
      }
      if (monitoringLog.storniert) {
        throw Object.assign(new Error("Eintrag ist bereits storniert"), { statusCode: 409 });
      }

      for (const item of monitoringLog.items) {
        if (item.storniert) continue;
        await revertItemStock(monitoringLog.art, item, session);
        item.storniert = true;
      }

      monitoringLog.storniert = true;
      monitoringLog.storniertAt = new Date();
      monitoringLog.storniertBy = req.user.id;
      updated = await monitoringLog.save({ session });
    });
    res.status(200).json(updated);
  } finally {
    await session.endSession();
  }
}));

// POST revert a single item within a monitoring entry
router.post("/:id/items/:index/revert", auth, asyncHandler(async (req, res) => {
  const index = Number(req.params.index);
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const monitoringLog = await Monitoring.findById(req.params.id).session(session);
      if (!monitoringLog) {
        throw Object.assign(new Error("Monitoring log not found"), { statusCode: 404 });
      }
      if (!Number.isInteger(index) || index < 0 || index >= monitoringLog.items.length) {
        throw Object.assign(new Error("Item-Index ungültig"), { statusCode: 400 });
      }
      const item = monitoringLog.items[index];
      if (item.storniert) {
        throw Object.assign(new Error("Item ist bereits storniert"), { statusCode: 409 });
      }

      await revertItemStock(monitoringLog.art, item, session);
      item.storniert = true;

      if (monitoringLog.items.every((entry) => entry.storniert)) {
        monitoringLog.storniert = true;
        monitoringLog.storniertAt = new Date();
        monitoringLog.storniertBy = req.user.id;
      }
      updated = await monitoringLog.save({ session });
    });
    res.status(200).json(updated);
  } finally {
    await session.endSession();
  }
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
