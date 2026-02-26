export const spacingScale = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
  12: '3rem',
  16: '4rem',
  24: '6rem',
  32: '8rem',
  48: '12rem',
} as const;

export const spacingSemantic = {
  'container-padding': spacingScale[6],
  'section-gap': spacingScale[12],
  'card-padding': spacingScale[6],
  'field-gap': spacingScale[4],
  'stack-gap': spacingScale[3],
  'inline-gap': spacingScale[2],
} as const;

export const radiusScale = {
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;
