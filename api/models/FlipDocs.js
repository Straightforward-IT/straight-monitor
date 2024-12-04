const mongoose = require('mongoose');

const LaufzettelSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    bogenNr: {
        type: Number,
        required: true,
    },
    name_teamleiter: {
        type: String,
        required: true,
    },
    datum: {
        type: Date,
        required: false,
        set: (value) => {
            if (typeof value === 'string') {
                // Try parsing string into a date
                return new Date(value);
            }
            if (value && typeof value === 'object' && value.unix) {
                // Convert Unix timestamp to date
                return new Date(value.unix * 1000);
            }
            return value; // Return as-is if already a valid date
        },
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

const EventReportSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    datum: {
        type: Date,
        required: true,
        set: (value) => {
            if (typeof value === 'string') {
                return new Date(value);
            }
            if (value && typeof value === 'object' && value.unix) {
                return new Date(value.unix * 1000);
            }
            return value;
        },
    },
    kunde: {
        type: String,
        required: true,
    },
    puenktlichkeit: {
        type: String,
        required: false,
    },
    erscheinungsbild: {
        type: String,
        required: false,
    },
    team: {
        type: String,
        required: false,
    },
    mitarbeiter: {
        type: String,
        required: false,
    },
    feedback_auftraggeber: {
        type: String,
        required: false,
    },
    sonstiges: {
        type: String,
        required: false,
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

const EvaluierungSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
    },
    datum: {
        type: Date,
        required: false,
        set: (value) => {
            if (typeof value === 'string') {
                return new Date(value);
            }
            if (value && typeof value === 'object' && value.unix) {
                return new Date(value.unix * 1000);
            }
            return value;
        },
    },
    kunde: {
        type: String,
        required: true,
    },
    name_teamleiter: {
        type: String,
        required: true,
    },
    name_mitarbeiter: {
        type: String,
        required: true,
    },
    puenktlichkeit: {
        type: String,
        required: false,
    },
    grooming: {
        type: String,
        required: false,
    },
    motivation: {
        type: String,
        required: false,
    },
    technische_fertigkeiten: {
        type: String,
        required: false,
    },
    lernbereitschaft: {
        type: String,
        required: false,
    },
    sonstiges: {
        type: String,
        required: false,
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

const Laufzettel = mongoose.model('Laufzettel', LaufzettelSchema);
const EventReport = mongoose.model('EventReport', EventReportSchema);
const EvaluierungMA = mongoose.model('EvaluierungMA', EvaluierungSchema);

module.exports = { Laufzettel, EventReport, EvaluierungMA };
