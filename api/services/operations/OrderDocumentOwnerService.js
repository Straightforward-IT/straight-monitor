const Auftrag = require('../../models/Event/Auftrag');
const Group = require('../../models/Event/Auftragsgruppe');
const Submission = require('../../models/Event/AuftragEditorSubmission');
const Attachment = require('../../models/Event/AuftragEditorAttachment');
const Day = require('../../models/Event/AuftragEditorDay');
const { dayKey } = require('../../utils/orderDay');

async function documentsForOrder(order) {
  const group = order.auftragsgruppe ? await Group.findById(order.auftragsgruppe).lean() : null;
  return [
    ...(order.einsatzdokumente || []).map(doc => ({ ...doc, relationTarget: 'order' })),
    ...(group?.einsatzdokumente || []).map(doc => ({ ...doc, relationTarget: 'group', groupId: group._id })),
  ].filter(doc => doc.uploadStatus !== 'pending');
}
async function documentOwner(order, target = 'order') {
  if (!['order', 'group'].includes(target)) {
    const error = new Error('Ungültiges Dokument-Zuordnungsziel.');
    error.statusCode = 400;
    throw error;
  }
  if (target === 'order') return { model: Auftrag, owner: order, prefix: `Auftraege/${order.auftragNr}/docs/` };
  const owner = order.auftragsgruppe ? await Group.findById(order.auftragsgruppe).lean() : null;
  if (!owner) {
    const error = new Error('Dieser Auftrag gehört keiner Auftragsgruppe an.');
    error.statusCode = 400;
    throw error;
  }
  return { model: Group, owner, prefix: `Auftragsgruppen/${owner._id}/docs/` };
}
async function authorizeDocumentMutation(order, owner, target, userId, upload = null) {
  const queued = await Day.findOne({ auftragNr: order.auftragNr, status: { $ne: 'completed' } }).select('submission').lean();
  const submissionId = owner.activeSubmission || queued?.submission || order.submission;
  const operation = submissionId ? await Submission.findById(submissionId).lean() : null;
  if (!operation || (operation.status === 'completed' && operation.ready !== false)) return;
  const reject = (statusCode, message, code) => {
    const error = new Error(message);
    Object.assign(error, { statusCode, code });
    throw error;
  };
  if (!upload || operation.status !== 'completed') reject(409,
    'Die Einreichung oder ihre Dokumente sind noch nicht abgeschlossen.', 'ATTACHMENTS_PENDING');
  if (String(operation.createdBy) !== String(userId)) reject(403,
    'Nur der einreichende Benutzer kann die vorgemerkten Dokumente hochladen.', 'EDITOR_FORBIDDEN');
  const attachment = await Attachment.findOne({ submission: operation._id, clientUploadId: upload.clientUploadId,
    relationTarget: target, ...(target === 'order' ? { day: order.day || dayKey(order.vonDatum) } : {}) }).lean();
  if (!attachment || upload.type !== 'bestellung' || attachment.size !== upload.size
    || attachment.filename.replace(/[/\\:*?"<>|]/g, '_') !== upload.filename) {
    reject(409, 'Diese Datei gehört nicht zur vorgemerkten Dokument-Liste.', 'ATTACHMENT_INVALID');
  }
}
module.exports = { documentsForOrder, documentOwner, authorizeDocumentMutation };
