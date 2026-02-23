import { AdminPanelShell } from '@/components/AdminPanelShell';

const products = [
  { name: 'Galaxy Ultra 5G', sku: 'NX-ULTRA-5G', stock: 33 },
  { name: 'Xperia Camera', sku: 'NX-XP-CAM', stock: 17 },
  { name: 'Smart Home Hub', sku: 'NX-HOME-HUB', stock: 45 },
];

export default function AdminProductsPage() {
  return (
    <AdminPanelShell title="مدیریت محصولات" subtitle="مدیریت موجودی، SKU و وضعیت انتشار کالاها.">
      <div className="grid gap-4 md:grid-cols-3">
        {products.map((product) => (
          <article key={product.sku} className="admin-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white">{product.name}</h2>
            <p className="mt-2 text-xs text-slate-400">{product.sku}</p>
            <p className="mt-3 text-sm text-slate-200">موجودی: {product.stock}</p>
          </article>
        ))}
      </div>
    </AdminPanelShell>
  );
}
