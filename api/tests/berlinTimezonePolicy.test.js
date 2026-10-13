const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');
const sourceRoots = [
  path.join(repositoryRoot, 'api'),
  path.join(repositoryRoot, 'frontend/Straight-Monitor/src'),
];
const excludedDirectories = new Set(['node_modules', 'dist', 'coverage', 'test', 'tests']);
const sourceExtensions = new Set(['.js', '.ts', '.vue']);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) return [];
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filePath);
    return sourceExtensions.has(path.extname(entry.name)) ? [filePath] : [];
  });
}

function closingParenthesis(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')' && --depth === 0) return index;
  }
  return -1;
}

function missingBerlinTimezone(filePath, source, expression) {
  const violations = [];
  let searchFrom = 0;
  while (true) {
    const expressionIndex = source.indexOf(expression, searchFrom);
    if (expressionIndex === -1) return violations;
    const openingIndex = source.indexOf('(', expressionIndex + expression.length);
    const closingIndex = openingIndex === -1 ? -1 : closingParenthesis(source, openingIndex);
    if (closingIndex === -1) {
      violations.push(`${filePath}: unvollständiger Aufruf von ${expression}`);
      return violations;
    }
    const call = source.slice(openingIndex + 1, closingIndex);
    if (!/timeZone\s*:\s*['"]Europe\/Berlin['"]/.test(call)) {
      const line = source.slice(0, expressionIndex).split('\n').length;
      violations.push(`${filePath}:${line}: ${expression} ohne Europe/Berlin`);
    }
    searchFrom = closingIndex + 1;
  }
}

describe('Europe/Berlin timezone policy', () => {
  it('configures the backend process for Berlin business-time calculations', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    delete require.cache[require.resolve('../config/timezone')];

    try {
      const { BUSINESS_TIME_ZONE } = require('../config/timezone');
      assert.equal(BUSINESS_TIME_ZONE, 'Europe/Berlin');
      assert.equal(process.env.TZ, 'Europe/Berlin');
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
      delete require.cache[require.resolve('../config/timezone')];
    }
  });

  it('uses Berlin for business-facing date formatting and current calendar dates', () => {
    const violations = [];
    for (const filePath of sourceRoots.flatMap(sourceFiles)) {
      const source = fs.readFileSync(filePath, 'utf8');
      for (const expression of ['.toLocaleDateString', '.toLocaleTimeString', 'Intl.DateTimeFormat']) {
        violations.push(...missingBerlinTimezone(filePath, source, expression));
      }
      for (const forbidden of [
        /\.toDateString\s*\(/g,
        /new Date\(\)\.(?:getFullYear|getMonth|getDate|getDay|getHours|getMinutes)\s*\(/g,
        /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g,
        /timeZone\s*:\s*['"]UTC['"]/g,
      ]) {
        for (const match of source.matchAll(forbidden)) {
          const line = source.slice(0, match.index).split('\n').length;
          violations.push(`${filePath}:${line}: implizite oder UTC-basierte fachliche Kalenderzeit`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
