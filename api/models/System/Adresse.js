const mongoose = require('mongoose');

const AdresseSchema = new mongoose.Schema({
	nummer: {
		type: String,
		required: true,
		unique: true,
		index: true,
		trim: true,
	},
	art: {
		type: String,
		required: true,
		enum: ['K', 'A', 'P'],
		index: true,
	},
	name1: { type: String, default: null, trim: true },
	name2: { type: String, default: null, trim: true },
	name: { type: String, default: null, trim: true },
	branche: { type: String, default: null, trim: true },
	strasse: { type: String, default: null, trim: true },
	nat: { type: String, default: null, trim: true },
	plz: { type: String, default: null, trim: true },
	ort: { type: String, default: null, trim: true },
	telefone: [{ type: String, trim: true }],
	land: { type: String, default: null, trim: true },
	anrede: { type: String, default: null, trim: true },
	knr: { type: String, default: null, trim: true, index: true },
	trans: { type: String, default: null, trim: true },
	email: { type: String, default: null, trim: true, lowercase: true },
	homepage: { type: String, default: null, trim: true },
	isRechnAdr: { type: Boolean, default: false, index: true },
	isPostAdr: { type: Boolean, default: false, index: true },
	isActive: { type: Boolean, default: true, index: true },
	importiertAm: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Adresse', AdresseSchema);
