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
  danger: 'btn border border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30',
  subtle: 'btn border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
  icon: 'btn h-10 w-10 rounded-full border border-white/15 bg-white/5 p-0 text-slate-100 hover:bg-white/10',
  floating:
    'btn fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full border border-cyan-300/40 bg-cyan-500/25 p-0 text-cyan-100 shadow-2xl hover:bg-cyan-500/35',
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
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] transition-transform';
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
