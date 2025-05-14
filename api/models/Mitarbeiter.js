const mongoose = require('mongoose');

const MitarbeiterSchema = new mongoose.Schema({
    flip_id: { type: String, required: false, trim: true},
    asana_id: {type: String, unique: true, required: false, trim: true},
    vorname: { type: String, required: true, trim: true },
    nachname: { type: String, required: true, trim: true },
    erstellt_von: { type: String, required: false, trim: true},
    email: { type: String, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    laufzettel_received: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Laufzettel",
        },
    ],
    laufzettel_submitted: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Laufzettel",
        },
    ],
    eventreports: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EventReport",
        },
    ],
    evaluierungen_received: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EvaluierungMA",
        },
    ],
    evaluierungen_submitted: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EvaluierungMA",
        },
    ],
    dateCreated: { type: Date, default: Date.now },
});


function autoPopulate(next) {
    const pathsToPopulate = [];

    const fieldsToCheck = [
        { key: "laufzettel_received", select: "_id name" },
        { key: "laufzettel_submitted", select: "_id name" },
        { key: "eventreports", select: "_id title" },
        { key: "evaluierungen_received", select: "_id score" },
        { key: "evaluierungen_submitted", select: "_id score" },
    ];

    fieldsToCheck.forEach(({ key, select }) => {
        // Check if the field exists in the document and is not empty
        if (this[key] && this[key].length > 0) {
            pathsToPopulate.push({ path: key, select });
        }
    });

    // Populate only if at least one valid field exists
    if (pathsToPopulate.length > 0) {
        this.populate(pathsToPopulate);
    }

    next();
}

// Apply middleware to `find` and `findOne`
MitarbeiterSchema.pre("find", function (next) {
    autoPopulate.call(this, next);
});

MitarbeiterSchema.pre("findOne", function (next) {
    autoPopulate.call(this, next);
});


// Optional: Add a virtual field for dynamic calculations
MitarbeiterSchema.virtual('evaluierungSoll').get(function () {
    return this.laufzettel_received ? this.laufzettel_received.length : 0;
});

const Mitarbeiter = mongoose.model('Mitarbeiter', MitarbeiterSchema);

module.exports = Mitarbeiter;
