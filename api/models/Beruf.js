const mongoose = require("mongoose");

const BerufSchema = new mongoose.Schema({
  jobKey: {
    type: Number,
    required: true,
    unique: true,
  },
  designation: {
    type: String,
    required: true,
  }
});

module.exports = mongoose.model("Beruf", BerufSchema);
