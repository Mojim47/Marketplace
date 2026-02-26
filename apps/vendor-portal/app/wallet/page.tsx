import { VendorShell } from '../../components/VendorShell';

export default function VendorWalletPage() {
  return (
    <VendorShell title="کیف پول" subtitle="وضعیت موجودی، تسویه ها و برداشت های دوره ای.">
      <section className="vendor-grid cols-2">
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">موجودی قابل برداشت</div>
          <p className="vendor-kpi">158,000,000 ریال</p>
        </article>
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">تسویه در انتظار</div>
          <p className="vendor-kpi">42,700,000 ریال</p>
        </article>
      </section>
    </VendorShell>
  );
}
