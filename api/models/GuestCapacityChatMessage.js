const mongoose = require('mongoose');

const GuestCapacityChatMessageSchema = new mongoose.Schema(
  {
    auftragNr: {
      type: Number,
      required: true,
      index: true,
    },
    mitarbeiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mitarbeiter',
      required: true,
    },
    personalNr: {
      type: Number,
      required: true,
      index: true,
    },
    flipId: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

GuestCapacityChatMessageSchema.index({ auftragNr: 1, createdAt: -1 });

module.exports = mongoose.model('GuestCapacityChatMessage', GuestCapacityChatMessageSchema);