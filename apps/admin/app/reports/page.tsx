import { AdminPanelShell } from '@/components/AdminPanelShell';

const reports = [
  { title: 'گزارش فروش روزانه', status: 'Ready' },
  { title: 'تحلیل رفتار مشتری', status: 'Running' },
  { title: 'کارایی کمپین ها', status: 'Ready' },
];

export default function AdminReportsPage() {
  return (
    <AdminPanelShell title="گزارش ها" subtitle="گزارش های تحلیلی برای تصمیم گیری عملیاتی و مالی.">
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map((report) => (
          <article key={report.title} className="admin-card rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white">{report.title}</h2>
            <p className="mt-3 text-sm text-slate-300">Status: {report.status}</p>
          </article>
        ))}
      </div>
    </AdminPanelShell>
  );
}
