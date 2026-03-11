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
  },
  { timestamps: true }
);

module.exports = mongoose.model("CheckIn", CheckInSchema);
