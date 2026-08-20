const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
}, { _id: false });

// Groessen labels are always stored uppercase (e.g. "xl" → "XL").
const groesseOptionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true, uppercase: true },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const stockSchema = new mongoose.Schema({
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  variationKey: { type: String, default: null, trim: true },
  groesseKey: { type: String, default: 'onesize', trim: true },
  bestand: { type: Number, required: true, min: 0, default: 0 },
  soll: { type: Number, required: true, min: 0, default: 0 },
  shopUrl: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
  legacyItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null,
  },
}, { timestamps: true });

const inventoryItemSchema = new mongoose.Schema({
  bezeichnung: { type: String, required: true, trim: true },
  shopUrl: { type: String, default: '', trim: true },
  variationen: { type: [optionSchema], default: [] },
  groessen: { type: [groesseOptionSchema], default: [] },
  bestaende: { type: [stockSchema], default: [] },
  isActive: { type: Boolean, default: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
  collection: 'inventory_items',
});

inventoryItemSchema.pre('validate', function validateStockCombinations(next) {
  const combinations = new Set();

  for (const stock of this.bestaende.filter((entry) => entry.isActive)) {
    const key = [
      String(stock.location),
      stock.variationKey || '',
      stock.groesseKey || 'onesize',
    ].join('|');

    if (combinations.has(key)) {
      this.invalidate('bestaende', 'Eine aktive Bestandskombination darf nur einmal existieren.');
      break;
    }
    combinations.add(key);
  }

  next();
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
