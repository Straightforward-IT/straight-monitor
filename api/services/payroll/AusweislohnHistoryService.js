const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('../../domain/payroll/ausweislohnHistory');
const { fail } = require('../../domain/payroll/detailImport');

// Explicit local Zvoove test source. Does not publish an active payroll input,
// import references into MongoDB, or feed the independent position calculation.
function createReader(root = path.resolve(__dirname, '../../assets')) {
  const cache = new Map();
  return async year => {
    if (!/^\d{4}$/.test(String(year))) fail('Ungültiges Quelljahr.');
    const filename = `Ausweislohn ${year}.xlsx`, file = path.join(root, filename);
    let stat;
    try { stat = await fs.stat(file); } catch (error) { if (error.code === 'ENOENT') fail(`Die historische Quelldatei ${filename} fehlt.`, 'AVERAGE_HISTORY_MISSING', 422); throw error; }
    if (stat.size > 30 * 1024 * 1024) fail('AUSWEISLOHN überschreitet 30 MB.');
    const revision = `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    if (cache.get(year)?.revision !== revision) {
      const promise = fs.readFile(file).then(buffer => ({ filename, hash: crypto.createHash('sha256').update(buffer).digest('hex'), rows: parse(buffer, filename, Number(year)) }));
      cache.set(year, { revision, promise });
      promise.catch(() => { if (cache.get(year)?.promise === promise) cache.delete(year); });
      if (cache.size > 2) cache.delete(cache.keys().next().value);
    }
    return cache.get(year).promise;
  };
}
module.exports = { read: createReader(), createReader };
