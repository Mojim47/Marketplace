import { Container, GlassCard, Pill, SectionTitle } from '@/components/ui';
import Link from 'next/link';

const values = [
  {
    title: 'اعتمادپذیری زیرساخت',
    body: 'معماری سرویس ها با رویکرد پایداری، رصدپذیری و قابلیت استقرار مستمر طراحی شده است.',
  },
  {
    title: 'تجربه خرید هوشمند',
    body: 'از جستجوی معنایی تا پیشنهاددهی لحظه ای، تجربه کاربر با داده واقعی و نه داده مصنوعی بهینه می شود.',
  },
  {
    title: 'همکاری برد-برد',
    body: 'ابزارهای فروشنده و پنل مدیریتی برای رشد همزمان مشتری، فروشنده و اپراتور یکپارچه شده اند.',
  },
];

export default function AboutPage() {
  return (
    <Container className="py-12">
      <div className="flex flex-wrap gap-3">
        <Pill>درباره ما</Pill>
        <Pill>ماموریت محصول</Pill>
        <Pill>Production Ready</Pill>
      </div>

      <header className="mt-6 rounded-3xl border border-slate-200 bg-white p-8">
        <SectionTitle className="text-3xl text-slate-900">داستان AIMarket</SectionTitle>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          ما یک مارکت‌پلیس نسل جدید ساخته ایم که همزمان نیاز مشتری، فروشنده و تیم عملیات را پوشش می
          دهد. هدف ما ایجاد یک پلتفرم سریع، امن و قابل توسعه برای تجارت مدرن است.
        </p>
        <div className="mt-6">
          <Link
            href="/categories"
            className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-5 py-2 text-sm text-slate-800 transition hover:border-orange-300 hover:text-orange-700"
          >
            مشاهده دسته بندی ها
          </Link>
        </div>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-3">
        {values.map((item) => (
          <GlassCard key={item.title} className="rounded-3xl p-6">
            <h2 className="section-title text-xl text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
          </GlassCard>
        ))}
      </section>
    </Container>
  );
}
