const mongoose = require('mongoose');

const LaufzettelSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
    }, name: {
        type: String,
        required: true,
    }, bogenNr: {
        type: Number,
        required: true,
    }, name_teamleiter: {
        type: String,
        required: true
    }, datum: {
        type: Date,
        required: false
    }, date: {
        type: Date,
        default: Date.now
      },
});

const EventReportSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    datum: {
        type: Date,
        required: true
    },
    kunde: {
        type: String,
        required: true
    },
    puenktlichkeit: {
        type: String,
        required: false
    },
    erscheinungsbild: {
        type: String,
        required: false
    },
    team: {
        type: String,
        required: false
    },
    mitarbeiter: {
        type: String,
        required: false
    },
    feedback_auftraggeber: {
        type: String,
        required: false
    },
    sonstiges: {
        type: String,
        required: false
    },
    date: {
        type: Date,
        default: Date.now
      },
});

const EvaluierungSchema = new mongoose.Schema({
    location: {
        type: String,
        required: true
    },
    datum: {
        type: Date,
        required: false
    },
    kunde: {
        type: String,
        required: true
    },
    name_teamleiter: {
        type: String,
        required: true
    },
    name_mitarbeiter: {
        type: String,
        required: true
    },
    puenktlichkeit: {
        type: String,
        required: false
    },
    grooming: {
        type: String,
        required: false
    },
    motivation: {
        type: String,
        required: false
    },
    technische_fertigkeiten: {
        type: String,
        required: false
    },
    lernbereitschaft: {
        type: String,
        required: false
    },
    sonstiges: {
        type: String,
        required: false
    },
    date: {
        type: Date,
        default: Date.now
      },
});

const Laufzettel = mongoose.model('Laufzettel', LaufzettelSchema);
const EventReport = mongoose.model('EventReport', EventReportSchema);
const EvaluierungMA = mongoose.model('EvaluierungMA', EvaluierungSchema);

module.exports = {Laufzettel, EventReport, EvaluierungMA};
