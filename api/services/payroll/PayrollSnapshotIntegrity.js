'use strict';

const { normalize, sha256 } = require('../../payroll-core/hash');

const PREMIUM_TYPES = new Set([
  'EXPERIENCE_BONUS',
  'INDUSTRY_SURCHARGE',
  'NIGHT_PREMIUM',
  'SUNDAY_PREMIUM',
  'HOLIDAY_PREMIUM',
  'OVERTIME_PREMIUM',
]);
const ABSENCE_TYPES = new Set(['VACATION_PAY', 'SICK_PAY', 'SHORT_TIME']);
const GROSS_TYPES = new Set([
  'BASE_WAGE', 'EXPERIENCE_BONUS', 'INDUSTRY_SURCHARGE', 'EQUAL_PAY_ADJUSTMENT',
  'NIGHT_PREMIUM', 'SUNDAY_PREMIUM', 'HOLIDAY_PREMIUM', 'OVERTIME_PREMIUM',
  'AZK_PAYOUT', 'VACATION_PAY', 'SICK_PAY', 'SHORT_TIME', 'CORRECTION', 'OTHER',
  'TEMP_HIGHER_GRADE_DIFFERENTIAL', 'TRAVEL_TIME', 'SPECIAL_PAYMENT',
]);

const idString = (value) => (value?._id || value)?.toString?.() || String(value?._id || value || '');

function asPlain(value) {
  return normalize(value?.toObject ? value.toObject({ depopulate: true }) : value);
}

function canonicalDecimal(value) {
  if (value == null) return null;
  const text = String(value?.toString ? value.toString() : value);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return text;
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [integer, fraction = ''] = unsigned.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  const normalized = trimmedFraction ? `${integer}.${trimmedFraction}` : integer;
  return negative && normalized !== '0' ? `-${normalized}` : normalized;
}

function inputSourceProjection(inputSnapshot) {
  const input = asPlain(inputSnapshot) || {};
  delete input.sourceHash;
  return input;
}

function inputSourceHash(inputSnapshot) {
  return sha256(inputSourceProjection(inputSnapshot));
}

function componentPayloadProjection(component) {
  const source = asPlain(component) || {};
  return {
    type: source.type,
    componentKey: source.componentKey,
    mappingKey: source.mappingKey,
    quantity: canonicalDecimal(source.quantity),
    unit: source.unit,
    rateCents: source.rateCents ?? null,
    factor: canonicalDecimal(source.factor),
    percentBasisPoints: source.percentBasisPoints ?? null,
    amountCents: source.amountCents,
    explanation: source.explanation || {},
    sourceRefs: [...new Set((source.sourceRefs || []).filter(Boolean).map(String))],
  };
}

function componentPayloadHash(component) {
  return sha256(componentPayloadProjection(component));
}

function componentContentProjection(component) {
  const source = asPlain(component) || {};
  return {
    ...componentPayloadProjection(source),
    currency: source.currency,
    taxable: source.taxable ?? null,
    socialSecurityRelevant: source.socialSecurityRelevant ?? null,
    payloadHash: source.payloadHash,
  };
}

function totalsProjection(totals) {
  const source = asPlain(totals) || {};
  return {
    baseWageCents: source.baseWageCents,
    premiumsCents: source.premiumsCents,
    equalPayAdjustmentCents: source.equalPayAdjustmentCents,
    azkPayoutCents: source.azkPayoutCents,
    absencePayCents: source.absencePayCents,
    correctionsCents: source.correctionsCents,
    expectedGrossCents: source.expectedGrossCents,
    currency: source.currency,
  };
}

function snapshotContentProjection(snapshot) {
  const source = snapshot?.toObject ? snapshot.toObject({ depopulate: true }) : snapshot;
  return {
    payrollRun: idString(source?.payrollRun),
    mitarbeiter: idString(source?.mitarbeiter),
    month: source?.month,
    revision: source?.revision,
    employeeIdentity: asPlain(source?.employeeIdentity),
    inputSnapshot: asPlain(source?.inputSnapshot),
    components: (source?.components || []).map(componentContentProjection),
    totals: totalsProjection(source?.totals),
    calculationVersion: source?.calculationVersion,
    tariffVersions: (source?.tariffVersions || []).map(idString),
  };
}

function snapshotContentHash(snapshot) {
  return sha256(snapshotContentProjection(snapshot));
}

function sumTypes(components, predicate) {
  return components.reduce((total, component) => (
    predicate(component.type) ? total + Number(component.amountCents || 0) : total
  ), 0);
}

function calculatedTotals(components) {
  const values = (components || []).map((entry) => asPlain(entry));
  return {
    baseWageCents: sumTypes(values, (type) => type === 'BASE_WAGE'),
    premiumsCents: sumTypes(values, (type) => PREMIUM_TYPES.has(type)),
    equalPayAdjustmentCents: sumTypes(values, (type) => type === 'EQUAL_PAY_ADJUSTMENT'),
    azkPayoutCents: sumTypes(values, (type) => type === 'AZK_PAYOUT'),
    absencePayCents: sumTypes(values, (type) => ABSENCE_TYPES.has(type)),
    correctionsCents: sumTypes(values, (type) => type === 'CORRECTION'),
    expectedGrossCents: sumTypes(values, (type) => GROSS_TYPES.has(type)),
    currency: 'EUR',
  };
}

function integrityIssue(code, message, fieldPath, details = null) {
  return { code, severity: 'ERROR', blocking: true, message, fieldPath, details };
}

function verifySnapshotIntegrity(snapshot) {
  const issues = [];
  const expectedInputHash = inputSourceHash(snapshot?.inputSnapshot);
  if (snapshot?.inputSnapshot?.sourceHash !== expectedInputHash) {
    issues.push(integrityIssue(
      'PAYROLL_INPUT_SNAPSHOT_HASH_MISMATCH',
      'Der unveränderliche Eingabedatensatz stimmt nicht mehr mit seinem Quellen-Hash überein.',
      'inputSnapshot.sourceHash',
    ));
  }

  for (const component of snapshot?.components || []) {
    const expected = componentPayloadHash(component);
    if (component.payloadHash !== expected) {
      issues.push(integrityIssue(
        'PAYROLL_COMPONENT_HASH_MISMATCH',
        'Eine berechnete Lohnart stimmt nicht mehr mit ihrem Payload-Hash überein.',
        'components.payloadHash',
        { componentKey: component.componentKey || null },
      ));
    }
  }

  const expectedTotals = calculatedTotals(snapshot?.components || []);
  const storedTotals = totalsProjection(snapshot?.totals);
  const mismatchedTotals = Object.keys(expectedTotals).filter((key) => storedTotals[key] !== expectedTotals[key]);
  if (mismatchedTotals.length) {
    issues.push(integrityIssue(
      'PAYROLL_TOTALS_MISMATCH',
      'Die gespeicherten Payroll-Summen stimmen nicht mehr mit den Lohnarten überein.',
      'totals',
      { fields: mismatchedTotals },
    ));
  }

  const expectedContentHash = snapshotContentHash(snapshot);
  if (snapshot?.contentHash !== expectedContentHash) {
    issues.push(integrityIssue(
      'PAYROLL_SNAPSHOT_HASH_MISMATCH',
      'Der Payroll-Snapshot stimmt nicht mehr mit seinem unveränderlichen Inhalts-Hash überein.',
      'contentHash',
    ));
  }

  return {
    valid: issues.length === 0,
    issues,
    expectedInputHash,
    expectedContentHash,
    expectedTotals,
  };
}

module.exports = {
  inputSourceHash,
  componentPayloadHash,
  snapshotContentHash,
  calculatedTotals,
  verifySnapshotIntegrity,
  _private: {
    canonicalDecimal,
    inputSourceProjection,
    componentPayloadProjection,
    componentContentProjection,
    snapshotContentProjection,
    totalsProjection,
  },
};
