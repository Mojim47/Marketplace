import { VendorShell } from '../../components/VendorShell';

const orders = [
  { id: 'NX-3001', customer: 'علی رضایی', amount: '12,400,000', status: 'در حال پردازش', timer: '00:14:18' },
  { id: 'NX-3002', customer: 'مینا نوری', amount: '7,900,000', status: 'ارسال شده', timer: '--:--:--' },
  { id: 'NX-3003', customer: 'رامین پاکدل', amount: '23,700,000', status: 'در انتظار تایید', timer: '00:05:09' },
];

export default function VendorOrdersPage() {
  return (
    <VendorShell title="سفارش ها" subtitle="پیگیری سفارش های جدید، در حال ارسال و تکمیل شده.">
      <section className="vendor-grid">
        {orders.map((order) => (
          <article key={order.id} className="vendor-card vendor-item">
            <div className="flex items-center justify-between gap-2">
              <h2>{order.id}</h2>
              <span className={order.timer.includes(':') && order.timer !== '--:--:--' ? 'vendor-status warning' : 'vendor-status info'}>
                {order.timer}
              </span>
            </div>
            <p className="vendor-muted">مشتری: {order.customer}</p>
            <p className="vendor-muted">مبلغ: {order.amount} ریال</p>
            <p className="vendor-muted">وضعیت: {order.status}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="vendor-status success">آماده ارسال</button>
              <button type="button" className="vendor-status info">جزئیات</button>
            </div>
          </article>
        ))}
      </section>
    </VendorShell>
  );
}
