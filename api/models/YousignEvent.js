const mongoose = require('mongoose');

const YousignEventSchema = new mongoose.Schema({
  event_id: { type: String, unique: true },
  event_name: String,
  data: mongoose.Schema.Types.Mixed,
  subscription_id: String,
  receivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('YousignEvent', YousignEventSchema);
