import { Activity, Cpu, ShieldAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminPanelShell } from '@/components/AdminPanelShell';

const stats = [
  { label: 'درخواست دقیقه‌ای', value: '18,240', delta: '+9.4%', tone: 'text-emerald-300', spark: [20, 24, 18, 28, 31, 26, 34] },
  { label: 'کاربران فعال', value: '6,382', delta: '+3.1%', tone: 'text-emerald-300', spark: [16, 17, 19, 22, 21, 24, 23] },
  { label: 'هشدارهای امنیتی', value: '12', delta: '-2', tone: 'text-amber-300', spark: [13, 14, 12, 11, 12, 12, 10] },
  { label: 'خطای بحرانی', value: '1', delta: 'stable', tone: 'text-rose-300', spark: [1, 1, 1, 2, 1, 1, 1] },
];

const liveLog = [
  { level: 'INFO', line: 'Payment gateway latency normalized at 183ms', at: '12:14:22' },
  { level: 'WARNING', line: 'Inventory sync delay for vendor NX-902 observed', at: '12:14:36' },
  { level: 'INFO', line: 'Fraud detector model refreshed successfully', at: '12:14:48' },
  { level: 'ERROR', line: 'Checkout webhook retry triggered for order NX-90331', at: '12:15:03' },
];

export default function AdminHomePage() {
  return (
    <AdminPanelShell
      title="مرکز فرماندهی ادمین"
      subtitle="ماکسیمالیسم داده برای نظارت، هشداردهی و تصمیم‌گیری سریع در مقیاس واقعی."
    >
      <section className="grid gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="admin-kpi rounded-2xl p-5">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
            <p className={`mt-1 text-xs ${item.tone}`}>{item.delta}</p>
            <svg viewBox="0 0 120 28" className="mt-3 h-7 w-full">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={item.tone}
                points={item.spark.map((v, i) => `${i * 18},${28 - v}`).join(' ')}
              />
            </svg>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="admin-card rounded-3xl p-6">
          <h2 className="admin-title text-xl text-white">نقشه حرارتی تعاملات زنده</h2>
          <p className="mt-2 text-sm text-slate-300">نقاط داغ تراکنش و رفتار کاربران در 60 ثانیه اخیر.</p>
          <div className="mt-5 grid grid-cols-8 gap-2 rounded-2xl bg-black/20 p-3">
            {Array.from({ length: 64 }).map((_, idx) => {
              const intensity = (idx * 17) % 100;
              const bg =
                intensity > 82
                  ? 'bg-rose-500'
                  : intensity > 62
                    ? 'bg-orange-500'
                    : intensity > 40
                      ? 'bg-amber-400'
                      : 'bg-slate-700';
              return <div key={idx} className={`h-8 rounded-md ${bg} opacity-80`} />;
            })}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              { icon: Activity, label: 'Active Traces', value: '42' },
              { icon: Users, label: 'Concurrent Admin', value: '7' },
              { icon: Cpu, label: 'AI Workers', value: '14' },
              { icon: ShieldAlert, label: 'Risk Guards', value: 'Enabled' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <item.icon size={14} />
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="admin-card rounded-3xl p-6">
            <h2 className="admin-title text-xl text-white">هشدارهای عملیاتی</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-300">
                Inventory lag on vendor sync queue
              </div>
              <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-rose-300">
                1 failed payment callback needs retry
              </div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300">
                AI recommender healthy and stable
              </div>
            </div>
            <div className="mt-5">
              <Button loading={false}>باز کردن پنل Incident</Button>
            </div>
          </div>

          <div className="admin-card rounded-3xl p-6">
            <h2 className="admin-title text-xl text-white">لاگ زنده سیستم</h2>
            <div className="mt-4 space-y-2 text-xs">
              {liveLog.map((row) => (
                <div key={`${row.at}-${row.line}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="text-slate-400">{row.at}</p>
                  <p
                    className={
                      row.level === 'ERROR'
                        ? 'admin-log-error'
                        : row.level === 'WARNING'
                          ? 'admin-log-warning'
                          : 'admin-log-info'
                    }
                  >
                    [{row.level}] {row.line}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AdminPanelShell>
  );
}
