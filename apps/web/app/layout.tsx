import './design-tokens.css';
import './globals.css';
import type { Metadata } from 'next';
import { Fraunces, Vazirmatn } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  title: 'NextGen Marketplace',
  description: 'Modern marketplace for vendors and customers',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = cookies().get('NG_LOCALE')?.value ?? 'fa';
  const isRtl = locale.startsWith('fa');
  return (
    <html lang={isRtl ? 'fa' : 'en'} dir={isRtl ? 'rtl' : 'ltr'} data-locale={locale}>
      <body className={`${vazirmatn.variable} ${fraunces.variable} antialiased`}>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
