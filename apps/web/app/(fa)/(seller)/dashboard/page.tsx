import { Button, Container, GlassCard, KpiCard, Pill, ProgressBar, SectionTitle } from "@/components/ui";

const insights = [
  {
    title: "افزایش تقاضای موبایل پرچم‌دار",
    body: "مدل پیش‌بینی نشان می‌دهد تقاضا در ۷ روز آینده ۱۸٪ رشد دارد. تامین موجودی توصیه می‌شود.",
  },
  {
    title: "بهینه‌سازی قیمت",
    body: "بازه قیمت بهینه برای حفظ نرخ تبدیل: 28.9M تا 31.4M ریال.",
  },
  {
    title: "ریسک موجودی",
    body: "۲ SKU پرفروش در آستانه اتمام موجودی هستند. هشدار سطح اضطراری فعال شد.",
  },
];

const inventory = [
  { name: "Galaxy Ultra 5G", status: "ایمن", level: "74%" },
  { name: "Aero XR Headset", status: "هشدار", level: "29%" },
  { name: "Nova Camera Pro", status: "بحرانی", level: "12%" },
];

export default function SellerDashboardPage() {
  return (
    <div className="min-h-screen">
      <Container className="space-y-10 py-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Pill>Seller Command Center</Pill>
            <SectionTitle className="text-3xl text-white">داشبورد فروشنده</SectionTitle>
            <p className="text-sm text-slate-300">
              تصمیم‌گیری سریع با داده‌های واقعی، هوش مصنوعی روی دستگاه و مانیتورینگ لحظه‌ای.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>افزودن محصول جدید</Button>
            <Button variant="outline">درخواست تحلیل AI</Button>
            <Button variant="ghost">دانلود گزارش هفتگی</Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          <KpiCard label="فروش امروز" value="3.8B ریال" trend="+12% نسبت به دیروز" />
          <KpiCard label="سفارش‌های فعال" value="146" trend="میانگین زمان پردازش 18 دقیقه" />
          <KpiCard label="نرخ تبدیل" value="2.4%" trend="+0.3% این هفته" />
          <KpiCard label="امتیاز رضایت" value="4.7/5" trend="+0.1 نسبت به ماه قبل" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard className="rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <SectionTitle className="text-xl text-white">نبض فروش</SectionTitle>
              <span className="text-xs text-slate-400">به‌روزرسانی 5 دقیقه پیش</span>
            </div>
            <div className="mt-6 space-y-4">
              <ProgressBar label="وب‌سایت" value={72} meta="72% از فروش" />
              <ProgressBar label="اپلیکیشن" value={54} meta="54% از فروش" />
              <ProgressBar label="AR/VR" value={31} meta="31% از فروش" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { label: "سبد رها شده", value: "24" },
                { label: "بازگشت مشتریان", value: "38%" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-900/60 p-4 text-sm text-slate-200">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="rounded-3xl p-6">
            <SectionTitle className="text-xl text-white">بینش‌های هوشمند</SectionTitle>
            <div className="mt-4 space-y-3">
              {insights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-xs text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard className="rounded-3xl p-6">
            <SectionTitle className="text-xl text-white">سلامت موجودی</SectionTitle>
            <div className="mt-4 space-y-3">
              {inventory.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-4 py-3 text-sm">
                  <div>
                    <p className="text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-400">سطح موجودی: {item.level}</p>
                  </div>
                  <span
                    className={`text-xs ${
                      item.status === "ایمن"
                        ? "text-emerald-300"
                        : item.status === "هشدار"
                          ? "text-amber-300"
                          : "text-rose-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="rounded-3xl p-6">
            <SectionTitle className="text-xl text-white">استودیو تجربه AR</SectionTitle>
            <p className="mt-2 text-sm text-slate-300">
              مدل‌های سه‌بعدی جدید را بارگذاری کنید و نرخ تعامل را با نمایش واقعیت افزوده افزایش دهید.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "مدل‌های آماده", value: "18" },
                { label: "در صف پردازش", value: "4" },
                { label: "بازدید AR امروز", value: "2,140" },
                { label: "نرخ تعامل AR", value: "+26%" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-900/60 p-4 text-sm text-slate-200">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button>افزودن مدل جدید</Button>
              <Button variant="outline">مشاهده عملکرد AR</Button>
            </div>
          </GlassCard>
        </section>
      </Container>
    </div>
  );
}
