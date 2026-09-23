// The supplied hr:exchange contract has no documented calculated AZK balance.
// Future implementations may return { status: 'AVAILABLE', minutes, period,
// fetchedAt } in memory only. Never include this result in preparation storage,
// snapshots, logs, or browser persistence.
async function readTimeAccount({ employeeId, month }) {
  return { status: 'UNAVAILABLE', employeeId, period: month, reason: 'LODAS_BALANCE_READER_NOT_CONFIGURED' };
}
module.exports = { readTimeAccount };
