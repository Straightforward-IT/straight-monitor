'use strict';

const { ok, unknown } = require('./result');
const { parseDateOnly } = require('./dates');
const { normalize, sha256 } = require('./hash');
const {
  ROUNDING_RULE,
  roundRational,
  hourlyRateTimesHoursHundredths,
} = require('./rounding');

const GVP_RATE_SOURCE = 'DGB/GVP Entgelttarifvertrag 2026, Anlage Entgelttabellen (primary tariff lines 915-961)';
const GVP_TARGET_SOURCE = 'DGB/GVP Manteltarifvertrag §§ 3.1-3.2 (primary tariff lines 157-190)';
const GVP_BASE_WAGE_SOURCE = 'DGB/GVP Manteltarifvertrag §§ 14.1, 14.3-14.4 (primary tariff lines 607-632)';
const PRIMARY_GVP_SOURCE_CHECKSUM = '6e2f4d4d90388276c2f66614aca480a818478ba6309d71a00789e6402f24fbfb';
const PRIMARY_GVP_SOURCE = Object.freeze({
  title: 'DGB/GVP Basistarifwerk 2026',
  reference: 'Documentation/Payroll/251112_GVP-Basistarifwerk.md',
  publishedAt: '2025-11-12T00:00:00.000Z',
  checksum: PRIMARY_GVP_SOURCE_CHECKSUM,
});

const RATE_PERIODS = Object.freeze([
  Object.freeze({
    id: 'GVP_2026_01',
    validFrom: '2026-01-01',
    validToExclusive: '2026-09-01',
    rates: Object.freeze({
      '1': Object.freeze({ BASE: 1496, P1_5: 1518, P3_0: 1541 }),
      '2a': Object.freeze({ BASE: 1529, P1_5: 1552, P3_0: 1575 }),
      '2b': Object.freeze({ BASE: 1569, P1_5: 1593, P3_0: 1616 }),
      '3': Object.freeze({ BASE: 1669, P1_5: 1694, P3_0: 1719 }),
      '4': Object.freeze({ BASE: 1765, P1_5: 1791, P3_0: 1818 }),
      '5': Object.freeze({ BASE: 1978, P1_5: 2008, P3_0: 2037 }),
      '6': Object.freeze({ BASE: 2197, P1_5: 2230, P3_0: 2263 }),
      '7': Object.freeze({ BASE: 2556, P1_5: 2594, P3_0: 2633 }),
      '8': Object.freeze({ BASE: 2736, P1_5: 2777, P3_0: 2818 }),
      '9': Object.freeze({ BASE: 2870, P1_5: 2913, P3_0: 2956 }),
    }),
  }),
  Object.freeze({
    id: 'GVP_2026_09',
    validFrom: '2026-09-01',
    validToExclusive: '2027-04-01',
    rates: Object.freeze({
      '1': Object.freeze({ BASE: 1533, P1_5: 1556, P3_0: 1579 }),
      '2a': Object.freeze({ BASE: 1567, P1_5: 1591, P3_0: 1614 }),
      '2b': Object.freeze({ BASE: 1608, P1_5: 1632, P3_0: 1656 }),
      '3': Object.freeze({ BASE: 1711, P1_5: 1737, P3_0: 1762 }),
      '4': Object.freeze({ BASE: 1809, P1_5: 1836, P3_0: 1863 }),
      '5': Object.freeze({ BASE: 2027, P1_5: 2057, P3_0: 2088 }),
      '6': Object.freeze({ BASE: 2252, P1_5: 2286, P3_0: 2320 }),
      '7': Object.freeze({ BASE: 2620, P1_5: 2659, P3_0: 2699 }),
      '8': Object.freeze({ BASE: 2804, P1_5: 2846, P3_0: 2888 }),
      '9': Object.freeze({ BASE: 2942, P1_5: 2986, P3_0: 3030 }),
    }),
  }),
  Object.freeze({
    id: 'GVP_2027_04',
    validFrom: '2027-04-01',
    validToExclusive: null,
    rates: Object.freeze({
      '1': Object.freeze({ BASE: 1587, P1_5: 1611, P3_0: 1635 }),
      '2a': Object.freeze({ BASE: 1622, P1_5: 1646, P3_0: 1671 }),
      '2b': Object.freeze({ BASE: 1664, P1_5: 1689, P3_0: 1714 }),
      '3': Object.freeze({ BASE: 1771, P1_5: 1798, P3_0: 1824 }),
      '4': Object.freeze({ BASE: 1872, P1_5: 1900, P3_0: 1928 }),
      '5': Object.freeze({ BASE: 2098, P1_5: 2129, P3_0: 2161 }),
      '6': Object.freeze({ BASE: 2331, P1_5: 2366, P3_0: 2401 }),
      '7': Object.freeze({ BASE: 2712, P1_5: 2753, P3_0: 2793 }),
      '8': Object.freeze({ BASE: 2902, P1_5: 2946, P3_0: 2989 }),
      '9': Object.freeze({ BASE: 3045, P1_5: 3091, P3_0: 3136 }),
    }),
  }),
]);

const VALID_TIERS = new Set(['BASE', 'P1_5', 'P3_0']);

function validRatePeriod(period, index) {
  return period && Number.isInteger(index) && index >= 0
    && RATE_PERIODS[index]?.id === period.id;
}

/**
 * Creates the one executable TariffVersion definition understood by this core.
 * It intentionally excludes approval state, actors and hashes. Those workflow
 * facts must never change the executable rule projection.
 */
function buildGvpTariffDefinition(period, index, { calculationVersion } = {}) {
  if (!validRatePeriod(period, index)) {
    throw new TypeError('period/index must identify an embedded GVP RATE_PERIODS entry');
  }
  if (!String(calculationVersion || '').trim()) {
    throw new TypeError('calculationVersion is required');
  }

  return {
    code: period.id,
    system: 'GVP',
    version: index + 1,
    validFrom: `${period.validFrom}T00:00:00.000Z`,
    validTill: period.validToExclusive
      ? new Date(new Date(`${period.validToExclusive}T00:00:00.000Z`).getTime() - 1).toISOString()
      : null,
    currency: 'EUR',
    standardMonthlyHours: '151.67',
    alternativeMonthlyHours: null,
    entgeltgruppen: Object.entries(period.rates).map(([code, rates]) => ({
      code: code.toUpperCase(),
      label: `Entgeltgruppe ${code}`,
      hourlyRateCents: rates.BASE,
    })),
    experienceBonusRules: Object.entries(period.rates).flatMap(([code, rates]) => ([
      {
        groupCode: code.toUpperCase(), afterCompletedMonths: 9,
        mode: 'FIXED_CENTS', hourlyAmountCents: rates.P1_5 - rates.BASE,
      },
      {
        groupCode: code.toUpperCase(), afterCompletedMonths: 12,
        mode: 'FIXED_CENTS', hourlyAmountCents: rates.P3_0 - rates.BASE,
      },
    ])),
    industrySurchargeStages: [],
    premiumRules: [
      { premiumType: 'NIGHT', percentBasisPoints: 2500, windowStart: '23:00', windowEnd: '06:00' },
      { premiumType: 'SUNDAY', percentBasisPoints: 5000 },
      { premiumType: 'PUBLIC_HOLIDAY', percentBasisPoints: 10000 },
      { premiumType: 'CHRISTMAS_EVE', percentBasisPoints: 10000, startsAfterLocalTime: '14:00' },
      { premiumType: 'NEW_YEARS_EVE', percentBasisPoints: 10000, startsAfterLocalTime: '14:00' },
      { premiumType: 'OVERTIME', percentBasisPoints: 2500 },
    ],
    premiumOverlapPolicy: 'HIGHEST_ONLY',
    overtimeThresholdBasisPoints: 11500,
    azkRules: {
      regularMaxPlusHours: '200',
      seasonalMaxPlusHours: '230',
      insolvencyProtectionThresholdHours: '150',
      annualCarryoverMaxHours: '150',
      reconciliationMonths: 12,
      graceMonths: 3,
    },
    vacationEntitlements: [
      { fromServiceYear: 1, throughServiceYear: 1, daysPerYear: '25' },
      { fromServiceYear: 2, throughServiceYear: 3, daysPerYear: '27' },
      { fromServiceYear: 4, throughServiceYear: null, daysPerYear: '30' },
    ],
    absenceAverageReferenceMonths: 3,
    additionalRules: {
      operationalSectorIsNotIndustrySurchargeAgreement: true,
      experienceInterpretationMustBeApprovedPerEmployment: true,
      sourceNotes: 'Customer premiums are caps/rules only; each site still needs an explicit declaration. Experience-rule interaction remains policy-driven.',
    },
    calculationVersion: String(calculationVersion).trim(),
    source: { ...PRIMARY_GVP_SOURCE },
  };
}

function decimalString(value) {
  if (value == null) return null;
  const numeric = Number(value?.toString?.() ?? value);
  return Number.isFinite(numeric) ? String(numeric) : String(value);
}

function isoInstant(value) {
  if (value == null) return null;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : String(value);
}

function executableTariffProjection(value = {}) {
  const entgeltgruppen = (value.entgeltgruppen || []).map((entry) => ({
    code: String(entry.code || '').toUpperCase(),
    hourlyRateCents: Number(entry.hourlyRateCents),
  })).sort((left, right) => left.code.localeCompare(right.code));
  const experienceBonusRules = (value.experienceBonusRules || []).map((entry) => ({
    groupCode: String(entry.groupCode || '').toUpperCase(),
    afterCompletedMonths: Number(entry.afterCompletedMonths),
    mode: entry.mode || null,
    percentBasisPoints: entry.percentBasisPoints == null ? null : Number(entry.percentBasisPoints),
    hourlyAmountCents: entry.hourlyAmountCents == null ? null : Number(entry.hourlyAmountCents),
  })).sort((left, right) => (
    left.groupCode.localeCompare(right.groupCode)
    || left.afterCompletedMonths - right.afterCompletedMonths
    || String(left.mode).localeCompare(String(right.mode))
  ));
  const industrySurchargeStages = (value.industrySurchargeStages || []).map((entry) => ({
    tariffCode: String(entry.tariffCode || '').toUpperCase(),
    stageCode: String(entry.stageCode || '').toUpperCase(),
    afterCompletedWeeks: Number(entry.afterCompletedWeeks),
    percentBasisPoints: Number(entry.percentBasisPoints),
    capAgainstEqualPay: entry.capAgainstEqualPay === true,
  })).sort((left, right) => (
    left.tariffCode.localeCompare(right.tariffCode)
    || left.stageCode.localeCompare(right.stageCode)
  ));
  const premiumRules = (value.premiumRules || []).map((entry) => ({
    premiumType: entry.premiumType || null,
    percentBasisPoints: Number(entry.percentBasisPoints),
    windowStart: entry.windowStart || null,
    windowEnd: entry.windowEnd || null,
    startsAfterLocalTime: entry.startsAfterLocalTime || null,
  })).sort((left, right) => String(left.premiumType).localeCompare(String(right.premiumType)));
  const vacationEntitlements = (value.vacationEntitlements || []).map((entry) => ({
    fromServiceYear: Number(entry.fromServiceYear),
    throughServiceYear: entry.throughServiceYear == null ? null : Number(entry.throughServiceYear),
    daysPerYear: decimalString(entry.daysPerYear),
  })).sort((left, right) => left.fromServiceYear - right.fromServiceYear);

  return {
    code: String(value.code || '').toUpperCase(),
    system: String(value.system || '').toUpperCase(),
    version: Number(value.version),
    validFrom: isoInstant(value.validFrom),
    validTill: isoInstant(value.validTill),
    currency: value.currency || null,
    standardMonthlyHours: decimalString(value.standardMonthlyHours),
    alternativeMonthlyHours: decimalString(value.alternativeMonthlyHours),
    entgeltgruppen,
    experienceBonusRules,
    industrySurchargeStages,
    premiumRules,
    premiumOverlapPolicy: value.premiumOverlapPolicy || null,
    overtimeThresholdBasisPoints: Number(value.overtimeThresholdBasisPoints),
    azkRules: {
      regularMaxPlusHours: decimalString(value.azkRules?.regularMaxPlusHours),
      seasonalMaxPlusHours: decimalString(value.azkRules?.seasonalMaxPlusHours),
      insolvencyProtectionThresholdHours: decimalString(value.azkRules?.insolvencyProtectionThresholdHours),
      annualCarryoverMaxHours: decimalString(value.azkRules?.annualCarryoverMaxHours),
      reconciliationMonths: Number(value.azkRules?.reconciliationMonths),
      graceMonths: Number(value.azkRules?.graceMonths),
    },
    vacationEntitlements,
    absenceAverageReferenceMonths: Number(value.absenceAverageReferenceMonths),
    additionalRules: normalize(value.additionalRules || {}),
    calculationVersion: value.calculationVersion || null,
    source: {
      title: value.source?.title || null,
      reference: value.source?.reference || null,
      publishedAt: isoInstant(value.source?.publishedAt),
      checksum: value.source?.checksum || null,
    },
  };
}

function collectMismatches(expected, actual, path = '', output = []) {
  if (output.length >= 100) return output;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      output.push({ fieldPath: path, expected, actual });
      return output;
    }
    if (expected.length !== actual.length) {
      output.push({ fieldPath: `${path}.length`, expected: expected.length, actual: actual.length });
    }
    for (let index = 0; index < Math.max(expected.length, actual.length); index += 1) {
      collectMismatches(expected[index], actual[index], `${path}[${index}]`, output);
    }
    return output;
  }
  const expectedObject = expected && typeof expected === 'object';
  const actualObject = actual && typeof actual === 'object';
  if (expectedObject || actualObject) {
    if (!expectedObject || !actualObject) {
      output.push({ fieldPath: path, expected, actual });
      return output;
    }
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      collectMismatches(expected[key], actual[key], path ? `${path}.${key}` : key, output);
    }
    return output;
  }
  if (!Object.is(expected, actual)) output.push({ fieldPath: path, expected, actual });
  return output;
}

function validateGvpTariffApproval(tariff, { calculationVersion } = {}) {
  if (!tariff || typeof tariff !== 'object') {
    return unknown('TARIFF_DEFINITION_REQUIRED', 'A tariff definition is required for executable approval.', {
      sourceRefs: [GVP_RATE_SOURCE, PRIMARY_GVP_SOURCE.reference],
    });
  }
  if (String(tariff.system || '').toUpperCase() !== 'GVP') {
    return unknown('TARIFF_SYSTEM_NOT_EXECUTABLE', 'Only the embedded GVP tariff is executable in the current payroll core.', {
      partial: { system: tariff.system || null },
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }
  if (tariff.source?.checksum !== PRIMARY_GVP_SOURCE_CHECKSUM) {
    return unknown('TARIFF_SOURCE_CHECKSUM_MISMATCH', 'The tariff source checksum does not match the reviewed primary GVP document.', {
      partial: {
        expectedChecksum: PRIMARY_GVP_SOURCE_CHECKSUM,
        actualChecksum: tariff.source?.checksum || null,
      },
      sourceRefs: [PRIMARY_GVP_SOURCE.reference],
    });
  }
  if (!String(calculationVersion || '').trim()) {
    return unknown('TARIFF_CALCULATION_VERSION_REQUIRED', 'The active payroll-core calculation version is required for approval validation.', {
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }
  if (tariff.calculationVersion !== calculationVersion) {
    return unknown('TARIFF_CALCULATION_VERSION_MISMATCH', 'The tariff draft targets a different payroll-core calculation version.', {
      partial: { expected: calculationVersion, actual: tariff.calculationVersion || null },
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }

  const periodIndex = RATE_PERIODS.findIndex((period) => period.id === String(tariff.code || '').toUpperCase());
  if (periodIndex === -1) {
    return unknown('GVP_TARIFF_PERIOD_UNKNOWN', 'The tariff code is not an embedded, reviewed GVP rate period.', {
      partial: { code: tariff.code || null, supportedCodes: RATE_PERIODS.map((period) => period.id) },
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }
  const expected = executableTariffProjection(buildGvpTariffDefinition(
    RATE_PERIODS[periodIndex],
    periodIndex,
    { calculationVersion },
  ));
  const actual = executableTariffProjection(tariff);
  const mismatches = collectMismatches(expected, actual);
  if (mismatches.length) {
    return unknown('GVP_TARIFF_EXECUTABLE_MISMATCH', 'The tariff draft differs from the reviewed executable GVP definition.', {
      partial: {
        periodId: RATE_PERIODS[periodIndex].id,
        mismatches,
        expectedExecutableHash: sha256(expected),
        actualExecutableHash: sha256(actual),
      },
      sourceRefs: [GVP_RATE_SOURCE, PRIMARY_GVP_SOURCE.reference],
    });
  }

  return ok({
    periodId: RATE_PERIODS[periodIndex].id,
    executableDefinition: actual,
    executableHash: sha256(actual),
    sourceChecksum: PRIMARY_GVP_SOURCE_CHECKSUM,
    calculationVersion,
  }, {
    explanations: [
      'The source checksum, effective period, complete GVP rate table and every executable tariff constant match the reviewed embedded definition.',
      'Approval actors and evidence are workflow metadata and are deliberately excluded from the executable hash.',
    ],
    sourceRefs: [GVP_RATE_SOURCE, PRIMARY_GVP_SOURCE.reference],
  });
}

function selectTariffRate({ date, entgeltgruppe, tier = 'BASE' } = {}) {
  if (!parseDateOnly(date)) {
    return unknown('TARIFF_DATE_REQUIRED', 'A valid payroll date in YYYY-MM-DD form is required.', {
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }
  if (!VALID_TIERS.has(tier)) {
    return unknown('EXPERIENCE_TIER_UNKNOWN', 'tier must be BASE, P1_5, or P3_0.', {
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }
  const period = RATE_PERIODS.find((candidate) => (
    candidate.validFrom <= date
    && (!candidate.validToExclusive || date < candidate.validToExclusive)
  ));
  if (!period) {
    return unknown('TARIFF_VERSION_MISSING', `No embedded primary GVP rate table covers ${date}.`, {
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }
  const rates = period.rates[String(entgeltgruppe)];
  if (!rates) {
    return unknown('ENTGELTGRUPPE_REQUIRED', 'A valid GVP Entgeltgruppe (1, 2a, 2b, or 3-9) is required.', {
      sourceRefs: [GVP_RATE_SOURCE],
    });
  }

  const warnings = [];
  if (!period.validToExclusive && date >= '2027-10-01') {
    warnings.push({
      code: 'OPEN_ENDED_TARIFF_VERSION_REVERIFY',
      message: 'The source table says "ab 01.04.2027", but the ETV can first be terminated on 30.09.2027; verify that no successor rate applies.',
    });
  }

  return ok({
    date,
    entgeltgruppe: String(entgeltgruppe),
    tier,
    baseHourlyCents: rates.BASE,
    hourlyRateCents: rates[tier],
    hourlySupplementCents: rates[tier] - rates.BASE,
    currency: 'EUR',
    amountUnit: 'CENT',
    ratePeriod: {
      id: period.id,
      validFrom: period.validFrom,
      validToExclusive: period.validToExclusive,
    },
  }, {
    explanations: [`Selected the official ${tier} table column for EG ${entgeltgruppe} on ${date}.`],
    sourceRefs: [GVP_RATE_SOURCE],
    warnings,
  });
}

function calculateMonthlyTarget({
  model,
  fullTimeHoursHundredths,
  workdays,
  partTimeNumerator = 1,
  partTimeDenominator = 1,
} = {}) {
  if (!Number.isInteger(partTimeNumerator) || !Number.isInteger(partTimeDenominator)
    || partTimeNumerator <= 0 || partTimeDenominator <= 0
    || partTimeNumerator > partTimeDenominator) {
    return unknown('PART_TIME_RATIO_REQUIRED', 'Provide a positive part-time numerator/denominator no greater than 1.', {
      sourceRefs: [GVP_TARGET_SOURCE],
    });
  }

  let fullTarget;
  const warnings = [];
  if (model === 'GVP_FIXED') {
    fullTarget = fullTimeHoursHundredths == null ? 15167 : fullTimeHoursHundredths;
    if (!Number.isInteger(fullTarget) || fullTarget <= 0 || fullTarget > 17334) {
      return unknown('CONTRACT_TARGET_INVALID', 'GVP fixed full-time target must be an integer hundredth of an hour up to 173.34 hours.', {
        sourceRefs: [GVP_TARGET_SOURCE],
      });
    }
    if (fullTarget > 15167) {
      warnings.push({
        code: 'EXTENDED_TARGET_REQUIRES_CONTRACT_EVIDENCE',
        message: 'A target above 151.67 hours requires the justified contractual/customer conditions in MTV § 3.1.',
      });
    }
  } else if (model === 'LEGACY_IGZ_VARIABLE') {
    const byWorkdays = { 20: 14000, 21: 14700, 22: 15400, 23: 16100 };
    fullTarget = byWorkdays[workdays];
    if (!fullTarget) {
      return unknown('LEGACY_WORKDAY_COUNT_REQUIRED', 'Legacy iGZ variable target supports 20, 21, 22, or 23 workdays.', {
        sourceRefs: [GVP_TARGET_SOURCE],
      });
    }
    warnings.push({
      code: 'LEGACY_IGZ_ELIGIBILITY_REQUIRES_EVIDENCE',
      message: 'This model is only available through 31.12.2029 to an employer bound to iGZ tariffs on 31.12.2025 that has not made its one-time switch.',
    });
  } else {
    return unknown('TARGET_MODEL_REQUIRED', 'model must be GVP_FIXED or LEGACY_IGZ_VARIABLE.', {
      sourceRefs: [GVP_TARGET_SOURCE],
    });
  }

  const targetHoursHundredths = roundRational(
    BigInt(fullTarget) * BigInt(partTimeNumerator),
    BigInt(partTimeDenominator),
  );
  if ((fullTarget * partTimeNumerator) % partTimeDenominator !== 0) {
    warnings.push({
      code: 'TARGET_QUANTITY_ROUNDED',
      message: 'The prorated target was rounded to the nearest hundredth of an hour.',
    });
  }

  return ok({
    model,
    fullTimeHoursHundredths: fullTarget,
    partTimeNumerator,
    partTimeDenominator,
    targetHoursHundredths,
    quantityUnit: 'HOUR_HUNDREDTH',
    roundingRule: ROUNDING_RULE,
  }, {
    explanations: [`Monthly target ${targetHoursHundredths}/100 hours is the full-time target prorated by the contractual part-time ratio.`],
    sourceRefs: [GVP_TARGET_SOURCE],
    warnings,
  });
}

function calculateBaseWage({
  date,
  entgeltgruppe,
  targetHoursHundredths,
  payableTargetHoursHundredths = targetHoursHundredths,
} = {}) {
  if (!Number.isInteger(targetHoursHundredths) || targetHoursHundredths < 0
    || !Number.isInteger(payableTargetHoursHundredths) || payableTargetHoursHundredths < 0
    || payableTargetHoursHundredths > targetHoursHundredths) {
    return unknown('PAYABLE_TARGET_REQUIRED', 'Target quantities must be non-negative integer hundredths of an hour and payable target may not exceed the full target.', {
      sourceRefs: [GVP_BASE_WAGE_SOURCE],
    });
  }
  const rate = selectTariffRate({ date, entgeltgruppe, tier: 'BASE' });
  if (rate.status !== 'OK') return rate;
  const amountCents = hourlyRateTimesHoursHundredths(
    rate.data.hourlyRateCents,
    payableTargetHoursHundredths,
  );

  return ok({
    date,
    entgeltgruppe: String(entgeltgruppe),
    targetHoursHundredths,
    payableTargetHoursHundredths,
    hourlyRateCents: rate.data.hourlyRateCents,
    amountCents,
    expectedAmountCents: amountCents,
    currency: 'EUR',
    roundingRule: ROUNDING_RULE,
    ratePeriod: rate.data.ratePeriod,
  }, {
    explanations: [
      `${payableTargetHoursHundredths}/100 payable target hours × ${rate.data.hourlyRateCents} cents/hour, rounded once to cents.`,
      'Use payable target hours determined from the monthly target schedule for entry, exit, or unpaid absence reductions; actual worked hours do not replace the guaranteed target basis.',
    ],
    sourceRefs: [GVP_BASE_WAGE_SOURCE, GVP_RATE_SOURCE],
    warnings: rate.warnings,
  });
}

function calculateTargetBaseWage({ date, entgeltgruppe, target, payableTargetHoursHundredths } = {}) {
  const targetResult = calculateMonthlyTarget(target);
  if (targetResult.status !== 'OK') return targetResult;
  const wage = calculateBaseWage({
    date,
    entgeltgruppe,
    targetHoursHundredths: targetResult.data.targetHoursHundredths,
    payableTargetHoursHundredths: payableTargetHoursHundredths == null
      ? targetResult.data.targetHoursHundredths
      : payableTargetHoursHundredths,
  });
  if (wage.status !== 'OK') return wage;
  return ok({
    target: targetResult.data,
    wage: wage.data,
    expectedAmountCents: wage.data.expectedAmountCents,
  }, {
    explanations: [...targetResult.explanations, ...wage.explanations],
    sourceRefs: [...new Set([...targetResult.sourceRefs, ...wage.sourceRefs])],
    warnings: [...targetResult.warnings, ...wage.warnings],
  });
}

module.exports = {
  PRIMARY_GVP_SOURCE,
  PRIMARY_GVP_SOURCE_CHECKSUM,
  RATE_PERIODS,
  buildGvpTariffDefinition,
  executableTariffProjection,
  validateGvpTariffApproval,
  selectTariffRate,
  calculateMonthlyTarget,
  calculateBaseWage,
  calculateTargetBaseWage,
};
