import { VendorShell } from '../../components/VendorShell';

const orders = [
  { id: 'NX-3001', customer: 'علی رضایی', amount: '12,400,000', status: 'در حال پردازش' },
  { id: 'NX-3002', customer: 'مینا نوری', amount: '7,900,000', status: 'ارسال شده' },
  { id: 'NX-3003', customer: 'رامین پاکدل', amount: '23,700,000', status: 'در انتظار تایید' },
];

export default function VendorOrdersPage() {
  return (
    <VendorShell title="سفارش ها" subtitle="پیگیری سفارش های جدید، در حال ارسال و تکمیل شده.">
      <section className="vendor-grid">
        {orders.map((order) => (
          <article key={order.id} className="vendor-card vendor-item">
            <h2>{order.id}</h2>
            <p className="vendor-muted">مشتری: {order.customer}</p>
            <p className="vendor-muted">مبلغ: {order.amount} ریال</p>
            <p className="vendor-muted">وضعیت: {order.status}</p>
          </article>
        ))}
      </section>
    </VendorShell>
  );
}
