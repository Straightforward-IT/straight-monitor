const mongoose = require('mongoose');

const MitarbeiterSchema = new mongoose.Schema({
    flip_id: { type: String, required: false, trim: true},
    asana_id: {type: String, unique: true, required: false, trim: true},
    personalnr: { type: String, required: false, trim: true, sparse: true, unique: true },
    personalnrHistory: [
        {
            value: { type: String, trim: true },
            updatedAt: { type: Date, default: Date.now },
            updatedBy: { type: String, default: 'system' },
            source: { type: String, default: 'manual' } // 'manual', 'import', 'api'
        }
    ],
    vorname: { type: String, required: true, trim: true },
    nachname: { type: String, required: true, trim: true },
    erstellt_von: { type: String, required: false, trim: true},
    email: { type: String, unique: true, lowercase: true, trim: true },
    additionalEmails: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true },
    berufe: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Beruf' }],
    qualifikationen: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Qualifikation' }],
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
}, { timestamps: true });


function autoPopulate(next) {
    const pathsToPopulate = [];

    const fieldsToCheck = [
        { 
            key: "laufzettel_received",
            populate: [
                { path: "mitarbeiter", select: "_id vorname nachname email" },
                { path: "teamleiter", select: "_id vorname nachname email" }
            ]
        },
        { 
            key: "laufzettel_submitted",
            populate: [
                { path: "mitarbeiter", select: "_id vorname nachname email" },
                { path: "teamleiter", select: "_id vorname nachname email" }
            ]
        },
        { 
            key: "eventreports",
            populate: { path: "teamleiter", select: "_id vorname nachname email" }
        },
        { 
            key: "evaluierungen_received",
            populate: [
                { path: "mitarbeiter", select: "_id vorname nachname email" },
                { path: "teamleiter", select: "_id vorname nachname email" }
            ]
        },
        { 
            key: "evaluierungen_submitted",
            populate: [
                { path: "mitarbeiter", select: "_id vorname nachname email" },
                { path: "teamleiter", select: "_id vorname nachname email" }
            ]
        },
    ];

    fieldsToCheck.forEach(({ key, populate }) => {
        // Check if the field exists in the document and is not empty
        if (this[key] && this[key].length > 0) {
            const populateConfig = { path: key };
            if (populate) {
                populateConfig.populate = populate;
            }
            pathsToPopulate.push(populateConfig);
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
