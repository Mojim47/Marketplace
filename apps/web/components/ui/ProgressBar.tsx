export function ProgressBar({
  label,
  value,
  meta,
  className = '',
}: {
  label: string;
  value: number;
  meta?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>{meta ?? `${percent}%`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
