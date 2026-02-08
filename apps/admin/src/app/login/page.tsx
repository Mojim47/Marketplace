'use client';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="admin-card w-full max-w-md rounded-3xl p-8">
          <p className="text-xs text-slate-300">Secure Access</p>
          <h1 className="admin-title mt-2 text-2xl text-white">æÑæÏ ãÏíÑÇä</h1>
          <p className="mt-3 text-sm text-slate-300">
            áØİÇğ ÇÒ ÍÓÇÈ ãÏíÑíÊí ÎæÏ ÈÑÇí ÏÓÊÑÓí Èå ÏÇÔÈæÑÏ ÇÓÊİÇÏå ˜äíÏ.
          </p>
          <div className="mt-6 space-y-4">
            <input
              className="w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
              placeholder="Çíãíá"
            />
            <input
              className="w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
              placeholder="ÑãÒ ÚÈæÑ"
              type="password"
            />
            <button className="w-full rounded-full bg-[color:var(--admin-brand)] px-6 py-3 text-sm font-semibold text-slate-900">
              æÑæÏ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
