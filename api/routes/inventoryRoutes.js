const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');
const InventoryItem = require('../models/Item_New');
const Location = require('../models/Location');
const Monitoring = require('../models/Monitoring');
const Mitarbeiter = require('../models/Mitarbeiter');
const PaketVorlage = require('../models/PaketVorlage');
const User = require('../models/User');
const {
  findInventoryStock,
  listFlatStocks,
  normalizeStockInput,
  toFlatStock,
  validateLocationIds,
} = require('../services/InventoryService');

const router = express.Router();

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function mapError(error, res) {
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  return res.status(statusCode).json({ message: error.message });
}

function normalizeItemPayload(body, partial = false) {
  const payload = {};
  if (body.bezeichnung !== undefined) payload.bezeichnung = String(body.bezeichnung).trim();
  if (body.shopUrl !== undefined) payload.shopUrl = String(body.shopUrl || '').trim();
  if (Array.isArray(body.variationen)) payload.variationen = body.variationen;
  if (Array.isArray(body.groessen)) payload.groessen = body.groessen;
  if (typeof body.isActive === 'boolean') payload.isActive = body.isActive;
  if (!partial && !payload.bezeichnung) throw httpError(400, 'bezeichnung ist erforderlich');
  return payload;
}

function stockCombinationKey(stock) {
  return [String(stock.location), stock.variationKey || '', stock.groesseKey || 'onesize'].join('|');
}

async function currentUser(userId) {
  const user = await User.findById(userId).select('name email').lean();
  if (!user) throw httpError(401, 'Benutzer nicht gefunden');
  return user;
}

router.get('/stocks', auth, asyncHandler(async (req, res) => {
  const stocks = await listFlatStocks({ locationId: req.query.locationId || null });
  res.json(stocks);
}));

router.get('/stocks/sync', auth, asyncHandler(async (req, res) => {
  const since = new Date(req.query.since);
  if (!req.query.since || Number.isNaN(since.getTime())) {
    return res.status(400).json({ message: 'since muss ein ISO-Datum sein' });
  }

  const updated = await listFlatStocks({ since });
  res.json({ success: true, updated, deleted: [], syncedAt: new Date().toISOString() });
}));

router.get('/activity', auth, asyncHandler(async (req, res) => {
  const locationIds = String(req.query.locationIds || '')
    .split(',')
    .map((locationId) => locationId.trim())
    .filter((locationId) => mongoose.isValidObjectId(locationId));
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
  const filter = { 'items.stockId': { $exists: true } };
  if (locationIds.length) filter.locationId = { $in: locationIds };

  const activity = await Monitoring.find(filter)
    .select('locationId standort art timestamp items benutzer benutzerName benutzerMail packageTemplate packageTemplateName anmerkung')
    .populate('locationId', 'shortName')
    .populate('benutzer', 'name')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
  const legacyPackageIds = activity
    .filter((entry) => !entry.packageTemplateName)
    .map((entry) => entry.anmerkung?.match(/\[Paketvorlage: ([a-f\d]{24})\]/i)?.[1])
    .filter(Boolean);
  const legacyPackages = legacyPackageIds.length
    ? await PaketVorlage.find({ _id: { $in: legacyPackageIds } }).select('name').lean()
    : [];
  const legacyPackageNames = new Map(legacyPackages.map((template) => [String(template._id), template.name]));
  res.json(activity.map((entry) => ({
    ...entry,
    packageTemplateName: entry.packageTemplateName
      || legacyPackageNames.get(String(entry.packageTemplate || entry.anmerkung?.match(/\[Paketvorlage: ([a-f\d]{24})\]/i)?.[1]))
      || null,
  })));
}));

router.get('/items', auth, asyncHandler(async (_req, res) => {
  const items = await InventoryItem.find({ isActive: true })
    .populate('bestaende.location', 'nameFull shortName isActive')
    .sort({ bezeichnung: 1 })
    .lean();
  res.json(items);
}));

router.post('/items', auth, asyncHandler(async (req, res) => {
  try {
    const payload = normalizeItemPayload(req.body);
    const stocks = (req.body.bestaende || []).map((stock) => normalizeStockInput(stock, payload.shopUrl));
    await validateLocationIds(stocks);
    const item = await InventoryItem.create({ ...payload, bestaende: stocks, createdBy: req.user.id });
    await item.populate('bestaende.location', 'nameFull shortName isActive');
    res.status(201).json({ item, stocks: item.bestaende.map((stock) => toFlatStock(item, stock)) });
  } catch (error) {
    mapError(error, res);
  }
}));

router.patch('/items/:itemId', auth, asyncHandler(async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.itemId);
    if (!item) throw httpError(404, 'Artikel nicht gefunden');
    const payload = normalizeItemPayload(req.body, true);

    if (req.body.bestaende !== undefined) {
      if (!Array.isArray(req.body.bestaende)) throw httpError(400, 'bestaende muss ein Array sein');
      const stocks = req.body.bestaende.map((stock) => normalizeStockInput(stock, payload.shopUrl ?? item.shopUrl));
      await validateLocationIds(stocks);

      const existingStocks = new Map(item.bestaende.map((stock) => [stockCombinationKey(stock), stock]));
      const submittedKeys = new Set(stocks.map(stockCombinationKey));
      if (submittedKeys.size !== stocks.length) throw httpError(400, 'Eine Bestandskombination darf nur einmal vorkommen');

      for (const stock of item.bestaende) {
        if (!submittedKeys.has(stockCombinationKey(stock))) stock.isActive = false;
      }
      for (const stock of stocks) {
        const existingStock = existingStocks.get(stockCombinationKey(stock));
        if (existingStock) Object.assign(existingStock, stock, { isActive: true });
        else item.bestaende.push(stock);
      }
    }

    Object.assign(item, payload);
    await item.save();
    await item.populate('bestaende.location', 'nameFull shortName isActive');
    res.json({ item, stocks: item.bestaende.map((stock) => toFlatStock(item, stock)) });
  } catch (error) {
    mapError(error, res);
  }
}));

router.post('/items/:itemId/stocks', auth, asyncHandler(async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.itemId);
    if (!item) throw httpError(404, 'Artikel nicht gefunden');
    const stock = normalizeStockInput(req.body, item.shopUrl);
    await validateLocationIds([stock]);
    item.bestaende.push(stock);
    await item.save();
    await item.populate('bestaende.location', 'nameFull shortName isActive');
    res.status(201).json(toFlatStock(item, item.bestaende[item.bestaende.length - 1]));
  } catch (error) {
    mapError(error, res);
  }
}));

router.patch('/stocks/:stockId', auth, asyncHandler(async (req, res) => {
  try {
    const found = await findInventoryStock(req.params.stockId);
    if (!found) throw httpError(404, 'Bestandskombination nicht gefunden');
    const { item, stock } = found;
    for (const key of ['soll', 'bestand', 'shopUrl', 'isActive', 'variationKey', 'groesseKey']) {
      if (req.body[key] !== undefined) stock[key] = req.body[key];
    }
    if (req.body.location !== undefined) {
      await validateLocationIds([{ location: req.body.location }]);
      stock.location = req.body.location;
    }
    await item.save();
    await item.populate('bestaende.location', 'nameFull shortName isActive');
    res.json(toFlatStock(item, item.bestaende.id(stock._id)));
  } catch (error) {
    mapError(error, res);
  }
}));

router.get('/holdings/:mitarbeiterId', auth, asyncHandler(async (req, res) => {
  const logs = await Monitoring.find({ mitarbeiter: req.params.mitarbeiterId, 'items.stockId': { $exists: true } })
    .sort({ timestamp: 1 })
    .lean();
  const holdings = new Map();

  for (const log of logs) {
    const multiplier = log.art === 'entnahme' ? 1 : log.art === 'zugabe' ? -1 : 0;
    if (!multiplier) continue;
    for (const line of log.items || []) {
      if (!line.stockId) continue;
      const key = String(line.stockId);
      const holding = holdings.get(key) || {
        stockId: line.stockId,
        inventoryItemId: line.inventoryItemId,
        locationId: line.locationId,
        bezeichnung: line.bezeichnung,
        variationKey: line.variationKey || null,
        groesse: line.groesse || 'onesize',
        anzahl: 0,
      };
      holding.anzahl += multiplier * Number(line.anzahl || 0);
      holdings.set(key, holding);
    }
  }

  res.json([...holdings.values()]
    .map((holding) => ({ ...holding, anzahl: Math.max(0, holding.anzahl) }))
    .filter((holding) => holding.anzahl > 0));
}));

router.post('/transactions', auth, asyncHandler(async (req, res) => {
  const { locationId, mitarbeiterId, direction, anmerkung = '', templateId = null, lines } = req.body;
  if (!mongoose.isValidObjectId(locationId)) throw httpError(400, 'locationId ist erforderlich');
  if (!mongoose.isValidObjectId(mitarbeiterId)) throw httpError(400, 'mitarbeiterId ist erforderlich');
  if (!['issue', 'return'].includes(direction)) throw httpError(400, 'direction muss issue oder return sein');
  if (!Array.isArray(lines) || !lines.length) throw httpError(400, 'Mindestens eine Bestandszeile ist erforderlich');

  const location = await Location.findOne({ _id: locationId, isActive: true }).lean();
  if (!location) throw httpError(400, 'Standort nicht gefunden oder inaktiv');
  const employee = await Mitarbeiter.findById(mitarbeiterId).select('vorname nachname personalnr').lean();
  if (!employee) throw httpError(404, 'Mitarbeiter nicht gefunden');
  const user = await currentUser(req.user.id);
  const packageTemplate = mongoose.isValidObjectId(templateId)
    ? await PaketVorlage.findById(templateId).select('name').lean()
    : null;
  const quantities = new Map();

  for (const line of lines) {
    const quantity = Number(line.anzahl);
    if (!mongoose.isValidObjectId(line.stockId) || !Number.isInteger(quantity) || quantity < 1) {
      throw httpError(400, 'Jede Zeile braucht stockId und eine positive ganze Anzahl');
    }
    quantities.set(String(line.stockId), (quantities.get(String(line.stockId)) || 0) + quantity);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const updatedStocks = [];
      const monitoringItems = [];

      for (const [stockId, quantity] of quantities) {
        const found = await findInventoryStock(stockId, session);
        if (!found) throw httpError(404, `Bestandskombination ${stockId} nicht gefunden`);
        const { item, stock } = found;
        if (String(stock.location._id) !== String(locationId)) {
          throw httpError(400, 'Alle Bestandszeilen muessen zum gewaehlten Standort gehoeren');
        }
        if (direction === 'issue' && stock.bestand < quantity) {
          throw httpError(409, `Nicht genug Bestand fuer ${item.bezeichnung}`);
        }

        stock.bestand += direction === 'issue' ? -quantity : quantity;
        await item.save({ session });
        updatedStocks.push(toFlatStock(item, stock));
        monitoringItems.push({
          itemId: stock.legacyItemId || item._id,
          inventoryItemId: item._id,
          stockId: stock._id,
          locationId,
          bezeichnung: item.bezeichnung,
          groesse: stock.groesseKey || 'onesize',
          variationKey: stock.variationKey || null,
          anzahl: quantity,
          soll: stock.soll,
        });
      }

      const monitoring = await Monitoring.create([{
        benutzer: req.user.id,
        benutzerMail: user.email || user.name || '-',
        benutzerName: user.name || null,
        standort: location.nameFull,
        locationId,
        art: direction === 'issue' ? 'entnahme' : 'zugabe',
        timestamp: new Date(),
        items: monitoringItems,
        packageTemplate: packageTemplate?._id || null,
        packageTemplateName: packageTemplate?.name || null,
        anmerkung: `${templateId ? `[Paketvorlage: ${templateId}] ` : ''}${anmerkung}`.trim(),
        mitarbeiter: employee._id,
        mitarbeiterName: `${employee.vorname} ${employee.nachname}`.trim(),
        mitarbeiterPersonalnr: employee.personalnr || null,
      }], { session });
      result = { updatedStocks, monitoring: monitoring[0] };
    });
    res.status(201).json(result);
  } finally {
    await session.endSession();
  }
}));

module.exports = router;