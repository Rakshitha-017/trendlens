import { useEffect, useState } from 'react';
import { ThemeMode } from '../types';

const THEME_KEY = 'trendlens_theme';

const listeners = new Set<() => void>();
let currentTheme: ThemeMode = (() => {
  try {
    const item = window.localStorage.getItem(THEME_KEY);
    return item ? (JSON.parse(item) as ThemeMode) : 'light';
  } catch (error) {
    console.error(`Error reading localStorage key "${THEME_KEY}":`, error);
    return 'light';
  }
})();

function persist(mode: ThemeMode) {
  currentTheme = mode;
  try {
    window.localStorage.setItem(THEME_KEY, JSON.stringify(mode));
  } catch (error) {
    console.error(`Error writing localStorage key "${THEME_KEY}":`, error);
  }
  listeners.forEach((listener) => listener());
}

export function useTheme(): { theme: ThemeMode; toggleTheme: () => void; setTheme: (mode: ThemeMode) => void } {
  const [theme, setTheme] = useState<ThemeMode>(currentTheme);

  useEffect(() => {
    const listener = () => setTheme(currentTheme);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    persist(theme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme, setTheme: (mode: ThemeMode) => persist(mode) };
}