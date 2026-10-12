import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { WageCalculationType, getWageCalculationType, formatWageCalculationType, wageCalculationTypeHint } from '@/utils/wageCalculationTypes';

const require = createRequire(import.meta.url);
const backend = require('../../../api/domain/payroll/wageCalculationTypes');
const Lohnart = require('../../../api/models/Payroll/Lohnart');

describe('shared wage calculation meanings', () => {
  it('resolves zero and uses the same definitions in API and frontend', () => {
    expect(getWageCalculationType(0).key).toBe('AMOUNT');
    expect(formatWageCalculationType(' 0 ')).toBe('0 · Betrag');
    expect(WageCalculationType).toEqual(backend.WageCalculationType);
    expect(Object.values(WageCalculationType)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '17']);
    for (const code of Object.values(WageCalculationType)) {
      expect(getWageCalculationType(code)).toEqual(backend.getWageCalculationType(code));
    }
  });
  it('distinguishes amounts, hours, daily factors and units for future entry forms', () => {
    expect(getWageCalculationType('0').inputs).toEqual(['amount']);
    expect(getWageCalculationType('1').inputs).toEqual(['days', 'hoursPerDay', 'hourlyRate']);
    expect(getWageCalculationType('2').inputs).toEqual(['hours', 'hourlyRate']);
    expect(getWageCalculationType('6').inputs).toEqual(['units', 'unitRate']);
    expect(wageCalculationTypeHint('6')).toContain('Einheiten, Betragssatz je Einheit');
  });
  it('requires distinct rate and supplement bases and keeps average/type 17 unresolved', () => {
    expect(getWageCalculationType('2').requiredContext).toContain('HOURLY_RATE_SOURCE');
    for (const code of ['3', '4', '7']) expect(getWageCalculationType(code).requiredContext).toContain('SUPPLEMENT_BASIS');
    expect(getWageCalculationType('5').requiredContext).toContain('AVERAGE_HOURLY_RATE_SOURCE');
    expect(getWageCalculationType('17').requiredContext).toContain('TYPE_17_AMOUNT_SEMANTICS');
    expect(wageCalculationTypeHint('17')).toContain('Bis dahin keine automatische Berechnung');
  });
  it('retains unknown imported codes instead of rejecting or interpreting them as amount', () => {
    for (const code of [null, undefined, '', '99', 'constructor', '2.5']) {
      expect(getWageCalculationType(code)).toBeNull();
      expect(backend.getWageCalculationType(code)).toBeNull();
    }
    expect(formatWageCalculationType('99')).toBe('99 · Unbekannte Berechnungsart');
    expect(formatWageCalculationType(null)).toBe('-');
    const row = new Lohnart({ lohnartNummer: '999', berechnungsartCode: '99' });
    expect(row.validateSync()).toBeUndefined();
    expect(row.berechnungsartCode).toBe('99');
  });
});
