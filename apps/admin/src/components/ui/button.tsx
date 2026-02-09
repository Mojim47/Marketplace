import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'outline';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'inline-flex w-full items-center justify-center rounded-full bg-primary-400 px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-primary-500',
  ghost: 'inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/20',
  outline: 'inline-flex w-full items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition',
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
      <span className="inline-flex items-center gap-2">
        {loading ? loadingText ?? 'در حال پردازش...' : children}
      </span>
    </button>
  );
}
