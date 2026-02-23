type MetricRingProps = {
  value: number;
  label: string;
  hint?: string;
  tone?: 'cyan' | 'emerald' | 'amber';
};

const toneClasses: Record<NonNullable<MetricRingProps['tone']>, string> = {
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
};

export function MetricRing({ value, label, hint, tone = 'cyan' }: MetricRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="relative mx-auto h-28 w-28">
        <svg viewBox="0 0 100 100" className="-rotate-90 h-full w-full">
          <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="8" fill="none" />
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
          <span className="text-lg font-semibold text-white">{clamped}%</span>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-slate-100">{label}</p>
      {hint ? <p className="mt-1 text-center text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

