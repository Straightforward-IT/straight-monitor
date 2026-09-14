// Frontend sandbox: balances are integer minutes, with no payroll or API rules.
export const DAY_ENTRY_TYPES = [
  ['M', 'Stundenkorrektur', 'correction', true],
  ['U', 'Urlaub (bezahlt)', 'vacation', true],
  ['K', 'Krank (mit Lohnfortzahlung)', 'sick', true],
  ['F', 'Feiertag', 'absence', true],
  ['FA', 'Freizeitausgleich (AZK minus)', 'absence', true],
  ['BG', 'Beschäftigungsverbot generell', 'absence', true],
  ['BI', 'Beschäftigungsverbot individuell', 'absence', true],
  ['EZ', 'Elternzeit', 'absence', false],
  ['FE', 'Fehlen (entschuldigt)', 'absence', false],
  ['FS', 'Freischicht / Schichtfrei', 'absence', false],
  ['FU', 'Fehlen (unentschuldigt)', 'absence', false],
  ['GW', 'Garantie / Wartezeit', 'absence', false],
  ['KA', 'Krank (Arbeitsunfall)', 'sick', true],
  ['KE', 'Krank (bei Eintritt o. Lohnfortzahlung)', 'sick', false],
  ['KF', 'KUG Feiertag', 'absence', false],
  ['KG', 'KUG Tag (Gehalt)', 'absence', false],
  ['KI', 'KUG (Krankengeld)', 'absence', false],
  ['KK', 'Krank (Erkrankung des Kindes)', 'sick', false],
  ['KO', 'Krank (ohne Lohnfortzahlung)', 'sick', false],
  ['KW', 'KUG Tag', 'absence', false],
  ['MS', 'Mutterschutz', 'absence', false],
  ['NV', 'Nicht verfügbar', 'absence', false],
  ['PZ', 'Pflegezeit', 'absence', false],
  ['Q', 'Quarantäne', 'absence', true],
  ['UB', 'Urlaub (Bildungsurlaub)', 'vacation', true],
  ['US', 'Urlaub (Sonderurlaub)', 'vacation', true],
  ['UU', 'Urlaub (unbezahlt)', 'vacation', false],
  ['V', 'Schnittvortrag', 'absence', false],
].map(([code, label, kind, credited]) => ({ code, label, kind, credited }));

export const TIME_ENTRY_TYPES = [
  { code: 'P', label: 'Produktive Zeit', kind: 'productive', credited: true },
  ...DAY_ENTRY_TYPES,
  { code: 'PL', label: 'Geplante Schicht', kind: 'planned', credited: false },
];

export const cloneTimeData = value => JSON.parse(JSON.stringify(value));
const minutes = value => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
export function formatMinutes(value) {
  const absolute = Math.abs(Math.round(value));
  return `${value < 0 ? '−' : ''}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')} h`;
}
export function monthDays(month) {
  const [year, number] = month.split('-').map(Number);
  return Array.from({ length: new Date(year, number, 0).getDate() }, (_, index) => {
    const date = new Date(year, number - 1, index + 1);
    return { date: `${month}-${String(index + 1).padStart(2, '0')}`, day: index + 1,
      weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }), weekend: [0, 6].includes(date.getDay()) };
  });
}
export function monthWeeks(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = Math.ceil((offset + monthDays(month).length) / 7);
  return Array.from({ length: count }, (_, weekIndex) => {
    const monday = new Date(Date.UTC(year, number - 1, 1 - offset + weekIndex * 7));
    // The ISO week belongs to the year containing its Thursday.
    const thursday = new Date(monday);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    const weekNumber = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
    return { key: monday.toISOString().slice(0, 10), number: weekNumber,
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(monday);
        date.setUTCDate(date.getUTCDate() + dayIndex);
        return { date: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === number - 1 };
      }) };
  });
}
export function createTimeWorkspace(initial) {
  const data = {
    entries: initial.entries.map(entry => ({ ...cloneTimeData(entry), minutes: minutes(entry.minutes),
      originalMinutes: minutes(entry.originalMinutes ?? entry.minutes) })),
    bankMinutes: minutes(initial.bankMinutes), createdMinutes: 0, removedMinutes: 0, journal: [],
  };
  return { data, saved: cloneTimeData(data), history: [], active: null, lots: [] };
}
export const bucketMinutes = workspace => workspace.lots.reduce((sum, lot) => sum + lot.minutes, 0);
export const hasTimeChanges = workspace => JSON.stringify(workspace.data) !== JSON.stringify(workspace.saved);
export function timeTotals(data) {
  const result = { productive: 0, absence: 0, correction: 0, planned: 0, uncredited: 0, credited: 0 };
  for (const entry of data.entries) {
    if (entry.kind === 'planned') result.planned += entry.minutes;
    else if (!entry.credited) result.uncredited += entry.minutes;
    else if (entry.kind === 'productive') result.productive += entry.minutes;
    else if (entry.kind === 'correction') result.correction += entry.minutes;
    else result.absence += entry.minutes;
  }
  result.credited = result.productive + result.absence + result.correction;
  result.forecast = result.credited + result.planned;
  return result;
}
export function sourceMinutes(workspace, source, newMinutes = 480) {
  if (source === 'new') return minutes(newMinutes);
  if (source === 'bank') return workspace.data.bankMinutes;
  const entry = workspace.data.entries.find(item => item.id === source);
  return entry && entry.kind !== 'planned' ? entry.minutes : 0;
}
export function targetLabel(workspace, id) {
  if (id === 'bank') return 'Zeitkonto';
  if (id === 'new') return 'Neue Stunden';
  if (id === 'remove') return 'Stunden entfernt';
  const entry = workspace.data.entries.find(item => item.id === id);
  return entry ? `${entry.date.slice(8)}. · ${entry.label}` : id;
}
function begin(workspace) {
  if (!workspace.active) workspace.active = { before: cloneTimeData(workspace.data), transfers: [] };
}
function finish(workspace) {
  if (!workspace.active || bucketMinutes(workspace)) return;
  const { before, transfers } = workspace.active;
  workspace.history.push(before);
  workspace.data.journal.unshift({ label: 'Stunden umgebucht', transfers: cloneTimeData(transfers) });
  workspace.active = null;
}
export function collectTime(workspace, source, amount, newMinutes = 480) {
  const quantity = Math.min(minutes(amount), sourceMinutes(workspace, source, newMinutes));
  if (!quantity) return 0;
  begin(workspace);
  if (source === 'bank') workspace.data.bankMinutes -= quantity;
  else if (source === 'new') workspace.data.createdMinutes += quantity;
  else workspace.data.entries.find(entry => entry.id === source).minutes -= quantity;
  workspace.lots.push({ source, label: targetLabel(workspace, source), minutes: quantity });
  return quantity;
}
export function dropTime(workspace, target, amount) {
  const quantity = Math.min(minutes(amount), bucketMinutes(workspace));
  if (!quantity || target === 'new') return 0;
  let entry;
  if (!['bank', 'remove'].includes(target)) {
    entry = workspace.data.entries.find(item => item.id === target);
    if (!entry || entry.kind === 'planned') return 0;
  }
  if (target === 'bank') workspace.data.bankMinutes += quantity;
  else if (target === 'remove') workspace.data.removedMinutes += quantity;
  else entry.minutes += quantity;
  let remaining = quantity;
  while (remaining) {
    const lot = workspace.lots[0];
    const taken = Math.min(remaining, lot.minutes);
    workspace.active.transfers.push({ source: lot.source, sourceLabel: lot.label,
      target, targetLabel: targetLabel(workspace, target), minutes: taken });
    lot.minutes -= taken;
    remaining -= taken;
    if (!lot.minutes) workspace.lots.shift();
  }
  finish(workspace);
  return quantity;
}
export function cancelTime(workspace) {
  if (!workspace.active) return false;
  workspace.data = cloneTimeData(workspace.active.before);
  workspace.lots = [];
  workspace.active = null;
  return true;
}
export function undoTime(workspace) {
  if (workspace.active) return cancelTime(workspace);
  if (!workspace.history.length) return false;
  workspace.data = workspace.history.pop();
  return true;
}
export function revertTime(workspace) {
  workspace.data = cloneTimeData(workspace.saved);
  workspace.active = null;
  workspace.lots = [];
  workspace.history = [];
}
export function saveTime(workspace) {
  if (workspace.active || bucketMinutes(workspace)) return null;
  workspace.saved = cloneTimeData(workspace.data);
  workspace.history = [];
  return cloneTimeData(workspace.saved);
}
// A zero-hour entry is a destination. Positive amounts are explicitly created;
// FA draws its initial amount from the bank instead of minting new hours.
export function addTimeEntry(workspace, entry) {
  if (workspace.active || workspace.data.entries.some(item => item.id === entry.id)) return false;
  const amount = minutes(entry.minutes);
  if (entry.code === 'FA' && amount > workspace.data.bankMinutes) return false;
  workspace.history.push(cloneTimeData(workspace.data));
  workspace.data.entries.push({ ...cloneTimeData(entry), minutes: amount, originalMinutes: 0 });
  if (entry.code === 'FA') workspace.data.bankMinutes -= amount;
  else workspace.data.createdMinutes += amount;
  workspace.data.journal.unshift({ label: `${entry.date.slice(8)}. · ${entry.label} angelegt`, transfers: [] });
  return true;
}
export function changeTimeEntryType(workspace, entryId, code) {
  if (workspace.active || bucketMinutes(workspace)) return false;
  const entry = workspace.data.entries.find(item => item.id === entryId);
  const type = TIME_ENTRY_TYPES.find(item => item.code === code);
  if (!entry || !type || entry.code === type.code) return false;
  workspace.history.push(cloneTimeData(workspace.data));
  entry.typeChangeOriginalLabel ||= entry.label;
  entry.code = type.code;
  entry.kind = type.kind;
  entry.credited = type.credited;
  entry.label = type.code === 'P' || type.code === 'PL' ? entry.typeChangeOriginalLabel : type.label;
  workspace.data.journal.unshift({ label: `${entry.date.slice(8)}. · Art auf ${type.label} geändert`, transfers: [] });
  return true;
}
export function dropOnDay(workspace, date, amount) {
  if (!bucketMinutes(workspace) || !minutes(amount)) return 0;
  const id = `correction-${date}`;
  if (!workspace.data.entries.some(entry => entry.id === id)) {
    workspace.data.entries.push({ id, date, code: 'M', label: 'Stundenkorrektur', kind: 'correction',
      credited: true, minutes: 0, originalMinutes: 0, source: 'Manuell' });
  }
  return dropTime(workspace, id, amount);
}
