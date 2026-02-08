// ═══════════════════════════════════════════════════════════════════════════
// Theme System - Light/Dark/High Contrast
// ═══════════════════════════════════════════════════════════════════════════
// WCAG 2.2 AA/AAA Compliant Theme Definitions
// ═══════════════════════════════════════════════════════════════════════════

import { colors } from '../tokens';

/**
 * Theme Mode Types
 */
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

/**
 * Semantic Color Tokens for Themes
 */
export interface ThemeColors {
  // Background colors
  background: {
    default: string;
    paper: string;
    elevated: string;
    sunken: string;
    overlay: string;
  };

  // Surface colors
  surface: {
    default: string;
    hover: string;
    active: string;
    disabled: string;
  };

  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    link: string;
    linkHover: string;
  };

  // Border colors
  border: {
    default: string;
    light: string;
    dark: string;
    focus: string;
    error: string;
  };

  // Brand colors
  brand: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    secondary: string;
    secondaryHover: string;
    secondaryActive: string;
  };

  // Semantic colors
  semantic: {
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    error: string;
    errorBg: string;
    info: string;
    infoBg: string;
  };

  // Interactive states
  interactive: {
    hover: string;
    active: string;
    focus: string;
    selected: string;
    disabled: string;
  };
}

/**
 * Light Theme - Default
 */
export const lightTheme: ThemeColors = {
  background: {
    default: '#FFFFFF',
    paper: '#FAFAFA',
    elevated: '#FFFFFF',
    sunken: '#F5F5F5',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  surface: {
    default: '#FFFFFF',
    hover: '#F5F5F5',
    active: '#EEEEEE',
    disabled: '#FAFAFA',
  },

  text: {
    primary: '#212121',
    secondary: '#616161',
    tertiary: '#9E9E9E',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF',
    link: colors.primary[600],
    linkHover: colors.primary[800],
  },

  border: {
    default: '#E0E0E0',
    light: '#EEEEEE',
    dark: '#BDBDBD',
    focus: colors.primary[500],
    error: colors.error.main,
  },

  brand: {
    primary: colors.primary[500],
    primaryHover: colors.primary[600],
    primaryActive: colors.primary[700],
    secondary: colors.secondary[500],
    secondaryHover: colors.secondary[600],
    secondaryActive: colors.secondary[700],
  },

  semantic: {
    success: colors.success.main,
    successBg: '#E8F5E9',
    warning: colors.warning.main,
    warningBg: '#FFF3E0',
    error: colors.error.main,
    errorBg: '#FFEBEE',
    info: colors.info.main,
    infoBg: '#E3F2FD',
  },

  interactive: {
    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.08)',
    focus: 'rgba(33, 150, 243, 0.12)',
    selected: 'rgba(33, 150, 243, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.12)',
  },
};

/**
 * Dark Theme
 */
export const darkTheme: ThemeColors = {
  background: {
    default: '#121212',
    paper: '#1E1E1E',
    elevated: '#2D2D2D',
    sunken: '#0A0A0A',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  surface: {
    default: '#1E1E1E',
    hover: '#2D2D2D',
    active: '#3D3D3D',
    disabled: '#1A1A1A',
  },

  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    tertiary: '#808080',
    disabled: '#5C5C5C',
    inverse: '#121212',
    link: colors.primary[300],
    linkHover: colors.primary[200],
  },

  border: {
    default: '#3D3D3D',
    light: '#2D2D2D',
    dark: '#5C5C5C',
    focus: colors.primary[400],
    error: colors.error.light,
  },

  brand: {
    primary: colors.primary[400],
    primaryHover: colors.primary[300],
    primaryActive: colors.primary[200],
    secondary: colors.secondary[400],
    secondaryHover: colors.secondary[300],
    secondaryActive: colors.secondary[200],
  },

  semantic: {
    success: colors.success.light,
    successBg: 'rgba(76, 175, 80, 0.12)',
    warning: colors.warning.light,
    warningBg: 'rgba(255, 152, 0, 0.12)',
    error: colors.error.light,
    errorBg: 'rgba(244, 67, 54, 0.12)',
    info: colors.info.light,
    infoBg: 'rgba(33, 150, 243, 0.12)',
  },

  interactive: {
    hover: 'rgba(255, 255, 255, 0.08)',
    active: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(66, 165, 245, 0.24)',
    selected: 'rgba(66, 165, 245, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.12)',
  },
};

/**
 * High Contrast Theme - WCAG AAA Compliant
 */
export const highContrastTheme: ThemeColors = {
  background: {
    default: '#000000',
    paper: '#000000',
    elevated: '#1A1A1A',
    sunken: '#000000',
    overlay: 'rgba(0, 0, 0, 0.9)',
  },

  surface: {
    default: '#000000',
    hover: '#1A1A1A',
    active: '#333333',
    disabled: '#0D0D0D',
  },

  text: {
    primary: '#FFFFFF',
    secondary: '#FFFF00', // Yellow for high visibility
    tertiary: '#00FFFF', // Cyan for tertiary
    disabled: '#808080',
    inverse: '#000000',
    link: '#00FFFF',
    linkHover: '#FFFFFF',
  },

  border: {
    default: '#FFFFFF',
    light: '#CCCCCC',
    dark: '#FFFFFF',
    focus: '#FFFF00',
    error: '#FF0000',
  },

  brand: {
    primary: '#00FFFF',
    primaryHover: '#FFFFFF',
    primaryActive: '#FFFF00',
    secondary: '#FF00FF',
    secondaryHover: '#FFFFFF',
    secondaryActive: '#FFFF00',
  },

  semantic: {
    success: '#00FF00',
    successBg: '#003300',
    warning: '#FFFF00',
    warningBg: '#333300',
    error: '#FF0000',
    errorBg: '#330000',
    info: '#00FFFF',
    infoBg: '#003333',
  },

  interactive: {
    hover: 'rgba(255, 255, 255, 0.2)',
    active: 'rgba(255, 255, 255, 0.3)',
    focus: 'rgba(255, 255, 0, 0.5)',
    selected: 'rgba(0, 255, 255, 0.3)',
    disabled: 'rgba(255, 255, 255, 0.1)',
  },
};

/**
 * Get theme by mode
 */
export function getTheme(mode: ThemeMode): ThemeColors {
  switch (mode) {
    case 'dark':
      return darkTheme;
    case 'high-contrast':
      return highContrastTheme;
    default:
      return lightTheme;
  }
}

/**
 * CSS Custom Properties Generator
 */
export function generateCSSVariables(theme: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};

  const flatten = (obj: Record<string, unknown>, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const varName = prefix ? `${prefix}-${key}` : key;
      if (typeof value === 'object' && value !== null) {
        flatten(value as Record<string, unknown>, varName);
      } else {
        vars[`--color-${varName}`] = String(value);
      }
    }
  };

  flatten(theme as unknown as Record<string, unknown>);
  return vars;
}

/**
 * Theme Context Type
 */
export interface ThemeContextValue {
  mode: ThemeMode;
  theme: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}
