import type { ReactNode } from 'react';

type OrbitalBadgeProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
};

export function OrbitalBadge({ icon, title, subtitle }: OrbitalBadgeProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full border border-cyan-300/30" />
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full border border-cyan-300/30" />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-transparent" />

      <div className="relative">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-cyan-200">
          {icon}
        </div>
        <p className="mt-4 text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-xs leading-6 text-slate-300">{subtitle}</p>
      </div>
    </div>
  );
}

