import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext, type Theme } from './ThemeContext';

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Try to load theme from localStorage
    const stored = localStorage.getItem('theme') as Theme | null;
    return stored || 'light';
  });

  useEffect(() => {
    // Apply theme to html element
    document.documentElement.setAttribute('data-theme', theme);
    // Persist to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
