import Link from 'next/link';
import type { ReactNode } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch';

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs text-slate-300">Admin Control Center</p>
              <h1 className="admin-title mt-2 text-3xl text-white" data-testid="admin-dashboard-title">
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
            </div>
            <LocaleSwitch />
          </div>

          <nav
            className="mt-5 flex flex-wrap gap-2 text-sm"
            aria-label="admin navigation"
            data-keyboard-nav="enabled"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/10 px-3 py-1.5 text-slate-200 transition hover:border-white/20 hover:bg-white/5"
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
