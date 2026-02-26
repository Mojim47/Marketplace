import { AdminPanelShell } from '@/components/AdminPanelShell';

export default function AdminSettingsPage() {
  return (
    <AdminPanelShell
      title="تنظیمات سیستم"
      subtitle="مدیریت تنظیمات محیط، امنیت و اعلان های سازمانی."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="admin-card rounded-3xl p-6">
          <h2 className="admin-title text-xl text-white">تنظیمات عمومی</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <label className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span>فعال سازی نگهداری روزانه</span>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span>اعلان لحظه ای رخدادها</span>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </section>

        <section className="admin-card rounded-3xl p-6">
          <h2 className="admin-title text-xl text-white">امنیت</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <label className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span>اجباری بودن MFA برای مدیران</span>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span>ثبت کامل Audit Log</span>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </section>
      </div>
    </AdminPanelShell>
  );
}
