import { Button } from '../components/ui/button';

export default function AdminHomePage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="admin-card rounded-3xl p-8">
          <p className="text-xs text-slate-300">Admin Control Center</p>
          <h1 className="admin-title mt-2 text-3xl text-white">پنل مدیریتی NextGen</h1>
          <p className="mt-3 text-sm text-slate-300">
            مانیتورینگ لحظه‌ای فروش، سلامت سیستم و بینش‌های هوش مصنوعی در یک نگاه.
          </p>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {[
            { label: 'سفارش‌های امروز', value: '1,284' },
            { label: 'درآمد روزانه', value: '38.2B ریال' },
            { label: 'هشدارهای فعال', value: '3' },
          ].map((item) => (
            <div key={item.label} className="admin-card rounded-2xl p-6">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="admin-card rounded-3xl p-6">
            <h2 className="admin-title text-xl text-white">سلامت سرویس‌ها</h2>
            <div className="mt-4 space-y-3">
              {['API Gateway', 'AI Search', 'AR Storage'].map((service) => (
                <div key={service} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm">
                  <span className="text-slate-200">{service}</span>
                  <span className="text-emerald-300">Healthy</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card rounded-3xl p-6">
            <h2 className="admin-title text-xl text-white">سیگنال‌های هوشمند</h2>
            <p className="mt-3 text-sm text-slate-300">
              سیستم پیشنهاد می‌دهد موجودی کالاهای پرتقا‌ضا را افزایش دهید و قیمت‌ها را بهینه کنید.
            </p>
            <div className="mt-6 max-w-xs">
              <Button loading={false}>مشاهده گزارش کامل</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
