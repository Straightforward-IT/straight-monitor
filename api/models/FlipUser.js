const mongoose = require('mongoose');

const FlipUserSchema = new mongoose.Schema({
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
    benutzername: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    rolle: {
        type: String,
        required: true,
        enum: ['admin', 'user'], // Define allowed roles
        trim: true
    },
    email: {
        type: String,
        required: false,
        unique: false,
        lowercase: true,
        trim: true,
    },
    abteilung: {
        type: String,
        required: false,
        trim: true
    },
    position: {
        type: String,
        required: false,
        trim: true
    },
    standort: {
        type: String,
        required: false,
        trim: true
    },
    telefon: {
        type: String,
        required: false,
    },
    mobil: {
        type: String,
        required: false,
    },
    channels: {
        type: [
            {
                name: { type: String, required: true, trim: true},
                id: { type: String, required: true, trim: true},
                role: { type: String, required: true, enum: ['admin', 'member'], trim: true},
            },
        ], 
        required: false,
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
});

const FlipUser = mongoose.model('FlipUser', FlipUserSchema);

module.exports = FlipUser;
