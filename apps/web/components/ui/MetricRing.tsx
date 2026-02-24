type MetricRingProps = {
  value: number;
  label: string;
  hint?: string;
  tone?: 'orange' | 'emerald' | 'amber';
};

const toneClasses: Record<NonNullable<MetricRingProps['tone']>, string> = {
  orange: 'text-orange-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
};

export function MetricRing({ value, label, hint, tone = 'orange' }: MetricRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="relative mx-auto h-28 w-28">
        <svg viewBox="0 0 100 100" className="-rotate-90 h-full w-full">
          <circle cx="50" cy="50" r={radius} stroke="rgba(100,116,139,0.22)" strokeWidth="8" fill="none" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`${toneClasses[tone]} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-slate-900">{clamped}%</span>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-slate-800">{label}</p>
      {hint ? <p className="mt-1 text-center text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
