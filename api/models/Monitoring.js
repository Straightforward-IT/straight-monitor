const mongoose = require('mongoose');

const MonitoringSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item', // Reference the Item collection
        required: true
    },
    bezeichnung: {
        type: String,
        required: true
    },
    groesse: {
        type: String,
        required: false
    },
    standort: {
        type: String,
        required: true
    },
    anzahl: {
        type: Number,
        required: true
    },
    art: {
        type: String, // 'zugabe' for add, 'entnahme' for remove
        enum: ['zugabe', 'entnahme'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Monitoring', MonitoringSchema);
