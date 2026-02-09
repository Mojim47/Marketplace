import './design-tokens.css';
import './globals.css';
import { Vazirmatn, Fraunces } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

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
  title: 'NextGen Admin',
  description: 'Admin Panel',
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
