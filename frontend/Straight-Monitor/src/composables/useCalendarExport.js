import { download } from '@getflip/bridge';

/**
 * Formats a date + optional time string into an ICS date/datetime stamp.
 * Returns { stamp: string, allDay: boolean }
 */
function icsDate(dateStr, timeStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  if (!timeStr) {
    return { stamp: `${yyyy}${mm}${dd}`, allDay: true };
  }

  // Parse HH:MM from "08:00", "08:00:00", or full Date.toString() string
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  const hh = m ? String(m[1]).padStart(2, '0') : '00';
  const min = m ? m[2] : '00';

  return { stamp: `${yyyy}${mm}${dd}T${hh}${min}00`, allDay: false };
}

function icsEscape(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildVEvent(e) {
  const title =
    e.auftrag?.eventTitel || e.bezeichnung || `Auftrag #${e.auftragNr}`;
  const location = [e.auftrag?.eventLocation, e.auftrag?.eventOrt]
    .filter(Boolean)
    .join(', ');

  const start = icsDate(e.datumVon, e.uhrzeitVon);

  let end;
  if (start.allDay) {
    // ICS all-day DTEND is exclusive — add 1 day to datumBis
    const endD = new Date(e.datumBis || e.datumVon);
    endD.setDate(endD.getDate() + 1);
    const yyyy = endD.getFullYear();
    const mm = String(endD.getMonth() + 1).padStart(2, '0');
    const dd = String(endD.getDate()).padStart(2, '0');
    end = { stamp: `${yyyy}${mm}${dd}`, allDay: true };
  } else {
    end = icsDate(e.datumBis || e.datumVon, e.uhrzeitBis || e.uhrzeitVon);
  }

  const uid = `einsatz-${e._id || e.auftragNr}@straight-monitor`;

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SUMMARY:${icsEscape(title)}`,
    start.allDay
      ? `DTSTART;VALUE=DATE:${start.stamp}`
      : `DTSTART:${start.stamp}`,
    end.allDay
      ? `DTEND;VALUE=DATE:${end.stamp}`
      : `DTEND:${end.stamp}`,
  ];

  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  if (e.schichtBezeichnung)
    lines.push(`DESCRIPTION:${icsEscape(e.schichtBezeichnung)}`);

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function buildIcsString(einsaetze) {
  const vevents = einsaetze.map(buildVEvent).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Straight Monitor//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Triggers a .ics file download via the Flip Bridge.
 * @param {Array} einsaetze - Array of enriched Einsatz objects
 * @param {string} fileName - File name for the download
 */
export async function downloadEinsaetze(einsaetze, fileName = 'Einsaetze.ics') {
  if (!einsaetze || einsaetze.length === 0) return false;
  const ics = buildIcsString(einsaetze);
  const base64 = btoa(unescape(encodeURIComponent(ics)));
  return download({
    fileName,
    fileType: 'text/calendar',
    dataUrl: `data:text/calendar;base64,${base64}`,
  });
}
