const mongoose = require('mongoose');

const packageEntrySchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
  },
  label: { type: String, default: '', trim: true },
  defaultSelected: { type: Boolean, default: true },
  defaultQuantity: { type: Number, required: true, min: 1, default: 1 },
  variationMode: {
    type: String,
    enum: ['none', 'fixed', 'choose'],
    default: 'none',
  },
  variationKey: { type: String, default: null, trim: true },
  groesseMode: {
    type: String,
    enum: ['none', 'fixed', 'choose'],
    default: 'none',
  },
  groesseKey: { type: String, default: null, trim: true },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

const packageSectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sortOrder: { type: Number, default: 0 },
  entries: { type: [packageEntrySchema], default: [] },
  isActive: { type: Boolean, default: true },
});

const locationPackageSchema = new mongoose.Schema({
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  sections: { type: [packageSectionSchema], default: [] },
}, { _id: false });

const paketVorlageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  allowedLocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
  }],
  locationPackages: { type: [locationPackageSchema], default: [] },
  sections: { type: [packageSectionSchema], default: [] },
  isActive: { type: Boolean, default: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
  collection: 'paketvorlagen',
});

paketVorlageSchema.pre('validate', function validateFixedOptions(next) {
  const sectionGroups = [this.sections, ...this.locationPackages.map((locationPackage) => locationPackage.sections)];
  for (const sections of sectionGroups) {
    for (const section of sections) {
      for (const entry of section.entries) {
      if (entry.variationMode === 'fixed' && !entry.variationKey) {
        this.invalidate('sections', 'Feste Variationen brauchen einen Variationsschluessel.');
      }
      if (entry.groesseMode === 'fixed' && !entry.groesseKey) {
        this.invalidate('sections', 'Feste Groessen brauchen einen Groessenschluessel.');
      }
      }
    }
  }
  next();
});

module.exports = mongoose.model('PaketVorlage', paketVorlageSchema);