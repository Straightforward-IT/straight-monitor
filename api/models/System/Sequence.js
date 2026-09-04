const mongoose = require('mongoose');

const SequenceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Sequence', SequenceSchema);
