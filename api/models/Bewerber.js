const mongoose = require('mongoose');

const BewerberNotizSchema = new mongoose.Schema(
	{
		text: { type: String, required: true, trim: true, maxlength: 5000 },
		erstelltVon: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
		erstelltVonName: { type: String, trim: true, default: '' },
		typ: {
			type: String,
			enum: ['note', 'status_change', 'conversion', 'system'],
			default: 'note',
		},
	},
	{ timestamps: true, _id: false }
);

const BewerberSchema = new mongoose.Schema(
	{
		status: {
			type: String,
			enum: ['neu', 'abgelehnt', 'warten', 'vg_terminiert', 'vu_terminiert', 'eingestellt'],
			default: 'neu',
			index: true,
		},
		grunddaten: {
			anrede: { type: String, trim: true, default: '' },
			vorname: { type: String, trim: true, default: '' },
			nachname: { type: String, trim: true, default: '' },
			email: { type: String, lowercase: true, trim: true, default: null, index: true },
			telefon1: { type: String, trim: true, default: '' },
			geschaeftsstelle: { type: String, trim: true, default: '' },
			homepage: { type: String, trim: true, default: '' },
			standort: {
				type: String,
				enum: ['Hamburg', 'Berlin', 'Köln', 'Unbekannt'],
				default: 'Unbekannt',
				index: true,
			},
			wohnsitz: {
				strasse: { type: String, trim: true, default: '' },
				plz: { type: String, trim: true, default: '' },
				ort: { type: String, trim: true, default: '' },
				land: { type: String, trim: true, default: 'Deutschland' },
			},
			staatsangehoerigkeit: { type: String, trim: true, default: '' },
			familienstand: { type: String, trim: true, default: '' },
			geburtsdatum: { type: Date, default: null },
			geschlecht: { type: String, trim: true, default: '' },
		},
		quelle: { type: String, trim: true, default: '' },

		anstellungsverhaeltnis: {
			art: { type: String, trim: true, default: '' },
			tageAuf70TageGearbeitet: { type: Number, default: 0, min: 0 },
			andereJobs: { type: String, trim: true, default: '' },
			schuelerOderStudent: { type: String, trim: true, default: '' },
			privatVersichert: { type: Boolean, default: false },
			krankenkasse: { type: String, trim: true, default: '' },
			ausweisnummer: { type: String, trim: true, default: '' },
			sozialversicherungsnummer: { type: String, trim: true, default: '' },
			iban: { type: String, trim: true, default: '' },
			bic: { type: String, trim: true, default: '' },
			mobilitaet: {
				fuehrerscheine: { type: [String], default: [] },
				dTicket: { type: Boolean, default: false },
				pkw: {
					eigenesFahrzeug: { type: Boolean, default: false },
					nutzungserlaubnis: { type: Boolean, default: false },
				},
			},
		},

		tags: { type: [String], default: [] },
		notizen: { type: [BewerberNotizSchema], default: [] },

		technischeDaten: {
			asanaTaskGid: { type: String, trim: true, sparse: true, unique: true },
			asanaProjectId: { type: String, trim: true, default: '' },
			asanaSectionId: { type: String, trim: true, default: '' },
			asanaTaskUrl: { type: String, trim: true, default: '' },
			r2Ordner: {
				pfad: { type: String, trim: true, default: '' },
				url: { type: String, trim: true, default: '' },
			},
			sourceMeta: {
				teamKey: { type: String, trim: true, default: '' },
				mailboxUpn: { type: String, trim: true, default: '' },
				parserLabel: { type: String, trim: true, default: '' },
				importHint: { type: String, trim: true, default: '' },
			},
			rawSnapshot: {
				subject: { type: String, trim: true, default: '' },
				notes: { type: String, default: '' },
				htmlNotes: { type: String, default: '' },
				payload: { type: mongoose.Schema.Types.Mixed, default: null },
			},
		},

		convertedToMitarbeiter: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Mitarbeiter',
			default: null,
			index: true,
		},
		convertedAt: { type: Date, default: null },
		convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

		rejectedAt: { type: Date, default: null },
		rejectedReason: { type: String, trim: true, default: '' },
		archivedAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

BewerberSchema.index({ status: 1, createdAt: -1 });
BewerberSchema.index({ 'grunddaten.standort': 1, status: 1 });
BewerberSchema.index({ 'grunddaten.email': 1, createdAt: -1 });

module.exports = mongoose.model('Bewerber', BewerberSchema);
