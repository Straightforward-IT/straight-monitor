const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const Auftrag = require('../../models/Event/Auftrag');
const Schicht = require('../../models/Event/Schicht');
const Einsatz = require('../../models/Event/Einsatz');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const User = require('../../models/System/User');
const Entry = require('../../models/Event/AuftragChronikEntry');
const asyncHandler = require('../../middleware/AsyncHandler');
const { SHARED_ORDER_FIELDS, OVERRIDE_FIELDS, resolveGroupOrderDefaults, resolveOrderOverrides } = require('./AuftragsgruppeOrderService');

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
  day: 'Starttag', auftragsgruppe: 'Auftragsgruppe', bestelltext: 'Bestellung',
  bestelltextOverride: 'Bestellung nur für diesen Tag', einsatzortOverride: 'Einsatzort nur für diesen Tag',
  eventTitelOverride: 'Titel nur für diesen Tag', referenzOverride: 'Referenz nur für diesen Tag',
  bestDatumOverride: 'Bestelldatum nur für diesen Tag',
  groupShiftKey: 'Gemeinsame Schicht', overrides: 'Tagesspezifische Felder',
  suppressedGroupShiftKeys: 'An diesem Tag unterdrückte Schichten', endDayOffset: 'Ende nach Starttag',
};
const FIELDS = {
  Auftrag: 'geschSt locationV2 kundenNr eventTitel bediener dtAngelegtAm bestDatum vonDatum bisDatum eventStrasse eventPlz eventOrt eventLocation aktiv auftStatus referenz excludedTeamleiter statusOverrideTeamleiter labels einsatzort isPseudo source day auftragsgruppe bestelltext bestelltextOverride einsatzortOverride eventTitelOverride referenzOverride bestDatumOverride suppressedGroupShiftKeys'.split(' '),
  Schicht: 'bezeichnung treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon ansprechpartnerEmail letzteAusschreibung datumVon datumBis uhrzeitVon uhrzeitBis typ berufSchl qualSchl bedarf garantiestundenLohn endeOffen day endDayOffset groupShiftKey overrides einsatzinformation.sourceHtml einsatzinformation.renderedHtml einsatzinformation.template einsatzinformation.templateVersion einsatzinformation.customized'.split(' '),
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
  const order = await Auftrag.findOne({ auftragNr }).select(['auftragNr', ...FIELDS.Auftrag].join(' ')).lean();
  if (!order) return {};
  const group = order.auftragsgruppe
    ? await resolveGroupOrderDefaults(await require('../../models/Event/Auftragsgruppe').findById(order.auftragsgruppe).lean()) : null;
  Object.assign(order, resolveOrderOverrides(order, group));
  // Sequential queries keep all reads in the same transaction snapshot.
  const shifts = await Schicht.find({ auftragNr }).select(['idAuftragArbeitsschichten', ...FIELDS.Schicht].join(' ')).lean();
  const assignments = await Einsatz.find({ auftragNr }).select(FIELDS.Einsatz.join(' ')).lean();
  return { Auftrag: [order], Schicht: shifts, Einsatz: assignments };
}

async function employeeNames(before, after) {
  const numbers = [...new Set([...(before.Einsatz || []), ...(after.Einsatz || [])]
    .map(record => record.personalNr).filter(value => value != null).map(String))];
  if (!numbers.length) return new Map();
  const employees = await Mitarbeiter.find({ $or: [
    { personalnr: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } },
  ] }).select('personalnr personalnrHistory vorname nachname').lean();
  const names = new Map();
  for (const employee of employees) {
    const name = [employee.vorname, employee.nachname].filter(Boolean).join(' ');
    for (const number of [employee.personalnr, ...(employee.personalnrHistory || []).map(item => item.value)]) {
      if (number != null && name) names.set(String(number), `${name} (#${number})`);
    }
  }
  return names;
}

function summary(action, changes) {
  const verb = { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht', released: 'freigegeben' };
  if (action === 'planning.updated') return `Personalplanung geändert · ${changes.filter(item => item.entity === 'Einsatz').length} Einsätze`;
  const [entity, event] = action.split('.');
  const primary = changes.find(item => item.entity === entity) || (changes.length === 1 ? changes[0] : null);
  const effectiveEntity = primary?.entity || entity;
  const effectiveEvent = primary && primary.entity !== entity ? primary.action : event;
  const affected = changes.filter(item => item !== primary).length;
  return `${effectiveEntity} ${verb[effectiveEvent] || 'geändert'}${primary ? `: ${primary.label}` : ''}${affected ? ` · ${affected} weitere Datensätze` : ''}`;
}

class RejectedResponse extends Error {
  constructor(response) { super('Order mutation rejected'); this.response = response; }
}

/** Explicitly wraps app mutation routes only. The JSON response is sent after commit.
 * A transaction prevents partial cascades, lost audit writes and attribution of another user's writes.
 * Never add external effects (email, uploads) to handlers using this wrapper.
 */
function withAuftragChronik(action, handler) {
  const wrapped = asyncHandler(async (req, res) => {
    // Legacy handlers use parseInt; reject partial numbers before either the write or snapshot.
    if (req.params.auftragNr !== undefined && (!/^\d+$/.test(req.params.auftragNr)
      || !Number.isSafeInteger(Number(req.params.auftragNr)) || Number(req.params.auftragNr) <= 0)) {
      return res.status(400).json({ message: 'Ungültige Auftragsnummer.' });
    }
    if (req.params.auftragNr) {
      const existing = await Auftrag.findOne({ auftragNr: Number(req.params.auftragNr) }).lean();
      const queued = existing ? await require('../../models/Event/AuftragEditorDay').findOne({
        auftragNr: existing.auftragNr, status: { $ne: 'completed' },
      }).select('submission').lean() : null;
      if (queued || existing?.submission) {
        const operation = await require('../../models/Event/AuftragEditorSubmission').findById(queued?.submission || existing.submission).lean();
        if (operation && (operation.status !== 'completed' || operation.ready === false)) return res.status(409).json({
          code: operation.status === 'completed' ? 'ATTACHMENTS_PENDING' : existing.auftragsgruppe ? 'GROUP_PENDING' : 'SUBMISSION_PENDING',
          submissionId: operation._id, message: 'Der Auftrag hat eine noch nicht abgeschlossene Einreichung.',
        });
      }
      if (existing?.auftragsgruppe) {
        const group = await require('../../models/Event/Auftragsgruppe').findById(existing.auftragsgruppe).lean();
        if (group?.activeSubmission) return res.status(409).json({
          code: 'GROUP_PENDING', submissionId: group.activeSubmission,
          message: 'Die Auftragsgruppe hat eine noch nicht abgeschlossene Änderung.',
        });
        if (req.route?.path?.includes('/schichten') || (req.route?.path === '/:auftragNr'
          && Object.keys(req.body || {}).some(key => [...SHARED_ORDER_FIELDS, ...OVERRIDE_FIELDS].includes(key)))) {
          return res.status(409).json({ code: 'GROUP_EDITOR_REQUIRED',
            message: 'Gemeinsame Änderungen müssen über den Auftragseditor eingereicht werden.' });
        }
      }
    }
    let result;
    try {
      result = await mongoose.connection.transaction(async () => {
        if (req.params.auftragNr) {
          const current = await Auftrag.findOne({ auftragNr: Number(req.params.auftragNr) }).lean();
          if (current?.auftragsgruppe) {
            const Group = require('../../models/Event/Auftragsgruppe');
            const reserved = await Group.updateOne({ _id: current.auftragsgruppe, activeSubmission: null },
              { $inc: { revision: 1 } });
            if (!reserved.modifiedCount) throw new RejectedResponse({ statusCode: 409,
              body: { code: 'GROUP_PENDING', message: 'Die Gruppe hat eine noch nicht abgeschlossene Änderung.' } });
          }
        }
        const before = await snapshot(Number(req.params.auftragNr));
        const response = { statusCode: 200, body: undefined,
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; },
        };
        await handler(req, response);
        if (response.statusCode >= 400) throw new RejectedResponse(response);
        const orderNumber = Number(req.params.auftragNr ?? response.body?.auftragNr);
        const after = await snapshot(orderNumber);
        if (buildChanges(before, after).length) {
          const changes = buildChanges(before, after, await employeeNames(before, after));
          const order = after.Auftrag?.[0] || before.Auftrag?.[0];
          const user = await User.findById(req.user?.id || req.user?._id).select('name email').lean();
          if (!user) throw new Error('Chronik: Benutzerkonto nicht gefunden');
          const locationV2 = order.locationV2 || (order.geschSt
            ? (await require('./LocationResolutionService').resolveLocationFromGeschSt(order.geschSt))?._id
            : null);
          if (locationV2) {
            await Entry.create({ auftragId: order._id, auftragNr: order.auftragNr,
              orderTitle: order.eventTitel || '', locationV2,
              kind: 'change', action, actor: { id: user._id, name: user.name || user.email },
              summary: summary(action, changes), changes });
          }
        }
        return response;
      });
    } catch (error) {
      if (!(error instanceof RejectedResponse)) throw error;
      result = error.response;
    }
    res.status(result.statusCode).json(result.body);
  });
  // The staged editor reuses these same domain mutations inside its own multi-order transaction.
  wrapped.mutationHandler = handler;
  return wrapped;
}

async function recordOrderChanges(before, after, actor, action) {
  if (!buildChanges(before, after).length) return;
  const changes = buildChanges(before, after, await employeeNames(before, after));
  const order = after.Auftrag?.[0] || before.Auftrag?.[0];
  if (!actor?._id) throw new Error('Chronik: Benutzerkonto nicht gefunden');
  await Entry.create({ auftragId: order._id, auftragNr: order.auftragNr,
    orderTitle: order.eventTitel || '', locationV2: order.locationV2,
    kind: 'change', action, actor: { id: actor._id, name: actor.name || actor.email },
    summary: summary(action, changes), changes });
}

module.exports = { withAuftragChronik, buildChanges, canonical, snapshot, recordOrderChanges, employeeNames };
