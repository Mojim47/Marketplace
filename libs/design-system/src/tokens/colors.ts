export const semanticColorTokens = {
  'text-primary': '#FFFFFF',
  'text-secondary': '#E0E0E0',
  'text-muted': '#BDBDBD',
  'surface-default': '#212121',
  'surface-elevated': '#424242',
  'surface-glass': '#424242',
  'border-subtle': '#757575',
  'border-strong': '#9E9E9E',
  'accent-primary': '#2196F3',
  'accent-secondary': '#E91E63',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#F44336',
  info: '#2196F3',
  disabled: '#757575',
  highlight: '#90CAF9',
} as const;

export const semanticColorClassMap = {
  'text-primary': 'semantic-text-primary',
  'text-secondary': 'semantic-text-secondary',
  'text-muted': 'semantic-text-muted',
  'surface-default': 'semantic-surface-default',
  'surface-elevated': 'semantic-surface-elevated',
  'surface-glass': 'semantic-surface-glass',
  'border-subtle': 'semantic-border-subtle',
  'border-strong': 'semantic-border-strong',
  'accent-primary': 'semantic-accent-primary',
  'accent-secondary': 'semantic-accent-secondary',
  success: 'semantic-success',
  warning: 'semantic-warning',
  danger: 'semantic-danger',
  info: 'semantic-info',
  disabled: 'semantic-disabled',
  highlight: 'semantic-highlight',
} as const;

export type SemanticColorTokenName = keyof typeof semanticColorTokens;
