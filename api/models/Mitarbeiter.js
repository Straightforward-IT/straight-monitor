const mongoose = require('mongoose');

const MitarbeiterSchema = new mongoose.Schema({
    vorname: {
        type: String,
        required: true,
        trim: true
    },
    nachname: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: false,
        unique: false,
        lowercase: true,
        trim: true,
    },
    standort: {
        type: String,
        required: false,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isTeamleiter: {
        type: Boolean,
        default: false
    },
    laufzettel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Laufzettel"
    },
    flipRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FlipUser",
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
});

const Mitarbeiter = mongoose.model('Mitarbeiter', MitarbeiterSchema);

module.exports = Mitarbeiter;
