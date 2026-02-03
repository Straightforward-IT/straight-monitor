const mongoose = require("mongoose");

const QualifikationSchema = new mongoose.Schema({
  qualificationKey: {
    type: Number,
    required: true,
    unique: true,
  },
  designation: {
    type: String,
    required: true,
  }
});

module.exports = mongoose.model("Qualifikation", QualifikationSchema);
