import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

describe('useTheme Hook', () => {
  const mockMatchMedia = (matches: boolean) => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(false);
        }
        if (query === '(forced-colors: active)') {
          return mockMatchMedia(false);
        }
        return mockMatchMedia(false);
      })
    );

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    Object.defineProperty(document, 'documentElement', {
      value: {
        style: {
          setProperty: vi.fn(),
          colorScheme: '',
        },
        setAttribute: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize with light theme by default', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(result.current.isHighContrast).toBe(false);
  });

  it('should return theme object', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBeDefined();
    expect(result.current.theme.background).toBeDefined();
    expect(result.current.theme.text).toBeDefined();
    expect(result.current.theme.brand).toBeDefined();
  });

  it('should toggle between light and dark mode', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe('light');

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe('dark');
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('should set specific theme mode', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.mode).toBe('dark');

    act(() => {
      result.current.setMode('high-contrast');
    });

    expect(result.current.mode).toBe('high-contrast');
    expect(result.current.isHighContrast).toBe(true);
  });

  it('should persist theme preference to localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode('dark');
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('nextgen-theme-mode', 'dark');
  });

  it('should detect system dark mode preference', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => {
        if (query === '(prefers-color-scheme: dark)') {
          return mockMatchMedia(true);
        }
        return mockMatchMedia(false);
      })
    );

    const { result } = renderHook(() => useTheme());

    expect(result.current.systemPreference).toBe('dark');
  });

  it('should detect high contrast mode preference', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => {
        if (query === '(forced-colors: active)') {
          return mockMatchMedia(true);
        }
        return mockMatchMedia(false);
      })
    );

    const { result } = renderHook(() => useTheme());

    expect(result.current.systemPreference).toBe('high-contrast');
  });

  it('should load stored preference from localStorage', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dark');

    const { result } = renderHook(() => useTheme());

    // After initialization effect runs
    expect(localStorage.getItem).toHaveBeenCalledWith('nextgen-theme-mode');
  });

  it('should provide all required return values', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current).toHaveProperty('mode');
    expect(result.current).toHaveProperty('theme');
    expect(result.current).toHaveProperty('setMode');
    expect(result.current).toHaveProperty('toggleMode');
    expect(result.current).toHaveProperty('isDark');
    expect(result.current).toHaveProperty('isHighContrast');
    expect(result.current).toHaveProperty('systemPreference');
  });
});
