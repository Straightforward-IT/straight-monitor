export const CURRENT_PERIOD_OPTIONS = [
  { value: "day", label: "Tag" },
  { value: "week", label: "Woche" },
  { value: "month", label: "Monat" },
];

export function getPeriodRange(period, referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  let start = new Date(year, month, day);
  let end = new Date(year, month, day, 23, 59, 59, 999);

  if (period === "week") {
    const mondayOffset = start.getDay() === 0 ? -6 : 1 - start.getDay();
    start.setDate(start.getDate() + mondayOffset);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  }

  return { start, end };
}

export function orderOverlapsRange(order, range) {
  const orderStart = new Date(order?.vonDatum);
  const orderEnd = new Date(order?.bisDatum || order?.vonDatum);
  if (Number.isNaN(orderStart.getTime()) || Number.isNaN(orderEnd.getTime())) return false;
  return orderStart <= range.end && orderEnd >= range.start;
}
