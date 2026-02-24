import { VendorShell } from '../../components/VendorShell';

const products = [
  { name: 'Galaxy Ultra 5G', sku: 'NX-ULTRA-5G', stock: 33, price: '29,800,000' },
  { name: 'Xperia Camera', sku: 'NX-XP-CAM', stock: 17, price: '17,600,000' },
  { name: 'Smart Home Hub', sku: 'NX-HOME-HUB', stock: 45, price: '8,200,000' },
];

export default function VendorProductsPage() {
  return (
    <VendorShell title="محصولات" subtitle="مدیریت موجودی، قیمت و انتشار محصولات فروشگاه.">
      <section className="vendor-card vendor-item">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="vendor-muted">Bulk Actions</p>
          <div className="flex gap-2">
            <button type="button" className="vendor-status info">به‌روزرسانی قیمت</button>
            <button type="button" className="vendor-status warning">کاهش موجودی</button>
            <button type="button" className="vendor-status success">انتشار دسته‌ای</button>
          </div>
        </div>
      </section>

      <section className="vendor-grid cols-3">
        {products.map((product) => (
          <article key={product.sku} className="vendor-card vendor-item">
            <div className="flex items-start justify-between gap-2">
              <h2>{product.name}</h2>
              <input type="checkbox" aria-label={`select-${product.sku}`} />
            </div>
            <p className="vendor-muted">{product.sku}</p>
            <p className="vendor-muted mt-2">موجودی (ویرایش درجا): {product.stock}</p>
            <p className="vendor-muted">قیمت (ویرایش درجا): {product.price} ریال</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="vendor-status info">ویرایش</button>
              <button type="button" className="vendor-status success">انتشار</button>
            </div>
          </article>
        ))}
      </section>
    </VendorShell>
  );
}
