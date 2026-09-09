const dayOf = value => String(value || '').slice(0, 10);
const refId = value => String(value?._id ?? value ?? '');
const orderMatches = (item, auftragNr) => String(item.auftragNr) === String(auftragNr);

/** Read-only projection of Auftrag → Schicht → Einsatz, including legacy links. */
export function buildQuickEntryGroups(auftrag, schichten = [], einsaetze = []) {
  if (auftrag?.auftragNr == null) return [];
  const groups = schichten.filter(shift => orderMatches(shift, auftrag.auftragNr)).map((shift, index) => ({
    key: refId(shift._id) || `shift-${shift.idAuftragArbeitsschichten}-${dayOf(shift.datumVon)}-${index}`,
    schicht: shift,
    einsaetze: [],
  }));
  const unmatched = [];
  for (const einsatz of einsaetze.filter(item => orderMatches(item, auftrag.auftragNr))) {
    const directId = refId(einsatz.schicht);
    const candidates = directId
      ? groups.filter(group => refId(group.schicht._id) === directId)
      : groups.filter(group => einsatz.idAuftragArbeitsschichten != null
        && String(group.schicht.idAuftragArbeitsschichten) === String(einsatz.idAuftragArbeitsschichten));
    const assignmentDay = dayOf(einsatz.detailDatumVon || einsatz.datumVon);
    const dated = candidates.filter(group => dayOf(group.schicht.datumVon) === assignmentDay);
    const group = directId && candidates.length === 1 ? candidates[0]
      : dated.length === 1 ? dated[0]
        : candidates.length === 1 && (!assignmentDay || !dayOf(candidates[0].schicht.datumVon)) ? candidates[0] : null;
    if (group) group.einsaetze.push(einsatz);
    else unmatched.push(einsatz);
  }
  if (unmatched.length) groups.push({ key: 'unassigned', schicht: { bezeichnung: 'Ohne Schichtzuordnung' }, einsaetze: unmatched });
  return groups;
}

export function employeeName(einsatz) {
  const employee = einsatz.mitarbeiterData || {};
  return [employee.nachname, employee.vorname].filter(Boolean).join(', ') || `Mitarbeiter ${einsatz.personalNr ?? 'ohne Nummer'}`;
}

export function plannedTimes(einsatz, schicht) {
  return { start: einsatz.uhrzeitVon || schicht.uhrzeitVon || '', end: einsatz.uhrzeitBis || schicht.uhrzeitBis || '' };
}

export function createQuickEntry(einsatz, initial = {}) {
  return {
    einsatzId: refId(einsatz._id),
    start: initial.start || '',
    end: initial.end || '',
    breakMinutes: initial.breakMinutes ?? 0,
    paidBreakMinutes: initial.paidBreakMinutes ?? 0,
    breaks: Array.from({ length: 3 }, (_, index) => ({
      start: initial.breaks?.[index]?.start || '',
      end: initial.breaks?.[index]?.end || '',
      paid: Boolean(initial.breaks?.[index]?.paid),
    })),
  };
}

export function clockMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Duration-only UI preview. No payroll or statutory break rules are applied. */
export function analyzeQuickEntry(entry) {
  const errors = [];
  const activeBreaks = (entry.breaks || []).filter(block => block.start || block.end);
  const usesBlocks = activeBreaks.length > 0;
  const empty = !entry.start && !entry.end && !usesBlocks && Number(entry.breakMinutes ?? 0) === 0 && Number(entry.paidBreakMinutes ?? 0) === 0;
  const result = { empty, complete: false, errors, grossMinutes: 0, breakMinutes: 0, paidBreakMinutes: 0, netMinutes: 0, overnight: false, usesBlocks };
  if (empty) return result;

  const start = clockMinutes(entry.start);
  const rawEnd = clockMinutes(entry.end);
  if (start === null || rawEnd === null) {
    errors.push('Ist-Beginn und Ist-Ende vollständig angeben.');
    return result;
  }
  if (start === rawEnd) {
    errors.push('Beginn und Ende dürfen nicht gleich sein.');
    return result;
  }
  const end = rawEnd < start ? rawEnd + 1440 : rawEnd;
  result.overnight = rawEnd < start;
  result.grossMinutes = end - start;

  if (usesBlocks) {
    const intervals = [];
    (entry.breaks || []).forEach((block, index) => {
      if (!block.start && !block.end) return;
      const from = clockMinutes(block.start);
      const to = clockMinutes(block.end);
      if (from === null || to === null) {
        errors.push(`Pause ${index + 1}: Beginn und Ende angeben.`);
        return;
      }
      const blockStart = from < start ? from + 1440 : from;
      const blockEnd = to < start ? to + 1440 : to;
      if (blockStart >= blockEnd || blockStart < start || blockEnd > end) {
        errors.push(`Pause ${index + 1} muss innerhalb der Ist-Zeit liegen und eine positive Dauer haben.`);
        return;
      }
      intervals.push({ start: blockStart, end: blockEnd });
      result.breakMinutes += blockEnd - blockStart;
      if (block.paid) result.paidBreakMinutes += blockEnd - blockStart;
    });
    intervals.sort((left, right) => left.start - right.start);
    if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) errors.push('Pausen dürfen sich nicht überschneiden.');
  } else {
    const totalBreak = Number(entry.breakMinutes);
    const paidBreak = Number(entry.paidBreakMinutes);
    if (!Number.isInteger(totalBreak) || totalBreak < 0 || !Number.isInteger(paidBreak) || paidBreak < 0) {
      errors.push('Pausen als ganze, nicht negative Minuten angeben.');
    } else {
      result.breakMinutes = totalBreak;
      result.paidBreakMinutes = paidBreak;
    }
  }
  if (result.paidBreakMinutes > result.breakMinutes) errors.push('Bezahlte Pause darf die gesamte Pause nicht überschreiten.');
  if (result.breakMinutes > result.grossMinutes) errors.push('Die Pause darf nicht länger als die Ist-Zeit sein.');
  result.complete = errors.length === 0;
  if (result.complete) result.netMinutes = result.grossMinutes - result.breakMinutes + result.paidBreakMinutes;
  return result;
}

export const formatHours = minutes => (minutes / 60).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
