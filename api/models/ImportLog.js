const mongoose = require('mongoose');

const ImportLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['auftrag', 'kunde', 'einsatz', 'einsatz-komplett', 'schichten', 'personal', 'beruf', 'qualifikation', 'personal_quali', 'rechnung', 'other']
  },
  filename: {
    type: String,
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'warning'],
    default: 'success'
  },
  recordCount: {
    type: Number,
    default: 0
  },
  details: {
    type: Object
  },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ImportLog', ImportLogSchema);
