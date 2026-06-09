const User = require('./models/User');
const Kunde = require('./models/Kunde');
const Auftrag = require('./models/Auftrag');
const Einsatz = require('./models/Einsatz');
const Schicht = require('./models/Schicht');
const { sendMail } = require('./EmailService');
const logger = require('./utils/logger');

const MONTH_NAMES_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function assertValidPeriod(month, year) {
  const parsedMonth = Number.parseInt(month, 10);
  const parsedYear = Number.parseInt(year, 10);

  if (!parsedMonth || parsedMonth < 1 || parsedMonth > 12 || !parsedYear || parsedYear < 2000 || parsedYear > 2100) {
    const error = new Error('Gültiger Monat (1-12) und Jahr erforderlich');
    error.statusCode = 400;
    throw error;
  }

  return { month: parsedMonth, year: parsedYear };
}

function getPreviousMonthPeriod(referenceDate = new Date()) {
  const currentMonthIndex = referenceDate.getMonth();
  if (currentMonthIndex === 0) {
    return { month: 12, year: referenceDate.getFullYear() - 1 };
  }

  return { month: currentMonthIndex, year: referenceDate.getFullYear() };
}

function shiftMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

function monthRange(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1))
  };
}

function periodLabel(period) {
  return `${MONTH_NAMES_DE[period.month - 1]} ${period.year}`;
}

function emptyMetrics() {
  return {
    auftraegeCount: 0,
    bedarfCount: 0,
    einsaetzeCount: 0,
    offenCount: 0,
    besetzungsquote: null
  };
}

function hasMetricData(metrics) {
  return !!metrics && (
    metrics.auftraegeCount > 0 ||
    metrics.bedarfCount > 0 ||
    metrics.einsaetzeCount > 0 ||
    metrics.offenCount > 0
  );
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function finalizeMetrics(metrics) {
  const bedarfCount = Number(metrics.bedarfCount || 0);
  const einsaetzeCount = Number(metrics.einsaetzeCount || 0);

  metrics.bedarfCount = bedarfCount;
  metrics.einsaetzeCount = einsaetzeCount;
  metrics.auftraegeCount = Number(metrics.auftraegeCount || 0);
  metrics.offenCount = Math.max(bedarfCount - einsaetzeCount, 0);
  metrics.besetzungsquote = bedarfCount > 0 ? roundOne((einsaetzeCount / bedarfCount) * 100) : null;

  return metrics;
}

function createDelta(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  const absolute = current - previous;
  const percent = previous > 0 ? roundOne((absolute / previous) * 100) : null;
  let status = 'flat';

  if (previous === 0 && current > 0) status = 'new';
  else if (previous > 0 && current === 0) status = 'lost';
  else if (absolute > 0) status = 'up';
  else if (absolute < 0) status = 'down';

  return { current, previous, absolute, percent, status };
}

function createDeltaSet(current, previous) {
  const comparison = previous || emptyMetrics();

  return {
    auftraegeCount: createDelta(current.auftraegeCount, comparison.auftraegeCount),
    bedarfCount: createDelta(current.bedarfCount, comparison.bedarfCount),
    einsaetzeCount: createDelta(current.einsaetzeCount, comparison.einsaetzeCount),
    offenCount: createDelta(current.offenCount, comparison.offenCount)
  };
}

function sortByCustomerName(a, b) {
  return String(a.kundName || '').localeCompare(String(b.kundName || ''), 'de');
}

function buildRankings(kunden, deltaKey) {
  const ranked = kunden
    .filter((entry) => hasMetricData(entry.current) || hasMetricData(entry[deltaKey === 'deltaPrevMonth' ? 'prevMonth' : 'prevYear']))
    .map((entry) => ({
      kundenNr: entry.kundenNr,
      kundName: entry.kundName,
      kuerzel: entry.kuerzel,
      current: entry.current,
      delta: entry[deltaKey].bedarfCount,
      einsatzDelta: entry[deltaKey].einsaetzeCount
    }));

  const winners = ranked
    .filter((entry) => entry.delta.absolute > 0 || entry.einsatzDelta.absolute > 0)
    .sort((a, b) => {
      if (b.delta.absolute !== a.delta.absolute) return b.delta.absolute - a.delta.absolute;
      return b.einsatzDelta.absolute - a.einsatzDelta.absolute;
    })
    .slice(0, 5);

  const losers = ranked
    .filter((entry) => entry.delta.absolute < 0 || entry.einsatzDelta.absolute < 0)
    .sort((a, b) => {
      if (a.delta.absolute !== b.delta.absolute) return a.delta.absolute - b.delta.absolute;
      return a.einsatzDelta.absolute - b.einsatzDelta.absolute;
    })
    .slice(0, 5);

  return { winners, losers };
}

function createTotals(kunden, key) {
  const totals = kunden.reduce((acc, entry) => {
    const metrics = entry[key] || emptyMetrics();
    acc.auftraegeCount += metrics.auftraegeCount || 0;
    acc.bedarfCount += metrics.bedarfCount || 0;
    acc.einsaetzeCount += metrics.einsaetzeCount || 0;
    return acc;
  }, { auftraegeCount: 0, bedarfCount: 0, einsaetzeCount: 0 });

  return finalizeMetrics(totals);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtNumber(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value || 0);
}

function fmtPercent(value) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value) + '%';
}

function fmtDelta(delta) {
  if (!delta) return '-';
  if (delta.absolute === 0) return '0';

  const sign = delta.absolute > 0 ? '+' : '';
  const pct = delta.percent !== null ? ` (${sign}${fmtPercent(delta.percent)})` : '';
  return `${sign}${fmtNumber(delta.absolute)}${pct}`;
}

function deltaColor(delta) {
  if (!delta || delta.absolute === 0) return '#6b7280';
  return delta.absolute > 0 ? '#16a34a' : '#dc2626';
}

async function buildKundenContext(kunden) {
  const kundenNrs = [...new Set(kunden.map((kunde) => Number(kunde.kundenNr)).filter(Number.isFinite))];

  if (!kundenNrs.length) {
    return { kundenNrs, auftragNrs: [], auftragToKunde: new Map() };
  }

  const auftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } })
    .select('auftragNr kundenNr')
    .lean();

  const auftragToKunde = new Map();
  for (const auftrag of auftraege) {
    if (!Number.isFinite(Number(auftrag.auftragNr)) || !Number.isFinite(Number(auftrag.kundenNr))) continue;
    auftragToKunde.set(Number(auftrag.auftragNr), Number(auftrag.kundenNr));
  }

  return {
    kundenNrs,
    auftragNrs: [...auftragToKunde.keys()],
    auftragToKunde
  };
}

async function aggregateBedarfByAuftrag(auftragNrs, range) {
  if (!auftragNrs.length) return [];

  const dateMatch = { $gte: range.start, $lt: range.end };
  const schichtMatch = { auftragNr: { $in: auftragNrs }, datumVon: dateMatch, bedarf: { $gt: 0 } };
  const einsatzMatch = { ...schichtMatch, isPseudo: { $ne: true } };
  const project = { auftragNr: 1, idAuftragArbeitsschichten: 1, datumVon: 1, bedarf: 1 };

  return Schicht.aggregate([
    { $match: schichtMatch },
    { $project: project },
    {
      $unionWith: {
        coll: Einsatz.collection.name,
        pipeline: [
          { $match: einsatzMatch },
          { $project: project }
        ]
      }
    },
    {
      $group: {
        _id: {
          auftragNr: '$auftragNr',
          idAuftragArbeitsschichten: '$idAuftragArbeitsschichten',
          datumVon: '$datumVon'
        },
        bedarf: { $first: '$bedarf' }
      }
    },
    {
      $group: {
        _id: '$_id.auftragNr',
        bedarfCount: { $sum: '$bedarf' }
      }
    }
  ]);
}

async function aggregateEinsaetzeByAuftrag(auftragNrs, range) {
  if (!auftragNrs.length) return [];

  return Einsatz.aggregate([
    {
      $match: {
        auftragNr: { $in: auftragNrs },
        datumVon: { $gte: range.start, $lt: range.end },
        personalNr: { $ne: null },
        isPseudo: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$auftragNr',
        einsaetzeCount: { $sum: 1 }
      }
    }
  ]);
}

async function buildPeriodMetrics(kunden, context, range) {
  const metricsByKunde = new Map(kunden.map((kunde) => [Number(kunde.kundenNr), { ...emptyMetrics(), auftraege: new Set() }]));

  if (!context.auftragNrs.length) {
    return new Map([...metricsByKunde.entries()].map(([kundenNr, metrics]) => [kundenNr, finalizeMetrics(metrics)]));
  }

  const [bedarfByAuftrag, einsaetzeByAuftrag] = await Promise.all([
    aggregateBedarfByAuftrag(context.auftragNrs, range),
    aggregateEinsaetzeByAuftrag(context.auftragNrs, range)
  ]);

  for (const entry of bedarfByAuftrag) {
    const auftragNr = Number(entry._id);
    const kundenNr = context.auftragToKunde.get(auftragNr);
    if (!kundenNr || !metricsByKunde.has(kundenNr)) continue;

    const metrics = metricsByKunde.get(kundenNr);
    metrics.bedarfCount += Number(entry.bedarfCount || 0);
    metrics.auftraege.add(auftragNr);
  }

  for (const entry of einsaetzeByAuftrag) {
    const auftragNr = Number(entry._id);
    const kundenNr = context.auftragToKunde.get(auftragNr);
    if (!kundenNr || !metricsByKunde.has(kundenNr)) continue;

    const metrics = metricsByKunde.get(kundenNr);
    metrics.einsaetzeCount += Number(entry.einsaetzeCount || 0);
    metrics.auftraege.add(auftragNr);
  }

  return new Map([...metricsByKunde.entries()].map(([kundenNr, metrics]) => {
    metrics.auftraegeCount = metrics.auftraege.size;
    delete metrics.auftraege;
    return [kundenNr, finalizeMetrics(metrics)];
  }));
}

function buildEmptyReport(user, period) {
  const previousMonth = shiftMonth(period.year, period.month, -1);
  const previousYear = { month: period.month, year: period.year - 1 };

  return {
    month: period.month,
    year: period.year,
    monthLabel: periodLabel(period),
    user: user ? { _id: user._id, name: user.name, email: user.email } : null,
    comparison: {
      previousMonth: { ...previousMonth, label: periodLabel(previousMonth) },
      previousYear: { ...previousYear, label: periodLabel(previousYear) }
    },
    totals: {
      current: emptyMetrics(),
      prevMonth: emptyMetrics(),
      prevYear: emptyMetrics(),
      deltaPrevMonth: createDeltaSet(emptyMetrics(), emptyMetrics()),
      deltaPrevYear: createDeltaSet(emptyMetrics(), emptyMetrics())
    },
    winners: [],
    losers: [],
    yoyWinners: [],
    yoyLosers: [],
    kunden: []
  };
}

async function buildWatchlistReportForKunden(kundenIds, periodInput, user = null) {
  const period = assertValidPeriod(periodInput.month, periodInput.year);
  const report = buildEmptyReport(user, period);

  if (!Array.isArray(kundenIds) || !kundenIds.length) return report;

  const kunden = await Kunde.find({ _id: { $in: kundenIds } })
    .select('_id kundenNr kundName kuerzel kundStatus geschSt')
    .lean();

  if (!kunden.length) return report;

  const previousMonth = report.comparison.previousMonth;
  const previousYear = report.comparison.previousYear;
  const context = await buildKundenContext(kunden);

  const [currentMap, prevMonthMap, prevYearMap] = await Promise.all([
    buildPeriodMetrics(kunden, context, monthRange(period.year, period.month)),
    buildPeriodMetrics(kunden, context, monthRange(previousMonth.year, previousMonth.month)),
    buildPeriodMetrics(kunden, context, monthRange(previousYear.year, previousYear.month))
  ]);

  const kundenReport = kunden.map((kunde) => {
    const kundenNr = Number(kunde.kundenNr);
    const current = currentMap.get(kundenNr) || emptyMetrics();
    const prevMonth = prevMonthMap.get(kundenNr) || emptyMetrics();
    const prevYear = prevYearMap.get(kundenNr) || emptyMetrics();

    return {
      _id: kunde._id,
      kundenNr,
      kundName: kunde.kundName,
      kuerzel: kunde.kuerzel,
      kundStatus: kunde.kundStatus,
      geschSt: kunde.geschSt,
      current,
      prevMonth,
      prevYear,
      deltaPrevMonth: createDeltaSet(current, prevMonth),
      deltaPrevYear: createDeltaSet(current, prevYear)
    };
  }).sort((a, b) => {
    if (b.current.bedarfCount !== a.current.bedarfCount) return b.current.bedarfCount - a.current.bedarfCount;
    if (b.current.einsaetzeCount !== a.current.einsaetzeCount) return b.current.einsaetzeCount - a.current.einsaetzeCount;
    return sortByCustomerName(a, b);
  });

  const prevMonthRankings = buildRankings(kundenReport, 'deltaPrevMonth');
  const prevYearRankings = buildRankings(kundenReport, 'deltaPrevYear');
  const currentTotals = createTotals(kundenReport, 'current');
  const prevMonthTotals = createTotals(kundenReport, 'prevMonth');
  const prevYearTotals = createTotals(kundenReport, 'prevYear');

  return {
    ...report,
    totals: {
      current: currentTotals,
      prevMonth: prevMonthTotals,
      prevYear: prevYearTotals,
      deltaPrevMonth: createDeltaSet(currentTotals, prevMonthTotals),
      deltaPrevYear: createDeltaSet(currentTotals, prevYearTotals)
    },
    winners: prevMonthRankings.winners,
    losers: prevMonthRankings.losers,
    yoyWinners: prevYearRankings.winners,
    yoyLosers: prevYearRankings.losers,
    kunden: kundenReport
  };
}

async function resolveUser(userOrId) {
  if (!userOrId) return null;
  if (typeof userOrId === 'object' && userOrId.kundenWatchlist) return userOrId;

  return User.findById(userOrId)
    .select('email name role roles isConfirmed kundenWatchlist')
    .lean();
}

async function buildWatchlistReportForUser(userOrId, periodInput) {
  const period = assertValidPeriod(periodInput.month, periodInput.year);
  const user = await resolveUser(userOrId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return buildWatchlistReportForKunden(user.kundenWatchlist || [], period, user);
}

function renderRankingList(title, entries) {
  const rows = entries.length
    ? entries.map((entry) => `
        <tr>
          <td style="padding:6px 0;color:#111827">${escapeHtml(entry.kundName || `#${entry.kundenNr}`)}</td>
          <td style="padding:6px 0;text-align:right;color:${deltaColor(entry.delta)};font-weight:600">${fmtDelta(entry.delta)}</td>
        </tr>`).join('')
    : '<tr><td colspan="2" style="padding:6px 0;color:#9ca3af">Keine Veränderung</td></tr>';

  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px">
      <h3 style="margin:0 0 8px;font-size:14px;color:#111827">${escapeHtml(title)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
    </div>`;
}

function buildReportHtml(report) {
  const rows = report.kunden.map((kunde) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827">
        ${escapeHtml(kunde.kundName || `#${kunde.kundenNr}`)}
        ${kunde.kuerzel ? `<span style="color:#9ca3af;font-size:11px;font-weight:400"> (${escapeHtml(kunde.kuerzel)})</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtNumber(kunde.current.bedarfCount)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtNumber(kunde.current.einsaetzeCount)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtNumber(kunde.current.offenCount)}<br><span style="color:#9ca3af;font-size:11px">${fmtPercent(kunde.current.besetzungsquote)}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtNumber(kunde.current.auftraegeCount)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${deltaColor(kunde.deltaPrevMonth.bedarfCount)}">${fmtDelta(kunde.deltaPrevMonth.bedarfCount)}<br><span style="color:${deltaColor(kunde.deltaPrevMonth.einsaetzeCount)};font-size:11px">Einsätze ${fmtDelta(kunde.deltaPrevMonth.einsaetzeCount)}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${deltaColor(kunde.deltaPrevYear.bedarfCount)}">${fmtDelta(kunde.deltaPrevYear.bedarfCount)}<br><span style="color:${deltaColor(kunde.deltaPrevYear.einsaetzeCount)};font-size:11px">Einsätze ${fmtDelta(kunde.deltaPrevYear.einsaetzeCount)}</span></td>
    </tr>`).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;max-width:980px;margin:0 auto;color:#374151">
      <h2 style="margin:0 0 4px;color:#111827">Watchlist-Report</h2>
      <p style="margin:0 0 18px;color:#6b7280">${escapeHtml(report.monthLabel)} im Vergleich zu ${escapeHtml(report.comparison.previousMonth.label)} und ${escapeHtml(report.comparison.previousYear.label)}</p>

      <table style="width:100%;border-collapse:separate;border-spacing:0 8px;margin-bottom:16px">
        <tr>
          <td style="padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px"><strong>${fmtNumber(report.totals.current.bedarfCount)}</strong><br><span style="color:#6b7280;font-size:12px">Bedarf</span></td>
          <td style="padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px"><strong>${fmtNumber(report.totals.current.einsaetzeCount)}</strong><br><span style="color:#6b7280;font-size:12px">besetzte Einsätze</span></td>
          <td style="padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px"><strong>${fmtNumber(report.totals.current.offenCount)}</strong><br><span style="color:#6b7280;font-size:12px">offen</span></td>
          <td style="padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px"><strong>${fmtPercent(report.totals.current.besetzungsquote)}</strong><br><span style="color:#6b7280;font-size:12px">Besetzungsquote</span></td>
        </tr>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        ${renderRankingList('Winners ggü. Vormonat', report.winners)}
        ${renderRankingList('Losers ggü. Vormonat', report.losers)}
        ${renderRankingList('Winners ggü. Vorjahr', report.yoyWinners)}
        ${renderRankingList('Losers ggü. Vorjahr', report.yoyLosers)}
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f4f5f6">
            <th style="padding:9px 12px;text-align:left;color:#4b5563">Kunde</th>
            <th style="padding:9px 12px;text-align:right;color:#4b5563">Bedarf</th>
            <th style="padding:9px 12px;text-align:right;color:#4b5563">Einsätze</th>
            <th style="padding:9px 12px;text-align:right;color:#4b5563">Offen / Quote</th>
            <th style="padding:9px 12px;text-align:right;color:#4b5563">Aufträge</th>
            <th style="padding:9px 12px;text-align:right;color:#4b5563">Vormonat</th>
            <th style="padding:9px 12px;text-align:right;color:#4b5563">Vorjahr</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px">Erstellt am ${new Date().toLocaleDateString('de-DE')} · Straight Monitor</p>
    </div>`;
}

async function sendWatchlistReportToUser(userOrId, periodInput, options = {}) {
  const period = assertValidPeriod(periodInput.month, periodInput.year);
  const user = await resolveUser(userOrId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const report = await buildWatchlistReportForKunden(user.kundenWatchlist || [], period, user);

  if (!report.kunden.length) {
    if (options.throwOnEmpty) {
      const error = new Error('Watchlist ist leer');
      error.statusCode = 400;
      throw error;
    }

    return { sent: false, reason: 'empty-watchlist', report };
  }

  if (!user.email) {
    if (options.throwOnEmpty) {
      const error = new Error('User hat keine E-Mail-Adresse');
      error.statusCode = 400;
      throw error;
    }

    return { sent: false, reason: 'missing-email', report };
  }

  const html = buildReportHtml(report);
  await sendMail(user.email, `Watchlist-Report: ${report.monthLabel}`, html, 'it');

  return { sent: true, email: user.email, report };
}

async function sendMonthlyWatchlistReports(options = {}) {
  const period = options.month && options.year
    ? assertValidPeriod(options.month, options.year)
    : getPreviousMonthPeriod(options.referenceDate || new Date());

  const users = await User.find({
    isConfirmed: true,
    email: { $exists: true, $ne: '' },
    'kundenWatchlist.0': { $exists: true },
    $or: [
      { roles: 'VERTRIEB' },
      { roles: 'Vertrieb' },
      { role: 'VERTRIEB' },
      { role: 'Vertrieb' }
    ]
  })
    .select('email name role roles isConfirmed kundenWatchlist')
    .lean();

  const summary = {
    sent: 0,
    skipped: 0,
    errors: [],
    month: period.month,
    year: period.year,
    monthLabel: periodLabel(period)
  };

  for (const user of users) {
    try {
      const result = await sendWatchlistReportToUser(user, period);
      if (result.sent) summary.sent += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.errors.push({ userId: user._id, email: user.email, message: error.message });
      logger.error(`[WatchlistReport] Failed for ${user.email}:`, error.message);
    }
  }

  return summary;
}

module.exports = {
  MONTH_NAMES_DE,
  assertValidPeriod,
  getPreviousMonthPeriod,
  buildWatchlistReportForUser,
  buildWatchlistReportForKunden,
  buildReportHtml,
  sendWatchlistReportToUser,
  sendMonthlyWatchlistReports
};