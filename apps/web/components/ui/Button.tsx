import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'ghost'
  | 'secondary'
  | 'danger'
  | 'subtle'
  | 'icon'
  | 'floating';

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
  danger: 'btn border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100',
  subtle: 'btn border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  icon: 'btn h-10 w-10 rounded-full border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-100',
  floating:
    'btn fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full border border-emerald-300 bg-emerald-500 p-0 text-white shadow-2xl hover:bg-emerald-600',
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
  const interactiveStates =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] transition-transform';
  const classes = `${variantClasses[variant]} ${interactiveStates} ${className}`.trim();
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
