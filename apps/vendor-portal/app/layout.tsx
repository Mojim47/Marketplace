// ═══════════════════════════════════════════════════════════════════════════
// Vendor Portal - Root Layout
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NextGen Marketplace - Vendor Portal',
  description: 'Vendor dashboard for NextGen Marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
