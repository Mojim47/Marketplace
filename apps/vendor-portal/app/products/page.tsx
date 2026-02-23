import { VendorShell } from '../../components/VendorShell';

const products = [
  { name: 'Galaxy Ultra 5G', sku: 'NX-ULTRA-5G', stock: 33 },
  { name: 'Xperia Camera', sku: 'NX-XP-CAM', stock: 17 },
  { name: 'Smart Home Hub', sku: 'NX-HOME-HUB', stock: 45 },
];

export default function VendorProductsPage() {
  return (
    <VendorShell title="محصولات" subtitle="مدیریت موجودی، قیمت و انتشار محصولات فروشگاه.">
      <section className="vendor-grid cols-3">
        {products.map((product) => (
          <article key={product.sku} className="vendor-card vendor-item">
            <h2>{product.name}</h2>
            <p className="vendor-muted">{product.sku}</p>
            <p className="vendor-muted">موجودی: {product.stock}</p>
          </article>
        ))}
      </section>
    </VendorShell>
  );
}
