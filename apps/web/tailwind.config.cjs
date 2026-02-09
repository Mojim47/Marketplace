const tokens = require('./tailwind.tokens.json');

const alpha = (token) => `rgb(var(${token}-rgb) / <alpha-value>)`;

const neutralScale = {
  0: alpha('--color-neutral-0'),
  50: alpha('--color-neutral-50'),
  100: alpha('--color-neutral-100'),
  200: alpha('--color-neutral-200'),
  300: alpha('--color-neutral-300'),
  400: alpha('--color-neutral-400'),
  500: alpha('--color-neutral-500'),
  600: alpha('--color-neutral-600'),
  700: alpha('--color-neutral-700'),
  800: alpha('--color-neutral-800'),
  900: alpha('--color-neutral-900'),
  1000: alpha('--color-neutral-1000'),
};

const primaryScale = {
  50: alpha('--color-primary-50'),
  100: alpha('--color-primary-100'),
  200: alpha('--color-primary-200'),
  300: alpha('--color-primary-300'),
  400: alpha('--color-primary-400'),
  500: alpha('--color-primary-500'),
  600: alpha('--color-primary-600'),
  700: alpha('--color-primary-700'),
  800: alpha('--color-primary-800'),
  900: alpha('--color-primary-900'),
};

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
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
        white: alpha('--color-neutral-0'),
        black: alpha('--color-neutral-1000'),
        slate: neutralScale,
        gray: neutralScale,
        blue: primaryScale,
        emerald: {
          300: alpha('--color-success-light'),
          500: alpha('--color-success-main'),
          700: alpha('--color-success-dark'),
        },
      },
      fontFamily: {
        sans: ['var(--font-vazirmatn)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        rtl: '0.25rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    function ({ addUtilities }) {
      const newUtilities = {
        '.text-start': {
          'text-align': 'start',
        },
        '.text-end': {
          'text-align': 'end',
        },
        '.float-start': {
          float: 'inline-start',
        },
        '.float-end': {
          float: 'inline-end',
        },
        '.border-s': {
          'border-inline-start-width': '1px',
        },
        '.border-e': {
          'border-inline-end-width': '1px',
        },
        '.ps-4': {
          'padding-inline-start': '1rem',
        },
        '.pe-4': {
          'padding-inline-end': '1rem',
        },
        '.ms-4': {
          'margin-inline-start': '1rem',
        },
        '.me-4': {
          'margin-inline-end': '1rem',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
