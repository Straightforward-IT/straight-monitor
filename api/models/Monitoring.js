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
  standort: {
    type: String,
    required: true,
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
      bezeichnung: {
        type: String,
        required: true,
      },
      groesse: {
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
});

module.exports = mongoose.model("Monitoring", MonitoringSchema);
