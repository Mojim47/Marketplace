import { VendorShell } from '../../components/VendorShell';

export default function VendorDashboardPage() {
  return (
    <VendorShell
      title="داشبورد فروشنده"
      subtitle="نمای سریع از سلامت فروشگاه و عملیات روزانه."
    >
      <section className="vendor-grid cols-3">
        {[
          { label: 'بازدید امروز', value: '4,820' },
          { label: 'نرخ تبدیل', value: '3.4%' },
          { label: 'امتیاز فروشگاه', value: '4.8 / 5' },
        ].map((item) => (
          <article key={item.label} className="vendor-card vendor-item">
            <div className="vendor-muted">{item.label}</div>
            <p className="vendor-kpi">{item.value}</p>
          </article>
        ))}
      </section>
    </VendorShell>
  );
}
