export function currentPayrollMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
}

export function personGroupForMonth(employee, month = currentPayrollMonth()) {
  const entry = (employee?.lohnStammdaten || []).find(snapshot => snapshot.month === month);
  if (entry?.persgruppe != null) return entry.persgruppe;
  if (entry?.persgruppe_set_explicitly || entry?.sourceId) return null;
  return month === currentPayrollMonth() ? employee?.persgruppe ?? null : null;
}
