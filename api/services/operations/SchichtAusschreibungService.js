const Schicht = require('../../models/Event/Schicht');
const Auftrag = require('../../models/Event/Auftrag');
const logger = require('../../utils/logger');

const BERLIN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const BERLIN_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function getBerlinNowParts(now = new Date()) {
  return {
    dateKey: BERLIN_DATE_FMT.format(now), // YYYY-MM-DD
    timeKey: BERLIN_TIME_FMT.format(now), // HH:MM
  };
}

function toBerlinDateKey(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return BERLIN_DATE_FMT.format(d);
}

function normalizeTimeKey(rawTime) {
  const str = String(rawTime || '').trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(str);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * Checks whether a shift has already started in Europe/Berlin time.
 * - If the start date (datumVon || datumBis || auftrag.vonDatum) is before today -> started.
 * - If the start date is today and uhrzeitVon is set and <= current Berlin HH:MM -> started.
 * - If no uhrzeitVon is set, it is treated as started once the date is strictly before today.
 */
function hasSchichtStarted(schicht, auftrag = null, now = new Date()) {
  const { dateKey: todayKey, timeKey: nowTimeKey } = getBerlinNowParts(now);
  const startDateKey =
    toBerlinDateKey(schicht?.datumVon) ||
    toBerlinDateKey(schicht?.datumBis) ||
    toBerlinDateKey(auftrag?.vonDatum) ||
    toBerlinDateKey(auftrag?.bisDatum);

  if (!startDateKey) return false;
  if (startDateKey < todayKey) return true;
  if (startDateKey > todayKey) return false;

  const startTimeKey = normalizeTimeKey(schicht?.uhrzeitVon);
  if (!startTimeKey) return false;
  return startTimeKey <= nowTimeKey;
}

/**
 * Automatically sets `istAusgeschrieben: false` on all currently published Schichten
 * that have already started (in the past).
 * Can be called both from serverRoutines (cron) and on-the-fly during reads.
 */
async function expireStartedSchichtAusschreibungen(now = new Date()) {
  const openSchichten = await Schicht.find({ istAusgeschrieben: true })
    .select('_id auftragNr datumVon datumBis uhrzeitVon istAusgeschrieben')
    .lean();

  if (!openSchichten.length) {
    return { checked: 0, expiredCount: 0, expiredIds: [] };
  }

  const missingDateAuftragNrs = [
    ...new Set(
      openSchichten
        .filter((s) => !s.datumVon && !s.datumBis && s.auftragNr != null)
        .map((s) => s.auftragNr)
    ),
  ];

  const auftragByNr = new Map();
  if (missingDateAuftragNrs.length) {
    const auftraege = await Auftrag.find({ auftragNr: { $in: missingDateAuftragNrs } })
      .select('auftragNr vonDatum bisDatum')
      .lean();
    for (const a of auftraege) {
      auftragByNr.set(a.auftragNr, a);
    }
  }

  const expiredIds = [];
  const affectedAuftragNrs = new Set();

  for (const schicht of openSchichten) {
    const auftrag = auftragByNr.get(schicht.auftragNr) || null;
    if (hasSchichtStarted(schicht, auftrag, now)) {
      expiredIds.push(schicht._id);
      if (schicht.auftragNr != null) affectedAuftragNrs.add(schicht.auftragNr);
    }
  }

  if (expiredIds.length) {
    await Schicht.updateMany(
      { _id: { $in: expiredIds }, istAusgeschrieben: true },
      { $set: { istAusgeschrieben: false } }
    );
    if (affectedAuftragNrs.size) {
      await Auftrag.updateMany(
        { auftragNr: { $in: [...affectedAuftragNrs] } },
        { $inc: { planningVersion: 1 } }
      );
    }
    logger.info(
      `[SchichtAusschreibungService] Auto-expired ${expiredIds.length} started Schicht Ausschreibung(en).`
    );
  }

  return {
    checked: openSchichten.length,
    expiredCount: expiredIds.length,
    expiredIds: expiredIds.map(String),
  };
}

module.exports = {
  hasSchichtStarted,
  expireStartedSchichtAusschreibungen,
};
