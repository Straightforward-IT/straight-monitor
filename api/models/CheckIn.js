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
      type: [Number], // Array of personalNr values
      default: [],
    },
    noShow: {
      type: [Number], // Array of personalNr values marked as "Nicht Erschienen"
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CheckIn", CheckInSchema);
