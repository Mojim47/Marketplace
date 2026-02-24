import { VendorShell } from '../../components/VendorShell';

export default function VendorDashboardPage() {
  return (
    <VendorShell
      title="داشبورد فروشنده"
      subtitle="مینیمالیسم عملیاتی برای سرعت تصمیم‌گیری، کنترل سود و اجرای سریع سفارش."
    >
      <section className="vendor-grid cols-3">
        {[
          { label: 'فروش امروز', value: '96.4M ریال' },
          { label: 'نرخ تبدیل', value: '3.9%' },
          { label: 'سفارش جدید', value: '42' },
        ].map((item) => (
          <article key={item.label} className="vendor-card vendor-item">
            <div className="vendor-muted">{item.label}</div>
            <p className="vendor-kpi">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="vendor-grid cols-3">
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">آمار فروش</div>
          <p className="vendor-kpi">+14.2%</p>
          <p className="vendor-muted">نسبت به دیروز</p>
        </article>
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">پرفروش‌ها</div>
          {[
            ['Galaxy Ultra 5G', 92],
            ['Nova Camera Pro', 81],
            ['Smart Home Hub', 74],
          ].map(([name, pct]) => (
            <div key={name} className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span>{name}</span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </article>
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">هشدارهای فوری</div>
          <div className="mt-3 space-y-2 text-sm">
            <p className="vendor-status warning">Aero XR Headset: موجودی رو به اتمام</p>
            <p className="vendor-status info">2 سفارش بیش از 20 دقیقه در انتظار</p>
            <p className="vendor-status success">تسویه روزانه موفق انجام شد</p>
          </div>
        </article>
      </section>
    </VendorShell>
  );
}
