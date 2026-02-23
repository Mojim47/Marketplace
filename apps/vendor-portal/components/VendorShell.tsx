import Link from 'next/link';
import type { ReactNode } from 'react';

const nav = [
  { href: '/dashboard', label: 'داشبورد' },
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
          <div className="vendor-muted">NextGen Vendor Portal</div>
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
