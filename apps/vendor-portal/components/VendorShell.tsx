import Link from 'next/link';
import type { ReactNode } from 'react';

const nav = [
  { href: '/dashboard', label: 'داشبورد' },
  { href: '/stories', label: 'استوری ها' },
  { href: '/products', label: 'محصولات' },
  { href: '/orders', label: 'سفارش ها' },
  { href: '/wallet', label: 'کیف پول' },
  { href: '/analytics', label: 'تحلیل' },
  { href: '/settings', label: 'تنظیمات' },
];

export function VendorShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="vendor-shell">
      <div className="vendor-wrap">
        <header className="vendor-card vendor-header">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="vendor-muted">Vendor Operations Center</div>
            <div className="flex gap-2">
              <span className="vendor-status success">SLA 99.8%</span>
              <span className="vendor-status info">Orders +18</span>
              <span className="vendor-status warning">Low Stock 6</span>
            </div>
          </div>
          <h1 className="vendor-title">{title}</h1>
          <p className="vendor-subtitle">{subtitle}</p>
          <nav className="vendor-nav" aria-label="vendor navigation">
            {nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        {children}
      </div>
    </div>
  );
}
