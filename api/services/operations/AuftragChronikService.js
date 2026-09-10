const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const Auftrag = require('../../models/Event/Auftrag');
const Schicht = require('../../models/Event/Schicht');
const Einsatz = require('../../models/Event/Einsatz');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const User = require('../../models/System/User');
const Entry = require('../../models/Event/AuftragChronikEntry');
const asyncHandler = require('../../middleware/AsyncHandler');

// Only connection.transaction() scopes inherit a session; imports and ordinary queries are unaffected.
mongoose.set('transactionAsyncLocalStorage', true);

const LABELS = {
  geschSt: 'Geschäftsstelle', locationV2: 'Standort', kundenNr: 'Kunde', eventTitel: 'Titel',
  bediener: 'Bearbeiter', dtAngelegtAm: 'Angelegt am', bestDatum: 'Bestelldatum',
  vonDatum: 'Beginn', bisDatum: 'Ende', eventLocation: 'Location', eventStrasse: 'Straße',
  eventPlz: 'PLZ', eventOrt: 'Ort', aktiv: 'Aktiv', auftStatus: 'Status', referenz: 'Referenz',
  excludedTeamleiter: 'Ausgeschlossene Teamleiter', statusOverrideTeamleiter: 'Teamleiter-Freigaben',
  labels: 'Labels', einsatzort: 'Einsatzort', isPseudo: 'Pseudo', source: 'Herkunft',
  bezeichnung: 'Bezeichnung', treffpunkt: 'Treffpunktzeit', treffpunktOrt: 'Treffpunkt',
  ansprechpartnerName: 'Ansprechpartner', ansprechpartnerTelefon: 'Telefon', ansprechpartnerEmail: 'E-Mail',
  letzteAusschreibung: 'Letzte Ausschreibung', datumVon: 'Datum von', datumBis: 'Datum bis',
  uhrzeitVon: 'Uhrzeit von', uhrzeitBis: 'Uhrzeit bis', typ: 'Typ', berufSchl: 'Beruf',
  qualSchl: 'Qualifikation', bedarf: 'Bedarf', garantiestundenLohn: 'Garantiestunden', endeOffen: 'Ende offen',
  personalNr: 'Mitarbeiter', schicht: 'Schicht', idAuftragArbeitsschichten: 'Externe Schichtnummer',
  schichtBezeichnung: 'Schichtbezeichnung', detailDatumVon: 'Detaildatum von', detailDatumBis: 'Detaildatum bis',
  cProtBediener: 'Protokoll-Bearbeiter', dtProtDatum: 'Protokolldatum',
  stundenlisteIncluded: 'In Stundenliste enthalten', conflictOverride: 'Bestätigter Planungskonflikt',
  'einsatzinformation.sourceHtml': 'Einsatzinformation – Vorlage',
  'einsatzinformation.renderedHtml': 'Einsatzinformation – Inhalt',
  'einsatzinformation.template': 'Einsatzinformation – Vorlagen-ID',
  'einsatzinformation.templateVersion': 'Einsatzinformation – Version',
  'einsatzinformation.customized': 'Einsatzinformation – Individuell angepasst',
};
const FIELDS = {
  Auftrag: 'geschSt locationV2 kundenNr eventTitel bediener dtAngelegtAm bestDatum vonDatum bisDatum eventStrasse eventPlz eventOrt eventLocation aktiv auftStatus referenz excludedTeamleiter statusOverrideTeamleiter labels einsatzort isPseudo source'.split(' '),
  Schicht: 'bezeichnung treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon ansprechpartnerEmail letzteAusschreibung datumVon datumBis uhrzeitVon uhrzeitBis typ berufSchl qualSchl bedarf garantiestundenLohn endeOffen einsatzinformation.sourceHtml einsatzinformation.renderedHtml einsatzinformation.template einsatzinformation.templateVersion einsatzinformation.customized'.split(' '),
  Einsatz: 'personalNr berufSchl qualSchl bezeichnung datumVon datumBis cProtBediener dtProtDatum schicht idAuftragArbeitsschichten schichtBezeichnung treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon ansprechpartnerEmail letzteAusschreibung detailDatumVon detailDatumBis uhrzeitVon uhrzeitBis typ bedarf garantiestundenLohn endeOffen isPseudo stundenlisteIncluded conflictOverride'.split(' '),
};

function canonical(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  if (value?.toHexString) return value.toHexString();
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => !['_id', 'confirmedAt', 'confirmedBy'].includes(key))
    .map(key => [key, canonical(value[key])]));
  return value;
}

function valueAt(doc, field) { return field.split('.').reduce((value, key) => value?.[key], doc); }
function formatValue(value) {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (Array.isArray(value)) return value.map(formatValue).join(', ') || '—';
  if (typeof value === 'object') return value.name || JSON.stringify(value);
  return String(value);
}

function fieldLabel(field, value, names) {
  if (value === null) return '—';
  if (field === 'personalNr') return names.get(String(value)) || `Personal ${value}`;
  if (field.includes('Html')) return sanitizeHtml(String(value), { allowedTags: [], allowedAttributes: {} }) || '—';
  if (field === 'auftStatus') return ({ 1: 'Entwurf', 2: 'Bestätigt' })[value] || String(value);
  return formatValue(value);
}

function recordLabel(entity, record, names) {
  if (entity === 'Auftrag') return record.eventTitel || `Auftrag #${record.auftragNr}`;
  if (entity === 'Schicht') return record.bezeichnung || 'Schicht';
  return [names.get(String(record.personalNr)) || `Personal ${record.personalNr ?? 'unbekannt'}`,
    record.schichtBezeichnung, record.uhrzeitVon].filter(Boolean).join(' · ');
}

function buildChanges(before, after, names = new Map()) {
  const changes = [];
  for (const entity of Object.keys(FIELDS)) {
    const oldRecords = new Map((before[entity] || []).map(record => [String(record._id), record]));
    const newRecords = new Map((after[entity] || []).map(record => [String(record._id), record]));
    for (const id of new Set([...oldRecords.keys(), ...newRecords.keys()])) {
      const oldRecord = oldRecords.get(id);
      const newRecord = newRecords.get(id);
      const fields = FIELDS[entity].flatMap(field => {
        const oldValue = canonical(valueAt(oldRecord, field));
        const newValue = canonical(valueAt(newRecord, field));
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
        return [{ field, label: LABELS[field], before: oldValue, after: newValue,
          beforeLabel: fieldLabel(field, oldValue, names), afterLabel: fieldLabel(field, newValue, names) }];
      });
      if (!fields.length && oldRecord && newRecord) continue;
      changes.push({ entity, entityId: id, label: recordLabel(entity, newRecord || oldRecord, names),
        action: !oldRecord ? 'created' : !newRecord ? 'deleted' : 'updated', fields });
    }
  }
  return changes;
}

async function snapshot(auftragNr) {
  if (!Number.isSafeInteger(auftragNr) || auftragNr <= 0) return {};
  const order = await Auftrag.findOne({ auftragNr }).lean();
  if (!order) return {};
  // Sequential queries keep all reads in the same transaction snapshot.
  const shifts = await Schicht.find({ auftragNr }).lean();
  const assignments = await Einsatz.find({ auftragNr }).lean();
  return { Auftrag: [order], Schicht: shifts, Einsatz: assignments };
}

async function employeeNames(before, after) {
  const numbers = [...new Set([...(before.Einsatz || []), ...(after.Einsatz || [])]
    .map(record => record.personalNr).filter(value => value != null).map(String))];
  if (!numbers.length) return new Map();
  const employees = await Mitarbeiter.find({ $or: [
    { personalnr: { $in: numbers } }, { personalnummern: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } },
  ] }).select('personalnr personalnummern personalnrHistory vorname nachname').lean();
  const names = new Map();
  for (const employee of employees) {
    const name = [employee.vorname, employee.nachname].filter(Boolean).join(' ');
    for (const number of [employee.personalnr, ...(employee.personalnummern || []), ...(employee.personalnrHistory || []).map(item => item.value)]) {
      if (number != null && name) names.set(String(number), `${name} (#${number})`);
    }
  }
  return names;
}

function summary(action, changes) {
  const verb = { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht', released: 'freigegeben' };
  if (action === 'planning.updated') return `Personalplanung geändert · ${changes.filter(item => item.entity === 'Einsatz').length} Einsätze`;
  const [entity, event] = action.split('.');
  const primary = changes.find(item => item.entity === entity);
  const affected = changes.filter(item => item !== primary).length;
  return `${entity} ${verb[event] || 'geändert'}${primary ? `: ${primary.label}` : ''}${affected ? ` · ${affected} weitere Datensätze` : ''}`;
}

class RejectedResponse extends Error {
  constructor(response) { super('Order mutation rejected'); this.response = response; }
}

/** Explicitly wraps app mutation routes only. The JSON response is sent after commit.
 * A transaction prevents partial cascades, lost audit writes and attribution of another user's writes.
 * Never add external effects (email, uploads) to handlers using this wrapper.
 */
function withAuftragChronik(action, handler) {
  return asyncHandler(async (req, res) => {
    let result;
    try {
      result = await mongoose.connection.transaction(async () => {
        const before = await snapshot(Number(req.params.auftragNr));
        const response = { statusCode: 200, body: undefined,
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; },
        };
        await handler(req, response);
        if (response.statusCode >= 400) throw new RejectedResponse(response);
        const orderNumber = Number(req.params.auftragNr ?? response.body?.auftragNr);
        const after = await snapshot(orderNumber);
        const changes = buildChanges(before, after, await employeeNames(before, after));
        if (changes.length) {
          const order = after.Auftrag?.[0] || before.Auftrag?.[0];
          const user = await User.findById(req.user?.id || req.user?._id).select('name email').lean();
          if (!user) throw new Error('Chronik: Benutzerkonto nicht gefunden');
          await Entry.create({ auftragId: order._id, auftragNr: order.auftragNr,
            orderTitle: order.eventTitel || '', locationV2: order.locationV2,
            kind: 'change', action, actor: { id: user._id, name: user.name || user.email },
            summary: summary(action, changes), changes });
        }
        return response;
      });
    } catch (error) {
      if (!(error instanceof RejectedResponse)) throw error;
      result = error.response;
    }
    res.status(result.statusCode).json(result.body);
  });
}

module.exports = { withAuftragChronik, buildChanges, canonical };
