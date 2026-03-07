import { createContext, useContext, useState, useEffect } from 'react';
import {
  applyThemeToDocument,
  dispatchThemeChange,
  getStoredThemePreference,
  persistThemePreference,
  type AppTheme,
  THEME_CHANGE_EVENT,
} from '../lib/theme/themeStorage';

type Theme = AppTheme;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Get initial theme synchronously to prevent flash
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  try {
    return getStoredThemePreference(window.localStorage) || 'dark';
  } catch (e) {
    console.error('Failed to load theme from localStorage:', e);
    return 'dark';
  }
}

// Apply theme to document immediately (before React renders)
if (typeof window !== 'undefined') {
  const initialTheme = getInitialTheme();
  applyThemeToDocument(initialTheme, document);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    try {
      persistThemePreference(theme, window.localStorage);
      dispatchThemeChange(theme);
    } catch (e) {
      // localStorage not available
      console.error('Failed to save theme to localStorage:', e);
    }

    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    const syncThemeFromStorage = () => {
      try {
        const nextTheme = getStoredThemePreference(window.localStorage);
        if (nextTheme && nextTheme !== theme) {
          setThemeState(nextTheme);
        }
      } catch (e) {
        console.error('Failed to sync theme from localStorage:', e);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'theme' || event.key === 'screndlySettings') {
        syncThemeFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, syncThemeFromStorage as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, syncThemeFromStorage as EventListener);
    };
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
