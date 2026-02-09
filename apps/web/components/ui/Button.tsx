import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'secondary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn btn-primary',
  outline: 'btn btn-outline',
  ghost: 'btn btn-ghost',
  secondary: 'btn btn-secondary',
};

export function Button({
  variant = 'primary',
  className = '',
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = `${variantClasses[variant]} ${className}`.trim();
  return (
    <button
      className={classes}
      aria-busy={loading}
      data-loading={loading ? 'true' : 'false'}
      disabled={disabled || loading}
      {...props}
    >
      <span className="btn-content">
        {loading ? (loadingText ?? 'در حال پردازش...') : children}
      </span>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
    </button>
  );
}
