import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { formatMitarbeiterName } from '../src/utils/mitarbeiterName';
import { accentColorOptions, getAccentColor } from '../src/utils/appearance';
import { useAuth } from '../src/stores/auth';
import { useTheme } from '../src/stores/theme';

const mocks = vi.hoisted(() => ({
  api: { patch: vi.fn(), put: vi.fn(), get: vi.fn() },
}));

vi.mock('@/utils/api', () => ({ default: mocks.api }));

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-accent');
});

describe('employee name settings', () => {
  it('formats plain employee objects in both supported orders and handles missing parts', () => {
    expect(formatMitarbeiterName({ vorname: ' Anna ', nachname: ' Beispiel ' })).toBe('Anna Beispiel');
    expect(formatMitarbeiterName({ vorname: 'Anna', nachname: 'Beispiel' }, 'last-first')).toBe('Beispiel, Anna');
    expect(formatMitarbeiterName({ nachname: 'Beispiel' }, 'last-first')).toBe('Beispiel');
    expect(formatMitarbeiterName(null)).toBe('');
  });

  it('uses first-last when no user preference exists', () => {
    expect(useAuth().employeeNameFormat).toBe('first-last');
  });

  it('applies a preference optimistically and keeps the saved server value', async () => {
    const auth = useAuth();
    auth.user = { _id: 'user-1', preferences: { appearance: { theme: 'light' } } };
    let resolveRequest;
    mocks.api.patch.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

    const pending = auth.updatePreferences({ display: { employeeNameFormat: 'last-first' } });
    expect(auth.employeeNameFormat).toBe('last-first');

    resolveRequest({ data: { preferences: { appearance: { theme: 'light' }, display: { employeeNameFormat: 'last-first' } } } });
    await pending;
    expect(auth.employeeNameFormat).toBe('last-first');
  });

  it('rolls an optimistic preference back when persistence fails', async () => {
    const auth = useAuth();
    auth.user = { _id: 'user-1', preferences: { display: { employeeNameFormat: 'first-last' } } };
    mocks.api.patch.mockRejectedValue(new Error('offline'));

    await expect(auth.updatePreferences({ display: { employeeNameFormat: 'last-first' } })).rejects.toThrow('offline');
    expect(auth.employeeNameFormat).toBe('first-last');
  });
});

describe('appearance accent settings', () => {
  it('uses one accent definition for settings swatches and the theme variables', () => {
    expect(accentColorOptions.map(({ value }) => value)).toEqual(['orange', 'baby-blue', 'pink', 'ac-dc']);
    expect(getAccentColor('pink')).toMatchObject({
      color: '#f177aa',
      rgb: '241, 119, 170',
      onColor: '#3b0a22',
    });
    expect(getAccentColor('ac-dc', 'dark')).toMatchObject({
      color: '#ffffff',
      rgb: '255, 255, 255',
      onColor: '#1d1d1d',
    });
  });

  it('defaults to orange and hydrates a saved user accent', () => {
    const theme = useTheme();
    theme.init();
    expect(theme.accentColor).toBe('orange');
    expect(document.documentElement.dataset.accent).toBe('orange');

    theme.hydrateFromUser({ preferences: { appearance: { accentColor: 'pink' } } });
    expect(theme.accentColor).toBe('pink');
    expect(localStorage.getItem('accentColor')).toBe('pink');
    expect(document.documentElement.dataset.accent).toBe('pink');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#f177aa');
    expect(document.documentElement.style.getPropertyValue('--primary-rgb')).toBe('241, 119, 170');
    expect(document.documentElement.style.getPropertyValue('--primary-contrast')).toBe('#3b0a22');

    theme.setAccentColor('ac-dc');
    expect(theme.accentColor).toBe('ac-dc');
    expect(document.documentElement.dataset.accent).toBe('ac-dc');
  });

  it('persists an accent preference and rolls back failed updates', async () => {
    const auth = useAuth();
    const theme = useTheme();
    auth.user = { _id: 'user-1', preferences: { appearance: { accentColor: 'orange' } } };
    theme.init();
    mocks.api.patch.mockResolvedValueOnce({
      data: { preferences: { appearance: { accentColor: 'pink' } } },
    });

    await theme.setAccentColorForUser('pink');
    expect(theme.accentColor).toBe('pink');
    expect(mocks.api.patch).toHaveBeenLastCalledWith('/api/users/me/preferences', {
      preferences: { appearance: { accentColor: 'pink' } },
    });

    mocks.api.patch.mockRejectedValueOnce(new Error('offline'));
    await expect(theme.setAccentColorForUser('baby-blue')).rejects.toThrow('offline');
    expect(theme.accentColor).toBe('pink');
    expect(document.documentElement.dataset.accent).toBe('pink');
  });
});
