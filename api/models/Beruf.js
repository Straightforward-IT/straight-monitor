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
  },  
    taetigkeitsschluessel: {
      type: String,
      required: false,
    }
});

module.exports = mongoose.model("Beruf", BerufSchema);
