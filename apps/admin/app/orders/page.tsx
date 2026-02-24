import { AdminPanelShell } from '@/components/AdminPanelShell';

const orders = [
  { id: 'NX-3001', buyer: 'محسن کاظمی', amount: '12,400,000', status: 'Processing' },
  { id: 'NX-3002', buyer: 'ریحانه زمانی', amount: '8,900,000', status: 'Delivered' },
  { id: 'NX-3003', buyer: 'مهدی شکری', amount: '23,700,000', status: 'Pending Review' },
];

export default function AdminOrdersPage() {
  return (
    <AdminPanelShell
      title="مدیریت سفارش ها"
      subtitle="رصد وضعیت سفارش، پرداخت و ارسال در یک نمای یکپارچه."
    >
      <div className="admin-card rounded-3xl p-6">
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
            >
              <div>
                <p className="text-sm text-white">{order.id}</p>
                <p className="text-xs text-slate-400">{order.buyer}</p>
              </div>
              <p className="text-sm text-slate-200">{order.amount} ریال</p>
              <span className="text-xs text-slate-300">{order.status}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminPanelShell>
  );
}
