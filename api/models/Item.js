const mongoose = require('mongoose');

// Define Item Schema
const ItemSchema = new mongoose.Schema({
  bezeichnung: {
    type: String,
    required: true,
  },
  groesse: {
    type: String,
    required: false,
  },
  anzahl: {
    type: Number,
    required: true,
  },
  standort: {
    type: String,
    required: true
  }
});

// Export the Item model
module.exports = mongoose.model('Item', ItemSchema);
