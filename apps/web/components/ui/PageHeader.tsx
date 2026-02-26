import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  chips?: string[];
  actions?: ReactNode;
  titleTestId?: string;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  chips = [],
  actions,
  titleTestId,
}: PageHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-xs uppercase tracking-wide text-slate-500">{eyebrow}</p>
          ) : null}
          <h1
            className="section-title mt-2 text-3xl text-slate-900 sm:text-4xl"
            data-testid={titleTestId}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
