import { Button, Container, GlassCard, KpiCard, Pill, SectionTitle } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Container className="py-16 lg:py-24">
        <header className="flex flex-col gap-10">
          <div className="flex flex-wrap gap-3">
            <Pill>تجارت هوشمند AI + AR</Pill>
            <Pill>پردازش روي دستگاه</Pill>
            <Pill>استاندارد سازماني</Pill>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-6">
              <h1 className="section-title text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                بازار نسل بعد با تجربه‌اي فراتر از ترندهاي امروز
              </h1>
              <p className="text-base leading-7 text-[color:var(--ink-muted)] sm:text-lg">
                NextGen Marketplace تجربه‌اي يکپارچه از جست‌وجوي هوشمند، پيشنهاددهي دقيق، و نمايش
                واقعيت افزوده را با تکيه بر قدرت دستگاه کاربر ارائه مي‌کند.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button loading={false}>شروع تجربه هوشمند</Button>
                <Button loading={false} variant="outline">
                  مشاهده نمونه‌ها
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <KpiCard label="افزايش تعامل" value="+42%" className="text-center" />
                <KpiCard label="نرخ تبديل" value="1.6x" className="text-center" />
                <KpiCard label="پاسخ جست‌وجو" value="98ms" className="text-center" />
              </div>
            </div>

            <GlassCard className="rounded-3xl p-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>AI Search Live</span>
                  <span className="text-emerald-300">Online</span>
                </div>
                <div className="rounded-2xl bg-slate-900/60 p-4">
                  <p className="text-sm text-slate-200">"گوشي پرچم‌دار با دوربين حرفه‌اي"</p>
                  <div className="mt-4 space-y-2">
                    {[
                      { name: 'Galaxy Ultra 5G', score: 'شباهت 93%' },
                      { name: 'iPhone Pro Max', score: 'شباهت 89%' },
                      { name: 'Xperia Camera', score: 'شباهت 82%' },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-200"
                      >
                        <span>{item.name}</span>
                        <span>{item.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-white/20 p-4 text-xs text-slate-300">
                  رتبه‌بندي معنايي با Embedding واقعي و بدون هرگونه داده‌سازي مصنوعي انجام مي‌شود.
                </div>
              </div>
            </GlassCard>
          </div>
        </header>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: 'هوش تصميم‌ساز',
              desc: 'مدل‌هاي پيش‌بيني تقاضا و پيشنهاددهي که رفتار مشتري را در لحظه تحليل مي‌کنند.',
            },
            {
              title: 'AR واقعي',
              desc: 'نمايش محصولات در فضاي واقعي با WebXR و پشتيباني کامل iOS/Android.',
            },
            {
              title: 'حريم داده',
              desc: 'پردازش محلي و امن داده‌ها بدون ارسال اطلاعات حساس به سرويس‌هاي خارجي.',
            },
          ].map((item) => (
            <GlassCard key={item.title} className="rounded-3xl p-6">
              <SectionTitle className="text-xl text-white">{item.title}</SectionTitle>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.desc}</p>
            </GlassCard>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-slate-900/60 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <SectionTitle className="text-3xl text-white">اکوسيستم يکپارچه فروشنده</SectionTitle>
              <p className="mt-2 text-sm text-slate-300">
                داشبورد فروشنده با پيش‌بيني فروش، پيشنهاد قيمت، و هشدارهاي هوشمند.
              </p>
            </div>
            <Button loading={false} variant="ghost">
              درخواست دموي سازماني
            </Button>
          </div>
        </section>
      </Container>
    </div>
  );
}
