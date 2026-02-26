import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import tokens from './tailwind.tokens.json';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './ui/**/*.{ts,tsx}',
    '../../libs/**/*.{ts,tsx}',
  ],
  theme: {
    ...tokens,
    screens: {
      xs: '320px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      backgroundImage: {
        'neon-radial':
          'radial-gradient(circle at 30% 30%, rgb(var(--color-secondary-400-rgb) / 0.35), transparent 40%), radial-gradient(circle at 70% 70%, rgb(var(--color-primary-400-rgb) / 0.28), transparent 45%)',
        noise:
          "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27 viewBox=%270 0 160 160%27%3E%3Cfilter id=%27n%27 x=%270%27 y=%270%27 width=%27100%25%27 height=%27100%25%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.65%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.32%27/%3E%3C/svg%3E')",
      },
      backdropBlur: {
        glass: '20px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseOrb: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        glowSweep: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
      },
      animation: {
        orb: 'pulseOrb 6s ease-in-out infinite',
        glow: 'glowSweep 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
