import Link from 'next/link';

const promoBanners = [
  {
    title: 'Flash Deals 2026',
    subtitle: 'تخفیف‌های لحظه‌ای با ارسال سریع',
    href: '/categories?campaign=flash-deals',
  },
  { title: 'Smart Checkout', subtitle: 'تسویه امن با زمان پاسخ زیر 200ms', href: '/checkout' },
  {
    title: 'Seller Week',
    subtitle: 'مزایای ویژه فروشندگان منتخب',
    href: '/auth/register?as=seller',
  },
];

export function AuthExperiencePanel({ heading }: { heading: string }) {
  return (
    <aside className="space-y-4">
      <div className="auth-hero-shell">
        <p className="text-xs text-orange-700">AIMarket Experience</p>
        <h3 className="section-title mt-2 text-2xl text-slate-900">{heading}</h3>
        <p className="mt-2 text-sm text-slate-600">
          هویت محصولی، پیشنهاد هوشمند و مسیر خرید بدون اصطکاک در یک سطح دیداری واحد.
        </p>
        <div className="auth-marquee mt-4">
          <div className="auth-marquee-track">
            <span>ارسال کمتر از 24 ساعت</span>
            <span>تضمین اصالت کالا</span>
            <span>پیشنهاد شخصی‌سازی‌شده AI</span>
            <span>پشتیبانی 24/7</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {promoBanners.map((item) => (
          <Link key={item.title} href={item.href} className="auth-banner-tile">
            <p className="text-xs text-orange-700">{item.title}</p>
            <p className="mt-1 text-sm text-slate-700">{item.subtitle}</p>
          </Link>
        ))}
      </div>
    </aside>
  );
}
