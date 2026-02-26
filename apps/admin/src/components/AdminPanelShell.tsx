import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Bell, Command, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const nav = [
  { href: '/', label: 'داشبورد' },
  { href: '/users', label: 'کاربران' },
  { href: '/vendors', label: 'فروشندگان' },
  { href: '/orders', label: 'سفارش ها' },
  { href: '/products', label: 'محصولات' },
  { href: '/categories', label: 'دسته بندی' },
  { href: '/reports', label: 'گزارش ها' },
  { href: '/settings', label: 'تنظیمات' },
];

export function AdminPanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="admin-card rounded-3xl p-6">
          <div className="mb-5 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="admin-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
              <Command size={14} />
              Admin Command
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
              <Search size={15} className="text-slate-400" />
              <input
                aria-label="global admin search"
                placeholder="جستجوی جهانی سرویس، کاربر، سفارش..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                System Stable
              </span>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                3 Alerts
              </span>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 p-2 text-slate-200"
                aria-label="admin alerts"
                aria-busy="false"
              >
                <Bell size={14} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs text-slate-300">Admin Control Center</p>
              <h1
                className="admin-title mt-2 text-3xl text-white"
                data-testid="admin-dashboard-title"
              >
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
            </div>
            <LocaleSwitch />
          </div>

          <nav
            className="mt-5 grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8"
            aria-label="admin navigation"
            data-keyboard-nav="enabled"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/10 px-3 py-2 text-center text-slate-200 transition hover:border-amber-400/30 hover:bg-amber-300/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <section className="mt-6">{children}</section>
      </div>
    </div>
  );
}
