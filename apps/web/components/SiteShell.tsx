'use client';

import {
  ChevronDown,
  Cpu,
  Home,
  Menu,
  Smartphone,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { AuthNavButton } from '@/components/AuthNavButton';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { SearchBox } from '@/components/SearchBox';
import { Container } from '@/components/ui/Container';
import { l1Categories } from '@/lib/aimarket-taxonomy';

const topNav = [
  { href: '/', label: 'خانه' },
  { href: '/cart', label: 'سبد خرید' },
  { href: '/checkout', label: 'تسویه' },
  { href: '/orders', label: 'سفارش‌ها' },
  { href: '/profile', label: 'پروفایل' },
  { href: '/about', label: 'درباره ما' },
];

const statusItems = [
  { label: 'SLA پلتفرم', value: '99.95%' },
  { label: 'میانگین ارسال', value: 'کمتر از 24 ساعت' },
  { label: 'پشتیبانی', value: '24/7' },
];

const categoryIcons: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  'smart-home': Home,
  compute: Cpu,
  'audio-video': Tv,
};

const footerGroups = [
  {
    title: 'خرید',
    items: [
      { href: '/categories', label: 'همه دسته‌بندی‌ها' },
      { href: '/cart', label: 'سبد خرید' },
      { href: '/checkout', label: 'تسویه حساب' },
    ],
  },
  {
    title: 'حساب کاربری',
    items: [
      { href: '/auth/login', label: 'ورود' },
      { href: '/auth/register', label: 'ثبت‌نام' },
      { href: '/orders', label: 'پیگیری سفارش' },
    ],
  },
  {
    title: 'اعتماد و قوانین',
    items: [
      { href: '/privacy-policy', label: 'حریم خصوصی' },
      { href: '/terms-of-service', label: 'شرایط استفاده' },
      { href: '/about', label: 'درباره AIMarket' },
    ],
  },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const quickLinks = useMemo(() => topNav.slice(0, 4), []);
  const heroCategories = useMemo(() => l1Categories.slice(0, 4), []);
  const megaCategories = useMemo(
    () =>
      l1Categories.slice(0, 4).map((category) => ({
        id: category.key,
        title: category.name,
        href: `/categories?group=${encodeURIComponent(category.slug)}`,
        icon: categoryIcons[category.slug] ?? Smartphone,
        items: (category.children ?? []).slice(0, 3).map((sub) => ({
          label: sub.name,
          href: `/categories?group=${encodeURIComponent(category.slug)}&level=${encodeURIComponent(sub.slug)}`,
        })),
      })),
    []
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="border-b border-white/10 bg-white/[0.03]">
          <Container className="flex flex-wrap items-center gap-3 py-2 text-xs text-slate-300">
            {statusItems.map((item) => (
              <span key={item.label} className="rounded-full border border-white/10 px-3 py-1">
                <strong className="text-white">{item.value}</strong>
                <span className="mx-1">•</span>
                <span>{item.label}</span>
              </span>
            ))}
          </Container>
        </div>

        <Container className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <button
              aria-label={mobileOpen ? 'بستن منو' : 'باز کردن منو'}
              className="rounded-xl border border-white/15 p-2 text-slate-200 lg:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              type="button"
              aria-busy="false"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <Link href="/" className="section-title text-lg text-white sm:text-xl">
              AIMarket
            </Link>

            <span className="hidden rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-200 sm:inline-flex">
              AIMarket 2026
            </span>
          </div>

          <div className="hidden flex-1 lg:block">
            <SearchBox />
          </div>

          <div className="flex items-center gap-2">
            <LocaleSwitch />
            <AuthNavButton />
          </div>
        </Container>

        <Container className="hidden items-center justify-between gap-4 pb-4 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/5"
              aria-expanded={megaOpen}
              aria-haspopup="menu"
            >
              دسته‌بندی‌ها
              <ChevronDown size={14} className={`${megaOpen ? 'rotate-180' : ''} transition-transform`} />
            </button>

            {megaOpen ? (
              <div className="absolute right-0 top-11 z-50 w-[760px] rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl">
                <div className="grid grid-cols-4 gap-3">
                  {megaCategories.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <Link href={group.href} className="inline-flex items-center gap-2 text-sm text-white">
                        <group.icon size={16} className="text-cyan-300" />
                        {group.title}
                      </Link>
                      <ul className="mt-3 space-y-2 text-xs text-slate-300">
                        {group.items.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} className="transition hover:text-cyan-200">
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Promotion: دسته‌های منتخب این هفته با اولویت نمایش بالا فعال هستند.
                </div>
              </div>
            ) : null}
          </div>

          <nav aria-label="main navigation" className="flex flex-wrap gap-2 text-sm text-slate-200" data-keyboard-nav="true">
            {topNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-white/25 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">
            <Sparkles size={14} className="text-amber-300" />
            <span>AIMarket Search-First + AI Recommender فعال است</span>
          </div>
        </Container>

        {mobileOpen && (
          <Container className="pb-4 lg:hidden">
            <div className="mb-3">
              <SearchBox compact />
            </div>

            <nav aria-label="mobile navigation" className="grid grid-cols-2 gap-2" data-keyboard-nav="true">
              {topNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-100"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
              {heroCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/categories?group=${encodeURIComponent(category.slug)}`}
                  className="rounded-xl border border-white/10 px-3 py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </Container>
        )}
      </header>

      <main className="min-h-[calc(100vh-260px)]">{children}</main>

      <footer className="mt-20 border-t border-white/10 bg-slate-950/90">
        <Container className="grid gap-8 py-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <h2 className="section-title text-xl text-white">AIMarket</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              زیرساخت تجارت نسل بعد برای خرید هوشمند، تجربه AR و عملیات پایدار در مقیاس سازمانی.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-white/10 px-3 py-1"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-white">{group.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link className="transition hover:text-white" href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
      </footer>
    </>
  );
}
