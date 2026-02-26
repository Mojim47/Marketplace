import { AdminPanelShell } from '@/components/AdminPanelShell';

const categories = [
  { name: 'موبایل و تبلت', count: 1240 },
  { name: 'لپ تاپ و کامپیوتر', count: 860 },
  { name: 'خانه هوشمند', count: 530 },
  { name: 'گیمینگ', count: 295 },
];

export default function AdminCategoriesPage() {
  return (
    <AdminPanelShell
      title="مدیریت دسته بندی"
      subtitle="ساختار گروه بندی محصولات برای تجربه خرید دقیق و سریع."
    >
      <div className="admin-card rounded-3xl p-6">
        <div className="grid gap-3 md:grid-cols-2">
          {categories.map((category) => (
            <div key={category.name} className="rounded-xl bg-white/5 px-4 py-3">
              <p className="text-sm text-white">{category.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {category.count.toLocaleString('fa-IR')} کالا
              </p>
            </div>
          ))}
        </div>
      </div>
    </AdminPanelShell>
  );
}
