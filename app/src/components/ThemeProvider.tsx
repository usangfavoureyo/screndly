import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

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
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'dark'; // Default to dark mode
  } catch (e) {
    console.error('Failed to load theme from localStorage:', e);
    return 'dark';
  }
}

// Apply theme to document immediately (before React renders)
if (typeof window !== 'undefined') {
  const initialTheme = getInitialTheme();
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#000000';
  } else {
    document.documentElement.classList.remove('dark');
    document.body.style.backgroundColor = '#ffffff';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // localStorage not available
      console.error('Failed to save theme to localStorage:', e);
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
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