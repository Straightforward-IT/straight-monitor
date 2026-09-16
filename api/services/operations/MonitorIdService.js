const Sequence = require('../../models/System/Sequence');

const ENTITY_TYPES = new Set(['auftrag', 'schicht', 'einsatz', 'mitarbeiter', 'kunde', 'adresse', 'rechnung']);
const MAX_SEQUENCE = 999999;

function normalizeLocationCode(value) {
  const code = String(value || '').trim();
  if (!/^[1-5]$/.test(code)) {
    throw new Error('Für eine Monitor-ID benötigt der Standort eine eindeutige einstellige externe ID von 1 bis 5');
  }
  return code;
}

async function allocateMonitorId(entityType, locationExternalId) {
  if (!ENTITY_TYPES.has(entityType)) throw new Error(`Unbekannter Monitor-ID-Typ: ${entityType}`);
  const locationCode = normalizeLocationCode(locationExternalId);
  const key = `monitor-id:${entityType}:${locationCode}`;
  let sequence;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      sequence = await Sequence.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      break;
    } catch (error) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }

  if (!sequence || sequence.value > MAX_SEQUENCE) {
    throw new Error(`Der Monitor-ID-Nummernkreis für ${entityType} am Standort ${locationCode} ist ausgeschöpft`);
  }

  return `M${locationCode}${String(sequence.value).padStart(6, '0')}`;
}

module.exports = { allocateMonitorId, normalizeLocationCode };