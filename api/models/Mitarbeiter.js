const mongoose = require('mongoose');

const MitarbeiterSchema = new mongoose.Schema({
    vorname: { type: String, required: true, trim: true },
    nachname: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    standort: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isFestAngestellt: { type: Boolean },
    isOfficeMA: { type: Boolean },
    isTeamleiter: { type: Boolean, default: false },
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
    eventReportSoll: {
        type: Number, // This will be imported and stored directly
        default: 0,
    },
    flipRef: { type: mongoose.Schema.Types.ObjectId, ref: "FlipUser" },
    asanaRef: { type: mongoose.Schema.Types.ObjectId },
    dateCreated: { type: Date, default: Date.now },
});

// Middleware for auto-populating referenced documents
MitarbeiterSchema.pre('find', function () {
    this.populate([
        { path: 'laufzettel_received' },
        { path: 'laufzettel_submitted' },
        { path: 'eventreports' },
        { path: 'evaluierungen_received' },
        { path: 'evaluierungen_submitted' },
        { path: 'flipRef' }
    ]);
});

MitarbeiterSchema.pre('findOne', function () {
    this.populate([
        { path: 'laufzettel_received' },
        { path: 'laufzettel_submitted' },
        { path: 'eventreports' },
        { path: 'evaluierungen_received' },
        { path: 'evaluierungen_submitted' },
        { path: 'flipRef' }
    ]);
});

// Optional: Add a virtual field for dynamic calculations
MitarbeiterSchema.virtual('evaluierungSoll').get(function () {
    return this.laufzettel_received ? this.laufzettel_received.length : 0;
});

const Mitarbeiter = mongoose.model('Mitarbeiter', MitarbeiterSchema);

module.exports = Mitarbeiter;
