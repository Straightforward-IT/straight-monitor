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
  },
  beruf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beruf',
    default: null,
  }
});

module.exports = mongoose.model("Qualifikation", QualifikationSchema);
