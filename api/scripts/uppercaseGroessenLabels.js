/**
 * One-off migration: uppercase all groessen labels in inventory_items.
 * Run once: node api/scripts/uppercaseGroessenLabels.js
 */
const mongoose = require('mongoose');
const InventoryItem = require('../models/Item_New');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const items = await InventoryItem.find({ 'groessen.0': { $exists: true } });
  let updated = 0;

  for (const item of items) {
    let changed = false;
    for (const groesse of item.groessen) {
      const upper = groesse.label.toUpperCase();
      if (groesse.label !== upper) {
        groesse.label = upper;
        changed = true;
      }
    }
    if (changed) {
      await item.save();
      updated++;
      console.log(`Updated: ${item.bezeichnung} (${item._id})`);
    }
  }

  console.log(`\nDone. ${updated}/${items.length} items updated.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
