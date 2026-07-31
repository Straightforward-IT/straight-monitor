const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Item = require('../models/Item');
const InventoryItem = require('../models/Item_New');
const Location = require('../models/Location');
const logger = require('../utils/logger');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');
const mappingFlagIndex = process.argv.indexOf('--mapping');
const mappingPath = mappingFlagIndex >= 0 ? process.argv[mappingFlagIndex + 1] : null;

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function shortNameFor(locationName) {
  const known = { hamburg: 'HH', berlin: 'B', koln: 'K' };
  return known[Location.normalize(locationName)] || String(locationName || '').slice(0, 3).toUpperCase();
}

function readMapping() {
  if (!mappingPath) return {};
  const absolutePath = path.resolve(process.cwd(), mappingPath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function mappedDimensions(legacyItem, mapping) {
  const override = mapping[String(legacyItem._id)] || {};
  const legacySize = legacyItem.groesse || 'onesize';
  const variationLabel = override.variationLabel || null;
  const groesseLabel = override.groesseLabel || (variationLabel ? 'onesize' : legacySize);

  return {
    variation: variationLabel ? { key: override.variationKey || normalizeKey(variationLabel), label: variationLabel } : null,
    groesse: { key: override.groesseKey || normalizeKey(groesseLabel) || 'onesize', label: groesseLabel },
  };
}

function appendOption(options, option) {
  if (!option || options.some((existing) => existing.key === option.key)) return;
  options.push({ ...option, isActive: true });
}

async function ensureLocation(name, cache) {
  const key = Location.normalize(name);
  if (cache.has(key)) return cache.get(key);

  let location = await Location.findOne({ nameKey: key });
  if (!location && shouldWrite) {
    location = await Location.create({ nameFull: name, shortName: shortNameFor(name) });
  }
  if (!location && !shouldWrite) {
    location = { _id: `dry-run:${key}`, nameFull: name, shortName: shortNameFor(name) };
  }
  if (location) cache.set(key, location);
  return location;
}

async function migrate() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  const mapping = readMapping();
  await mongoose.connect(process.env.MONGO_URI);

  const legacyItems = await Item.find().sort({ bezeichnung: 1, standort: 1 }).lean();
  const report = { legacyItems: legacyItems.length, locations: new Set(), createdProducts: 0, createdStocks: 0, skippedExisting: 0, unresolvedLocations: [] };
  const locations = new Map();

  for (const legacyItem of legacyItems) {
    report.locations.add(legacyItem.standort);
    const location = await ensureLocation(legacyItem.standort, locations);
    if (!location) {
      report.unresolvedLocations.push({ id: String(legacyItem._id), standort: legacyItem.standort });
      continue;
    }

    const existingStock = await InventoryItem.exists({ 'bestaende.legacyItemId': legacyItem._id });
    if (existingStock) {
      report.skippedExisting += 1;
      continue;
    }

    const dimensions = mappedDimensions(legacyItem, mapping);
    let inventoryItem = await InventoryItem.findOne({ bezeichnung: legacyItem.bezeichnung });
    if (!inventoryItem) {
      report.createdProducts += 1;
      if (!shouldWrite) {
        report.createdStocks += 1;
        continue;
      }
      inventoryItem = new InventoryItem({ bezeichnung: legacyItem.bezeichnung });
    }

    const duplicateCombination = inventoryItem.bestaende.some((stock) =>
      String(stock.location) === String(location._id)
      && (stock.variationKey || null) === dimensions.variation?.key
      && stock.groesseKey === dimensions.groesse.key
    );
    if (duplicateCombination) {
      report.skippedExisting += 1;
      continue;
    }

    report.createdStocks += 1;
    if (!shouldWrite) continue;

    appendOption(inventoryItem.variationen, dimensions.variation);
    if (dimensions.groesse.key !== 'onesize') appendOption(inventoryItem.groessen, dimensions.groesse);
    inventoryItem.bestaende.push({
      location: location._id,
      variationKey: dimensions.variation?.key || null,
      groesseKey: dimensions.groesse.key,
      bestand: legacyItem.anzahl,
      soll: legacyItem.soll,
      legacyItemId: legacyItem._id,
    });
    await inventoryItem.save();
  }

  logger.info('Inventory migration report', {
    mode: shouldWrite ? 'write' : 'dry-run',
    legacyItems: report.legacyItems,
    locations: [...report.locations],
    createdProducts: report.createdProducts,
    createdStocks: report.createdStocks,
    skippedExisting: report.skippedExisting,
    unresolvedLocations: report.unresolvedLocations,
  });
}

migrate()
  .catch((error) => {
    logger.error('Inventory migration failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });