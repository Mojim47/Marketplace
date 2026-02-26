export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic skeleton placeholders
            key={index}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3"
          >
            <div className="aspect-[4/5] animate-pulse rounded-xl bg-slate-100" />
            <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
