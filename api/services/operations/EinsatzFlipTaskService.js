const logger = require('../../utils/logger');
const Einsatz = require('../../models/Event/Einsatz');
const {
  assignFlipTask,
  completeFlipTask,
} = require('../integrations/FlipService');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatGermanDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatShortTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function buildJobDetailsHtml({ einsatz, auftrag, isReserve }) {
  const eventTitle =
    auftrag?.eventTitel ||
    auftrag?.eventLocation ||
    einsatz?.bezeichnung ||
    einsatz?.schichtBezeichnung ||
    `Auftrag #${einsatz?.auftragNr || ''}`;
  const role = einsatz?.schichtBezeichnung || einsatz?.bezeichnung || 'Einsatz';
  const dateFrom = formatGermanDate(einsatz?.datumVon || auftrag?.vonDatum);
  const dateTo = formatGermanDate(einsatz?.datumBis || auftrag?.bisDatum);
  const dateLabel = dateFrom && dateTo && dateFrom !== dateTo ? `${dateFrom} – ${dateTo}` : dateFrom || 'Offen';
  const timeFrom = formatShortTime(einsatz?.uhrzeitVon);
  const timeTo = formatShortTime(einsatz?.uhrzeitBis);
  const timeLabel = timeFrom ? `${timeFrom}${timeTo ? ` – ${timeTo}` : ''} Uhr` : 'Nach Absprache';
  const meetingPoint = [formatShortTime(einsatz?.treffpunkt), einsatz?.treffpunktOrt]
    .filter(Boolean)
    .join(' · ');
  const location = [
    auftrag?.eventLocation,
    [auftrag?.eventStrasse, [auftrag?.eventPlz, auftrag?.eventOrt].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join(' — ');

  const introText = isReserve
    ? 'Du wurdest als Reserve eingesetzt. Bitte bestätige in "Jobs" deine Reserve-Schicht.'
    : 'Du wurdest eingesetzt! Bitte bestätige in "Jobs" deinen Job.';

  const detailRows = [
    `<li><strong>Job:</strong> ${escapeHtml(eventTitle)}</li>`,
    `<li><strong>Schicht / Tätigkeit:</strong> ${escapeHtml(role)}${isReserve ? ' (Reserve)' : ''}</li>`,
    `<li><strong>Datum:</strong> ${escapeHtml(dateLabel)}</li>`,
    `<li><strong>Uhrzeit:</strong> ${escapeHtml(timeLabel)}</li>`,
    ...(meetingPoint ? [`<li><strong>Treffpunkt:</strong> ${escapeHtml(meetingPoint)}</li>`] : []),
    ...(location ? [`<li><strong>Einsatzort:</strong> ${escapeHtml(location)}</li>`] : []),
  ].join('');

  return `<p><strong>${escapeHtml(introText)}</strong></p><ul>${detailRows}</ul>`;
}

async function notifyEinsatzAssignment({ einsatz, auftrag, mitarbeiter, isReserve = false }) {
  if (!einsatz || !mitarbeiter?.flip_id) {
    return null;
  }

  const eventTitle =
    auftrag?.eventTitel ||
    auftrag?.eventLocation ||
    einsatz?.schichtBezeichnung ||
    einsatz?.bezeichnung ||
    `Auftrag #${einsatz?.auftragNr || ''}`;

  const title = isReserve
    ? `Du wurdest als Reserve eingesetzt: ${eventTitle}`
    : `Du wurdest eingesetzt: ${eventTitle}`;

  const description = buildJobDetailsHtml({ einsatz, auftrag, isReserve });
  const rawDate = einsatz.datumVon || auftrag?.vonDatum || null;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const dueAt =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? { date: parsedDate.toISOString().slice(0, 10), type: 'DATE' }
      : null;

  try {
    const task = await assignFlipTask({
      body: {
        external_id: `einsatz-confirmation:${einsatz._id}:${isReserve ? 'reserve' : 'regular'}:${Date.now()}`,
        title,
        recipients: [{ id: mitarbeiter.flip_id, type: 'USER' }],
        due_at: dueAt,
        description,
      },
    });

    if (task?.id) {
      await Einsatz.findByIdAndUpdate(einsatz._id, {
        $set: { 'bestaetigung.flipTaskId': String(task.id) },
      });
      if (einsatz.bestaetigung) {
        einsatz.bestaetigung.flipTaskId = String(task.id);
      } else {
        einsatz.bestaetigung = { flipTaskId: String(task.id) };
      }
    }
    return task;
  } catch (error) {
    logger.warn(
      `FlipTask für Einsatz ${einsatz._id} (Mitarbeiter ${mitarbeiter._id}) konnte nicht erstellt werden: ${error.message}`
    );
    return null;
  }
}

async function completeEinsatzFlipTask({ einsatz }) {
  const flipTaskId = einsatz?.bestaetigung?.flipTaskId;
  if (!flipTaskId) return false;

  try {
    await completeFlipTask(flipTaskId);
    logger.info(`FlipTask ${flipTaskId} nach Einsatzbestätigung gelöscht.`);
    return true;
  } catch (err) {
    logger.warn(`FlipTask Löschen fehlgeschlagen (${flipTaskId}): ${err.message}`);
    return false;
  }
}

module.exports = {
  notifyEinsatzAssignment,
  completeEinsatzFlipTask,
  buildJobDetailsHtml,
};
