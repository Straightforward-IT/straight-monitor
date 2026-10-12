import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { AverageStorageType, getAverageStorageType, formatAverageStorageType } from '@/utils/averageStorageTypes';

const require = createRequire(import.meta.url);
const backend = require('../../../api/domain/payroll/averageStorageTypes');
const Lohnart = require('../../../api/models/Payroll/Lohnart');

describe('average storage meanings', () => {
  it('provides consistent API and frontend definitions and distinguishes numeric zero from missing', () => {
    expect(AverageStorageType).toEqual(backend.AverageStorageType);
    expect(Object.values(AverageStorageType)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    for (const code of Object.values(AverageStorageType)) {
      expect(getAverageStorageType(code)).toEqual(backend.getAverageStorageType(code));
    }
    expect(formatAverageStorageType(0)).toBe('0 · Keine Addition im Durchschnittsbetrag');
    expect(getAverageStorageType(' 0 ').contributions).toEqual({ days: null, hours: 0, amount: 0 });
  });
  it('keeps amount-only and quantity-only contributions separate for the future average calculation', () => {
    expect(getAverageStorageType('1').contributions).toEqual({ days: 1, hours: 1, amount: 1 });
    expect(getAverageStorageType('2').contributions).toEqual({ days: 0, hours: 0, amount: 1 });
    expect(getAverageStorageType('3').contributions).toEqual({ days: 1, hours: 0, amount: 0 });
    expect(getAverageStorageType('4').contributions).toEqual({ days: 0, hours: 1, amount: 0 });
    expect(getAverageStorageType('5').contributions).toEqual({ days: -1, hours: -1, amount: -1 });
    expect(getAverageStorageType('6').contributions).toEqual({ days: 0, hours: 0, amount: -1 });
    expect(getAverageStorageType('7').contributions).toEqual({ days: 0, hours: -1, amount: 0 });
  });
  it('keeps unknown imported codes without silently including or excluding them', () => {
    for (const code of [null, undefined, '', '99', 'constructor', '2.5', false]) {
      expect(getAverageStorageType(code)).toBeNull();
      expect(backend.getAverageStorageType(code)).toBeNull();
    }
    expect(formatAverageStorageType('99')).toBe('99 · Unbekannte Durchschnittsart');
    expect(formatAverageStorageType(null)).toBe('-');
    const row = new Lohnart({ lohnartNummer: '999', durchschnittsspeicherCode: '99' });
    expect(row.validateSync()).toBeUndefined();
    expect(row.durchschnittsspeicherCode).toBe('99');
  });
});
