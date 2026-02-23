import { VendorShell } from '../components/VendorShell';

export default function VendorPortalHome() {
  return (
    <VendorShell
      title="پنل فروشندگان NextGen"
      subtitle="مدیریت فروش، موجودی و عملکرد فروشگاه از یک داشبورد یکپارچه."
    >
      <section className="vendor-grid cols-3">
        {[
          { label: 'فروش امروز', value: '84,500,000 ریال' },
          { label: 'سفارش جدید', value: '27' },
          { label: 'کالای کم موجود', value: '9' },
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
