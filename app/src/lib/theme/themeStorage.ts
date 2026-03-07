export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const SETTINGS_STORAGE_KEY = 'screndlySettings';
export const THEME_CHANGE_EVENT = 'screndly:theme-change';
export const THEME_COLORS: Record<AppTheme, string> = {
  dark: '#000000',
  light: '#ffffff',
};

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

  const settingsTheme = parseSettingsTheme(storage.getItem(SETTINGS_STORAGE_KEY));
  if (settingsTheme) {
    return settingsTheme;
  }

  const legacyTheme = storage.getItem(THEME_STORAGE_KEY);
  if (isTheme(legacyTheme)) {
    return legacyTheme;
  }

  return null;
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

export function applyThemeToDocument(theme: AppTheme, rootDocument: Document = document): void {
  const isDark = theme === 'dark';
  const themeColor = THEME_COLORS[theme];
  const { documentElement, body, head } = rootDocument;

  documentElement.dataset.theme = theme;
  documentElement.classList.toggle('dark', isDark);
  documentElement.style.colorScheme = theme;

  if (body) {
    body.style.backgroundColor = themeColor;
  }

  let themeColorMeta = rootDocument.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = rootDocument.createElement('meta');
    themeColorMeta.setAttribute('name', 'theme-color');
    head.appendChild(themeColorMeta);
  }
  themeColorMeta.setAttribute('content', themeColor);

  let colorSchemeMeta = rootDocument.querySelector('meta[name="color-scheme"]');
  if (!colorSchemeMeta) {
    colorSchemeMeta = rootDocument.createElement('meta');
    colorSchemeMeta.setAttribute('name', 'color-scheme');
    head.appendChild(colorSchemeMeta);
  }
  colorSchemeMeta.setAttribute('content', theme);
}
