import { VendorShell } from '../../components/VendorShell';

export default function VendorSettingsPage() {
  return (
    <VendorShell title="تنظیمات فروشگاه" subtitle="پیکربندی اعلان، حمل و نقل و اطلاعات حساب فروشنده.">
      <section className="vendor-grid cols-2">
        <article className="vendor-card vendor-item">
          <h2>عملیات</h2>
          <p className="vendor-muted">فعال سازی اعلان سفارش جدید</p>
          <input type="checkbox" defaultChecked />
        </article>
        <article className="vendor-card vendor-item">
          <h2>مالی</h2>
          <p className="vendor-muted">تسویه خودکار هفتگی</p>
          <input type="checkbox" defaultChecked />
        </article>
      </section>
    </VendorShell>
  );
}
