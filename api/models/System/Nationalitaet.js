const mongoose = require('mongoose');

const NationalitaetSchema = new mongoose.Schema({
  schluessel: {
    type: Number,
    required: true,
    unique: true,
  },
  natKennz: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  staat: {
    type: String,
    required: true,
    trim: true,
  },
  staatAngehoerigkeit: {
    type: String,
    required: false,
    trim: true,
  },
  staatschluessel: {
    type: Number,
    required: false,
    default: null,
  },
});

module.exports = mongoose.model('Nationalitaet', NationalitaetSchema);