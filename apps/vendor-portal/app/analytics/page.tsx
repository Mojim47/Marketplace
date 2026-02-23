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
    </VendorShell>
  );
}
