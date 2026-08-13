'use strict';

const PaychexService = require('./PaychexService');
const PayrollError = require('./utils/PayrollError');

const PROVIDER_DECIMAL_SCALE_MAX = 2;
const PAYLOAD_MODES = new Set(['AMOUNT_ONLY', 'QUANTITY_FACTOR_PERCENT']);
const QUANTITY_SOURCES = new Set(['COMPONENT_QUANTITY', 'FIXED_ONE']);
const FACTOR_SOURCES = new Set(['COMPONENT_FACTOR', 'COMPONENT_RATE_EURO', 'FIXED_ONE']);
const PERCENT_SOURCES = new Set(['COMPONENT_PERCENT', 'FIXED_100']);

function fail(code, message, details = null) {
  throw new PayrollError(code, message, 409, details);
}

function plainDecimal(value, field) {
  if (value === undefined || value === null || value === '') {
    fail('PAYCHEX_PAYLOAD_VALUE_REQUIRED', `${field} fehlt für die konfigurierte Paychex-Payload.`, { field });
  }

  const raw = String(value).trim();
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) {
    fail('PAYCHEX_PAYLOAD_DECIMAL_INVALID', `${field} ist keine endliche Dezimalzahl.`, { field });
  }

  const exponent = Number(match[4] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) {
    fail('PAYCHEX_PAYLOAD_DECIMAL_INVALID', `${field} liegt außerhalb des unterstützten Dezimalbereichs.`, { field });
  }

  const integer = match[2];
  const fraction = match[3] || '';
  let digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '');
  let scale = fraction.length - exponent;
  if (scale < 0) {
    digits += '0'.repeat(-scale);
    scale = 0;
  }
  if (scale > digits.length) digits = `${'0'.repeat(scale - digits.length)}${digits}`;

  return {
    negative: match[1] === '-' && BigInt(digits || '0') !== 0n,
    coefficient: BigInt(digits || '0'),
    scale,
  };
}

function assertProviderScale(scale, field) {
  if (!Number.isInteger(scale) || scale < 0 || scale > PROVIDER_DECIMAL_SCALE_MAX) {
    fail(
      'PAYCHEX_PAYLOAD_SCALE_UNSUPPORTED',
      `${field} muss zwischen 0 und ${PROVIDER_DECIMAL_SCALE_MAX} liegen.`,
      { field, scale, providerMaximum: PROVIDER_DECIMAL_SCALE_MAX },
    );
  }
  return scale;
}

/** Exact decimal rounding, ties away from zero; never routes payroll values through IEEE-754. */
function roundDecimal(value, scale = PROVIDER_DECIMAL_SCALE_MAX, field = 'value') {
  const targetScale = assertProviderScale(scale, field);
  const parsed = plainDecimal(value, field);
  let coefficient = parsed.coefficient;

  if (parsed.scale > targetScale) {
    const divisor = 10n ** BigInt(parsed.scale - targetScale);
    const quotient = coefficient / divisor;
    const remainder = coefficient % divisor;
    coefficient = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  } else if (parsed.scale < targetScale) {
    coefficient *= 10n ** BigInt(targetScale - parsed.scale);
  }

  const digits = coefficient.toString().padStart(targetScale + 1, '0');
  const absolute = targetScale === 0
    ? digits
    : `${digits.slice(0, -targetScale)}.${digits.slice(-targetScale)}`;
  return `${parsed.negative && coefficient !== 0n ? '-' : ''}${absolute}`;
}

function decimalFromScaledInteger(value, sourceScale, field) {
  if (!Number.isSafeInteger(value)) {
    fail('PAYCHEX_PAYLOAD_INTEGER_INVALID', `${field} muss als sichere Ganzzahl vorliegen.`, { field });
  }
  const negative = value < 0;
  const digits = String(Math.abs(value)).padStart(sourceScale + 1, '0');
  const absolute = sourceScale === 0
    ? digits
    : `${digits.slice(0, -sourceScale)}.${digits.slice(-sourceScale)}`;
  return `${negative && value !== 0 ? '-' : ''}${absolute}`;
}

function componentMappingKey(component = {}) {
  return component.mappingKey || component.componentKey || component.type || null;
}

function componentMappingEntries(mapping = {}) {
  const source = mapping?.components || mapping?.mappings || [];
  if (source instanceof Map) return [...source.values()];
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([componentKey, entry]) => ({ componentKey, ...entry }));
  }
  return [];
}

function findComponentMapping(mapping, component) {
  const key = componentMappingKey(component);
  return componentMappingEntries(mapping).find((entry) => entry.componentKey === key) || null;
}

function assertSource(source, supported, field, fallback) {
  const selected = source || fallback;
  if (!supported.has(selected)) {
    fail('PAYCHEX_PAYLOAD_SOURCE_UNSUPPORTED', `${field} enthält eine nicht unterstützte Quelle.`, {
      field,
      source: selected,
    });
  }
  return selected;
}

function decimalSign(value, field) {
  const parsed = plainDecimal(value, field);
  if (parsed.coefficient === 0n) return 0;
  return parsed.negative ? -1 : 1;
}

/**
 * Build one validated Paychex v1.3 salary-component payload.
 *
 * The expected amount remains separate because Q/F/P payloads do not carry the
 * independently calculated StraightMonitor gross amount sent for reconciliation.
 */
function buildProviderSalaryComponent({ component, mappingEntry, month }) {
  if (!component || typeof component !== 'object') {
    fail('PAYCHEX_PAYLOAD_COMPONENT_REQUIRED', 'Die berechnete Lohnart fehlt.');
  }
  if (!mappingEntry || typeof mappingEntry !== 'object') {
    fail('PAYCHEX_WAGE_TYPE_MAPPING_REQUIRED', 'Die freigegebene Paychex-Zuordnung fehlt.');
  }

  const mappingKey = componentMappingKey(component);
  if (mappingEntry.componentKey && mappingEntry.componentKey !== mappingKey) {
    fail('PAYCHEX_MAPPING_KEY_MISMATCH', 'Die Paychex-Zuordnung gehört zu einer anderen internen Lohnart.', {
      mappingKey,
      mappedComponentKey: mappingEntry.componentKey,
    });
  }

  const mode = String(mappingEntry.payloadMode || '').toUpperCase();
  if (!PAYLOAD_MODES.has(mode)) {
    fail('PAYCHEX_PAYLOAD_MODE_UNSUPPORTED', 'Die Paychex-Zuordnung verwendet keinen freigegebenen Payload-Modus.', {
      mappingKey,
      payloadMode: mappingEntry.payloadMode || null,
    });
  }

  if (!Number.isSafeInteger(component.amountCents)) {
    fail('PAYCHEX_EXPECTED_AMOUNT_INVALID', 'Der unabhängige Erwartungsbetrag muss als sichere Ganzzahl in Cent vorliegen.', {
      mappingKey,
    });
  }
  if (component.amountCents < 0 && mappingEntry.allowNegativeAmount !== true) {
    fail('PAYCHEX_NEGATIVE_AMOUNT_NOT_ALLOWED', 'Ein negativer Erwartungsbetrag ist für diese Paychex-Lohnart nicht ausdrücklich freigegeben.', {
      mappingKey,
      amountCents: component.amountCents,
    });
  }

  const companySalaryComponent = mappingEntry.companySalaryComponentUid || mappingEntry.salaryComponentUid;
  if (!String(companySalaryComponent || '').trim()) {
    fail('PAYCHEX_WAGE_TYPE_MAPPING_REQUIRED', 'Die Paychex Company Salary Component UID fehlt.', { mappingKey });
  }

  let payload;
  let normalizedValues = null;
  if (mode === 'AMOUNT_ONLY') {
    payload = PaychexService.buildSalaryComponentPayload({
      mode,
      companySalaryComponent,
      amountCents: component.amountCents,
      validFromMonth: month,
    });
  } else {
    if (!mappingEntry.quantityUnit || mappingEntry.quantityUnit !== component.unit) {
      fail('PAYCHEX_QUANTITY_UNIT_MISMATCH', 'Einheit der Lohnart und Einheit der Paychex-Zuordnung stimmen nicht überein.', {
        mappingKey,
        componentUnit: component.unit || null,
        mappingUnit: mappingEntry.quantityUnit || null,
      });
    }

    const quantitySource = assertSource(
      mappingEntry.quantitySource,
      QUANTITY_SOURCES,
      'quantitySource',
      'COMPONENT_QUANTITY',
    );
    const factorSource = assertSource(
      mappingEntry.factorSource,
      FACTOR_SOURCES,
      'factorSource',
      'COMPONENT_FACTOR',
    );
    const percentSource = assertSource(
      mappingEntry.percentSource,
      PERCENT_SOURCES,
      'percentSource',
      'COMPONENT_PERCENT',
    );
    const quantityScale = assertProviderScale(mappingEntry.roundQuantityScale ?? 2, 'roundQuantityScale');
    const factorScale = assertProviderScale(mappingEntry.roundFactorScale ?? 2, 'roundFactorScale');
    const percentScale = assertProviderScale(mappingEntry.roundPercentScale ?? 2, 'roundPercentScale');

    const rawQuantity = quantitySource === 'FIXED_ONE' ? '1' : component.quantity;
    const rawFactor = factorSource === 'FIXED_ONE'
      ? '1'
      : factorSource === 'COMPONENT_RATE_EURO'
        ? decimalFromScaledInteger(component.rateCents, 2, 'rateCents')
        : component.factor;
    const rawPercent = percentSource === 'FIXED_100'
      ? '100'
      : decimalFromScaledInteger(component.percentBasisPoints, 2, 'percentBasisPoints');

    const quantity = roundDecimal(rawQuantity, quantityScale, 'quantity');
    const factor = roundDecimal(rawFactor, factorScale, 'factor');
    const percent = roundDecimal(rawPercent, percentScale, 'percent');
    const payloadSign = decimalSign(quantity, 'quantity')
      * decimalSign(factor, 'factor')
      * decimalSign(percent, 'percent');
    const expectedSign = Math.sign(component.amountCents);
    if (expectedSign !== 0 && payloadSign !== expectedSign) {
      fail('PAYCHEX_PAYLOAD_SIGN_MISMATCH', 'Vorzeichen der Q/F/P-Werte stimmt nicht mit dem Erwartungsbetrag überein.', {
        mappingKey,
        expectedAmountCents: component.amountCents,
      });
    }

    payload = PaychexService.buildSalaryComponentPayload({
      mode,
      companySalaryComponent,
      quantity,
      factor,
      percent,
      validFromMonth: month,
    });
    normalizedValues = {
      quantity: payload.quantity,
      factor: payload.factor,
      percent: payload.percent,
      quantityScale,
      factorScale,
      percentScale,
    };
  }

  return {
    payload,
    expectedAmountCents: component.amountCents,
    expectedCurrency: component.currency || 'EUR',
    expectedAmountSource: 'STRAIGHTMONITOR_PAYROLL_SNAPSHOT',
    payloadMode: mode,
    mappingKey,
    normalizedValues,
  };
}

module.exports = {
  PROVIDER_DECIMAL_SCALE_MAX,
  roundDecimal,
  componentMappingKey,
  componentMappingEntries,
  findComponentMapping,
  buildProviderSalaryComponent,
};
