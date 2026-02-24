import './design-tokens.css';
import './globals.css';
import type { Metadata } from 'next';
import { Readex_Pro, Vazirmatn } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { RuntimeThemeAgent } from '@/components/RuntimeThemeAgent';
import { SiteShell } from '@/components/SiteShell';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

const readex = Readex_Pro({
  subsets: ['latin', 'arabic'],
  display: 'swap',
  variable: '--font-readex',
});

export const metadata: Metadata = {
  title: 'AIMarket',
  description: 'AIMarket 2026 - AI-first production marketplace',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NG_LOCALE')?.value ?? 'fa';
  const isRtl = locale.startsWith('fa');
  return (
    <html lang={isRtl ? 'fa' : 'en'} dir={isRtl ? 'rtl' : 'ltr'} data-locale={locale}>
      <body className={`${vazirmatn.variable} ${readex.variable} antialiased`}>
        <AuthProvider>
          <RuntimeThemeAgent />
          <SiteShell>{children}</SiteShell>
        </AuthProvider>
      </body>
    </html>
  );
}
