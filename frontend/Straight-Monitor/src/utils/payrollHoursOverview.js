const HOURS_GROUPS = new Set(['21015', '21195', '22436']);
const EARNINGS_GROUPS = new Set(['23437', '27356']);

/** Payroll shows imported facts; other callers keep their assignment forecasts. */
export function buildPayrollHoursOverview({ employee, totals, entries, contingentData }) {
  const source = contingentData || {};
  const groupId = String(source.group?.legacyId || '');
  const hasDays = ['days', 'days-hours', 'days-earnings'].includes(source.type);
  const withoutMonthlyLimit = EARNINGS_GROUPS.has(groupId) || ['earnings', 'days-earnings'].includes(source.type);
  const missingMonthlyHours = source.type === 'notice' && HOURS_GROUPS.has(groupId)
    && source.issues?.some(issue => issue.code === 'MONTHLY_HOURS_MISSING');
  const comparesMonthlyHours = !withoutMonthlyLimit && (['hours', 'days-hours', 'days'].includes(source.type) || missingMonthlyHours);
  const monthlyHours = source.monthlyHours ?? employee.monthlyHours;
  const limit = comparesMonthlyHours && Number.isFinite(Number(monthlyHours)) && Number(monthlyHours) > 0 ? monthlyHours : null;
  const hoursIssues = comparesMonthlyHours && limit === null ? [{ code: 'MONTHLY_HOURS_MISSING',
    message: 'Keine Monats-Sollstunden hinterlegt. Die erfassten Stunden werden ohne Sollvergleich angezeigt.' }] : [];
  const classificationIssues = source.type === 'notice' && !missingMonthlyHours ? source.issues || [] : [];

  return {
    ...source,
    type: hasDays ? 'days-hours' : 'hours',
    title: source.type === 'notice' && !missingMonthlyHours ? 'Erfasste Stunden' : source.title || 'Erfasste Stunden',
    employeeName: employee.name || source.employeeName || '',
    // Wage and assignment-hour errors do not invalidate imported quantities.
    issues: [...classificationIssues, ...hoursIssues],
    hoursIssues,
    importedHours: {
      total: totals.hours,
      limit,
      byCode: (totals.byCode || []).map(row => ({ ...row,
        kind: entries.some(entry => entry.kb === row.kb && entry.kind === 'unresolved') ? 'unresolved' : row.kind,
      })),
    },
  };
}
