const mongoose = require('mongoose');
const Auftrag = require('../../models/Event/Auftrag');
const Einsatz = require('../../models/Event/Einsatz');
const Schicht = require('../../models/Event/Schicht');
const Kunde = require('../../models/Customer/Kunde');
const { canAccess } = require('../TimeCaptureService');

function day(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) ? parsed.toISOString().slice(0, 10) : null;
}
const assignmentDay = assignment => assignment.day || day(assignment.detailDatumVon || assignment.datumVon);
const shiftDay = shift => shift.day || day(shift.datumVon);
const objectIds = values => values.filter(value => value && mongoose.isValidObjectId(value));
const shiftNumbers = bookings => [...new Set(bookings.map(booking => Number(booking.shiftId)).filter(value => Number.isSafeInteger(value) && value > 0))];

/** Related display context only: never changes or reconstructs booked hours. */
async function contexts(user, bookings) {
  const result = new Map();
  if (!bookings.length) return result;
  const numbers = [...new Set(bookings.map(booking => booking.auftragNr).filter(value => Number.isSafeInteger(value) && value > 0))];
  const orders = await Auftrag.find({ auftragNr: { $in: numbers } })
    .select('auftragNr eventTitel kundenNr locationV2 einsatzort eventLocation eventOrt vonDatum bisDatum')
    .populate('einsatzort', 'bezeichnung').lean();
  const visible = orders.filter(order => canAccess(user, order.locationV2));
  const orderNumbers = visible.map(order => order.auftragNr);
  const [assignments, customers] = visible.length ? await Promise.all([
    Einsatz.find({ auftragNr: { $in: orderNumbers }, personalNr: { $in: [...new Set(bookings.map(booking => Number(booking.personalNr)).filter(Number.isSafeInteger))] }, isPseudo: { $ne: true },
      $or: [{ _id: { $in: objectIds(bookings.map(booking => booking.assignmentId)) } }, { idAuftragArbeitsschichten: { $in: shiftNumbers(bookings) } }] })
      .select('auftragNr personalNr schicht day zvooveEinspersNr einsortNr idAuftragArbeitsschichten bezeichnung schichtBezeichnung datumVon datumBis detailDatumVon detailDatumBis uhrzeitVon uhrzeitBis treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon garantiestundenLohn berufSchl qualSchl')
      .lean(),
    Kunde.find({ kundenNr: { $in: visible.map(order => order.kundenNr).filter(Boolean) } }).select('kundenNr kundName').lean(),
  ]) : [[], []];
  const shifts = visible.length ? await Schicht.find({ auftragNr: { $in: orderNumbers },
    $or: [{ _id: { $in: objectIds(assignments.map(assignment => assignment.schicht)) } }, { idAuftragArbeitsschichten: { $in: shiftNumbers(bookings) } }] })
    .select('auftragNr idAuftragArbeitsschichten day datumVon datumBis bezeichnung uhrzeitVon uhrzeitBis treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon')
    .lean() : [];
  for (const booking of bookings) {
    const key = String(booking._id), order = orders.find(order => order.auftragNr === booking.auftragNr);
    if (!order || !canAccess(user, order.locationV2)) {
      result.set(key, { status: order ? 'FORBIDDEN' : 'ORDER_MISSING', order: null, shift: null, assignment: null });
      continue;
    }
    const fits = assignment => assignment.auftragNr === booking.auftragNr && String(assignment.personalNr) === String(booking.personalNr) && assignmentDay(assignment) === booking.date
      && (!booking.shiftId || String(assignment.idAuftragArbeitsschichten) === String(booking.shiftId));
    const direct = booking.assignmentId ? assignments.find(assignment => String(assignment._id) === String(booking.assignmentId) && fits(assignment)) : null;
    const candidates = direct ? [direct] : booking.shiftId ? assignments.filter(fits) : [];
    const assignment = candidates.length === 1 ? candidates[0] : null;
    const shiftFits = shift => shift.auftragNr === booking.auftragNr && shiftDay(shift) === booking.date
      && (!booking.shiftId || String(shift.idAuftragArbeitsschichten) === String(booking.shiftId));
    const directShift = assignment?.schicht ? shifts.find(shift => String(shift._id) === String(assignment.schicht) && shiftFits(shift)) : null;
    const shiftCandidates = directShift ? [directShift] : booking.shiftId ? shifts.filter(shiftFits) : [];
    const shift = shiftCandidates.length === 1 ? shiftCandidates[0] : null;
    result.set(key, {
      status: 'AVAILABLE',
      order: { number: order.auftragNr, title: order.eventTitel || null, customerNumber: order.kundenNr || null,
        customerName: customers.find(customer => customer.kundenNr === order.kundenNr)?.kundName || null,
        site: order.einsatzort?.bezeichnung || order.eventLocation || null, town: order.eventOrt || null,
        from: day(order.vonDatum), until: day(order.bisDatum) },
      shift: { status: shift ? 'MATCHED' : shiftCandidates.length > 1 ? 'AMBIGUOUS' : assignment ? 'FROM_ASSIGNMENT' : 'MISSING',
        id: shift ? String(shift._id) : null, externalId: booking.shiftId || null,
        label: shift?.bezeichnung || assignment?.schichtBezeichnung || null,
        from: shiftDay(shift || {}) || day(assignment?.detailDatumVon || assignment?.datumVon),
        until: day(shift?.datumBis || assignment?.detailDatumBis || assignment?.datumBis),
        start: shift?.uhrzeitVon || assignment?.uhrzeitVon || null, end: shift?.uhrzeitBis || assignment?.uhrzeitBis || null,
        meetingTime: shift?.treffpunkt || assignment?.treffpunkt || null, meetingPoint: shift?.treffpunktOrt || assignment?.treffpunktOrt || null,
        contactName: shift?.ansprechpartnerName || assignment?.ansprechpartnerName || null,
        contactPhone: shift?.ansprechpartnerTelefon || assignment?.ansprechpartnerTelefon || null },
      assignment: { status: assignment ? 'MATCHED' : candidates.length > 1 ? 'AMBIGUOUS' : 'MISSING',
        id: assignment ? String(assignment._id) : null, externalNumber: assignment?.zvooveEinspersNr || null,
        title: assignment?.bezeichnung || null, personalNr: assignment?.personalNr ?? null,
        from: day(assignment?.detailDatumVon || assignment?.datumVon), until: day(assignment?.detailDatumBis || assignment?.datumBis),
        start: assignment?.uhrzeitVon || null, end: assignment?.uhrzeitBis || null,
        guaranteedHours: assignment?.garantiestundenLohn ?? null,
        occupationKey: assignment?.berufSchl || null, qualificationKey: assignment?.qualSchl || null },
    });
  }
  return result;
}
module.exports = { contexts };
