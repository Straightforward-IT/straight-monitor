export const tariffFileRoles = [
  { key: 'contract', importNumber: 700, label: 'Tarifvertrag', hint: 'Vertrag 17055' },
  { key: 'employeeGroups', importNumber: 701, label: 'Tarifmitarbeitergruppe', hint: 'Tarifvarianten, einschließlich inaktiver Varianten' },
  { key: 'payGroups', importNumber: 702, label: 'Tarifgruppe', hint: 'Entgeltgruppen · INR = Matrixposition IY' },
  { key: 'stages', importNumber: 703, label: 'Tarifstufe', hint: 'Stufen · INR = Matrixposition IX' },
  { key: 'periods', importNumber: 704, label: 'Tarifzeit', hint: 'Aktuelle und historische Tarifperioden' },
  { key: 'rates', importNumber: 705, label: 'Tarif Entgelt', hint: 'Entgeltmatrix je Tarifperiode' },
  { key: 'wageRules', importNumber: 706, label: 'Tarif Lohnarten', hint: 'Alle Lohnartenregeln je Tarifperiode' },
  { key: 'specialPayments', importNumber: 707, label: 'Tarif Urlaubsgeld Weihnachtsgeld', hint: 'Sonderzahlungsregeln je Tarifperiode' },
  { key: 'assignmentAllowances', importNumber: 708, label: 'Tarifeinsatzzulage', hint: 'Einsatzzulagen je Tarifperiode' },
  { key: 'employeeAssignments', importNumber: 709, label: 'Tarif Personal', hint: 'Mitarbeiterzuordnungen mit ihrer Historie' },
  { key: 'aboveTariff', importNumber: 710, label: 'Tarif ÜTZ', hint: 'Individuelle übertarifliche Werte mit ihrer Historie' },
  { key: 'referenceWages', importNumber: 711, label: 'Tarifecklohn', hint: 'Ecklohn-Konfiguration je Tarifvariante' },
  { key: 'noticePeriods', importNumber: 712, label: 'Tarifkündigungsfrist', hint: 'Kündigungsfristen des Tarifvertrags' },
  { key: 'vacationRules', importNumber: 713, label: 'Tarifurlaub', hint: 'Urlaubsstaffeln des Tarifvertrags' },
];

export function formatTariffDate(value) {
  if (!value) return 'offen';
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('.') : String(value);
}

// Keep all imported decimal places; never turn tariff amounts into binary floats.
export function formatTariffDecimal(value, currency = false) {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return text;
  const [whole, decimals = ''] = text.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fraction = currency ? decimals.padEnd(2, '0') : decimals;
  return `${grouped}${fraction ? `,${fraction}` : ''}${currency ? ' €' : ''}`;
}

export function sourceValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function matchLabel(status) {
  return { MATCHED: 'Zugeordnet', MISSING: 'Mitarbeiter fehlt', AMBIGUOUS: 'Mehrdeutige Personalnummer' }[status] || status || 'Ungeklärt';
}

export function importStatusLabel(status) {
  return { READY: 'Geprüft', INVALID: 'Fehlerhaft', ACTIVE: 'Aktiv', SUPERSEDED: 'Abgelöst' }[status] || status || '—';
}

export function todayInBerlin() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function tariffSelectionNotice(selection, label = 'Tarifzuordnung') {
  if (!selection?.personalNr) return '';
  if (selection.basis === 'CURRENT_PERSONAL_NUMBER' && selection.excludedPersonalNumbers?.length) {
    return `${label}: Aktuelle Personalnummer ${selection.personalNr} verwendet. Gleichzeitig gültige Zeilen der historischen Nummern ${selection.excludedPersonalNumbers.join(', ')} bleiben in der Historie erhalten.`;
  }
  if (selection.basis === 'HISTORICAL_PERSONAL_NUMBER' && selection.currentPersonalNr) {
    return `${label}: Historische Personalnummer ${selection.personalNr} verwendet; zur aktuellen Nummer ${selection.currentPersonalNr} fehlt am Stichtag ein gültiger Eintrag.`;
  }
  return '';
}
