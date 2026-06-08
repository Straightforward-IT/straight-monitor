const mongoose = require('mongoose');

const GuestCapacityAdjustmentSchema = new mongoose.Schema(
  {
    delta: {
      type: Number,
      required: true,
      enum: [1, -1],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      default: 'capacity-counter',
    },
  },
  { _id: false }
);

const GuestCapacityCounterSchema = new mongoose.Schema(
  {
    auftragNr: {
      type: Number,
      required: true,
      index: true,
    },
    personalNr: {
      type: Number,
      required: true,
      index: true,
    },
    mitarbeiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mitarbeiter',
      required: true,
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
    guestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    adjustments: {
      type: [GuestCapacityAdjustmentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

GuestCapacityCounterSchema.index({ auftragNr: 1, personalNr: 1 }, { unique: true });
GuestCapacityCounterSchema.index({ personalNr: 1, updatedAt: -1 });

module.exports = mongoose.model('GuestCapacityCounter', GuestCapacityCounterSchema);
