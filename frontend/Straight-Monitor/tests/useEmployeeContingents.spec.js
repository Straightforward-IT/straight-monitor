import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useEmployeeContingents } from '../src/composables/useEmployeeContingents';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/utils/api', () => ({ default: mocks }));
let scope;
const employee = { _id: 'employee-1', vorname: 'Ada', nachname: 'Test' };
const october = { year: 2026, month: 10 }, november = { year: 2026, month: 11 };
const create = () => { scope = effectScope(); return scope.run(() => useEmployeeContingents()); };
afterEach(() => { scope?.stop(); vi.resetAllMocks(); });

describe('shared employee contingent loading', () => {
  it('loads lazily, deduplicates name triggers and retains backend tariff and fallback views', async () => {
    const loader = create();
    expect(loader.dataFor(employee, october).type).toBe('notice');
    expect(mocks.get).not.toHaveBeenCalled();
    const data = { type: 'days-earnings', group: { legacyId: '27356' }, totalEarnings: '650.00' };
    mocks.get.mockResolvedValue({ data });
    const first = loader.load(employee._id, october), second = loader.load(employee._id, october);
    expect(first).toBe(second);
    expect(loader.isLoading(employee, october)).toBe(true);
    await first;
    expect(loader.dataFor(employee, october)).toEqual(data);
    expect(loader.isLoading(employee, october)).toBe(false);
    await loader.load(employee._id, october);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith('/api/personal/employee-1/analytics/contingent', expect.objectContaining({ params: october }));
  });

  it('keeps different months separate and a late old response cannot replace the new period', async () => {
    const loader = create();
    let resolveOld;
    mocks.get.mockImplementation((_url, config) => config.params.month === 10
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ data: { type: 'hours', title: 'November' } }));
    const old = loader.load(employee._id, october);
    await loader.load(employee._id, november);
    resolveOld({ data: { type: 'days', title: 'Oktober' } }); await old;
    expect(loader.dataFor(employee, november).title).toBe('November');
    expect(loader.dataFor(employee, october).title).toBe('Oktober');
  });

  it('invalidates and aborts pending requests, ignoring old results after a reload', async () => {
    const loader = create();
    let resolveOld, signal;
    mocks.get.mockImplementationOnce((_url, config) => { signal = config.signal; return new Promise(resolve => { resolveOld = resolve; }); });
    const old = loader.load(employee._id, october);
    await Promise.resolve();
    loader.clear();
    expect(signal.aborted).toBe(true);
    mocks.get.mockResolvedValueOnce({ data: { type: 'days-hours', title: 'Neu' } });
    await loader.load(employee._id, october);
    resolveOld({ data: { type: 'hours', title: 'Alt' } });
    expect(await old).toBeNull();
    expect(loader.dataFor(employee, october).title).toBe('Neu');
  });

  it('shows failures and retries on the next opening instead of showing zero figures', async () => {
    const loader = create();
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    await loader.load(employee._id, october);
    expect(loader.dataFor(employee, october).issues[0].code).toBe('LOAD_FAILED');
    expect(loader.dataFor(employee, october).workedHours).toBeUndefined();
    mocks.get.mockResolvedValueOnce({ data: { type: 'hours', selectionBasis: 'EMPLOYMENT_TYPE', monthlyHours: 100 } });
    await loader.load(employee._id, october);
    expect(loader.dataFor(employee, october).selectionBasis).toBe('EMPLOYMENT_TYPE');
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('force-refreshes a cached employee when the EmployeeCard expands again', async () => {
    const loader = create();
    mocks.get.mockResolvedValueOnce({ data: { type: 'days-hours', workedDays: 1 } });
    await loader.load(employee._id, october);
    mocks.get.mockResolvedValueOnce({ data: { type: 'days-hours', workedDays: 2 } });
    await loader.load(employee._id, october, { force: true });
    expect(loader.dataFor(employee, october).workedDays).toBe(2);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
