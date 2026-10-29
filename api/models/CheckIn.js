const mongoose = require("mongoose");

const CheckInSchema = new mongoose.Schema(
  {
    auftragNr: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    checkedIn: {
      type: [mongoose.Schema.Types.Mixed], // Array of Einsatz _id strings (or legacy personalNr numbers)
      default: [],
    },
    noShow: {
      type: [mongoose.Schema.Types.Mixed], // Array of Einsatz _id strings (or legacy personalNr numbers) marked as "Nicht Erschienen"
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CheckIn", CheckInSchema);
