import { AdminPanelShell } from '@/components/AdminPanelShell';

const users = [
  { name: 'علی رضایی', email: 'ali@example.com', status: 'Active' },
  { name: 'نرگس محمدی', email: 'narges@example.com', status: 'Suspended' },
  { name: 'حسین احمدی', email: 'hossein@example.com', status: 'Active' },
];

export default function AdminUsersPage() {
  return (
    <AdminPanelShell title="مدیریت کاربران" subtitle="لیست کاربران، وضعیت دسترسی و کنترل عملیات حساب.">
      <div className="admin-card rounded-3xl p-6">
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.email} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm text-white">{user.name}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <span className="text-xs text-slate-200">{user.status}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminPanelShell>
  );
}
