"use client";

import { createContext, useContext, useCallback, useMemo, ReactNode, useState, useEffect } from "react";

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  isLoading: boolean;
}

interface ThemeContextType extends ThemeState {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'theme';
const DARK_CLASS = 'dark';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>({
    theme: 'light',
    isLoading: true
  });

  // Load theme from localStorage and system preference on mount
  useEffect(() => {
    const loadTheme = () => {
      // Check localStorage first
      const storedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
      
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setState({ theme: storedTheme, isLoading: false });
        applyTheme(storedTheme);
        return;
      }

      // Fall back to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme: Theme = prefersDark ? 'dark' : 'light';
      
      setState({ theme: systemTheme, isLoading: false });
      applyTheme(systemTheme);
    };

    loadTheme();
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((theme: Theme) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add(DARK_CLASS);
    } else {
      root.classList.remove(DARK_CLASS);
    }
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setState({ theme, isLoading: false });
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme: Theme = state.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [state.theme, setTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a preference
      const storedTheme = localStorage.getItem(STORAGE_KEY);
      if (!storedTheme) {
        const systemTheme: Theme = e.matches ? 'dark' : 'light';
        setState(prev => ({ ...prev, theme: systemTheme }));
        applyTheme(systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [applyTheme]);

  const value = useMemo<ThemeContextType>(() => ({
    ...state,
    setTheme,
    toggleTheme
  }), [state, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
