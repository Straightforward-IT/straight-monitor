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
    telefon: { type: String, required: false, trim: true },
    iban: { type: String, required: false, trim: true, uppercase: true },
    fuehrerscheine: [{
            klasse: { type: String, trim: true, default: null },
            gueltigVon: { type: Date, default: null },
            gueltigBis: { type: Date, default: null },
            source: { type: String, enum: ['import', 'manual'], default: 'manual' },
    }],
    // Legacy single-license field; retained for migration of existing records.
    fuehrerschein: {
        klasse: { type: String, trim: true, default: null },
        gueltigVon: { type: Date, default: null },
        gueltigBis: { type: Date, default: null },
        hatAuto: { type: Boolean, default: null },
    },
    // Hauptadresse (Adresse 1) aus Zvoove — Tel/Email der Hauptadresse fließen in telefon/email.
    adresse: {
        strasse: { type: String, trim: true },
        plz: { type: String, trim: true },
        ort: { type: String, trim: true },
        land: { type: String, trim: true },
    },
    // Zweitadresse (Adresse 2) inkl. eigener Kontaktdaten.
    adresse2: {
        strasse: { type: String, trim: true },
        plz: { type: String, trim: true },
        ort: { type: String, trim: true },
        land: { type: String, trim: true },
        telefon: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true },
    },
    locationV2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null,
        index: true,
    },
    // Immutable logical root for all employee-owned R2 objects.
    r2Prefix: { type: String, default: null, trim: true, immutable: true, sparse: true, unique: true },
    // Stable R2 folder name for employee-related signature documents.
    signaturOrdner: { type: String, default: null, trim: true },
    profilbild: { type: String, required: false, trim: true }, // R2 key for uploaded profile picture (fallback when no Flip photo)
    generierteDokumente: [{
        typ: { type: String, enum: ['kuendigung'], required: true },
        filename: { type: String, required: true, trim: true },
        r2Key: { type: String, required: true, trim: true },
        parameters: { type: mongoose.Schema.Types.Mixed, required: true },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    }],
    isActive: { type: Boolean, default: true },
    // Optional public portal entries enabled for this employee (e.g. 'new-menu-item').
    publicMenuOptions: [{ type: String, trim: true }],
    konfektionsgroesse: { type: String, required: false, trim: true },
    schuhgroesse: { type: String, required: false, trim: true },
    geburtsdatum: { type: Date, required: false },
    geburtsname: { type: String, required: false, trim: true },
    geburtsort: { type: String, required: false, trim: true },
    nationalitaet: { type: String, required: false, trim: true },
    eintrittsdatum: { type: Date, required: false },
    austrittsdatum: { type: Date, required: false },
    arbeitsverhaeltnis: {
        von: { type: Date, default: null },
        typ: { type: Number, enum: [0, 1, 2, 3], default: null },
        durchschnittBeiFortfuehren: { type: Boolean, default: null },
        // 0 = Vollzeit, 1 = Teilzeit, 2 = Geringfügig Beschäftigt (603€ Limitiert), 3 = Kurzfristig Beschäftigt
    },
    // Arbeitstage bei Vorarbeitgebern für die 70-Tage-Regel. Der Wert gilt nur
    // für das angegebene Kalenderjahr und wird danach in der Anzeige zurückgesetzt.
    vorarbeitgebertage: {
        year: { type: Number, default: null },
        days: { type: Number, default: 0, min: 0 },
        correction: {
            year: { type: Number, default: null },
            originalDays: { type: Number, default: null },
            deductedOwnAssignments: { type: Number, default: null },
            correctedAt: { type: Date, default: null },
        },
    },
    // Deprecated: superseded by `lohnStammdaten`. Kept so documents that have not
    // been migrated yet still resolve. Migrate with scripts/backfillLohnStammdaten.js.
    arbeitszeit: [{
        month: { type: String, trim: true, default: null, match: /^\d{4}-\d{2}$/ },
        von: { type: Date, default: null },
        bis: { type: Date, default: null },
        montag: { type: Number, default: null },
        dienstag: { type: Number, default: null },
        mittwoch: { type: Number, default: null },
        donnerstag: { type: Number, default: null },
        freitag: { type: Number, default: null },
        samstag: { type: Number, default: null },
        sonntag: { type: Number, default: null },
        woche: { type: Number, default: null },
        monat: { type: Number, default: undefined },
        zeitkontoPlusLimit: { type: Number, default: null },
        zeitkontoMinusLimit: { type: Number, default: null },
    }],
    // Monthly payroll master data. One snapshot per `YYYY-MM`, because both the
    // contractual working time and the tax class can change from month to month.
    // `arbeitszeit.monat` is never written for new snapshots: the monthly target is
    // derived from `arbeitszeit.woche` and the non-weekend days of the requested month.
    lohnStammdaten: [{
        month: { type: String, trim: true, default: null, match: /^\d{4}-\d{2}$/ },
        sourceId: { type: String, default: null, trim: true },
        persgruppe: {
            type: Number, default: null,
            validate: value => value == null || [101, 110, 109, 106].includes(value),
        },
        persgruppe_set_explicitly: { type: Boolean, default: false },
        von: { type: Date, default: null },
        bis: { type: Date, default: null },
        arbeitszeit: {
            montag: { type: Number, default: null },
            dienstag: { type: Number, default: null },
            mittwoch: { type: Number, default: null },
            donnerstag: { type: Number, default: null },
            freitag: { type: Number, default: null },
            samstag: { type: Number, default: null },
            sonntag: { type: Number, default: null },
            woche: { type: Number, default: null },
            // Legacy only. New snapshots derive this value from `woche` and the requested month.
            monat: { type: Number, default: undefined },
            zeitkontoPlusLimit: { type: Number, default: null },
            zeitkontoMinusLimit: { type: Number, default: null },
        },
        steuer: {
            // German Lohnsteuerklasse I–VI (stored as 1–6).
            klasse: { type: Number, default: null, min: 1, max: 6 },
            // Only meaningful for Steuerklasse IV (Faktorverfahren).
            faktor: { type: Number, default: null, min: 0 },
        },
    }],
    // Legacy reads only; new writes belong to lohnStammdaten.
    persgruppe: {
        type: Number,
        required: false,
        enum: [101, 110, 109, 106],
        // 101 = Festangestellt, 110 = Kurzfristig Angestellt, 109 = Geringfügig Angestellt, 106 = Werkstudent
    },
    persgruppe_set_explicitly: { type: Boolean, default: undefined }, // Legacy manual protection; new flags are monthly.
    isBewerberstatus: { type: Boolean, default: false }, // true wenn Persstatus=1 (Bewerber, noch kein vollständiger MA)
    isStudent: { type: Boolean, default: false },
    isSchueler: { type: Boolean, default: false },
    studieninformationen: {
        hochschule: { type: String, default: '', trim: true },
        studiengang: { type: String, default: '', trim: true },
        startDate: { type: Date, default: null },
        expectedCompletionDate: { type: Date, default: null },
    },
    schulinformationen: {
        schule: { type: String, default: '', trim: true },
        startDate: { type: Date, default: null },
        expectedCompletionDate: { type: Date, default: null },
    },
    steuerId: { type: String, default: '', trim: true, select: false },
    sozialversicherungsnummer: { type: String, default: '', trim: true, select: false },
    versicherungsnachweisTyp: { type: String, enum: ['', 'KRANKENKASSENKARTE', 'SONSTIGES'], default: '' },
    hatWeitereBeschaeftigungen: { type: Boolean, default: null },
    berufe: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Beruf' }],
    qualifikationen: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Qualifikation' }],
    // ── Legacy v1 Arrays (nicht mehr für v2 Laufzettel benutzen!) ──
    // v2 nutzt query-basiertes Referenzieren:
    //   Laufzettel.find({ mitarbeiter: userId })  → MA-Sicht
    //   Laufzettel.find({ teamleiter: userId })   → TL-Sicht
    //   EventReport.find({ teamleiter: userId })  → TL EventReports
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
    kundenwuensche: [{
        kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', required: true },
        typ: { type: String, enum: ['positiv', 'negativ'], required: true },
        kommentar: { type: String, default: '' },
        angelegtVon: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        angelegtAm: { type: Date, default: Date.now },
    }],
    dateCreated: { type: Date, default: Date.now },
    dispoNotiz: { type: String, default: '' },
    // dispoAktivitaetsLog migrated to Comment collection (scope: 'chronik')
    rank: { type: String, default: null },           // aktueller Rang-Tier-Key (z.B. 'gold', 'diamond')
    einsatzCount: { type: Number, default: null },   // gecachte Anzahl gestarteter Einsätze (für Rang)
    einsatzCountUpdatedAt: { type: Date, default: null },
    birthdayGroupActive: { type: Boolean, default: false }, // true solange Geburtstags-Gruppe als Primary gesetzt ist
}, { timestamps: true });

MitarbeiterSchema.pre('validate', function initializeR2Prefix(next) {
    if (this.isNew && !this.r2Prefix && this._id) {
        this.r2Prefix = `employees/${this._id}`;
    }
    next();
});

MitarbeiterSchema.methods.formatName = function formatName(format = 'first-last') {
    const vorname = this.vorname?.trim() || '';
    const nachname = this.nachname?.trim() || '';

    if (format === 'last-first') {
        return [nachname, vorname].filter(Boolean).join(', ');
    }

    return [vorname, nachname].filter(Boolean).join(' ');
};

const ARBEITSZEIT_FIELDS = [
    'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
    'woche', 'monat', 'zeitkontoPlusLimit', 'zeitkontoMinusLimit',
];

function toPlain(value) {
    if (!value || typeof value !== 'object') return value;
    return typeof value.toObject === 'function' ? value.toObject() : value;
}

function normalizeSnapshotEntries(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(entry => entry && typeof entry === 'object');
    if (typeof value === 'object') return [value];
    return [];
}

function legacyArbeitszeitToLohnStammdaten(entry) {
    const plain = toPlain(entry) || {};
    const arbeitszeit = {};
    for (const field of ARBEITSZEIT_FIELDS) {
        if (plain[field] != null) arbeitszeit[field] = plain[field];
    }
    return {
        month: plain.month ?? null,
        von: plain.von ?? null,
        bis: plain.bis ?? null,
        arbeitszeit,
        steuer: {},
    };
}

// Modern snapshots win per month; unmigrated legacy entries stay available so that
// history is never lost while `backfillLohnStammdaten.js` has not run yet.
function collectLohnStammdaten(doc) {
    const modern = normalizeSnapshotEntries(doc?.lohnStammdaten).map(toPlain);
    const legacy = normalizeSnapshotEntries(doc?.arbeitszeit).map(legacyArbeitszeitToLohnStammdaten);
    const coveredMonths = new Set(modern.map(entry => entry.month).filter(Boolean));
    const entries = [...modern, ...legacy.filter(entry => !entry.month || !coveredMonths.has(entry.month))];
    if (doc?.persgruppe != null || doc?.persgruppe_set_explicitly) {
        const month = currentPayrollMonthKey();
        const current = entries.find(entry => entry.month === month);
        if (current?.persgruppe == null && !current?.sourceId && !current?.persgruppe_set_explicitly) {
            const start = new Date(`${month}-01T00:00:00Z`);
            const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
            const applicableLegacy = newestByStart(entries.filter(entry => !entry.month && overlapsMonth(entry, start, end)));
            const snapshot = { ...(current || applicableLegacy), month, persgruppe: doc.persgruppe ?? null, persgruppe_set_explicitly: !!doc.persgruppe_set_explicitly };
            return [...entries.filter(entry => entry.month !== month), snapshot];
        }
    }
    return entries;
}

function normalizeMonthKey(year, month) {
    if (typeof year === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(year) && month == null) return year;
    const numericYear = Number(year);
    const numericMonth = Number(month);
    if (!Number.isInteger(numericYear) || numericYear < 1000 || numericYear > 9999
        || !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return null;
    return `${numericYear}-${String(numericMonth).padStart(2, '0')}`;
}

function overlapsMonth(entry, monthStart, monthEnd) {
    const from = entry?.von ? new Date(entry.von) : null;
    const till = entry?.bis ? new Date(entry.bis) : null;
    if (from && (!Number.isFinite(from.getTime()) || from > monthEnd)) return false;
    if (till && (!Number.isFinite(till.getTime()) || till < monthStart)) return false;
    return true;
}

function newestByStart(entries) {
    return [...entries].sort((left, right) => {
        const leftDate = left?.von ? new Date(left.von).getTime() : 0;
        const rightDate = right?.von ? new Date(right.von).getTime() : 0;
        return rightDate - leftDate;
    })[0] || null;
}

MitarbeiterSchema.methods.getLohnStammdatenForMonth = function (year, month) {
    const monthKey = normalizeMonthKey(year, month);
    if (!monthKey) return null;
    const entries = collectLohnStammdaten(this);
    if (!entries.length) return null;

    const monthStart = new Date(`${monthKey}-01T00:00:00Z`);
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    // LGELENA records describe the actual payroll month independently of the
    // contractual working-time validity carried over from the personnel import.
    const exactMatches = entries.filter(entry => entry.month === monthKey && (entry.sourceId || overlapsMonth(entry, monthStart, monthEnd)));
    if (exactMatches.length) return newestByStart(exactMatches);

    // Records created before monthly snapshots existed have no `month`.
    // They remain valid only inside their contractual von/bis interval.
    const legacyMatches = entries.filter(entry => !entry.month && overlapsMonth(entry, monthStart, monthEnd));
    return newestByStart(legacyMatches);
};

// Returns the flattened working-time shape ({ month, von, bis, montag, …, woche, … }).
MitarbeiterSchema.methods.getArbeitszeitSnapshotForMonth = function (year, month) {
    const entry = this.getLohnStammdatenForMonth(year, month);
    if (!entry) return null;
    return {
        month: entry.month ?? null,
        von: entry.von ?? null,
        bis: entry.bis ?? null,
        ...(toPlain(entry.arbeitszeit) || {}),
    };
};

MitarbeiterSchema.methods.getSteuerklasseForMonth = function (year, month) {
    const entry = this.getLohnStammdatenForMonth(year, month);
    const klasse = Number(toPlain(entry?.steuer)?.klasse ?? null);
    return Number.isInteger(klasse) && klasse >= 1 && klasse <= 6 ? klasse : null;
};

MitarbeiterSchema.methods.getPersgruppeForMonth = function (year, month) {
    const monthKey = normalizeMonthKey(year, month);
    if (!monthKey) return null;
    const entry = collectLohnStammdaten(this).find(snapshot => snapshot.month === monthKey);
    if (entry?.persgruppe != null) return entry.persgruppe;
    if (entry?.persgruppe_set_explicitly || entry?.sourceId) return null;
    // A global legacy value cannot establish a historical person group.
    return monthKey === this.constructor.currentPayrollMonth() ? this.persgruppe ?? null : null;
};

MitarbeiterSchema.methods.getMonthlyWorkingHours = function (year, month) {
    const monthKey = normalizeMonthKey(year, month);
    if (!monthKey) return null;
    const snapshot = this.getArbeitszeitSnapshotForMonth(monthKey);
    if (!snapshot) return null;

    const legacyMonthlyValue = Number(snapshot.monat ?? null);
    const weekHours = Number(snapshot.woche ?? null);
    if (Number.isFinite(legacyMonthlyValue) && legacyMonthlyValue > 0 && (!Number.isFinite(weekHours) || weekHours <= 0)) {
        return legacyMonthlyValue;
    }
    if (!Number.isFinite(weekHours) || weekHours <= 0) {
        if (Number.isFinite(legacyMonthlyValue) && legacyMonthlyValue > 0) return legacyMonthlyValue;
        return null;
    }

    const [yearValue, normalizedMonth] = monthKey.split('-').map(Number);
    const monthDays = new Date(Date.UTC(yearValue, normalizedMonth, 0)).getUTCDate();
    let workdays = 0;
    for (let day = 1; day <= monthDays; day += 1) {
        const weekday = new Date(Date.UTC(yearValue, normalizedMonth - 1, day)).getUTCDay();
        if (weekday !== 0 && weekday !== 6) workdays += 1;
    }
    return (weekHours * workdays) / 5;
};

MitarbeiterSchema.statics.lohnStammdatenFromLegacyArbeitszeit = function (value) {
    return normalizeSnapshotEntries(value).map(legacyArbeitszeitToLohnStammdaten);
};

function currentPayrollMonthKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit',
    }).formatToParts(new Date());
    return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
}

MitarbeiterSchema.statics.currentPayrollMonth = currentPayrollMonthKey;

MitarbeiterSchema.statics.collectLohnStammdaten = function (doc) {
    return collectLohnStammdaten(doc);
};

MitarbeiterSchema.statics.mergeLohnStammdatenSnapshot = function (value, snapshot) {
    const existing = normalizeSnapshotEntries(value).map(entry => ({ ...toPlain(entry) }));
    if (!snapshot?.month || !normalizeMonthKey(snapshot.month)) return existing;
    return [
        ...existing.filter(entry => entry.month !== snapshot.month),
        { ...snapshot },
    ].sort((left, right) => String(left.month || '').localeCompare(String(right.month || '')));
};


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
        { key: "berufe" },
        { key: "qualifikationen" }
    ];

    fieldsToCheck.forEach(({ key, populate }) => {
        // Check if the field exists in the document and is not empty
        if (this[key] && this[key].length > 0) {
            const populateConfig = { path: key };
            
            // For simple arrays of references (berufe/qualifikationen), 
            // no nested populate config needed if we just want the document
            // If populate is provided (for complex nested populations above), use it
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

/** Read the tariff base rate for this stable employee ID; defaults to today in Berlin.
 * Returns RESOLVED with an exact decimal string and group/stage/period context,
 * or UNRESOLVED with a concrete code/message. Does not change employee data.
 */
MitarbeiterSchema.methods.getTariffBaseRate = function (date, context) {
    // Lazy require avoids the service's reference to the Mitarbeiter model at startup.
    const tariffs = require('../../services/tariffs/TariffService');
    return tariffs.baseRate(this._id, date === undefined ? tariffs.currentTariffDate() : date, context);
};

/** Read independent ÜTZ values (DPREIS etc.) at a date, defaulting to today in Berlin.
 * Missing or overlapping histories return UNRESOLVED; values are never summed.
 */
MitarbeiterSchema.methods.getAboveTariffValues = function (date, context) {
    const tariffs = require('../../services/tariffs/TariffService');
    return tariffs.aboveTariffValues(this._id, date === undefined ? tariffs.currentTariffDate() : date, context);
};

/** Exact hourly tariff + DPREIS; an absent allowance is zero, ambiguity is not. */
MitarbeiterSchema.methods.getTariffHourlyWage = async function (date, context) {
    const tariffs = require('../../services/tariffs/TariffService');
    const { addDecimals } = require('../../services/tariffs/tariffMoney');
    const snapshot = context || await tariffs.createEmployeeContext(this);
    const day = date === undefined ? tariffs.currentTariffDate() : date;
    const [baseRate, aboveTariff] = await Promise.all([
        this.getTariffBaseRate(day, snapshot), this.getAboveTariffValues(day, snapshot),
    ]);
    if (baseRate.status !== 'RESOLVED') return baseRate;
    if (aboveTariff.status !== 'RESOLVED' && aboveTariff.code !== 'ABOVE_TARIFF_MISSING') return aboveTariff;
    const allowance = aboveTariff.values?.DPREIS ?? '0';
    return { status: 'RESOLVED', date: day, currency: 'EUR', value: addDecimals(baseRate.value, allowance),
        baseRate: baseRate.value, aboveTariff: allowance, activeImportId: snapshot.importId };
};

const Mitarbeiter = mongoose.model('Mitarbeiter', MitarbeiterSchema);

module.exports = Mitarbeiter;
