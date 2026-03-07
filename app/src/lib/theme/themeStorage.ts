export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const SETTINGS_STORAGE_KEY = 'screndlySettings';
export const THEME_CHANGE_EVENT = 'screndly:theme-change';

function isTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark';
}

function parseSettingsTheme(rawSettings: string | null): AppTheme | null {
  if (!rawSettings) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSettings) as { darkMode?: unknown };
    if (typeof parsed.darkMode === 'boolean') {
      return parsed.darkMode ? 'dark' : 'light';
    }
  } catch {
    return null;
  }

  return null;
}

export function getStoredThemePreference(storage?: Storage): AppTheme | null {
  if (!storage) {
    return null;
  }

  const explicitTheme = storage.getItem(THEME_STORAGE_KEY);
  if (isTheme(explicitTheme)) {
    return explicitTheme;
  }

  return parseSettingsTheme(storage.getItem(SETTINGS_STORAGE_KEY));
}

export function persistThemePreference(theme: AppTheme, storage?: Storage): void {
  if (!storage) {
    return;
  }

  storage.setItem(THEME_STORAGE_KEY, theme);

  try {
    const existing = storage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = existing ? JSON.parse(existing) : {};
    parsed.darkMode = theme === 'dark';
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ darkMode: theme === 'dark' }));
  }
}

export function dispatchThemeChange(theme: AppTheme): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, {
      detail: { theme },
    })
  );
}
