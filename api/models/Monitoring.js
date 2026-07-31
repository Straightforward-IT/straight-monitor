const mongoose = require("mongoose");

const MonitoringSchema = new mongoose.Schema({
  benutzer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  benutzerMail: {
    type: String,
    required: true,
  },
  benutzerName: {
    type: String,
    required: false,
  },
  standort: {
    type: String,
    required: true,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    required: false,
  },
  art: {
    type: String, // 'zugabe' for add, 'entnahme' for remove, 'änderung' for change
    enum: ["zugabe", "entnahme", "änderung"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  items: [
    {
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item", // Reference the Item collection
        required: true,
      },
      inventoryItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InventoryItem",
        required: false,
      },
      stockId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
      },
      locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
        required: false,
      },
      bezeichnung: {
        type: String,
        required: true,
      },
      groesse: {
        type: String,
        required: false,
      },
      variationKey: {
        type: String,
        required: false,
      },
      anzahl: {
        type: Number,
        required: true,
      },
      soll: {
        type: Number,
        required: false,
      },
    },
  ],
  anmerkung: {
    type: String,
    required: false,
  },
  packageTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PaketVorlage",
    required: false,
  },
  packageTemplateName: {
    type: String,
    required: false,
  },
  // Optionale Mitarbeiter-Verknüpfung
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mitarbeiter",
    required: false,
  },
  // Snapshot für unveränderlichen Verlauf
  mitarbeiterName: {
    type: String,
    required: false,
  },
  mitarbeiterPersonalnr: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Monitoring", MonitoringSchema);
