import { VendorShell } from '../../components/VendorShell';

const insights = [
  { title: 'پرفروش ترین دسته', value: 'موبایل و تبلت' },
  { title: 'بهترین ساعت فروش', value: '20:00 - 22:00' },
  { title: 'نرخ بازگشت مشتری', value: '32%' },
];

export default function VendorAnalyticsPage() {
  return (
    <VendorShell title="تحلیل فروش" subtitle="بینش داده ای برای تصمیم گیری سریع و دقیق.">
      <section className="vendor-grid cols-3">
        {insights.map((item) => (
          <article key={item.title} className="vendor-card vendor-item">
            <div className="vendor-muted">{item.title}</div>
            <p className="vendor-kpi">{item.value}</p>
          </article>
        ))}
      </section>
      <section className="vendor-card vendor-item">
        <div className="vendor-muted">پیش‌بینی AI (۷ روز آینده)</div>
        <svg viewBox="0 0 620 210" className="mt-3 w-full rounded-xl bg-slate-50 p-2">
          <polyline fill="none" stroke="#3b82f6" strokeWidth="3" points="10,170 90,155 170,145 250,126 330,119 410,101 490,94 610,85" />
          <polyline fill="none" stroke="#10b981" strokeDasharray="6 6" strokeWidth="3" points="410,101 450,98 490,94 550,88 610,81" />
        </svg>
      </section>
    </VendorShell>
  );
}
