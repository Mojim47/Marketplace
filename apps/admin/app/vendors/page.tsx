import { AdminPanelShell } from '@/components/AdminPanelShell';

const vendors = [
  { store: 'TechHub', tier: 'Gold', score: '98/100' },
  { store: 'SmartHomeX', tier: 'Silver', score: '91/100' },
  { store: 'AudioPro', tier: 'Bronze', score: '86/100' },
];

export default function AdminVendorsPage() {
  return (
    <AdminPanelShell title="مدیریت فروشندگان" subtitle="کنترل عملکرد فروشندگان و وضعیت همکاری.">
      <div className="grid gap-4 md:grid-cols-3">
        {vendors.map((vendor) => (
          <article key={vendor.store} className="admin-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white">{vendor.store}</h2>
            <p className="mt-2 text-sm text-slate-300">Tier: {vendor.tier}</p>
            <p className="mt-1 text-sm text-slate-300">Quality Score: {vendor.score}</p>
          </article>
        ))}
      </div>
    </AdminPanelShell>
  );
}
