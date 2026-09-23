const dayOf = value => String(value || '').slice(0, 10);
const refId = value => String(value?._id ?? value ?? '');
const orderMatches = (item, auftragNr) => String(item.auftragNr) === String(auftragNr);

/** Read-only projection of Auftrag → Einsatz; imported Einsatz fields are authoritative. */
export function buildQuickEntryRows(auftrag, einsaetze = []) {
  if (auftrag?.auftragNr == null) return [];
  return einsaetze
    .filter(einsatz => orderMatches(einsatz, auftrag.auftragNr))
    .toSorted((left, right) => [
      dayOf(left.detailDatumVon || left.datumVon).localeCompare(dayOf(right.detailDatumVon || right.datumVon)),
      String(left.uhrzeitVon || '').localeCompare(String(right.uhrzeitVon || '')),
      employeeName(left).localeCompare(employeeName(right), 'de'),
    ].find(result => result !== 0) || 0);
}

export function employeeName(einsatz) {
  const employee = einsatz.mitarbeiterData || {};
  return [employee.nachname, employee.vorname].filter(Boolean).join(', ') || `Mitarbeiter ${einsatz.personalNr ?? 'ohne Nummer'}`;
}

export function plannedTimes(einsatz) {
  return { start: einsatz.uhrzeitVon || '', end: einsatz.uhrzeitBis || '' };
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

/** § 4 ArbZG: mandatory total rest break for the recorded working time. */
export function minimumRestBreakMinutes(workMinutes) {
  if (workMinutes > 9 * 60) return 45;
  if (workMinutes > 6 * 60) return 30;
  return 0;
}

const berlinClock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function actualMinute(date, clock, offset) {
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error('Ungültiges Einsatzdatum.');
  day.setUTCDate(day.getUTCDate() + offset);
  const expected = `${day.toISOString().slice(0, 10)} ${clock}`;
  const wall = day.getTime() + clockMinutes(clock) * 60000;
  const matches = [60, 120].map(minutes => new Date(wall - minutes * 60000)).filter(value => berlinClock.format(value) === expected);
  if (matches.length !== 1) throw new Error('Diese Uhrzeit ist durch die Zeitumstellung nicht eindeutig. Bitte separat klären.');
  return matches[0].getTime() / 60000;
}

/** Duration-only UI preview. Optional date accounts for Europe/Berlin DST. */
export function analyzeQuickEntry(entry, date = null) {
  const errors = [];
  const activeBreaks = (entry.breaks || []).filter(block => block.start || block.end);
  const usesBlocks = activeBreaks.length > 0;
  const empty = !entry.start && !entry.end && !usesBlocks && Number(entry.breakMinutes ?? 0) === 0 && Number(entry.paidBreakMinutes ?? 0) === 0;
  const warnings = [];
  const result = { empty, complete: false, errors, warnings, grossMinutes: 0, workMinutes: 0, minimumRestBreakMinutes: 0, breakMinutes: 0, paidBreakMinutes: 0, netMinutes: 0, overnight: false, usesBlocks };
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
  if (date) {
    try {
      result.grossMinutes = actualMinute(date, entry.end, result.overnight ? 1 : 0) - actualMinute(date, entry.start, 0);
      if (result.grossMinutes > 1440) errors.push('Eine Erfassung darf höchstens 24 Stunden umfassen.');
    } catch (error) { errors.push(error.message); return result; }
  }

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
      let duration = blockEnd - blockStart;
      if (date) {
        try { duration = actualMinute(date, block.end, blockEnd >= 1440 ? 1 : 0) - actualMinute(date, block.start, blockStart >= 1440 ? 1 : 0); }
        catch (error) { errors.push(error.message); return; }
      }
      result.breakMinutes += duration;
      if (block.paid) result.paidBreakMinutes += duration;
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
  result.workMinutes = result.grossMinutes - result.breakMinutes;
  result.minimumRestBreakMinutes = minimumRestBreakMinutes(result.workMinutes);
  if (result.minimumRestBreakMinutes && result.breakMinutes < result.minimumRestBreakMinutes) {
    warnings.push(`Für ${Math.floor(result.workMinutes / 60)}:${String(result.workMinutes % 60).padStart(2, '0')} Stunden Arbeitszeit sind mindestens ${result.minimumRestBreakMinutes} Minuten Ruhepause erforderlich; erfasst sind ${result.breakMinutes} Minuten.`);
  }
  if (result.workMinutes > 10 * 60) warnings.push('Die Arbeitszeit ohne Ruhepausen liegt über 10 Stunden. Gesetzliche oder tarifliche Ausnahme prüfen.');
  result.complete = errors.length === 0;
  if (result.complete) result.netMinutes = result.grossMinutes - result.breakMinutes + result.paidBreakMinutes;
  return result;
}

export const formatHours = minutes => (minutes / 60).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
