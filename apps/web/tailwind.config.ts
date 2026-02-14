import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './ui/**/*.{ts,tsx}',
    '../../libs/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#050505',
        neon: {
          fuchsia: '#D946EF',
          violet: '#8B5CF6',
          cyan: '#0EA5E9',
        },
        glass: 'rgba(255,255,255,0.08)',
        glassBorder: 'rgba(255,255,255,0.10)',
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #D946EF 0%, #8B5CF6 45%, #0EA5E9 100%)',
        'neon-radial':
          'radial-gradient(circle at 30% 30%, rgba(217,70,239,0.35), transparent 40%), radial-gradient(circle at 70% 70%, rgba(14,165,233,0.28), transparent 45%)',
        noise:
          "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27 viewBox=%270 0 160 160%27%3E%3Cfilter id=%27n%27 x=%270%27 y=%270%27 width=%27100%25%27 height=%27100%25%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.65%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.32%27/%3E%3C/svg%3E')",
      },
      boxShadow: {
        glow: '0 0 40px rgba(217,70,239,0.35), 0 0 60px rgba(14,165,233,0.28)',
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
