const mongoose = require('mongoose');

const GuestCapacityLimitChangeSchema = new mongoose.Schema(
  {
    previousLimit: {
      type: Number,
      default: null,
    },
    nextLimit: {
      type: Number,
      default: null,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mitarbeiter',
      required: true,
    },
    changedByPersonalNr: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const GuestCapacityMetaSchema = new mongoose.Schema(
  {
    auftragNr: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    capacityLimit: {
      type: Number,
      default: null,
      min: 0,
    },
    limitUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mitarbeiter',
      default: null,
    },
    limitUpdatedByPersonalNr: {
      type: Number,
      default: null,
    },
    limitUpdatedAt: {
      type: Date,
      default: null,
    },
    limitChanges: {
      type: [GuestCapacityLimitChangeSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GuestCapacityMeta', GuestCapacityMetaSchema);