const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const Auftrag = require('../../models/Event/Auftrag');
const Schicht = require('../../models/Event/Schicht');
const Einsatz = require('../../models/Event/Einsatz');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const User = require('../../models/System/User');
const Entry = require('../../models/Event/AuftragChronikEntry');
const asyncHandler = require('../../middleware/AsyncHandler');
const { dayKey } = require('../../utils/orderDay');
const { SHARED_ORDER_FIELDS, OVERRIDE_FIELDS, resolveGroupOrderDefaults, resolveOrderOverrides } = require('./AuftragsgruppeOrderService');

const IMPORT_SYSTEM_ACTOR_ID = new mongoose.Types.ObjectId('000000000000000000007001');

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

function resolveChangeActor(entity, action, oldRecord, newRecord) {
  if (action === 'deleted') return {};
  const record = newRecord || oldRecord;
  if (!record) return {};
  if (entity === 'Auftrag' && action === 'created') {
    const actorName = String(record.bediener || '').trim() || null;
    const rawAt = record.dtAngelegtAm ? new Date(record.dtAngelegtAm) : null;
    const actorAt = rawAt && !Number.isNaN(rawAt.getTime()) ? rawAt : null;
    return {
      ...(actorName ? { actorName } : {}),
      ...(actorAt ? { actorAt } : {}),
    };
  }
  if (entity === 'Einsatz' && (action === 'created' || action === 'updated')) {
    const actorName = String(record.cProtBediener || '').trim() || null;
    const rawAt = record.dtProtDatum ? new Date(record.dtProtDatum) : null;
    const actorAt = rawAt && !Number.isNaN(rawAt.getTime()) ? rawAt : null;
    return {
      ...(actorName ? { actorName } : {}),
      ...(actorAt ? { actorAt } : {}),
    };
  }
  return {};
}

function buildChanges(before, after, names = new Map()) {
  const changes = [];
  const ids = names?.ids;
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
        const beforeMitarbeiterId = field === 'personalNr' && oldValue != null ? ids?.get(String(oldValue)) : undefined;
        const afterMitarbeiterId = field === 'personalNr' && newValue != null ? ids?.get(String(newValue)) : undefined;
        return [{ field, label: LABELS[field], before: oldValue, after: newValue,
          beforeLabel: fieldLabel(field, oldValue, names), afterLabel: fieldLabel(field, newValue, names),
          ...(beforeMitarbeiterId ? { beforeMitarbeiterId } : {}),
          ...(afterMitarbeiterId ? { afterMitarbeiterId } : {}) }];
      });
      if (!fields.length && oldRecord && newRecord) continue;
      const targetRecord = newRecord || oldRecord;
      const action = !oldRecord ? 'created' : !newRecord ? 'deleted' : 'updated';
      const mitarbeiterId = entity === 'Einsatz' && targetRecord?.personalNr != null
        ? ids?.get(String(targetRecord.personalNr))
        : undefined;
      changes.push({ entity, entityId: id, label: recordLabel(entity, targetRecord, names),
        action,
        ...resolveChangeActor(entity, action, oldRecord, newRecord),
        ...(mitarbeiterId ? { mitarbeiterId } : {}),
        fields });
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
  ] }).select('_id personalnr personalnrHistory vorname nachname').lean();
  const names = new Map();
  const ids = new Map();
  names.ids = ids;
  for (const employee of employees) {
    const name = [employee.vorname, employee.nachname].filter(Boolean).join(' ');
    for (const number of [employee.personalnr, ...(employee.personalnrHistory || []).map(item => item.value)]) {
      if (number != null) {
        if (name) names.set(String(number), `${name} (#${number})`);
        if (employee._id) ids.set(String(number), employee._id);
      }
    }
  }
  return names;
}

function summary(action, changes) {
  const verb = { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht', released: 'freigegeben' };
  if (action === 'planning.updated') return `Personalplanung geändert · ${changes.filter(item => item.entity === 'Einsatz').length} Einsätze`;
  const [entity, event] = action.split('.');
  const primary =
    changes.find(item => item.entity === entity && item.action === event) ||
    changes.find(item => item.entity === entity) ||
    (changes.length === 1 ? changes[0] : null);
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

function safeDayKey(value) {
  if (!value) return '';
  try { return dayKey(value); } catch { return String(canonical(value) || ''); }
}

function alignImportSnapshots(before = {}, after = {}) {
  if (!before?.Auftrag?.length || !after?.Auftrag?.length) return before;

  const alignedShifts = [];
  const usedShiftIds = new Set();
  const afterShifts = after.Schicht || [];

  const shiftKeyPrimary = s => (s.idAuftragArbeitsschichten != null
    ? `ext:${s.idAuftragArbeitsschichten}:${safeDayKey(s.datumVon)}:${s.uhrzeitVon ?? ''}`
    : `bez:${s.bezeichnung ?? ''}:${safeDayKey(s.datumVon)}:${s.uhrzeitVon ?? ''}:${s.uhrzeitBis ?? ''}`);
  const shiftKeyFallback = s => (s.idAuftragArbeitsschichten != null
    ? `extday:${s.idAuftragArbeitsschichten}:${safeDayKey(s.datumVon)}`
    : null);

  for (const oldShift of before.Schicht || []) {
    let match = afterShifts.find(s => !usedShiftIds.has(String(s._id)) && String(s._id) === String(oldShift._id));
    if (!match) {
      const pk = shiftKeyPrimary(oldShift);
      match = afterShifts.find(s => !usedShiftIds.has(String(s._id)) && shiftKeyPrimary(s) === pk);
    }
    if (!match) {
      const fk = shiftKeyFallback(oldShift);
      if (fk) match = afterShifts.find(s => !usedShiftIds.has(String(s._id)) && shiftKeyFallback(s) === fk);
    }
    if (match) {
      usedShiftIds.add(String(match._id));
      alignedShifts.push({ ...oldShift, _id: match._id });
    } else {
      alignedShifts.push(oldShift);
    }
  }

  const alignedEinsaetze = [];
  const usedEinsatzIds = new Set();
  const afterEinsaetze = after.Einsatz || [];

  const einsatzKeyPrimary = e => `ext:${e.idAuftragArbeitsschichten ?? ''}:${e.personalNr ?? ''}:${safeDayKey(e.datumVon || e.detailDatumVon)}:${e.uhrzeitVon ?? ''}`;
  const einsatzKeyFallback = e => `extday:${e.idAuftragArbeitsschichten ?? ''}:${e.personalNr ?? ''}:${safeDayKey(e.datumVon || e.detailDatumVon)}`;

  for (const oldEinsatz of before.Einsatz || []) {
    let match = afterEinsaetze.find(e => !usedEinsatzIds.has(String(e._id)) && String(e._id) === String(oldEinsatz._id));
    if (!match && oldEinsatz.zvooveEinspersNr) {
      match = afterEinsaetze.find(
        e => !usedEinsatzIds.has(String(e._id)) && e.zvooveEinspersNr && String(e.zvooveEinspersNr) === String(oldEinsatz.zvooveEinspersNr),
      );
    }
    if (!match) {
      const pk = einsatzKeyPrimary(oldEinsatz);
      match = afterEinsaetze.find(e => !usedEinsatzIds.has(String(e._id)) && einsatzKeyPrimary(e) === pk);
    }
    if (!match) {
      const fk = einsatzKeyFallback(oldEinsatz);
      match = afterEinsaetze.find(e => !usedEinsatzIds.has(String(e._id)) && einsatzKeyFallback(e) === fk);
    }
    if (match) {
      usedEinsatzIds.add(String(match._id));
      alignedEinsaetze.push({
        ...oldEinsatz,
        _id: match._id,
        ...(match.schicht == null && oldEinsatz.idAuftragArbeitsschichten === match.idAuftragArbeitsschichten
          ? { schicht: match.schicht }
          : {}),
      });
    } else {
      alignedEinsaetze.push(oldEinsatz);
    }
  }

  return {
    Auftrag: before.Auftrag,
    Schicht: alignedShifts,
    Einsatz: alignedEinsaetze,
  };
}

async function snapshotMany(auftragNrs = []) {
  const result = new Map();
  if (mongoose.connection.readyState !== 1) return result;
  const validNrs = [...new Set((auftragNrs || []).map(Number).filter(n => Number.isSafeInteger(n) && n > 0))];
  if (!validNrs.length) return result;

  const [orders, shifts, assignments] = await Promise.all([
    Auftrag.find({ auftragNr: { $in: validNrs } }).select(['auftragNr', 'createdBy', 'creationOrigin', 'createdAt', ...FIELDS.Auftrag].join(' ')).lean(),
    Schicht.find({ auftragNr: { $in: validNrs } }).select(['auftragNr', 'idAuftragArbeitsschichten', ...FIELDS.Schicht].join(' ')).lean(),
    Einsatz.find({ auftragNr: { $in: validNrs } }).select(['auftragNr', 'zvooveEinspersNr', ...FIELDS.Einsatz].join(' ')).lean(),
  ]);

  const shiftsByNr = new Map();
  for (const s of shifts) {
    const nr = Number(s.auftragNr);
    if (!shiftsByNr.has(nr)) shiftsByNr.set(nr, []);
    shiftsByNr.get(nr).push(s);
  }

  const assignmentsByNr = new Map();
  for (const e of assignments) {
    const nr = Number(e.auftragNr);
    if (!assignmentsByNr.has(nr)) assignmentsByNr.set(nr, []);
    assignmentsByNr.get(nr).push(e);
  }

  for (const order of orders) {
    const nr = Number(order.auftragNr);
    result.set(nr, {
      Auftrag: [order],
      Schicht: shiftsByNr.get(nr) || [],
      Einsatz: assignmentsByNr.get(nr) || [],
    });
  }
  return result;
}

async function captureImportSnapshots(auftragNrs = [], deactivateQuery = null) {
  if (mongoose.connection.readyState !== 1) return new Map();
  const extraNrs = deactivateQuery && typeof Auftrag.distinct === 'function'
    ? await Auftrag.distinct('auftragNr', deactivateQuery)
    : [];
  return snapshotMany([...(auftragNrs || []), ...(extraNrs || [])]);
}

async function ensureOrderCreationEntry(orderOrNr, fallbackActor = null) {
  if (mongoose.connection.readyState !== 1 || !orderOrNr) return null;
  const order = typeof orderOrNr === 'object' && orderOrNr._id
    ? orderOrNr
    : await Auftrag.findOne({ auftragNr: Number(orderOrNr) })
      .select('_id auftragNr eventTitel locationV2 geschSt dtAngelegtAm createdAt bediener createdBy creationOrigin kundenNr source')
      .lean();
  if (!order?._id) return null;

  const hasCreationMetadata = Boolean(
    order.dtAngelegtAm || order.bediener || order.createdBy || order.creationOrigin || order.kundenNr != null,
  );
  if (!hasCreationMetadata) return null;

  const locationV2 = order.locationV2 || (order.geschSt
    ? (await require('./LocationResolutionService').resolveLocationFromGeschSt(order.geschSt))?._id
    : null);
  if (!locationV2) return null;

  if (await Entry.exists({ auftragId: order._id, action: 'Auftrag.created' })) return null;

  const current = await snapshot(order.auftragNr);
  if (!current.Auftrag?.length) return null;
  const changes = buildChanges({}, current, await employeeNames({}, current));
  if (!changes.length) return null;

  let creator = null;
  if (order.createdBy && mongoose.isValidObjectId(order.createdBy)) {
    creator = await User.findById(order.createdBy).select('_id name email').lean();
  }

  const isZvoove = order.source === 'zvoove' || order.creationOrigin === 'zvoove-import';
  const zvooveBediener = String(order.bediener || '').trim();
  const actorId = isZvoove
    ? IMPORT_SYSTEM_ACTOR_ID
    : (creator?._id || (mongoose.isValidObjectId(order.createdBy) ? order.createdBy : null)
      || fallbackActor?._id || fallbackActor?.id || IMPORT_SYSTEM_ACTOR_ID);
  const actorName = isZvoove
    ? (zvooveBediener || 'Zvoove')
    : (creator?.name || creator?.email || zvooveBediener || fallbackActor?.name || fallbackActor?.email || 'System');

  let createdAt = order.dtAngelegtAm ? new Date(order.dtAngelegtAm) : (order.createdAt ? new Date(order.createdAt) : new Date());
  if (Number.isNaN(createdAt.getTime())) createdAt = new Date();
  const earliest = await Entry.findOne({ auftragId: order._id }).sort({ createdAt: 1, _id: 1 }).select('createdAt').lean();
  if (earliest?.createdAt && createdAt >= new Date(earliest.createdAt)) {
    createdAt = new Date(new Date(earliest.createdAt).getTime() - 1000);
  }

  const entrySummary = summary('Auftrag.created', changes);

  await Entry.updateOne(
    { auftragId: order._id, action: 'Auftrag.created' },
    {
      $setOnInsert: {
        auftragId: order._id,
        auftragNr: order.auftragNr,
        orderTitle: order.eventTitel || '',
        locationV2,
        kind: 'change',
        action: 'Auftrag.created',
        source: isZvoove ? 'zvoove' : 'monitor',
        actor: { id: actorId, name: actorName },
        summary: entrySummary,
        changes,
        createdAt,
      },
    },
    { upsert: true },
  );
  return true;
}

async function recordImportChronikEntries({
  beforeMap,
  auftragNrs = [],
} = {}) {
  if (mongoose.connection.readyState !== 1 || !(beforeMap instanceof Map)) return [];
  const allNrs = [...new Set([...beforeMap.keys(), ...(auftragNrs || []).map(Number)])]
    .filter(n => Number.isSafeInteger(n) && n > 0);
  if (!allNrs.length) return [];

  const afterMap = await snapshotMany(allNrs);
  const allBeforeEinsaetze = [];
  const allAfterEinsaetze = [];
  const allOrderIds = [];

  for (const nr of allNrs) {
    const b = beforeMap.get(nr);
    const a = afterMap.get(nr);
    if (b?.Einsatz?.length) allBeforeEinsaetze.push(...b.Einsatz);
    if (a?.Einsatz?.length) allAfterEinsaetze.push(...a.Einsatz);
    const ord = a?.Auftrag?.[0] || b?.Auftrag?.[0];
    if (ord?._id) allOrderIds.push(ord._id);
  }

  const [names, existingCreatedOrderIds] = await Promise.all([
    employeeNames({ Einsatz: allBeforeEinsaetze }, { Einsatz: allAfterEinsaetze }),
    allOrderIds.length
      ? Entry.distinct('auftragId', { auftragId: { $in: allOrderIds }, action: 'Auftrag.created' })
      : [],
  ]);

  const createdSet = new Set((existingCreatedOrderIds || []).map(String));
  const entriesToInsert = [];
  const resolveLocationFromGeschSt = require('./LocationResolutionService').resolveLocationFromGeschSt;

  for (const nr of allNrs) {
    const before = beforeMap.get(nr) || {};
    const after = afterMap.get(nr) || {};
    const order = after.Auftrag?.[0] || before.Auftrag?.[0];
    if (!order?._id) continue;

    const locationV2 = order.locationV2 || (order.geschSt
      ? (await resolveLocationFromGeschSt(order.geschSt))?._id
      : null);
    if (!locationV2) continue;

    // Never attribute Zvoove import changes to the Monitor user who uploaded the file.
    const actorId = IMPORT_SYSTEM_ACTOR_ID;
    const orderBediener = String(order.bediener || '').trim();

    if (!before.Auftrag?.length && after.Auftrag?.length) {
      const changes = buildChanges({}, after, names);
      if (changes.length) {
        let createdAt = order.dtAngelegtAm ? new Date(order.dtAngelegtAm) : new Date();
        if (Number.isNaN(createdAt.getTime())) createdAt = new Date();
        entriesToInsert.push({
          auftragId: order._id,
          auftragNr: order.auftragNr,
          orderTitle: order.eventTitel || '',
          locationV2,
          kind: 'change',
          action: 'Auftrag.created',
          source: 'zvoove',
          actor: { id: actorId, name: orderBediener || 'Zvoove' },
          summary: summary('Auftrag.created', changes),
          changes,
          createdAt,
        });
      }
      continue;
    }

    if (before.Auftrag?.length && after.Auftrag?.length) {
      const beforeOrder = before.Auftrag[0];
      if (!createdSet.has(String(order._id))) {
        const initialChanges = buildChanges({}, before, names);
        if (initialChanges.length) {
          let initialCreatedAt = beforeOrder.dtAngelegtAm
            ? new Date(beforeOrder.dtAngelegtAm)
            : (beforeOrder.createdAt ? new Date(beforeOrder.createdAt) : new Date(Date.now() - 1000));
          if (Number.isNaN(initialCreatedAt.getTime()) || initialCreatedAt >= new Date()) {
            initialCreatedAt = new Date(Date.now() - 1000);
          }
          const initialActorName = String(beforeOrder.bediener || '').trim() || orderBediener || 'Zvoove';
          entriesToInsert.push({
            auftragId: order._id,
            auftragNr: order.auftragNr,
            orderTitle: beforeOrder.eventTitel || order.eventTitel || '',
            locationV2,
            kind: 'change',
            action: 'Auftrag.created',
            source: 'zvoove',
            actor: { id: actorId, name: initialActorName },
            summary: summary('Auftrag.created', initialChanges),
            changes: initialChanges,
            createdAt: initialCreatedAt,
          });
          createdSet.add(String(order._id));
        }
      }

      const alignedBefore = alignImportSnapshots(before, after);
      const diffChanges = buildChanges(alignedBefore, after, names);
      if (diffChanges.length) {
        entriesToInsert.push({
          auftragId: order._id,
          auftragNr: order.auftragNr,
          orderTitle: order.eventTitel || '',
          locationV2,
          kind: 'change',
          action: 'Auftrag.updated',
          source: 'zvoove',
          actor: { id: actorId, name: 'Zvoove' },
          summary: summary('Auftrag.updated', diffChanges),
          changes: diffChanges,
          createdAt: new Date(),
        });
      }
    }
  }

  if (entriesToInsert.length) {
    await Entry.insertMany(entriesToInsert);
  }
  return entriesToInsert;
}

function buildSignaturChronikDetails(vorgang, event) {
  const typLabel = vorgang.typKey === 'stundenliste'
    ? 'Stundenliste Signatur'
    : vorgang.typKey === 'reisekostenabrechnung'
      ? 'Reisekosten-Signatur'
      : 'Signatur-Vorgang';
  const docTitle = vorgang.name || 'Dokument';

  if (event === 'started') {
    const submittersList = (vorgang.submitters || [])
      .map(s => [s.role, s.name || s.email].filter(Boolean).join(': '))
      .filter(Boolean)
      .join(', ');
    return {
      action: 'SignaturVorgang.started',
      summary: `${typLabel} gestartet: ${docTitle}`,
      changeAction: 'created',
      fields: [
        { field: 'status', label: 'Status', before: null, after: 'open', beforeLabel: '—', afterLabel: 'Gestartet (Offen)' },
        ...(submittersList
          ? [{ field: 'submitters', label: 'Unterzeichner', before: null, after: submittersList, beforeLabel: '—', afterLabel: submittersList }]
          : []),
      ],
    };
  }
  if (event === 'completed') {
    return {
      action: 'SignaturVorgang.completed',
      summary: `${typLabel}: Abgeschlossen (${docTitle})`,
      changeAction: 'updated',
      fields: [
        { field: 'status', label: 'Status', before: 'open', after: 'completed', beforeLabel: 'Gestartet (Offen)', afterLabel: 'Abgeschlossen' },
      ],
    };
  }
  return {
    action: 'SignaturVorgang.cancelled',
    summary: `${typLabel}: Storniert (${docTitle})`,
    changeAction: 'deleted',
    fields: [
      { field: 'status', label: 'Status', before: 'open', after: 'cancelled', beforeLabel: 'Gestartet (Offen)', afterLabel: 'Storniert' },
    ],
  };
}

async function recordSignaturVorgangChronik(vorgang, event, userOrId = null, customCreatedAt = null) {
  if (mongoose.connection.readyState !== 1 || !vorgang?._id || !['started', 'completed', 'cancelled'].includes(event)) {
    return null;
  }
  const auftragNr = Number(vorgang.auftragNr);
  if (!Number.isSafeInteger(auftragNr) || auftragNr <= 0) return null;

  const order = await Auftrag.findOne({ auftragNr }).select('_id auftragNr eventTitel locationV2 geschSt').lean();
  if (!order?._id) return null;

  const locationV2 = order.locationV2 || vorgang.locationV2?._id || vorgang.locationV2 || (order.geschSt
    ? (await require('./LocationResolutionService').resolveLocationFromGeschSt(order.geschSt))?._id
    : null);
  if (!locationV2) return null;

  const { action, summary: entrySummary, changeAction, fields } = buildSignaturChronikDetails(vorgang, event);

  if (await Entry.exists({ auftragId: order._id, action, 'changes.entityId': vorgang._id })) {
    return null;
  }

  let user = null;
  const candidateUserId = (typeof userOrId === 'object' ? (userOrId?._id || userOrId?.id) : userOrId) || vorgang.createdBy;
  if (typeof userOrId === 'object' && (userOrId?.name || userOrId?.email)) {
    user = userOrId;
  } else if (candidateUserId && mongoose.isValidObjectId(candidateUserId)) {
    user = await User.findById(candidateUserId).select('_id name email').lean();
  }

  const actorId = user?._id || (mongoose.isValidObjectId(vorgang.createdBy) ? vorgang.createdBy : IMPORT_SYSTEM_ACTOR_ID);
  const actorName = user?.name || user?.email || 'DocuSeal Signatur';
  const mitarbeiterId = vorgang.mitarbeiter?._id || (mongoose.isValidObjectId(vorgang.mitarbeiter) ? vorgang.mitarbeiter : null);

  return Entry.create({
    auftragId: order._id,
    auftragNr: order.auftragNr,
    orderTitle: order.eventTitel || '',
    locationV2,
    kind: 'change',
    action,
    source: 'monitor',
    actor: { id: actorId, name: actorName },
    summary: entrySummary,
    changes: [{
      entity: 'SignaturVorgang',
      entityId: vorgang._id,
      signaturVorgangId: vorgang._id,
      typKey: vorgang.typKey || null,
      ...(mitarbeiterId ? { mitarbeiterId } : {}),
      label: vorgang.name || 'Signaturvorgang',
      action: changeAction,
      fields,
    }],
    createdAt: customCreatedAt || new Date(),
  });
}

async function ensureOrderSignatureEntries(orderOrNr, fallbackActor = null) {
  if (mongoose.connection.readyState !== 1 || !orderOrNr) return;
  const auftragNr = Number(typeof orderOrNr === 'object' ? orderOrNr.auftragNr : orderOrNr);
  if (!Number.isSafeInteger(auftragNr) || auftragNr <= 0) return;

  const SignaturVorgang = mongoose.models.SignaturVorgang || require('../../models/Signature/SignaturVorgang');
  const vorgaenge = await SignaturVorgang.find({
    auftragNr,
    status: { $in: ['open', 'completed', 'cancelled'] },
    createdBy: { $ne: null },
  }).sort({ createdAt: 1 }).lean();

  for (const vorgang of vorgaenge) {
    if (vorgang.status === 'open' || vorgang.status === 'completed' || vorgang.submissionId) {
      await recordSignaturVorgangChronik(vorgang, 'started', vorgang.createdBy || fallbackActor, vorgang.createdAt);
    }
    if (vorgang.status === 'completed') {
      await recordSignaturVorgangChronik(
        vorgang,
        'completed',
        vorgang.createdBy || fallbackActor,
        vorgang.completedAt || vorgang.updatedAt || new Date(),
      );
    } else if (vorgang.status === 'cancelled') {
      await recordSignaturVorgangChronik(
        vorgang,
        'cancelled',
        vorgang.createdBy || fallbackActor,
        vorgang.cancelledAt || vorgang.updatedAt || new Date(),
      );
    }
  }
}

async function enrichEntriesWithEmployeeIds(entries = []) {
  if (mongoose.connection.readyState !== 1 || !Array.isArray(entries) || !entries.length) return entries;
  const pnrs = new Set();
  for (const entry of entries) {
    if (entry.source === 'zvoove' && entry.action !== 'Auftrag.created') {
      entry.actor = { id: entry.actor?.id || IMPORT_SYSTEM_ACTOR_ID, name: 'Zvoove' };
    }
    for (const change of entry.changes || []) {
      if (change.action !== 'deleted') {
        if (change.entity === 'Auftrag' && change.action === 'created') {
          if (!change.actorName) {
            const bedField = (change.fields || []).find(f => f.field === 'bediener');
            const val = String(bedField?.after ?? '').trim();
            if (val && val !== '—') change.actorName = val;
          }
          if (!change.actorAt) {
            const dtField = (change.fields || []).find(f => f.field === 'dtAngelegtAm');
            if (dtField?.after) change.actorAt = dtField.after;
          }
        } else if (change.entity === 'Einsatz') {
          if (!change.actorName) {
            const bedField = (change.fields || []).find(f => f.field === 'cProtBediener');
            const val = String(bedField?.after ?? '').trim();
            if (val && val !== '—') change.actorName = val;
          }
          if (!change.actorAt) {
            const dtField = (change.fields || []).find(f => f.field === 'dtProtDatum');
            if (dtField?.after) change.actorAt = dtField.after;
          }
        }
      }
      const labelMatch = String(change.label || '').match(/\(#(\d+)\)/);
      if (labelMatch) pnrs.add(labelMatch[1]);
      for (const field of change.fields || []) {
        if (field.field === 'personalNr') {
          if (field.before != null) pnrs.add(String(field.before));
          if (field.after != null) pnrs.add(String(field.after));
        }
      }
    }
  }
  if (!pnrs.size) return entries;

  const pnrList = [...pnrs];
  const employees = await Mitarbeiter.find({
    $or: [{ personalnr: { $in: pnrList } }, { 'personalnrHistory.value': { $in: pnrList } }],
  }).select('_id personalnr personalnrHistory').lean();

  const idByPnr = new Map();
  for (const emp of employees) {
    for (const num of [emp.personalnr, ...(emp.personalnrHistory || []).map(h => h.value)]) {
      if (num != null && emp._id) idByPnr.set(String(num), emp._id);
    }
  }

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.entity === 'Einsatz' && !change.mitarbeiterId) {
        const labelMatch = String(change.label || '').match(/\(#(\d+)\)/);
        if (labelMatch && idByPnr.has(labelMatch[1])) {
          change.mitarbeiterId = idByPnr.get(labelMatch[1]);
        }
      }
      for (const field of change.fields || []) {
        if (field.field === 'personalNr') {
          if (!field.beforeMitarbeiterId && field.before != null && idByPnr.has(String(field.before))) {
            field.beforeMitarbeiterId = idByPnr.get(String(field.before));
          }
          if (!field.afterMitarbeiterId && field.after != null && idByPnr.has(String(field.after))) {
            field.afterMitarbeiterId = idByPnr.get(String(field.after));
          }
        }
      }
    }
  }
  return entries;
}

module.exports = {
  withAuftragChronik,
  buildChanges,
  canonical,
  snapshot,
  snapshotMany,
  alignImportSnapshots,
  captureImportSnapshots,
  ensureOrderCreationEntry,
  ensureOrderSignatureEntries,
  recordSignaturVorgangChronik,
  enrichEntriesWithEmployeeIds,
  recordImportChronikEntries,
  recordOrderChanges,
  employeeNames,
};
