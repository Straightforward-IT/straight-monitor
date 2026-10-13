const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});
const offsetFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset',
});

function dayKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dayFormatter.format(date);
}
function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function addDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function dayOffset(from, to) {
  return Math.round((Date.parse(`${dayKey(to)}T12:00:00Z`) - Date.parse(`${dayKey(from)}T12:00:00Z`)) / 86400000);
}
function atTime(day, time = '00:00') {
  const wall = Date.parse(`${day}T${time}:00Z`);
  let instant = wall;
  for (let pass = 0; pass < 3; pass += 1) {
    const offset = offsetFormatter.formatToParts(new Date(instant))
      .find(part => part.type === 'timeZoneName').value.match(/GMT([+-])(\d+)(?::(\d+))?/);
    const minutes = offset ? (Number(offset[2]) * 60 + Number(offset[3] || 0)) * (offset[1] === '+' ? 1 : -1) : 0;
    const next = wall - minutes * 60000;
    if (next === instant) break;
    instant = next;
  }
  // Reject non-existent local times in the spring DST gap instead of silently moving a shift.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
  if (parts !== time) {
    const error = new Error(`Die Uhrzeit ${day} ${time} existiert in Europe/Berlin nicht.`);
    error.statusCode = 400;
    throw error;
  }
  return new Date(instant);
}
module.exports = { dayKey, validDay, addDays, dayOffset, atTime };
