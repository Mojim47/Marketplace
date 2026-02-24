import type { ReactNode } from 'react';

type OrbitalBadgeProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
};

export function OrbitalBadge({ icon, title, subtitle }: OrbitalBadgeProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full border border-orange-300/40" />
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full border border-orange-300/40" />
      <div className="absolute inset-0 bg-gradient-to-br from-orange-100 via-transparent to-transparent" />

      <div className="relative">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-orange-600">
          {icon}
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-xs leading-6 text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}
