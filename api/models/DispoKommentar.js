const mongoose = require('mongoose');

const DispoKommentarSchema = new mongoose.Schema({
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
  },
  datum: {
    type: String, // YYYY-MM-DD
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  author: {
    type: String,
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
});

DispoKommentarSchema.index({ mitarbeiter: 1, datum: 1 });
DispoKommentarSchema.index({ datum: 1 });

module.exports = mongoose.model('DispoKommentar', DispoKommentarSchema);
