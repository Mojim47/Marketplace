import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpLeft, Boxes, Brain, Gauge, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { CampaignCarousel } from '@/components/campaign-carousel';
import { HeroCard } from '@/components/hero-card';
import { CATALOG_PRODUCTS } from '@/lib/catalog-data';
import { l1Categories } from '@/lib/aimarket-taxonomy';
import {
  BentoFeatureGrid,
  Button,
  Container,
  GlassCard,
  KpiCard,
  MetricRing,
  OrbitalBadge,
  Pill,
  ProgressBar,
  SectionTitle,
} from '@/components/ui';

const spotlightProducts = CATALOG_PRODUCTS;
const money = new Intl.NumberFormat('fa-IR');

const workflow = [
  {
    title: '۱) کشف نیاز',
    desc: 'کاربر با جست وجوی معنایی، نیاز واقعی را به محصول قابل خرید تبدیل می کند.',
    metric: 'Precision 91%',
  },
  {
    title: '۲) ارزیابی AR',
    desc: 'نمایش محصول در محیط واقعی با Guardrail کیفیت، پیش از پرداخت.',
    metric: 'AR Pass 97%',
  },
  {
    title: '۳) تسویه و تحویل',
    desc: 'Checkout امن، ضد تکرار، و پیگیری سفارش تا تحویل نهایی.',
    metric: 'Success 99.4%',
  },
];

const heroCampaigns = [
  { title: 'کمپین نوروز 2026', subtitle: 'تخفیف پلکانی + ارسال سریع', href: '/categories?campaign=norooz-2026' },
  { title: 'AI Gadget Week', subtitle: 'پیشنهاد شخصی‌سازی شده براساس رفتار خرید', href: '/categories?campaign=ai-week' },
  { title: 'عرضه ویژه فروشنده ها', subtitle: 'فعال‌سازی فروش + داشبورد آنی', href: '/auth/register?as=seller' },
];

const userPanelItems = [
  { label: 'سفارش‌های باز', value: '3', hint: 'آخرین بروزرسانی 5 دقیقه قبل' },
  { label: 'کوپن فعال', value: '2', hint: 'اعتبار تا پایان هفته' },
  { label: 'پیام پشتیبانی', value: '1', hint: 'پاسخ کمتر از 10 دقیقه' },
];

const intelligence = [
  { label: 'دقت پیش بینی تقاضا', value: 88, meta: 'هفته جاری' },
  { label: 'پایداری موجودی', value: 81, meta: 'در 12 انبار' },
  { label: 'سرعت پاسخ جست وجو', value: 94, meta: 'P95 < 120ms' },
];

const smartCategories = l1Categories.map((category, index) => ({
  title: category.name,
  hint: index === 0 ? 'Trending' : index === 1 ? 'AI Recommended' : index === 2 ? 'Top Rated' : 'Fast Discovery',
  href: `/categories?group=${encodeURIComponent(category.slug)}`,
}));

const featuredSellers = [
  { name: 'Nova Devices', rating: '4.9', response: '< 5m', badge: 'Elite Seller' },
  { name: 'Orion Tech', rating: '4.8', response: '< 9m', badge: 'Fast Response' },
  { name: 'Pulse Market', rating: '4.7', response: '< 12m', badge: 'Trusted' },
];

const experienceMetrics = [
  { label: 'A11y Compliance', value: 98, hint: 'WCAG AA + Keyboard', tone: 'emerald' as const },
  { label: 'UI Response Health', value: 94, hint: 'Interaction < 200ms', tone: 'cyan' as const },
  { label: 'Visual Stability', value: 91, hint: 'Regression Guarded', tone: 'amber' as const },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Container className="py-14 lg:py-20">
        <header className="space-y-8">
          <div className="flex flex-wrap gap-3">
            <Pill>Alibaba-style Layout</Pill>
            <Pill>نسخه 2026</Pill>
            <Pill>جستجوی اولویت‌دار</Pill>
          </div>

          <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[0.9fr_1.55fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="دسته‌بندی‌ها">
              <p className="text-xs text-orange-600">Categories</p>
              <h2 className="section-title mt-2 text-xl text-slate-900">کشف سریع L1/L2/L3</h2>
              <div className="mt-4 space-y-2">
                {l1Categories.slice(0, 4).map((category) => (
                  <div key={category.slug} className="rounded-xl border border-slate-200 bg-white p-3">
                    <Link href={`/categories?group=${encodeURIComponent(category.slug)}`} className="text-sm text-slate-800 hover:text-orange-600">
                      {category.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(category.children ?? []).slice(0, 2).map((sub) => (
                        <Link
                          key={sub.slug}
                          href={`/categories?group=${encodeURIComponent(category.slug)}&level=${encodeURIComponent(sub.slug)}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:text-orange-600"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5">
              <p className="text-xs text-orange-600">Campaign Control Center</p>
              <h2 className="section-title mt-2 text-3xl text-slate-900">Hero سه‌ستونه AIMarket</h2>
              <p className="mt-2 text-sm text-slate-600">چیدمان شبیه Alibaba: دسته‌بندی + کمپین + پنل کاربر در بالای صفحه.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {heroCampaigns.map((campaign) => (
                  <Link key={campaign.title} href={campaign.href} className="rounded-2xl border border-orange-200 bg-white p-3 transition hover:-translate-y-1 hover:border-orange-400">
                    <p className="text-xs text-orange-700">{campaign.title}</p>
                    <p className="mt-2 text-xs text-slate-600">{campaign.subtitle}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="پنل کاربر">
              <p className="text-xs text-orange-600">پنل کاربر</p>
              <h2 className="section-title mt-2 text-xl text-slate-900">وضعیت لحظه‌ای حساب</h2>
              <div className="mt-4 space-y-3">
                {userPanelItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">{item.label}</p>
                      <strong className="text-slate-900">{item.value}</strong>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{item.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                <Link href="/auth/login" className="btn btn-outline inline-flex items-center justify-center">ورود</Link>
                <Link href="/orders" className="btn btn-primary inline-flex items-center justify-center">پیگیری سفارش</Link>
              </div>
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="space-y-6">
              <h1 className="section-title text-4xl leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
                بازار خرید هوشمند
                <br />
                برای مشتری حرفه ای و فروشنده جدی
              </h1>

              <p className="max-w-2xl text-base leading-8 text-[color:var(--ink-muted)] sm:text-lg">
                AIMarket یک تجربه کامل محصولی است: کشف، مقایسه، مشاهده در AR،
                خرید امن و عملیات پایدار. همه چیز برای تبدیل واقعی طراحی شده، نه فقط ظاهر.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/categories" className="btn btn-primary inline-flex items-center gap-2">
                  شروع خرید هوشمند
                  <ArrowUpLeft size={16} />
                </Link>
                <Link href="/about" className="btn btn-outline inline-flex items-center gap-2">
                  مشاهده معماری محصول
                </Link>
                <Button loading={false} variant="ghost">
                  درخواست دمو سازمانی
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="نرخ تبدیل" value="+41%" trend="در مقایسه با فصل قبل" />
                <KpiCard label="تاخیر Checkout" value="184ms" trend="P95 در اوج ترافیک" />
                <KpiCard label="دقت پیشنهاد" value="89.7%" trend="براساس رفتار واقعی کاربر" />
              </div>
            </div>

            <GlassCard className="rounded-3xl p-6">
              <SectionTitle className="text-xl text-white">اتاق فرمان عملیات</SectionTitle>
              <p className="mt-2 text-sm text-slate-300">
                وضعیت زنده موتور قیمت گذاری، موجودی و سلامت سرویس ها در یک نما.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Gauge size={15} /> سلامت سرویس ها
                    </span>
                    <strong className="text-emerald-300">Operational</strong>
                  </div>
                  <ProgressBar label="API" value={99} meta="99.95%" />
                  <ProgressBar className="mt-3" label="Search" value={95} meta="P95 112ms" />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Brain size={15} /> AI Decision Engine
                    </span>
                    <strong className="text-cyan-300">Live</strong>
                  </div>
                  {intelligence.map((item) => (
                    <ProgressBar
                      key={item.label}
                      className="mt-3 first:mt-0"
                      label={item.label}
                      meta={item.meta}
                      value={item.value}
                    />
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </header>

        <section className="mt-12">
          <HeroCard />
        </section>

        <section className="mt-14">
          <CampaignCarousel />
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassCard className="rounded-3xl p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <SectionTitle className="text-3xl text-white">Experience Layer 2026</SectionTitle>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                Elite Patterns
              </span>
            </div>
            <BentoFeatureGrid />
          </GlassCard>

          <div className="grid gap-4">
            <GlassCard className="rounded-3xl p-6">
              <SectionTitle className="text-xl text-white">شاخص های کیفیت تجربه</SectionTitle>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {experienceMetrics.map((metric) => (
                  <MetricRing
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.hint}
                    tone={metric.tone}
                  />
                ))}
              </div>
            </GlassCard>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <OrbitalBadge
                icon={<Brain size={18} />}
                title="AI Personalization"
                subtitle="پیشنهادهای پویا براساس سیگنال خرید، رفتار مرور و سبد جاری."
              />
              <OrbitalBadge
                icon={<ShieldCheck size={18} />}
                title="Trust by Default"
                subtitle="تمام اجزای مسیر خرید با guardهای امنیتی و فیدبک واضح پوشش داده شده‌اند."
              />
              <OrbitalBadge
                icon={<Layers3 size={18} />}
                title="Scalable Surface"
                subtitle="کامپوننت‌ها به صورت ماژولار برای رشد مسیرهای محصولی بعدی آماده هستند."
              />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-center justify-between gap-4">
            <SectionTitle className="text-3xl text-white">دسته بندی هوشمند</SectionTitle>
            <Link href="/categories" className="text-sm text-cyan-300 hover:text-cyan-200">
              مدیریت همه دسته ها
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {smartCategories.map((item) => (
              <Link key={item.title} href={item.href}>
                <GlassCard className="group rounded-3xl p-5 transition duration-200 hover:-translate-y-1 hover:border-cyan-300/30">
                  <p className="text-xs text-cyan-200">{item.hint}</p>
                  <h3 className="section-title mt-2 text-2xl text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-slate-300">کشف سریع محصولات متناسب با قصد خرید کاربر.</p>
                  <span className="mt-4 inline-flex text-xs text-cyan-300">ورود به دسته بندی</span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-center justify-between gap-4">
            <SectionTitle className="text-3xl text-slate-900">Dense Product Grid</SectionTitle>
            <Link href="/categories" className="text-sm text-orange-600 hover:text-orange-700">
              مشاهده همه محصولات
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {spotlightProducts.map((product) => (
              <GlassCard key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <Link href={`/product/${product.slug}`} className="block">
                  <div className="relative mb-3 h-36 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <Image src={product.image} alt={product.name} fill className="object-cover" sizes="(min-width: 1024px) 18vw, 45vw" />
                  </div>
                </Link>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{product.name}</h3>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                    {product.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{product.summary}</p>
                <p className="mt-2 text-[11px] text-slate-500">Seller: {product.seller}</p>
                <p className="text-[11px] text-slate-500">MOQ: {product.minOrderQty} عدد</p>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-500">قیمت</p>
                  <p className="text-sm font-semibold text-slate-900">{money.format(product.priceIrr)} تومان</p>
                  <p className="mt-1 text-[11px] text-emerald-700">{product.eta}</p>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link href="/checkout" className="btn btn-primary inline-flex flex-1 items-center justify-center !px-2 !py-2 !text-xs">
                    خرید سریع
                  </Link>
                  <Link
                    href={`/categories?q=${encodeURIComponent(product.name)}`}
                    className="btn btn-outline inline-flex items-center justify-center !px-2 !py-2 !text-xs"
                  >
                    مقایسه
                  </Link>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {workflow.map((step) => (
            <GlassCard key={step.title} className="rounded-3xl p-6">
              <SectionTitle className="text-xl text-white">{step.title}</SectionTitle>
              <p className="mt-3 text-sm leading-6 text-slate-300">{step.desc}</p>
              <div className="mt-4 inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                {step.metric}
              </div>
            </GlassCard>
          ))}
        </section>

        <section className="mt-16 grid gap-5 lg:grid-cols-4">
          <GlassCard className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <SectionTitle className="text-2xl text-slate-900">Seller Trust Block</SectionTitle>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              این بخش دقیقاً برای تصمیم سریع خرید B2B/B2C طراحی شده: تایید هویت، زمان پاسخ، و تضمین ارسال.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Verified Supplier</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Trade Assurance</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">On-time Delivery</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Response SLA &lt; 10m</div>
            </div>
          </GlassCard>

          <GlassCard className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <SectionTitle className="text-2xl text-slate-900">فروشندگان منتخب</SectionTitle>
            <div className="mt-5 space-y-3">
              {featuredSellers.map((seller) => (
                <div key={seller.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-900">{seller.name}</p>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      {seller.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Rating {seller.rating} • پاسخ گویی {seller.response}</p>
                  <Link href={`/categories?seller=${encodeURIComponent(seller.name)}`} className="mt-3 inline-flex text-xs text-orange-600 hover:text-orange-700">
                    مشاهده محصولات فروشنده
                  </Link>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-slate-900/60 p-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <SectionTitle className="text-3xl text-white">زیرساخت قابل اعتماد برای مقیاس پذیری واقعی</SectionTitle>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                از لایه امنیت تا مشاهده پذیری، مسیرها با معیارهای قابل سنجش طراحی شده اند تا تیم محصول
                بتواند با اطمینان نسخه جدید منتشر کند.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Zero-trust Headers</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Idempotent Checkout</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Trace-based Monitoring</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">Fallback-safe Search</span>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="inline-flex items-center gap-2"><ShieldCheck size={16} /> امنیت تراکنش</p>
                <p className="mt-2 text-xs text-slate-300">حفاظت چندلایه، کنترل نرخ، و ممیزی کامل.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="inline-flex items-center gap-2"><Layers3 size={16} /> عملیات چندسرویسی</p>
                <p className="mt-2 text-xs text-slate-300">سلامت سرویس ها، صف ها و مسیرهای حیاتی در لحظه.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="inline-flex items-center gap-2"><Boxes size={16} /> زنجیره تامین</p>
                <p className="mt-2 text-xs text-slate-300">پیش بینی تقاضا، کنترل موجودی، و هشدار کمبود.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <p className="inline-flex items-center gap-2 text-sm text-slate-200">
              <Sparkles size={16} className="text-amber-300" />
              آماده برای رشد محصول، نه فقط دمو.
            </p>
            <div className="flex gap-2">
              <Link href="/auth/register" className="btn btn-primary inline-flex items-center justify-center">
                ایجاد حساب جدید
              </Link>
              <Link href="/orders" className="btn btn-outline inline-flex items-center justify-center">
                پیگیری سفارش
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-900/70 p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <SectionTitle className="text-3xl text-white">باشگاه خبرنامه و جامعه کاربران</SectionTitle>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                برای دریافت کمپین های اختصاصی، آپدیت های محصول و پیشنهادهای شخصی سازی شده عضو شوید.
              </p>
            </div>
            <form className="grid w-full max-w-md gap-2 sm:grid-cols-[1fr_auto]" data-error-state="false" data-empty-state="true">
              <input
                type="email"
                placeholder="email@example.com"
                className="rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                aria-label="ایمیل برای عضویت در خبرنامه"
              />
              <button type="submit" className="btn btn-primary inline-flex items-center justify-center">
                عضویت
              </button>
            </form>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            <Link href="/docs" className="rounded-full border border-white/15 px-3 py-1 hover:text-white">راهنمای حریم خصوصی</Link>
            <Link href="/terms-of-service" className="rounded-full border border-white/15 px-3 py-1 hover:text-white">شرایط استفاده</Link>
            <Link href="/privacy-policy" className="rounded-full border border-white/15 px-3 py-1 hover:text-white">سیاست داده</Link>
          </div>
        </section>
      </Container>
    </div>
  );
}
