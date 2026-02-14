// ═══════════════════════════════════════════════════════════════════════════
// Design Tokens - NextGen Marketplace Design System
// ═══════════════════════════════════════════════════════════════════════════
// SC³ Compliant Design Tokens with WCAG 2.2 Accessibility
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Color Palette - Semantic Colors
 */
export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3', // Main
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },

  // Secondary Colors
  secondary: {
    50: '#FCE4EC',
    100: '#F8BBD9',
    200: '#F48FB1',
    300: '#F06292',
    400: '#EC407A',
    500: '#E91E63', // Main
    600: '#D81B60',
    700: '#C2185B',
    800: '#AD1457',
    900: '#880E4F',
  },

  // Neutral/Gray Scale
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    1000: '#000000',
  },

  // Semantic Colors
  success: {
    light: '#81C784',
    main: '#4CAF50',
    dark: '#388E3C',
    contrast: '#FFFFFF',
  },

  warning: {
    light: '#FFB74D',
    main: '#FF9800',
    dark: '#F57C00',
    contrast: '#000000',
  },

  error: {
    light: '#E57373',
    main: '#F44336',
    dark: '#D32F2F',
    contrast: '#FFFFFF',
  },

  info: {
    light: '#64B5F6',
    main: '#2196F3',
    dark: '#1976D2',
    contrast: '#FFFFFF',
  },
} as const;

/**
 * Typography Scale - Variable Fonts with Dynamic Scaling
 */
export const typography = {
  fontFamily: {
    primary: "'Inter Variable', 'Vazirmatn Variable', system-ui, sans-serif",
    secondary: "'Plus Jakarta Sans Variable', 'Vazirmatn Variable', sans-serif",
    mono: "'JetBrains Mono Variable', 'Fira Code', monospace",
    persian: "'Vazirmatn Variable', 'IRANSans', 'Tahoma', sans-serif",
  },

  // Fluid Typography Scale (clamp for responsive)
  fontSize: {
    xs: 'clamp(0.625rem, 0.5rem + 0.25vw, 0.75rem)', // 10-12px
    sm: 'clamp(0.75rem, 0.625rem + 0.25vw, 0.875rem)', // 12-14px
    base: 'clamp(0.875rem, 0.75rem + 0.25vw, 1rem)', // 14-16px
    md: 'clamp(1rem, 0.875rem + 0.25vw, 1.125rem)', // 16-18px
    lg: 'clamp(1.125rem, 1rem + 0.25vw, 1.25rem)', // 18-20px
    xl: 'clamp(1.25rem, 1.125rem + 0.5vw, 1.5rem)', // 20-24px
    '2xl': 'clamp(1.5rem, 1.25rem + 0.75vw, 2rem)', // 24-32px
    '3xl': 'clamp(2rem, 1.5rem + 1vw, 2.5rem)', // 32-40px
    '4xl': 'clamp(2.5rem, 2rem + 1.25vw, 3rem)', // 40-48px
    '5xl': 'clamp(3rem, 2.5rem + 1.5vw, 4rem)', // 48-64px
  },

  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

/**
 * Spacing Scale - 4px Base Unit
 */
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem', // 2px
  1: '0.25rem', // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem', // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem', // 12px
  3.5: '0.875rem', // 14px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  7: '1.75rem', // 28px
  8: '2rem', // 32px
  9: '2.25rem', // 36px
  10: '2.5rem', // 40px
  11: '2.75rem', // 44px
  12: '3rem', // 48px
  14: '3.5rem', // 56px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
  28: '7rem', // 112px
  32: '8rem', // 128px
  36: '9rem', // 144px
  40: '10rem', // 160px
  44: '11rem', // 176px
  48: '12rem', // 192px
  52: '13rem', // 208px
  56: '14rem', // 224px
  60: '15rem', // 240px
  64: '16rem', // 256px
  72: '18rem', // 288px
  80: '20rem', // 320px
  96: '24rem', // 384px
} as const;

/**
 * Border Radius
 */
export const borderRadius = {
  none: '0',
  sm: '0.125rem', // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  '2xl': '1rem', // 16px
  '3xl': '1.5rem', // 24px
  full: '9999px',
} as const;

/**
 * Shadows - Elevation System
 */
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Colored shadows for cards
  primary: '0 4px 14px 0 rgb(33 150 243 / 0.25)',
  success: '0 4px 14px 0 rgb(76 175 80 / 0.25)',
  warning: '0 4px 14px 0 rgb(255 152 0 / 0.25)',
  error: '0 4px 14px 0 rgb(244 67 54 / 0.25)',
} as const;

/**
 * Z-Index Scale
 */
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

/**
 * Breakpoints - Mobile First
 */
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  '3xl': '1920px',
} as const;

/**
 * Animation & Transitions
 */
export const animation = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '1000ms',
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Custom easings
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  },

  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    fadeOut: {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    slideInUp: {
      from: { transform: 'translateY(100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    slideInDown: {
      from: { transform: 'translateY(-100%)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    slideInLeft: {
      from: { transform: 'translateX(-100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    slideInRight: {
      from: { transform: 'translateX(100%)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    scaleIn: {
      from: { transform: 'scale(0.95)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
    spin: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
    pulse: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 },
    },
    bounce: {
      '0%, 100%': {
        transform: 'translateY(-25%)',
        animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
      },
      '50%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' },
    },
    shimmer: {
      '0%': { backgroundPosition: '-200% 0' },
      '100%': { backgroundPosition: '200% 0' },
    },
  },
} as const;

/**
 * Grid System
 */
export const grid = {
  columns: 12,
  gutter: {
    xs: spacing[4], // 16px
    sm: spacing[5], // 20px
    md: spacing[6], // 24px
    lg: spacing[8], // 32px
    xl: spacing[10], // 40px
  },
  container: {
    xs: '100%',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type ZIndex = typeof zIndex;
export type Breakpoints = typeof breakpoints;
export type Animation = typeof animation;
export type Grid = typeof grid;
