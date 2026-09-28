const Einsatz = require('../../models/Event/Einsatz');

const INVALIDATED_REASON_TIME_CHANGED = 'einsatzzeiten_geaendert';

function emptyBestaetigung() {
  return {
    version: null,
    einsatzzeitenGelesenAt: null,
    einsatzkleidungAt: null,
    ankunftspufferAt: null,
    completedAt: null,
  };
}

async function invalidateForTimeChange(filter) {
  const einsaetze = await Einsatz.find({
    ...filter,
    bestaetigungErforderlich: true,
  }).select('_id bestaetigt bestaetigung').lean();
  if (!einsaetze.length) return;

  const now = new Date();
  await Einsatz.bulkWrite(einsaetze.map((einsatz) => {
    const completed = einsatz.bestaetigt && einsatz.bestaetigung?.completedAt;
    return {
      updateOne: {
        filter: { _id: einsatz._id },
        update: {
          $set: {
            bestaetigt: false,
            bestaetigung: emptyBestaetigung(),
          },
          ...(completed ? {
            $push: {
              bestaetigungsHistorie: {
                ...einsatz.bestaetigung,
                invalidatedAt: now,
                invalidatedReason: INVALIDATED_REASON_TIME_CHANGED,
              },
            },
          } : {}),
        },
      },
    };
  }));
}

module.exports = {
  INVALIDATED_REASON_TIME_CHANGED,
  invalidateForTimeChange,
};
