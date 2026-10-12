import { describe, expect, it, vi, afterEach } from 'vitest';
import { currentPayrollMonth, personGroupForMonth } from '../src/utils/employeePayrollMasterData';

afterEach(() => vi.useRealTimers());
describe('Monatliche Personengruppen', () => {
  it('verwendet den Geschäftsmonat und keine fremden Monatswerte', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T22:30:00Z'));
    expect(currentPayrollMonth()).toBe('2026-10');
    const employee = { persgruppe: 109, lohnStammdaten: [
      { month: '2026-09', sourceId: '1', persgruppe: 110 },
      { month: '2026-10', sourceId: '2', persgruppe: 101 },
    ] };
    expect(personGroupForMonth(employee)).toBe(101);
    expect(personGroupForMonth(employee, '2026-09')).toBe(110);
    expect(personGroupForMonth(employee, '2026-08')).toBeNull();
  });
  it('behandelt geleerte importierte Werte als unbekannt und liest Legacy nur aktuell', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    expect(personGroupForMonth({ persgruppe: 109 })).toBe(109);
    expect(personGroupForMonth({ persgruppe: 109 }, '2026-09')).toBeNull();
    expect(personGroupForMonth({ persgruppe: 109, lohnStammdaten: [{ month: '2026-10', sourceId: '2', persgruppe: null }] })).toBeNull();
  });
});
