const mongoose = require('mongoose');

const ZvooveVerfuegbarkeitSchema = new mongoose.Schema({
  // Zvoove internal ID – unique key for upserts
  zvooveId: {
    type: Number, // ID from EINSATZZEIT_TAEGLICH
    required: true,
    unique: true,
    index: true,
  },
  personalnr: {
    type: Number, // PERSONALNR
    required: true,
    index: true,
  },
  datum: {
    type: Date, // DATUM – the calendar date of the entry
    required: true,
    index: true,
  },
  von: {
    type: Date, // VON – start datetime (e.g. "24.04.2026 13:15:00")
    default: null,
  },
  bis: {
    type: Date, // BIS – end datetime
    default: null,
  },
  info: {
    type: String, // INFO – free-text note
    default: null,
  },
  verfuegbar: {
    type: Boolean, // VERFUEGBAR: 0 = nicht verfügbar, 1 = verfügbar
    required: true,
  },
  ganztaegig: {
    type: Boolean, // GANZTAEGIG: 1 = ganztägig
    default: false,
  },
  anlagebediener: {
    type: String, // ANLAGEBEDIENER
    default: null,
  },
  zuletztBearbeitet: {
    type: Date, // ZULETZTBEARBEITET – same format as VON/BIS
    default: null,
  },
  // Timestamp of last import (for tracking)
  importiertAm: {
    type: Date,
    default: Date.now,
  }
});

// ─── Helper: extract "HH:MM" from a Date using local server time ───
function _timeStr(d) {
  if (!d) return null;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Converts a ZvooveVerfuegbarkeit document to display-only objects
 * compatible with DispoTable's eintrag and comment shapes.
 *
 * Mapping:
 *   verfuegbar=false            → verfuegbarkeit: 'blocked'  (mit Zeitraum falls vorhanden)
 *   verfuegbar=true, ganztaegig → verfuegbarkeit: 'available' (kein Zeitraum)
 *   verfuegbar=true, mit Zeit   → verfuegbarkeit: 'partially' (mit Zeitraum)
 *
 * @param {Object} v    – plain Mongoose document (lean)
 * @param {*}     maId – Mitarbeiter._id (ObjectId or string)
 * @returns {{ eintrag: Object, comment: Object|null }}
 */
ZvooveVerfuegbarkeitSchema.statics.toDispoDisplay = function (v, maId) {
  const datum = v.datum ? v.datum.toISOString().slice(0, 10) : null;

  // Determine verfuegbarkeit state
  let verfuegbarkeitStatus;
  if (!v.verfuegbar) {
    verfuegbarkeitStatus = 'blocked';
  } else if (v.ganztaegig) {
    verfuegbarkeitStatus = 'available';
  } else {
    verfuegbarkeitStatus = 'partially';
  }

  // Time range: only when NOT ganztaegig
  const zeitVon = (!v.ganztaegig && v.von) ? _timeStr(new Date(v.von)) : null;
  const zeitBis = (!v.ganztaegig && v.bis) ? _timeStr(new Date(v.bis)) : null;

  const eintrag = {
    _id: `zvoove_${v.zvooveId}`,
    _source: 'zvoove',
    mitarbeiter: maId,
    datumVon: v.datum,
    datumBis: v.datum,
    typ: 'verfuegbarkeit',
    verfuegbarkeit: verfuegbarkeitStatus,
    zeitVon,
    zeitBis,
  };

  // Virtual comment if info text is present
  let comment = null;
  const infoText = v.info ? String(v.info).trim() : null;
  if (infoText) {
    comment = {
      _id: `zvoove_comment_${v.zvooveId}`,
      _isZvoove: true,
      scope: 'dispo_day',
      text: infoText,
      author: v.anlagebediener ? `Zvoove (${v.anlagebediener})` : 'Zvoove',
      authorId: 'zvoove',
      readBy: [],
      context: {
        mitarbeiter: String(maId),
        datum,
      },
      createdAt: v.zuletztBearbeitet || v.datum,
    };
  }

  return { eintrag, comment };
};

module.exports = mongoose.model('ZvooveVerfuegbarkeit', ZvooveVerfuegbarkeitSchema);
