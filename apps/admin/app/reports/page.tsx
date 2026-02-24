import { AdminPanelShell } from '@/components/AdminPanelShell';

const kpis = [
  { title: 'GMV ماهانه', value: '1.28T', trend: '+12.4%' },
  { title: 'تعداد سفارش', value: '83,410', trend: '+6.1%' },
  { title: 'میانگین خرید', value: '15.3M', trend: '-1.8%' },
  { title: 'نرخ بازگشت', value: '31%', trend: '+2.2%' },
];

const vendors = [
  { rank: '🥇', name: 'Nova Devices', sales: '249B', visits: '1.9M', cv: '4.8%' },
  { rank: '🥈', name: 'Orion Tech', sales: '203B', visits: '1.6M', cv: '4.1%' },
  { rank: '🥉', name: 'Pulse Market', sales: '182B', visits: '1.4M', cv: '3.9%' },
];

export default function AdminReportsPage() {
  return (
    <AdminPanelShell title="Management Strategy Panel" subtitle="تصمیم‌گیری استراتژیک با KPI کلان، پیش‌بینی AI و عملکرد تیم فروشندگان.">
      <section className="grid gap-4 md:grid-cols-4">
        {kpis.map((item) => (
          <article key={item.title} className="admin-kpi rounded-2xl p-5">
            <p className="text-xs text-slate-400">{item.title}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
            <p className={`mt-1 text-xs ${item.trend.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'}`}>{item.trend}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="admin-card rounded-3xl p-6">
          <h2 className="admin-title text-xl text-white">Forecast vs Actual (30d + 7d)</h2>
          <p className="mt-2 text-sm text-slate-300">خط پررنگ: داده واقعی • خط چین: پیش‌بینی AI • ناحیه روشن: فاصله اطمینان</p>
          <svg viewBox="0 0 640 220" className="mt-4 w-full rounded-2xl bg-black/20 p-2">
            <polyline fill="none" stroke="#22c55e" strokeWidth="3" points="0,170 80,150 140,132 220,118 300,96 380,105 460,87 540,72 620,64" />
            <polyline fill="none" stroke="#8b5cf6" strokeDasharray="6 6" strokeWidth="3" points="460,87 500,80 540,76 580,70 620,66" />
            <polygon points="460,75 500,66 540,64 580,60 620,58 620,76 580,82 540,89 500,95 460,101" fill="rgba(139,92,246,0.18)" />
          </svg>
        </div>

        <div className="admin-card rounded-3xl p-6">
          <h2 className="admin-title text-xl text-white">Financial Pulse</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">Revenue: 421B</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">Cost: 188B</div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-300">Profit: 233B</div>
          </div>
        </div>
      </section>

      <section className="mt-6 admin-card rounded-3xl p-6">
        <h2 className="admin-title text-xl text-white">Vendor Performance Table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-slate-300">
                <th className="px-3 py-2 text-right">رتبه</th>
                <th className="px-3 py-2 text-right">فروشنده</th>
                <th className="px-3 py-2 text-right">فروش</th>
                <th className="px-3 py-2 text-right">بازدید</th>
                <th className="px-3 py-2 text-right">نرخ تبدیل</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((row) => (
                <tr key={row.name} className="border-t border-white/10 text-slate-200">
                  <td className="px-3 py-3">{row.rank}</td>
                  <td className="px-3 py-3">{row.name}</td>
                  <td className="px-3 py-3">{row.sales}</td>
                  <td className="px-3 py-3">{row.visits}</td>
                  <td className="px-3 py-3">{row.cv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPanelShell>
  );
}
