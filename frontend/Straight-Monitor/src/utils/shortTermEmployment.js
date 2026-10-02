function localDate(value) {
  if (!value) return null;
  const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date) {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function shortTermEmploymentWindow(entryDate, year) {
  const selectedYear = Number(year);
  if (!Number.isInteger(selectedYear)) return null;

  const yearStart = new Date(selectedYear, 0, 1);
  const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
  const entry = localDate(entryDate);
  if (entry && entry > yearEnd) return null;

  const entryIsInSelectedYear = entry?.getFullYear() === selectedYear;
  const from = entryIsInSelectedYear ? yearStart : (entry || yearStart);
  return {
    from,
    through: yearEnd,
    label: entry && !entryIsInSelectedYear
      ? `seit Eintritt am ${formatDate(entry)}`
      : `im Kalenderjahr ${selectedYear}`,
  };
}