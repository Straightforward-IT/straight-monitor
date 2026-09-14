const { EventReport } = require('../../models/Classes/EventReport');
const { Laufzettel } = require('../../models/Classes/Laufzettel');
const SignaturVorgang = require('../../models/Signature/SignaturVorgang');
const DocuSealVorgang = require('../../models/Signature/DocuSealVorgang');
const Reisekosten = require('../../models/Signature/Reisekostenabrechnung');
const { orderForUser, objectId, fail } = require('../TimeCaptureService');

function descriptor(kind, doc, values) {
  return { id: `${kind}-${doc._id}`, kind, recordId: String(doc._id), date: doc.datum || doc.updatedAt || doc.createdAt, ...values };
}
async function list(user, number) {
  const order = await orderForUser(user, number);
  const [reports, slips, signatures, legacy, expenses] = await Promise.all([
    EventReport.find({ auftragnummer: String(order.auftragNr) }).select('datum name_teamleiter').lean(),
    Laufzettel.find({ auftragnummer: order.auftragNr }).select('datum name_mitarbeiter status').lean(),
    SignaturVorgang.find({ auftragNr: order.auftragNr }).select('name fileName typKey status r2KeySigned r2KeyUnsigned updatedAt').lean(),
    DocuSealVorgang.find({ $or: [{ auftragNr: order.auftragNr }, { 'linkedEntity.type': 'Auftrag', 'linkedEntity.refId': order._id }] }).select('name status signedPdfKey updatedAt').lean(),
    Reisekosten.find({ auftragNr: order.auftragNr }).select('kopf.name kopf.vorname kopf.titel status r2Key anlagen signaturVorgang updatedAt').lean(),
  ]);
  const documents = [
    ...reports.map(doc => descriptor('eventreport', doc, { category: 'EventReport', title: `EventReport · ${doc.name_teamleiter}`, teamLeader: doc.name_teamleiter, status: 'Eingereicht', preview: 'pdf' })),
    ...slips.map(doc => descriptor('laufzettel', doc, { category: 'Weitere', title: `Laufzettel · ${doc.name_mitarbeiter}`, status: doc.status === 'ABGESCHLOSSEN' ? 'Abgeschlossen' : 'Erfasst', preview: 'pdf' })),
    ...signatures.map(doc => descriptor('signature', doc, {
      category: doc.typKey === 'stundenliste' ? 'Stundenliste' : 'Weitere',
      title: doc.name || doc.fileName, filename: doc.fileName || `${doc.name}.pdf`, preview: 'url',
      status: doc.status === 'cancelled' ? 'Storniert' : doc.r2KeySigned ? 'Ausgefüllt · signiert' : doc.status === 'completed' ? 'Abgeschlossen · Datei ausstehend' : doc.r2KeyUnsigned ? 'Vorlage · nicht ausgefüllt' : 'Unterschrift ausstehend',
      available: !!(doc.r2KeySigned || (doc.status !== 'completed' && doc.r2KeyUnsigned)), completed: !!doc.r2KeySigned,
    })),
    ...legacy.map(doc => descriptor('legacy-signature', doc, { category: 'Weitere', title: doc.name, filename: `${doc.name}.pdf`, preview: 'url',
      status: doc.signedPdfKey ? 'Ausgefüllt · signiert' : 'Datei ausstehend', available: !!doc.signedPdfKey, completed: !!doc.signedPdfKey })),
    ...expenses.map(doc => descriptor('reisekosten', doc, {
      category: 'Weitere', title: doc.kopf?.titel || `Reisekosten · ${[doc.kopf?.vorname, doc.kopf?.name].filter(Boolean).join(' ')}`, preview: 'url',
      filename: `Reisekosten-${order.auftragNr}.pdf`, status: 'Erfasste Abrechnung', available: !!doc.r2Key,
    })),
    ...expenses.flatMap(doc => (doc.anlagen || []).map(attachment => descriptor('beleg', doc, {
      id: `beleg-${doc._id}-${attachment._id}`, attachmentId: String(attachment._id), category: 'Weitere', title: attachment.filename || 'Reisekostenbeleg',
      filename: attachment.filename, mimeType: attachment.contentType, preview: 'url', status: 'Anlage', available: !!attachment.key,
    }))),
  ];
  const rank = doc => doc.category === 'Stundenliste' && doc.completed ? 0 : doc.category === 'EventReport' ? 1 : doc.category === 'Stundenliste' ? 2 : 3;
  return documents.sort((a, b) => rank(a) - rank(b) || new Date(b.date || 0) - new Date(a.date || 0));
}
async function preview(user, number, kind, id, attachmentId, download) {
  const order = await orderForUser(user, number);
  objectId(id);
  if (kind === 'eventreport' || kind === 'laufzettel') {
    const model = kind === 'eventreport' ? EventReport : Laufzettel;
    const doc = await model.findOne({ _id: id, auftragnummer: kind === 'eventreport' ? String(order.auftragNr) : order.auftragNr }).lean();
    if (!doc) fail(404, 'Dokument ist mit diesem Auftrag nicht verknüpft.');
    const { renderReportPdf } = require('./ReportPreviewService');
    return { buffer: await renderReportPdf(kind, doc, order) };
  }
  let doc, key, filename;
  if (kind === 'signature') {
    doc = await SignaturVorgang.findOne({ _id: id, auftragNr: order.auftragNr }).lean();
    key = doc?.r2KeySigned || (doc?.status !== 'completed' ? doc?.r2KeyUnsigned : null);
    filename = doc?.fileName || `${doc?.name || 'Dokument'}.pdf`;
  } else if (kind === 'legacy-signature') {
    doc = await DocuSealVorgang.findOne({ _id: id, $or: [{ auftragNr: order.auftragNr }, { 'linkedEntity.type': 'Auftrag', 'linkedEntity.refId': order._id }] }).lean();
    key = doc?.signedPdfKey; filename = `${doc?.name || 'Dokument'}.pdf`;
  } else if (kind === 'reisekosten' || kind === 'beleg') {
    doc = await Reisekosten.findOne({ _id: id, auftragNr: order.auftragNr }).lean();
    if (kind === 'beleg') {
      objectId(attachmentId);
      const attachment = doc?.anlagen?.find(item => String(item._id) === attachmentId);
      key = attachment?.key; filename = attachment?.filename;
    } else { key = doc?.r2Key; filename = `Reisekosten-${order.auftragNr}.pdf`; }
  }
  if (!doc) fail(404, 'Dokument ist mit diesem Auftrag nicht verknüpft.');
  if (!key) fail(409, 'Für dieses Dokument ist noch keine Datei hinterlegt.');
  // Resolve only keys read from the authorized linked document, never request keys.
  const R2Service = require('../integrations/R2Service');
  return { url: await R2Service.getSignedDownloadUrl(key, 900, { inline: !download, filename }) };
}
module.exports = { list, preview };
