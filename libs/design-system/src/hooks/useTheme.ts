// ═══════════════════════════════════════════════════════════════════════════
// useTheme Hook - Theme Management with System Preference Detection
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeMode, ThemeColors, getTheme, generateCSSVariables } from '../themes';

const THEME_STORAGE_KEY = 'nextgen-theme-mode';

/**
 * Detect system color scheme preference
 */
function getSystemPreference(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  
  // Check for high contrast mode
  if (window.matchMedia('(forced-colors: active)').matches) {
    return 'high-contrast';
  }
  
  // Check for dark mode preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
}

/**
 * Get stored theme preference
 */
function getStoredPreference(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && ['light', 'dark', 'high-contrast'].includes(stored)) {
      return stored as ThemeMode;
    }
  } catch {
    // localStorage not available
  }
  
  return null;
}

/**
 * Store theme preference
 */
function storePreference(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage not available
  }
}

/**
 * Apply theme CSS variables to document
 */
function applyThemeToDocument(theme: ThemeColors, mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  const vars = generateCSSVariables(theme);
  
  // Apply CSS variables
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  
  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', mode);
  
  // Set color-scheme for native elements
  root.style.colorScheme = mode === 'light' ? 'light' : 'dark';
}

export interface UseThemeReturn {
  /** Current theme mode */
  mode: ThemeMode;
  /** Current theme colors */
  theme: ThemeColors;
  /** Set specific theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark */
  toggleMode: () => void;
  /** Check if dark mode */
  isDark: boolean;
  /** Check if high contrast mode */
  isHighContrast: boolean;
  /** System preference */
  systemPreference: ThemeMode;
}

/**
 * Theme management hook
 */
export function useTheme(): UseThemeReturn {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [systemPreference, setSystemPreference] = useState<ThemeMode>('light');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const stored = getStoredPreference();
    const system = getSystemPreference();
    
    setSystemPreference(system);
    setModeState(stored || system);
    setIsInitialized(true);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const contrastQuery = window.matchMedia('(forced-colors: active)');

    const handleChange = () => {
      const newPreference = getSystemPreference();
      setSystemPreference(newPreference);
      
      // Only auto-update if no stored preference
      if (!getStoredPreference()) {
        setModeState(newPreference);
      }
    };

    darkQuery.addEventListener('change', handleChange);
    contrastQuery.addEventListener('change', handleChange);

    return () => {
      darkQuery.removeEventListener('change', handleChange);
      contrastQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Apply theme when mode changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const theme = getTheme(mode);
    applyThemeToDocument(theme, mode);
  }, [mode, isInitialized]);

  const theme = useMemo(() => getTheme(mode), [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storePreference(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(current => {
      const newMode = current === 'light' ? 'dark' : 'light';
      storePreference(newMode);
      return newMode;
    });
  }, []);

  return {
    mode,
    theme,
    setMode,
    toggleMode,
    isDark: mode === 'dark',
    isHighContrast: mode === 'high-contrast',
    systemPreference,
  };
}

export default useTheme;
