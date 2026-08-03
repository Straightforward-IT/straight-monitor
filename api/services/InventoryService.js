const mongoose = require('mongoose');
const InventoryItem = require('../models/Item_New');
const Location = require('../models/Location');

function optionLabel(options, key, fallback) {
  if (!key) return null;
  return options.find((option) => option.key === key)?.label || fallback || key;
}

function toFlatStock(item, stock) {
  const location = stock.location;
  const locationId = location?._id || location;
  const locationName = location?.nameFull || '';

  return {
    _id: stock._id,
    itemId: item._id,
    bezeichnung: item.bezeichnung,
    locationId,
    standort: locationName,
    standortKurz: location?.shortName || '',
    standortColor: location?.color || '#6b7280',
    variationKey: stock.variationKey || null,
    variation: optionLabel(item.variationen, stock.variationKey, stock.variationKey),
    groesseKey: stock.groesseKey || 'onesize',
    groesse: optionLabel(item.groessen, stock.groesseKey, stock.groesseKey || 'onesize') || 'onesize',
    anzahl: stock.bestand,
    bestand: stock.bestand,
    soll: stock.soll,
    shopUrl: stock.shopUrl || item.shopUrl || '',
    isActive: item.isActive && stock.isActive,
    updatedAt: stock.updatedAt || item.updatedAt,
  };
}

async function listFlatStocks({ since = null, locationId = null, includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  if (since) query.updatedAt = { $gt: since };

  const items = await InventoryItem.find(query)
    .populate('bestaende.location', 'nameFull shortName color isActive')
    .lean();

  return items.flatMap((item) => item.bestaende
    .filter((stock) => {
      if (!includeInactive && !stock.isActive) return false;
      if (locationId && String(stock.location?._id || stock.location) !== String(locationId)) return false;
      return true;
    })
    .map((stock) => toFlatStock(item, stock)));
}

async function findInventoryStock(stockId, session = null) {
  if (!mongoose.isValidObjectId(stockId)) return null;

  let query = InventoryItem.findOne({ 'bestaende._id': stockId, isActive: true })
    .populate('bestaende.location', 'nameFull shortName color isActive');
  if (session) query = query.session(session);

  const item = await query;
  if (!item) return null;
  const stock = item.bestaende.id(stockId);
  if (!stock?.isActive || !stock.location?.isActive) return null;
  return { item, stock };
}

function normalizeStockInput(input, defaultShopUrl = '') {
  return {
    location: input.location,
    variationKey: input.variationKey || null,
    groesseKey: input.groesseKey || 'onesize',
    bestand: Number(input.bestand ?? input.anzahl ?? 0),
    soll: Number(input.soll ?? 0),
    shopUrl: input.shopUrl?.trim() || defaultShopUrl,
    isActive: input.isActive !== false,
  };
}

async function validateLocationIds(stocks) {
  const ids = [...new Set(stocks.map((stock) => String(stock.location)).filter(Boolean))];
  const locations = await Location.find({ _id: { $in: ids }, isActive: true }).select('_id').lean();
  if (locations.length !== ids.length) {
    throw Object.assign(new Error('Mindestens ein Standort ist nicht aktiv oder nicht vorhanden.'), { statusCode: 400 });
  }
}

module.exports = {
  findInventoryStock,
  listFlatStocks,
  normalizeStockInput,
  toFlatStock,
  validateLocationIds,
};